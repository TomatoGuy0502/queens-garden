import { expect, it } from 'vitest'
import { io, type Socket } from 'socket.io-client'
import { randomUUID } from 'node:crypto'
import { createApp } from '../app'
import { generatePuzzle } from '../../src/queens/generator'
import type {
  ClientEvents,
  Credentials,
  RoomReply,
  RoomSnapshot,
  ServerEvents,
} from '../../shared/coop'
import type { StoredRoom } from '../model'
import { logicalHint } from '../../src/queens/difficulty'
import { workerPool } from '../compute'

it('real Socket.IO clients receive shared state, authorized operations and transient pointers', async () => {
  const records = new Map<string, StoredRoom>()
  const { app } = await createApp({
    repository: {
      get: (id) => Promise.resolve(structuredClone(records.get(id) ?? null)),
      save: (room) => {
        records.set(room.id, structuredClone(room))
        return Promise.resolve()
      },
      deleteExpired: () => Promise.resolve(),
    },
    compute: {
      generate: () => Promise.resolve(generatePuzzle({ size: 6, seed: 42, difficulty: 'easy' })),
      hint: (regions, cells) => Promise.resolve(logicalHint(regions, cells)),
      close: () => Promise.resolve(),
    },
  })
  const address = await app.listen({ port: 0, host: '127.0.0.1' })
  const created = await app.inject({
    method: 'POST',
    url: '/api/rooms',
    payload: { name: 'A', size: 6, difficulty: 'easy' },
  })
  const hostAccess = created.json<{ credentials: Credentials; state: RoomSnapshot }>()
  const host = hostAccess.credentials
  const gameId = hostAccess.state.game.id
  const joined = await app.inject({
    method: 'POST',
    url: `/api/rooms/${host.roomId}/join`,
    payload: { name: 'B' },
  })
  const guest = joined.json<{ credentials: Credentials }>().credentials
  function connect(auth: Credentials) {
    const socket: Socket<ServerEvents, ClientEvents> = io(address, {
      auth,
      transports: ['websocket'],
      forceNew: true,
      autoConnect: false,
    })
    return new Promise<Socket<ServerEvents, ClientEvents>>((resolve, reject) => {
      socket.once('connect', () => resolve(socket))
      socket.once('connect_error', reject)
      socket.connect()
    })
  }
  const a = await connect(host),
    b = await connect(guest)
  let current: RoomSnapshot | undefined
  b.on('room:state', (state) => {
    current = state
  })
  const send = (socket: typeof a, command: Parameters<ClientEvents['room:command']>[0]) =>
    new Promise<RoomReply>((resolve) => socket.emit('room:command', command, resolve))
  try {
    expect((await send(b, { type: 'start', actionId: randomUUID(), gameId })).ok).toBe(false)
    await send(a, { type: 'start', actionId: randomUUID(), gameId })
    await expect.poll(() => current?.game.phase).toBe('playing')
    const action = {
      type: 'setCell' as const,
      actionId: randomUUID(),
      gameId: current!.game.id,
      expectedVersion: 0,
      index: 0,
      nextState: 'queen' as const,
    }
    expect((await send(a, action)).ok).toBe(true)
    await expect.poll(() => current?.game.cells[0]).toBe('queen')
    expect((await send(a, action)).ok).toBe(true)
    expect((await send(b, { ...action, actionId: randomUUID() })).ok).toBe(false)
    const point = new Promise<number>((resolve) =>
      b.once('room:point', (value) => resolve(value.index)),
    )
    a.emit('room:point', { gameId: current!.game.id, index: 7 })
    expect(await point).toBe(7)
    const revision = current!.revision
    const hovering = new Promise<{ name: string; index: number | null }>((resolve) =>
      b.once('room:hover', resolve),
    )
    a.emit('room:hover', { gameId: current!.game.id, index: 8 })
    expect(await hovering).toMatchObject({ name: 'A', index: 8 })
    const cleared = new Promise<{ index: number | null }>((resolve) =>
      b.once('room:hover', resolve),
    )
    a.emit('room:hover', { gameId: current!.game.id, index: null })
    expect((await cleared).index).toBeNull()
    expect(current!.revision).toBe(revision)
    expect(JSON.stringify(current)).not.toMatch(/tokenHash|"solution"/)
  } finally {
    a.disconnect()
    b.disconnect()
    await app.close()
  }
})
it('runs the actual generator and deduction engine in a Node worker', async () => {
  const pool = workerPool(1)
  try {
    const puzzle = await pool.generate({ size: 6, seed: 42, difficulty: 'easy' })
    expect(puzzle.solution).toHaveLength(6)
    const hint = await pool.hint(puzzle.regions, Array(36).fill('empty'))
    expect(hint.step).toBeTruthy()
  } finally {
    await pool.close()
  }
})

