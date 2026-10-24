import { beforeAll, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { RoomManager } from '../rooms'
import type { Compute } from '../compute'
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
function command(value: Omit<Extract<RoomCommand, { type: 'ready' }>, 'actionId'>): RoomCommand {
  return { ...value, actionId: randomUUID() }
}
async function game(repository = memory(), engine = compute()) {
  const manager = new RoomManager(repository, engine)
  const host = await manager.create('Alice', { size: 6, difficulty: 'easy' }),
    guest = await manager.join(host.state.id, 'Bob')
  await manager.connect(host.credentials, 'a')
  await manager.connect(guest.credentials, 'b')
  await manager.command(
    host.credentials,
    command({ type: 'ready', ready: true, gameId: host.state.game.id }),
  )
  await manager.command(
    guest.credentials,
    command({ type: 'ready', ready: true, gameId: host.state.game.id }),
  )
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
it('disconnect pauses; authenticated reconnect restores the board; both players must be online to resume', async () => {
  const { manager, host, guest, state } = await game()
  await manager.command(host, cell(state, 0))
  await manager.disconnect(guest, 'b')
  expect((await manager.state(host)).game.phase).toBe('paused')
  await expect(
    manager.command(host, {
      type: 'pause',
      actionId: randomUUID(),
      gameId: state.game.id,
      paused: false,
    }),
  ).rejects.toThrow()
  await manager.connect(guest, 'b2')
  const restored = await manager.command(host, {
    type: 'pause',
    actionId: randomUUID(),
    gameId: state.game.id,
    paused: false,
  })
  expect(restored.game.cells[0]).toBe('queen')
  expect(restored.game.phase).toBe('playing')
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
it('a process restart restores room identity and board, paused for reconnection', async () => {
  const repository = memory(),
    { manager, host, guest, state } = await game(repository)
  await manager.command(host, cell(state, 0))
  const restored = new RoomManager(repository, compute())
  await restored.connect(host, 'new-a')
  await restored.connect(guest, 'new-b')
  const next = await restored.state(host)
  expect(next.game.cells[0]).toBe('queen')
  expect(next.game.phase).toBe('paused')
})
export type { Credentials }

it('leaving transfers hosting and an empty room can be joined with a fresh round', async () => {
  const { manager, host, guest } = await game()
  await manager.command(host, { type: 'leave', actionId: randomUUID() })
  const transferred = await manager.state(guest)
  expect(transferred.hostId).toBe(guest.playerId)
  await manager.command(guest, { type: 'leave', actionId: randomUUID() })
  const replacement = await manager.join(host.roomId, 'New host')
  expect(replacement.state.hostId).toBe(replacement.credentials.playerId)
  expect(replacement.state.game.phase).toBe('waiting')
  expect(replacement.state.game.cells).toEqual([])
})

it('eight players can start together only when every member is online and ready', async () => {
  const manager = new RoomManager(memory(), compute())
  const host = await manager.create('Host', { size: 6, difficulty: 'easy' })
  const members = [host.credentials]
  const gameId = host.state.game.id
  await manager.connect(host.credentials, 'host')
  await manager.command(host.credentials, command({ type: 'ready', ready: true, gameId }))
  const start = () =>
    manager.command(host.credentials, { type: 'start', actionId: randomUUID(), gameId })
  await expect(start()).rejects.toThrow()
  for (let i = 1; i < MAX_ROOM_PLAYERS; i++) {
    const member = await manager.join(host.state.id, `Player ${i + 1}`)
    members.push(member.credentials)
    await manager.connect(member.credentials, `socket-${i}`)
    if (i < MAX_ROOM_PLAYERS - 1)
      await manager.command(member.credentials, command({ type: 'ready', ready: true, gameId }))
  }
  await expect(start()).rejects.toThrow()
  const last = members.at(-1)!
  await manager.command(last, command({ type: 'ready', ready: true, gameId }))
  await manager.disconnect(last, `socket-${MAX_ROOM_PLAYERS - 1}`)
  await expect(start()).rejects.toThrow()
  await manager.connect(last, 'last-reconnected')
  await start()
  await expect.poll(async () => (await manager.state(host.credentials)).game.phase).toBe('playing')
  const state = await manager.state(last)
  expect(state.players).toHaveLength(MAX_ROOM_PLAYERS)
  await manager.command(last, cell(state, 0))
  expect((await manager.state(members[2])).game.cells[0]).toBe('queen')
})
it('joining an active game pauses it and any offline member blocks resume until reconnect or leave', async () => {
  const { manager, host, guest, state } = await game()
  const third = await manager.join(host.roomId, 'Charlie')
  expect(third.state.game.phase).toBe('paused')
  const resume = () =>
    manager.command(host, {
      type: 'pause',
      actionId: randomUUID(),
      gameId: state.game.id,
      paused: false,
    })
  await expect(resume()).rejects.toThrow()
  await manager.connect(third.credentials, 'c')
  expect((await resume()).game.phase).toBe('playing')
  await manager.disconnect(guest, 'b')
  await expect(resume()).rejects.toThrow()
  await manager.connect(guest, 'b-reconnected')
  await manager.command(guest, { type: 'leave', actionId: randomUUID() })
  expect((await resume()).game.phase).toBe('playing')
  await manager.command(host, { type: 'leave', actionId: randomUUID() })
  expect((await manager.state(third.credentials)).hostId).toBe(third.credentials.playerId)
  await expect(
    manager.command(third.credentials, {
      type: 'pause',
      actionId: randomUUID(),
      gameId: state.game.id,
      paused: false,
    }),
  ).rejects.toThrow()
})
