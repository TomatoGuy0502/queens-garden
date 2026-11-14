import { beforeAll, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { RoomManager } from '../rooms'
import type { Compute } from '../compute'
import { RoomError } from '../model'
import type { RoomEvent, RoomRepository, StoredRoom } from '../model'
import { MAX_ROOM_PLAYERS } from '../../shared/coop'
import type { Credentials, RoomCommand, RoomMode, RoomSnapshot } from '../../shared/coop'
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
  generate3d: () => Promise.reject(new Error('unused')),
  hint3d: () => Promise.reject(new Error('unused')),
  hint: (regions, cells) => Promise.resolve(logicalHint(regions, cells)),
  close: () => Promise.resolve(),
})
async function deepen(
  manager: RoomManager,
  who: Parameters<RoomManager['command']>[0],
  gameId: string,
  times: number,
  start?: Awaited<ReturnType<RoomManager['command']>>,
) {
  let snapshot = start
  for (let i = 0; i < times; i++)
    snapshot = await manager.command(who, { type: 'hint', actionId: randomUUID(), gameId })
  return snapshot!
}
async function game(repository = memory(), engine = compute(), mode: RoomMode = 'coop') {
  const manager = new RoomManager(repository, engine)
  const host = await manager.create('Alice', { size: 6, difficulty: 'easy' }, mode),
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
  const first = await manager.command(host, {
    type: 'hint',
    actionId: randomUUID(),
    gameId: state.game.id,
  })
  expect(first.game.hint?.step).toBeTruthy()
  expect(first.game.hint?.level).toBe(1)
  expect(first.game.hints).toBe(1)
  const hinted = await deepen(manager, host, state.game.id, 2)
  expect(hinted.game.hint?.level).toBe(3)
  expect(hinted.game.hints).toBe(3)
  const applied = await manager.command(guest, {
    type: 'applyHint',
    actionId: randomUUID(),
    gameId: state.game.id,
    hintId: hinted.game.hint!.id,
  })
  expect(applied.game.cells.filter((c) => c === 'marked').length).toBeGreaterThan(0)
})
it('a shared hint is revealed one level at a time for the whole room and counted per level', async () => {
  const { manager, host, guest, state } = await game()
  const send = (who: typeof host) =>
    manager.command(who, { type: 'hint', actionId: randomUUID(), gameId: state.game.id })
  const first = await send(host)
  const id = first.game.hint!.id
  const second = await send(guest)
  expect(second.game.hint).toMatchObject({ id, level: 2 })
  expect(second.game.hints).toBe(2)
  await expect(
    manager.command(guest, {
      type: 'applyHint',
      actionId: randomUUID(),
      gameId: state.game.id,
      hintId: id,
    }),
  ).rejects.toMatchObject({ code: 'HINT_NOT_REVEALED' })
  const third = await send(host)
  expect(third.game.hint).toMatchObject({ id, level: 3 })
  // The answer is already shown: asking again changes and counts nothing.
  const again = await send(guest)
  expect(again.game.hint).toMatchObject({ id, level: 3 })
  expect(again.game.hints).toBe(3)
  await manager.command(guest, {
    type: 'applyHint',
    actionId: randomUUID(),
    gameId: state.game.id,
    hintId: id,
  })
})
it('editing the board starts the next shared hint from the first level again', async () => {
  const { manager, host, state } = await game()
  const send = () =>
    manager.command(host, { type: 'hint', actionId: randomUUID(), gameId: state.game.id })
  await send()
  expect((await send()).game.hint?.level).toBe(2)
  const edited = await manager.command(host, cell(state, 35))
  expect(edited.game.hint).toBeNull()
  const fresh = await send()
  expect(fresh.game.hint?.level).toBe(1)
  expect(fresh.game.hints).toBe(3)
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
      return Promise.reject(new RoomError('STATE_CONFLICT'))
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
  const hinted = await deepen(
    manager,
    host,
    state.game.id,
    2,
    await manager.command(host, { type: 'hint', actionId: randomUUID(), gameId: state.game.id }),
  )
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

it('a long round keeps playing while old moves and receipts are dropped', async () => {
  const { manager, host, state } = await game()
  let latest = state
  for (let i = 0; i < 1100; i++) {
    const command = cell(latest, 0, i % 2 ? 'empty' : 'marked')
    latest = await manager.command(host, command)
  }
  expect(latest.game.actions).toHaveLength(300)
  expect(latest.game.moves).toBe(1100)
  const undone = await manager.command(host, {
    type: 'undo',
    actionId: randomUUID(),
    gameId: latest.game.id,
    targetId: latest.game.actions.at(-1)!.id,
  })
  expect(undone.game.cells[0]).toBe('marked')
})
it('a room runs one generation and one fresh hint at a time, so reset loops cannot flood compute', async () => {
  let generations = 0
  const manager = new RoomManager(memory(), {
    ...compute(),
    generate: () => {
      generations++
      return new Promise<QueensPuzzle>(() => undefined)
    },
  })
  const host = await manager.create('Alice', { size: 6, difficulty: 'easy' })
  await manager.connect(host.credentials, 'a')
  const started = await manager.command(host.credentials, {
    type: 'start',
    actionId: randomUUID(),
    gameId: host.state.game.id,
  })
  const reset = await manager.command(host.credentials, {
    type: 'reset',
    actionId: randomUUID(),
    gameId: started.game.id,
  })
  await expect(
    manager.command(host.credentials, {
      type: 'start',
      actionId: randomUUID(),
      gameId: reset.game.id,
    }),
  ).rejects.toMatchObject({ code: 'CANNOT_START' })
  expect(generations).toBe(1)

  let hints = 0
  const {
    manager: playing,
    host: player,
    state,
  } = await game(memory(), {
    ...compute(),
    hint: () => {
      hints++
      return new Promise(() => undefined)
    },
  })
  void playing.command(player, { type: 'hint', actionId: randomUUID(), gameId: state.game.id })
  await new Promise((r) => setTimeout(r, 1))
  await expect(
    playing.command(player, { type: 'hint', actionId: randomUUID(), gameId: state.game.id }),
  ).rejects.toMatchObject({ code: 'COMPUTE_BUSY' })
  expect(hints).toBe(1)
})

const duelBoard = (state: RoomSnapshot, cells: ('empty' | 'queen' | 'marked')[]): RoomCommand => ({
  type: 'duelBoard',
  actionId: randomUUID(),
  gameId: state.game.id,
  cells,
})
const solved = () => {
  const cells = Array<'empty' | 'queen'>(36).fill('empty')
  puzzle.solution.forEach((col, row) => (cells[row * 6 + col] = 'queen'))
  return cells
}
it('a duel starts only with two players and holds no more than two', async () => {
  const manager = new RoomManager(memory(), compute())
  const host = await manager.create('Alice', { size: 6, difficulty: 'easy' }, 'duel')
  expect(host.state.mode).toBe('duel')
  await manager.connect(host.credentials, 'a')
  const start = (gameId: string): RoomCommand => ({ type: 'start', actionId: randomUUID(), gameId })
  await expect(manager.command(host.credentials, start(host.state.game.id))).rejects.toMatchObject({
    code: 'CANNOT_START',
  })
  await manager.join(host.state.id, 'Bob')
  await expect(manager.join(host.state.id, 'Carol')).rejects.toMatchObject({ code: 'ROOM_FULL' })
  await manager.command(host.credentials, start(host.state.game.id))
})
it('a duel counts covered rows and columns, wrong or not, and a board only goes back to its owner', async () => {
  const { manager, host, guest, state } = await game(memory(), compute(), 'duel')
  const board = Array<'empty' | 'queen' | 'marked'>(36).fill('empty')
  // Three queens in one row cover one row, however many columns they use.
  ;[0, 1, 2].forEach((i) => (board[i] = 'queen'))
  const mine = await manager.command(host, duelBoard(state, board))
  expect(mine.game.duel?.progress[host.playerId]).toBe(1)
  expect(mine.game.duel?.mine).toEqual(board)
  board[7] = 'queen'
  board[14] = 'queen'
  expect((await manager.command(host, duelBoard(state, board))).game.duel?.progress).toMatchObject({
    [host.playerId]: 3,
    [guest.playerId]: 0,
  })
  const theirs = await manager.state(guest)
  expect(theirs.game.duel?.mine).toBeUndefined()
  expect(theirs.game.duel?.progress[host.playerId]).toBe(3)
  const broadcasts: RoomSnapshot[] = []
  manager.onState = (next) => broadcasts.push(next)
  await manager.command(
    host,
    duelBoard(
      state,
      board.map(() => 'empty'),
    ),
  )
  expect(broadcasts.length).toBeGreaterThan(0)
  expect(JSON.stringify(broadcasts)).not.toContain('"mine"')
  expect(JSON.stringify(await manager.state(guest))).not.toContain('queen')
})
it('the first correct board wins the duel and a late board changes nothing', async () => {
  const { manager, host, guest, state } = await game(memory(), compute(), 'duel')
  const wrong = solved()
  // One queen too many is never a solution, wherever the solution's queens are.
  wrong[wrong.indexOf('empty')] = 'queen'
  expect((await manager.command(host, duelBoard(state, wrong))).game.phase).toBe('playing')
  const won = await manager.command(guest, duelBoard(state, solved()))
  expect(won.game.phase).toBe('completed')
  expect(won.game.duel?.winnerId).toBe(guest.playerId)
  const late = await manager.command(host, duelBoard(state, solved()))
  expect(late.game.duel).toMatchObject({ winnerId: guest.playerId })
})
it('a finished duel starts again on the same settings once both players ask', async () => {
  const { manager, host, guest, state } = await game(memory(), compute(), 'duel')
  const rematch = (gameId: string): RoomCommand => ({
    type: 'rematch',
    actionId: randomUUID(),
    gameId,
  })
  await expect(manager.command(host, rematch(state.game.id))).rejects.toMatchObject({
    code: 'CANNOT_START',
  })
  const won = await manager.command(guest, duelBoard(state, solved()))
  const asked = await manager.command(host, rematch(won.game.id))
  expect(asked.game.phase).toBe('completed')
  expect(asked.game.duel?.rematch).toEqual([host.playerId])
  // Asking twice is still one vote.
  expect((await manager.command(host, rematch(won.game.id))).game.duel?.rematch).toEqual([
    host.playerId,
  ])
  const again = await manager.command(guest, rematch(won.game.id))
  expect(again.game.id).not.toBe(won.game.id)
  expect(again.game.duel).toMatchObject({ winnerId: null, rematch: [] })
  let next = await manager.state(host)
  for (let i = 0; i < 50 && next.game.phase === 'generating'; i++) {
    await new Promise((r) => setTimeout(r, 1))
    next = await manager.state(host)
  }
  expect(next.game.phase).toBe('playing')
  expect(next.settings).toEqual(state.settings)
  expect(next.game.duel?.progress).toEqual({ [host.playerId]: 0, [guest.playerId]: 0 })
})
it('a rematch needs the opponent still in the room, and a co-op room has none', async () => {
  const duel = await game(memory(), compute(), 'duel')
  const won = await duel.manager.command(duel.guest, duelBoard(duel.state, solved()))
  await duel.manager.command(duel.guest, {
    type: 'rematch',
    actionId: randomUUID(),
    gameId: won.game.id,
  })
  const left = await duel.manager.command(duel.guest, { type: 'leave', actionId: randomUUID() })
  expect(left.game.duel?.rematch).toEqual([])
  await expect(
    duel.manager.command(duel.host, {
      type: 'rematch',
      actionId: randomUUID(),
      gameId: won.game.id,
    }),
  ).rejects.toMatchObject({ code: 'CANNOT_START' })
  const coop = await game()
  await expect(
    coop.manager.command(coop.host, {
      type: 'rematch',
      actionId: randomUUID(),
      gameId: coop.state.game.id,
    }),
  ).rejects.toMatchObject({ code: 'INVALID_ACTION' })
})
it('a duel offers no hints, checks, pause, shared edits or restart, and a co-op room no duel boards', async () => {
  const { manager, host, state } = await game(memory(), compute(), 'duel')
  const gameId = state.game.id
  for (const command of [
    { type: 'hint' },
    { type: 'check' },
    { type: 'pause', paused: true },
    { type: 'restart' },
    { type: 'setCell', index: 0, expectedVersion: 0, nextState: 'queen' },
  ] as const)
    await expect(
      manager.command(host, { ...command, actionId: randomUUID(), gameId }),
    ).rejects.toMatchObject({ code: 'INVALID_ACTION' })
  await expect(manager.command(host, duelBoard(state, ['queen']))).rejects.toMatchObject({
    code: 'INVALID_INPUT',
  })
  const coop = await game()
  await expect(
    coop.manager.command(coop.host, duelBoard(coop.state, solved())),
  ).rejects.toMatchObject({ code: 'INVALID_ACTION' })
})
it('leaving a duel in progress forfeits it, and the host can open the next round', async () => {
  const { manager, host, guest, state } = await game(memory(), compute(), 'duel')
  const left = await manager.command(guest, { type: 'leave', actionId: randomUUID() })
  expect(left.game.phase).toBe('completed')
  expect(left.game.duel?.winnerId).toBe(host.playerId)
  const next = await manager.command(host, {
    type: 'reset',
    actionId: randomUUID(),
    gameId: state.game.id,
  })
  expect(next.game).toMatchObject({ phase: 'waiting', duel: { winnerId: null, progress: {} } })
})
it('a newcomer to a duel lands in the lobby instead of the last result', async () => {
  const { manager, host, guest } = await game(memory(), compute(), 'duel')
  await manager.command(guest, { type: 'leave', actionId: randomUUID() })
  expect((await manager.state(host)).game.phase).toBe('completed')
  const carol = await manager.join(host.roomId, 'Carol')
  expect(carol.state.game).toMatchObject({ phase: 'waiting', duel: { winnerId: null } })
  expect(carol.state.players).toHaveLength(2)
  expect((await manager.state(host)).game.phase).toBe('waiting')
})
it('leaving a duel while its puzzle is being prepared cancels the round', async () => {
  const stuck: Compute = { ...compute(), generate: () => new Promise(() => undefined) }
  const manager = new RoomManager(memory(), stuck)
  const host = await manager.create('Alice', { size: 6, difficulty: 'easy' }, 'duel'),
    guest = await manager.join(host.state.id, 'Bob')
  const started = await manager.command(host.credentials, {
    type: 'start',
    actionId: randomUUID(),
    gameId: host.state.game.id,
  })
  expect(started.game.phase).toBe('generating')
  const left = await manager.command(guest.credentials, { type: 'leave', actionId: randomUUID() })
  expect(left.game.phase).toBe('waiting')
  expect(left.players).toHaveLength(1)
})