it('static assets do not consume API limits and rate-limit errors remain HTTP 429', async () => {
  const { app } = await createApp({
    repository: {
      get: () => Promise.resolve(null),
      save: () => Promise.resolve(),
      deleteExpired: () => Promise.resolve(),
    },
    compute: {
      generate: () => Promise.reject(new Error('not used')),
      hint: () => Promise.resolve({ step: null, message: { key: 'hint.stuck' } }),
      close: () => Promise.resolve(),
    },
  })
  app.get('/assets/probe.js', () => 'export {}')
  try {
    for (let i = 0; i < 130; i++)
      expect((await app.inject('/assets/probe.js')).statusCode).toBe(200)
    for (let i = 0; i < 30; i++)
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/rooms',
            payload: { name: 'test', size: 6, difficulty: 'easy' },
          })
        ).statusCode,
      ).toBe(200)
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/rooms',
          payload: { name: 'test', size: 6, difficulty: 'easy' },
        })
      ).statusCode,
    ).toBe(429)
    expect((await app.inject('/api/health')).statusCode).toBe(200)
  } finally {
    await app.close()
  }
})

it('rate limits cannot be dodged by sending a forged X-Forwarded-For', async () => {
  const { app } = await createApp({
    repository: {
      get: () => Promise.resolve(null),
      save: () => Promise.resolve(),
      deleteExpired: () => Promise.resolve(),
    },
    compute: {
      generate: () => Promise.reject(new Error('not used')),
      hint: () => Promise.resolve({ step: null, message: { key: 'hint.stuck' } }),
      close: () => Promise.resolve(),
    },
  })
  try {
    const codes: number[] = []
    // The last entry is what the real proxy appended; the leading ones are the client's forgery.
    for (let i = 0; i < 40; i++)
      codes.push(
        (
          await app.inject({
            method: 'POST',
            url: '/api/rooms',
            headers: { 'x-forwarded-for': `10.0.${i}.1, 203.0.113.9` },
            payload: { name: 'test', size: 6, difficulty: 'easy' },
          })
        ).statusCode,
      )
    expect(codes.filter((code) => code === 429)).toHaveLength(10)
  } finally {
    await app.close()
  }
})

it('compiled workers ignore watch dependency messages and do not inherit development loaders or CLI-only flags', async () => {
  const { execFile } = await import('node:child_process')
  const { promisify } = await import('node:util')
  const { stdout } = await promisify(execFile)(
    process.execPath,
    [
      '--import',
      'tsx',
      '--input-type=module',
      '--eval',
      `
    import { workerPool } from './server/compute.ts';
    const pool = workerPool(1);
    try {
      const puzzle = await pool.generate({ size: 6, seed: 42, difficulty: 'easy' });
      console.log('generated:' + puzzle.size);
    } finally { await pool.close(); }
  `,
    ],
    { timeout: 10000, env: { ...process.env, WATCH_REPORT_DEPENDENCIES: '1' } },
  )
  expect(stdout).toContain('generated:6')
})

it('foreground computation preempts background generation on a single worker', async () => {
  const pool = workerPool(1)
  try {
    const background = pool
      .generateValidated({ size: 12, difficulty: 'hard', seed: 42 }, 'background')
      .catch((error: unknown) => error)
    const puzzle = await pool.generate({ size: 6, difficulty: 'easy', seed: 42 })
    expect(puzzle.size).toBe(6)
    expect(await background).toMatchObject({ code: 'BACKGROUND_PREEMPTED' })
    expect(pool.isIdle()).toBe(true)
    await expect(
      pool.validate({ ...puzzle, difficultyScore: -1 }, { size: 6, difficulty: 'easy', seed: 42 }),
    ).rejects.toMatchObject({ code: 'CATALOG_INVALID' })
  } finally {
    await pool.close()
  }
})
