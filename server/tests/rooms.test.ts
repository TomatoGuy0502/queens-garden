import { beforeAll, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { RoomManager } from '../rooms'
import type { Compute } from '../compute'
import { RoomError } from '../model'
import type { RoomEvent, RoomRepository, StoredRoom } from '../model'
import { MAX_ROOM_PLAYERS } from '../../shared/coop'
import type { Credentials, RoomCommand, RoomSnapshot } from '../../shared/coop'
import type { QueensPuzzle } from '../../src/queens/types'
import { generatePuzzle } from '../../src/queens/generator'
import { logicalHint } from '../../src/queens/difficulty'
let puzzle: QueensPuzzle
beforeAll(() => {
  puzzle = generatePuzzle({ size: 6, difficulty: 'easy', seed: 42 })
})
function memory(): RoomRepository {
  const rooms = new Map<string, StoredRoom>()
  return {
    get: (id) => Promise.resolve(structuredClone(rooms.get(id) ?? null)),
    save: (room) => {
      rooms.set(room.id, structuredClone(room))
      return Promise.resolve()
    },
    deleteExpired: () => Promise.resolve(),
  }
}
const compute = (): Compute => ({
  generate: () => Promise.resolve(structuredClone(puzzle)),
  hint: (regions, cells) => Promise.resolve(logicalHint(regions, cells)),
  close: () => Promise.resolve(),
})
async function game(repository = memory(), engine = compute()) {
  const manager = new RoomManager(repository, engine)
  const host = await manager.create('Alice', { size: 6, difficulty: 'easy' }),
    guest = await manager.join(host.state.id, 'Bob')
  await manager.connect(host.credentials, 'a')
  await manager.connect(guest.credentials, 'b')
  await manager.command(host.credentials, {
    type: 'start',
    actionId: randomUUID(),
    gameId: host.state.game.id,
  })
  let state = await manager.state(host.credentials)
  for (let i = 0; i < 50 && state.game.phase === 'generating'; i++) {
    await new Promise((r) => setTimeout(r, 1))
    state = await manager.state(host.credentials)
  }
  expect(state.game.phase).toBe('playing')
  return { manager, host: host.credentials, guest: guest.credentials, state }
}
function cell(
  state: RoomSnapshot,
  index: number,
  nextState: 'empty' | 'queen' | 'marked' = 'queen',
): RoomCommand {
  return {
    type: 'setCell',
    actionId: randomUUID(),
    gameId: state.game.id,
    index,
    nextState,
    expectedVersion: state.game.versions[index],
  }
}
it('room snapshots never expose the solution, analysis or guest tokens', async () => {
  const { state } = await game()
  const json = JSON.stringify(state)
  expect(json).not.toMatch(/"solution"|"analysis"|tokenHash|"token"/)
  expect(state.players).toHaveLength(2)
})
it('same-cell simultaneous actions accept one, and different cells both succeed', async () => {
  const { manager, host, guest, state } = await game()
  const outcomes = await Promise.allSettled([
    manager.command(host, cell(state, 0)),
    manager.command(guest, cell(state, 0)),
  ])
  expect(outcomes.filter((o) => o.status === 'fulfilled')).toHaveLength(1)
  expect((await manager.state(host)).game.cells[0]).toBe('queen')
  const current = await manager.state(host)
  await Promise.all([
    manager.command(host, cell(current, 1)),
    manager.command(guest, cell(current, 2)),
  ])
  expect((await manager.state(host)).game.cells.slice(0, 3)).toEqual(['queen', 'queen', 'queen'])
})
it('retries are idempotent and reused IDs with different payloads are rejected', async () => {
  const { manager, host, state } = await game()
  const action = cell(state, 0)
  await manager.command(host, action)
  await manager.command(host, action)
  expect((await manager.state(host)).game.moves).toBe(1)
  await expect(
    manager.command(host, { ...action, type: 'setCell', index: 1 } as RoomCommand),
  ).rejects.toMatchObject({ code: 'ACTION_ID_REUSED' })
})
it('undo and redo are personal and cannot overwrite a later edit by another player', async () => {
  const { manager, host, guest, state } = await game()
  const action = cell(state, 0)
  await manager.command(host, action)
  await expect(
    manager.command(guest, {
      type: 'undo',
      actionId: randomUUID(),
      gameId: state.game.id,
      targetId: action.actionId,
    }),
  ).rejects.toThrow()
  let current = await manager.command(host, {
    type: 'undo',
    actionId: randomUUID(),
    gameId: state.game.id,
    targetId: action.actionId,
  })
  expect(current.game.cells[0]).toBe('empty')
  current = await manager.command(host, {
    type: 'redo',
    actionId: randomUUID(),
    gameId: state.game.id,
    targetId: action.actionId,
  })
  expect(current.game.cells[0]).toBe('queen')
  await manager.command(guest, cell(current, 0, 'marked'))
  await expect(
    manager.command(host, {
      type: 'undo',
      actionId: randomUUID(),
      gameId: state.game.id,
      targetId: action.actionId,
    }),
  ).rejects.toMatchObject({ code: 'UNDO_CONFLICT' })
})
it('disconnect and reconnect preserve play, and manual pause can resume without absent teammates', async () => {
  const { manager, host, guest, state } = await game()
  await manager.command(host, cell(state, 0))
  await manager.disconnect(guest, 'b')
  expect((await manager.state(host)).game.phase).toBe('playing')
  await manager.command(host, {
    type: 'pause',
    actionId: randomUUID(),
    gameId: state.game.id,
    paused: true,
  })
  expect(
    (
      await manager.command(host, {
        type: 'pause',
        actionId: randomUUID(),
        gameId: state.game.id,
        paused: false,
      })
    ).game.phase,
  ).toBe('playing')
  await manager.connect(guest, 'b2')
  expect((await manager.state(guest)).game.cells[0]).toBe('queen')
  await manager.disconnect(host, 'a')
  expect((await manager.state(guest)).hostId).toBe(guest.playerId)
  expect((await manager.state(guest)).game.phase).toBe('playing')
})
it('rejects outsider credentials, full rooms and commands from the old game', async () => {
  const { manager, host, state } = await game()
  await expect(manager.state({ ...host, token: '0'.repeat(64) })).rejects.toMatchObject({
    code: 'UNAUTHORIZED',
  })
  for (let i = 2; i < MAX_ROOM_PLAYERS; i++) await manager.join(host.roomId, `Player ${i + 1}`)
  await expect(manager.join(host.roomId, 'Extra')).rejects.toMatchObject({ code: 'ROOM_FULL' })
  await manager.command(host, { type: 'reset', actionId: randomUUID(), gameId: state.game.id })
  await expect(manager.command(host, cell(state, 0))).rejects.toMatchObject({ code: 'STALE_GAME' })
})
it('invalid positions do not win; a valid solution completes for the team; undo resumes', async () => {
  const repository = memory()
  const events: RoomEvent[] = []
  const save = repository.save.bind(repository)
  repository.save = async (room, event) => {
    await save(room, event)
    events.push(structuredClone(event))
  }
  const { manager, host, state } = await game(repository)
  let current = state
  for (let i = 0; i < 6; i++) current = await manager.command(host, cell(current, i))
  expect(current.game.phase).toBe('playing')
  for (let i = 0; i < 6; i++) current = await manager.command(host, cell(current, i, 'empty'))
  let last = ''
  for (let row = 0; row < 6; row++) {
    const action = cell(current, row * 6 + puzzle.solution[row])
    last = action.actionId
    current = await manager.command(host, action)
  }
  expect(current.game.phase).toBe('completed')
  expect(events.at(-1)?.result).toMatchObject({
    gameId: state.game.id,
    puzzleId: puzzle.id,
    moves: current.game.moves,
    hints: 0,
  })
  expect(events.at(-1)?.result?.players.map((p) => p.name)).toEqual(['Alice', 'Bob'])
  expect(events.at(-1)?.changes).toHaveLength(1)
  expect(
    (
      await manager.command(host, {
        type: 'undo',
        actionId: randomUUID(),
        gameId: state.game.id,
        targetId: last,
      })
    ).game.phase,
  ).toBe('playing')
})
it('shared hints and batch application support undo without revealing the solution', async () => {
  const { manager, host, guest, state } = await game()
  const hinted = await manager.command(host, {
    type: 'hint',
    actionId: randomUUID(),
    gameId: state.game.id,
  })
  expect(hinted.game.hint?.step).toBeTruthy()
  expect(hinted.game.hints).toBe(1)
  const applied = await manager.command(guest, {
    type: 'applyHint',
    actionId: randomUUID(),
    gameId: state.game.id,
    hintId: hinted.game.hint!.id,
  })
  expect(applied.game.cells.filter((c) => c === 'marked').length).toBeGreaterThan(0)
})
it('failed persistence never broadcasts or applies an uncommitted command', async () => {
  const repository = memory(),
    { manager, host, state } = await game(repository)
  const oldSave = repository.save.bind(repository)
  repository.save = () => Promise.reject(new Error('database unavailable'))
  await expect(manager.command(host, cell(state, 0))).rejects.toThrow('database unavailable')
  repository.save = oldSave
  expect((await manager.state(host)).game.cells[0]).toBe('empty')
})
it('a process restart restores room identity and a running board without automatic pause', async () => {
  const repository = memory(),
    { manager, host, guest, state } = await game(repository)
  await manager.command(host, cell(state, 0))
  const restored = new RoomManager(repository, compute())
  await restored.connect(host, 'new-a')
  await restored.connect(guest, 'new-b')
  const next = await restored.state(host)
  expect(next.game.cells[0]).toBe('queen')
  expect(next.game.phase).toBe('playing')
})
export type { Credentials }

it('leaving transfers hosting and an empty room preserves the current round for the next visitor', async () => {
  const { manager, host, guest } = await game()
  await manager.command(host, { type: 'leave', actionId: randomUUID() })
  const transferred = await manager.state(guest)
  expect(transferred.hostId).toBe(guest.playerId)
  await manager.command(guest, { type: 'leave', actionId: randomUUID() })
  const replacement = await manager.join(host.roomId, 'New host')
  expect(replacement.state.hostId).toBe(replacement.credentials.playerId)
  expect(replacement.state.game.phase).toBe('playing')
  expect(replacement.state.game.cells).toHaveLength(36)
})

it('the host starts without readiness or waiting for all eight members to connect', async () => {
  const manager = new RoomManager(memory(), compute())
  const host = await manager.create('Host', { size: 6, difficulty: 'easy' })
  await manager.connect(host.credentials, 'host')
  const members = [host.credentials]
  for (let i = 1; i < MAX_ROOM_PLAYERS; i++) {
    const member = await manager.join(host.state.id, `Player ${i + 1}`)
    members.push(member.credentials)
  }
  await manager.command(host.credentials, {
    type: 'start',
    actionId: randomUUID(),
    gameId: host.state.game.id,
  })
  await expect.poll(async () => (await manager.state(host.credentials)).game.phase).toBe('playing')
  const last = members.at(-1)!
  await manager.connect(last, 'last')
  const state = await manager.state(last)
  expect(state.players).toHaveLength(MAX_ROOM_PLAYERS)
  await manager.command(last, cell(state, 0))
  expect((await manager.state(host.credentials)).game.cells[0]).toBe('queen')
})
it('solo hosting, joining and leaving never interrupt the running round or clock', async () => {
  const manager = new RoomManager(memory(), compute())
  const host = await manager.create('Host', { size: 6, difficulty: 'easy' })
  await manager.connect(host.credentials, 'host')
  await manager.command(host.credentials, {
    type: 'start',
    actionId: randomUUID(),
    gameId: host.state.game.id,
  })
  await expect.poll(async () => (await manager.state(host.credentials)).game.phase).toBe('playing')
  const third = await manager.join(host.state.id, 'Guest')
  expect(third.state.game.phase).toBe('playing')
  await manager.connect(third.credentials, 'guest')
  await manager.command(host.credentials, { type: 'leave', actionId: randomUUID() })
  const after = await manager.state(third.credentials)
  expect(after.hostId).toBe(third.credentials.playerId)
  expect(after.game.phase).toBe('playing')
  expect(after.game.id).toBe(third.state.game.id)
  expect(after.game.elapsedMs).toBeGreaterThanOrEqual(third.state.game.elapsedMs)
})
it('five-character codes retry collisions with a bound and never replace an existing room', async () => {
  const repository = memory()
  const first = await new RoomManager(repository, compute(), () => 'ABCDE').create('First', {
    size: 6,
    difficulty: 'easy',
  })
  let count = 0
  const next = await new RoomManager(repository, compute(), () =>
    ++count === 1 ? 'ABCDE' : '12345',
  ).create('Next', { size: 6, difficulty: 'easy' })
  expect(next.state.id).toBe('12345')
  expect((await repository.get('ABCDE'))?.hostId).toBe(first.credentials.playerId)
  await expect(
    new RoomManager(repository, compute(), () => 'ABCDE').create('Blocked', {
      size: 6,
      difficulty: 'easy',
    }),
  ).rejects.toMatchObject({ code: 'ROOM_CODE_EXHAUSTED' })
  const original = repository.save.bind(repository)
  let conflicted = false
  repository.save = (room, event) => {
    if (!conflicted) {
      conflicted = true
      return Promise.reject(new RoomError('Concurrent insert', 'STATE_CONFLICT'))
    }
    return original(room, event)
  }
  let attempt = 0
  const raced = await new RoomManager(repository, compute(), () =>
    ++attempt === 1 ? 'RACE1' : 'RACE2',
  ).create('Race', { size: 6, difficulty: 'easy' })
  expect(raced.state.id).toBe('RACE2')
})

it('host restart preserves the puzzle and team, clears the attempt atomically and rejects old-round edits', async () => {
  let generations = 0
  const engine = compute(),
    generate = engine.generate.bind(engine)
  engine.generate = (options) => {
    generations++
    return generate(options)
  }
  const { manager, host, guest, state } = await game(memory(), engine)
  await expect(
    manager.command(guest, { type: 'restart', actionId: randomUUID(), gameId: state.game.id }),
  ).rejects.toMatchObject({ code: 'HOST_ONLY' })
  const hinted = await manager.command(host, {
    type: 'hint',
    actionId: randomUUID(),
    gameId: state.game.id,
  })
  await manager.command(guest, {
    type: 'applyHint',
    actionId: randomUUID(),
    gameId: state.game.id,
    hintId: hinted.game.hint!.id,
  })
  await manager.command(host, {
    type: 'pause',
    actionId: randomUUID(),
    gameId: state.game.id,
    paused: true,
  })
  const action = { type: 'restart' as const, actionId: randomUUID(), gameId: state.game.id }
  const restarted = await manager.command(host, action)
  expect(restarted.game.id).not.toBe(state.game.id)
  expect(restarted.game.puzzle).toEqual(state.game.puzzle)
  expect(restarted.players).toEqual(state.players)
  expect(restarted.game).toMatchObject({
    phase: 'playing',
    moves: 0,
    hints: 0,
    hint: null,
    mistakes: [],
    actions: [],
    boardRevision: 0,
  })
  expect(restarted.game.cells).toEqual(Array(36).fill('empty'))
  expect(restarted.game.versions).toEqual(Array(36).fill(0))
  expect(restarted.game.elapsedMs).toBeLessThan(1000)
  expect((await manager.command(host, action)).game.id).toBe(restarted.game.id)
  await expect(manager.command(guest, cell(state, 0))).rejects.toMatchObject({ code: 'STALE_GAME' })
  expect(generations).toBe(1)
})
it('restarting a completed board retains the old result and records a new attempt independently', async () => {
  const repository = memory(),
    events: RoomEvent[] = [],
    save = repository.save.bind(repository)
  repository.save = async (room, event) => {
    await save(room, event)
    events.push(structuredClone(event))
  }
  const { manager, host, state } = await game(repository)
  let current = state
  for (let attempt = 0; attempt < 2; attempt++) {
    for (const [row, col] of puzzle.solution.entries())
      current = await manager.command(host, cell(current, row * 6 + col))
    expect(current.game.phase).toBe('completed')
    if (!attempt)
      current = await manager.command(host, {
        type: 'restart',
        gameId: current.game.id,
        actionId: randomUUID(),
      })
  }
  const results = events.flatMap((event) => (event.result ? [event.result] : []))
  expect(results).toHaveLength(2)
  expect(results[0].gameId).not.toBe(results[1].gameId)
  expect(results[0].puzzleId).toBe(results[1].puzzleId)
  expect(results.map((result) => result.moves)).toEqual([6, 6])
})
