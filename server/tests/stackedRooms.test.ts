import { beforeAll, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { RoomManager } from '../rooms'
import type { Compute } from '../compute'
import type { RoomEvent, RoomRepository, StoredRoom } from '../model'
import type { RoomCommand, RoomSnapshot } from '../../shared/coop'
import { commandSchema, createRoomSchema } from '../../shared/coop'
import { logicalHint } from '../../src/queens/difficulty'
import { logicalHint3d } from '../../src/queens3d/difficulty'
import { generatePuzzle3d } from '../../src/queens3d/generator'
import { cellIndex } from '../../src/queens3d/geometry'
import type { Queens3DPuzzle } from '../../src/queens3d/types'

let puzzle: Queens3DPuzzle
beforeAll(() => {
  puzzle = generatePuzzle3d({ size: 5, difficulty: 'easy', seed: 42 })
})
function memory(): RoomRepository {
  const rooms = new Map<string, StoredRoom>()
  return {
    get: (id) => Promise.resolve(structuredClone(rooms.get(id) ?? null)),
    save: (room: StoredRoom, _event: RoomEvent) => {
      rooms.set(room.id, structuredClone(room))
      return Promise.resolve()
    },
    deleteExpired: () => Promise.resolve(),
  }
}
const compute = (): Compute => ({
  generate: () => Promise.reject(new Error('flat board')),
  hint: (regions, cells) => Promise.resolve(logicalHint(regions, cells)),
  generate3d: () => Promise.resolve(structuredClone(puzzle)),
  hint3d: (regions, cells) => Promise.resolve(logicalHint3d(regions, cells)),
  close: () => Promise.resolve(),
})
async function stackedGame() {
  const manager = new RoomManager(memory(), compute())
  const host = await manager.create('Alice', { size: 5, difficulty: 'easy', stacked: true })
  await manager.connect(host.credentials, 'a')
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
  return { manager, host: host.credentials, state }
}
const place = (
  state: RoomSnapshot,
  index: number,
  nextState: 'queen' | 'empty' = 'queen',
): RoomCommand => ({
  type: 'setCell',
  actionId: randomUUID(),
  gameId: state.game.id,
  index,
  nextState,
  expectedVersion: state.game.versions[index],
})
const crowns = () =>
  puzzle.solution.flatMap((row, r) => row.map((z, c) => cellIndex(puzzle.size, z, r, c)))

it('a stacked room holds n³ cells and never shows the solution', async () => {
  const { state } = await stackedGame()
  expect(state.game.cells).toHaveLength(125)
  expect(state.game.puzzle).toMatchObject({ size: 5 })
  expect(JSON.stringify(state)).not.toMatch(/"solution"|"analysis"/)
})
it('the team wins by placing the skeleton, and a lone wrong crown does not', async () => {
  const { manager, host, state } = await stackedGame()
  const wrong = crowns()[0] + 25 * (puzzle.solution[0][0] < 4 ? 1 : -1)
  let current = await manager.command(host, place(state, wrong))
  expect(current.game.phase).toBe('playing')
  const checked = await manager.command(host, {
    type: 'check',
    actionId: randomUUID(),
    gameId: state.game.id,
  })
  expect(checked.game.mistakes).toEqual([wrong])
  current = await manager.command(host, place(checked, wrong, 'empty'))
  for (const index of crowns()) current = await manager.command(host, place(current, index))
  expect(current.game.phase).toBe('completed')
})
it('a shared hint is a stacked step', async () => {
  const { manager, host, state } = await stackedGame()
  const hinted = await manager.command(host, {
    type: 'hint',
    actionId: randomUUID(),
    gameId: state.game.id,
  })
  expect(hinted.game.hint?.step?.cells.every((cell) => cell < 125)).toBe(true)
})
it('stacked settings must use stacked sizes, in co-op rooms and duels alike', () => {
  const base = { name: 'A', difficulty: 'easy', stacked: true }
  expect(createRoomSchema.safeParse({ ...base, size: 5 }).success).toBe(true)
  expect(createRoomSchema.safeParse({ ...base, size: 8 }).success).toBe(false)
  expect(createRoomSchema.safeParse({ ...base, size: 5, mode: 'duel' }).success).toBe(true)
  expect(createRoomSchema.safeParse({ ...base, size: 8, mode: 'duel' }).success).toBe(false)
  expect(createRoomSchema.safeParse({ name: 'A', difficulty: 'easy', size: 5 }).success).toBe(false)
})
it('a stacked duel counts layer rows and columns, and a correct skeleton wins', async () => {
  const manager = new RoomManager(memory(), compute())
  const host = await manager.create('Alice', { size: 8, difficulty: 'easy' }, 'duel')
  const guest = await manager.join(host.state.id, 'Bob')
  await manager.connect(host.credentials, 'a')
  await manager.connect(guest.credentials, 'b')
  await manager.command(host.credentials, {
    type: 'configure',
    actionId: randomUUID(),
    gameId: host.state.game.id,
    settings: { size: 5, difficulty: 'easy', stacked: true },
  })
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
  expect(state.game.cells).toHaveLength(125)
  const board = (cells: number[]): RoomCommand => {
    const states = Array<'empty' | 'queen'>(125).fill('empty')
    for (const cell of cells) states[cell] = 'queen'
    return { type: 'duelBoard', actionId: randomUUID(), gameId: state.game.id, cells: states }
  }
  // The same cell on two layers covers two layer rows and two layer columns.
  const two = await manager.command(host.credentials, board([0, 25]))
  expect(two.game.duel?.progress[host.credentials.playerId]).toBe(2)
  // Two crowns in one row of one layer cover a single layer row.
  const row = await manager.command(host.credentials, board([0, 2]))
  expect(row.game.duel?.progress[host.credentials.playerId]).toBe(1)
  const won = await manager.command(guest.credentials, board(crowns()))
  expect(won.game.duel).toMatchObject({
    winnerId: guest.credentials.playerId,
    progress: { [guest.credentials.playerId]: 25 },
  })
  expect(won.game.phase).toBe('completed')
})
it('a duel board command carries a whole 6 × 6 × 6 board', () => {
  const command = {
    type: 'duelBoard',
    actionId: randomUUID(),
    gameId: randomUUID(),
    cells: Array(216).fill('empty'),
  }
  expect(commandSchema.safeParse(command).success).toBe(true)
  expect(commandSchema.safeParse({ ...command, cells: Array(217).fill('empty') }).success).toBe(
    false,
  )
})
