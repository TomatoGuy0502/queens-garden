import { expect, it } from 'vitest'
import { HoverPresence } from '../hoverPresence'
const credentials = {
  roomId: 'ABCDE',
  playerId: 'alice',
  token: 'unused-by-authenticated-presence',
}
function room() {
  return {
    id: 'ABCDE',
    expiresAt: 100000,
    players: [
      { id: 'alice', name: 'Alice', connected: true },
      { id: 'bob', name: 'Bob', connected: true },
    ],
    game: { id: 'round', phase: 'playing' as const, cells: Array<'empty'>(36).fill('empty') },
  }
}
it('authorizes cached membership and round/board bounds without touching persistent game state', () => {
  const presence = new HoverPresence(() => 100)
  const state = room(),
    before = structuredClone(state)
  presence.update(state)
  expect(presence.move(credentials, 'socket', { gameId: 'round', index: 7 })).toMatchObject({
    name: 'Alice',
    index: 7,
    expiresAt: 5100,
  })
  for (const index of [-1, 36, 1.5])
    expect(presence.move(credentials, 'socket', { gameId: 'round', index })).toBeNull()
  expect(
    presence.move({ ...credentials, playerId: 'outsider' }, 'socket', {
      gameId: 'round',
      index: 0,
    }),
  ).toBeNull()
  expect(
    presence.move({ ...credentials, roomId: 'OTHER' }, 'socket', { gameId: 'round', index: 0 }),
  ).toBeNull()
  expect(presence.move(credentials, 'socket', { gameId: 'old-round', index: 0 })).toBeNull()
  expect(state).toEqual(before)
})
it('a stale socket cannot clear a newer socket position and disconnect clears the owning socket', () => {
  const presence = new HoverPresence(() => 100)
  presence.update(room())
  presence.move(credentials, 'old', { gameId: 'round', index: 0 })
  presence.move(credentials, 'new', { gameId: 'round', index: 1 })
  expect(presence.move(credentials, 'old', { gameId: 'round', index: null })).toBeNull()
  expect(presence.disconnect(credentials, 'old')).toBeNull()
  expect(presence.current('ABCDE')[0]?.index).toBe(1)
  expect(presence.disconnect(credentials, 'new')?.index).toBeNull()
  expect(presence.current('ABCDE')).toEqual([])
})
it('expires idle positions and clears them on disconnect, pause, new rounds and room expiry', () => {
  let now = 100
  const presence = new HoverPresence(() => now)
  presence.update(room())
  presence.move(credentials, 'socket', { gameId: 'round', index: 0 })
  now = 5101
  expect(presence.current('ABCDE')).toEqual([])
  presence.cleanup()
  presence.move(credentials, 'socket', { gameId: 'round', index: 1 })
  presence.update({ ...room(), players: [{ id: 'alice', name: 'Alice', connected: false }] })
  expect(presence.current('ABCDE')).toEqual([])
  presence.update(room())
  presence.move(credentials, 'socket', { gameId: 'round', index: 2 })
  presence.update({ ...room(), game: { ...room().game, phase: 'paused' } })
  expect(presence.current('ABCDE')).toEqual([])
  expect(presence.move(credentials, 'socket', { gameId: 'round', index: 3 })).toBeNull()
  presence.update(room())
  presence.move(credentials, 'socket', { gameId: 'round', index: 4 })
  presence.update({ ...room(), game: { ...room().game, id: 'next' } })
  expect(presence.current('ABCDE')).toEqual([])
  now = 100001
  presence.cleanup()
  expect(presence.move(credentials, 'socket', { gameId: 'next', index: 0 })).toBeNull()
})

it('pointing is checked against cached presence: members only, running round, valid cell', () => {
  const presence = new HoverPresence(() => 100)
  const state = room()
  presence.update(state)
  expect(presence.point(credentials, { gameId: 'round', index: 7 })).toEqual({
    playerId: 'alice',
    name: 'Alice',
    gameId: 'round',
    index: 7,
    expiresAt: 2600,
  })
  expect(presence.point(credentials, { gameId: 'round', index: 36 })).toBeNull()
  expect(presence.point(credentials, { gameId: 'old-round', index: 0 })).toBeNull()
  expect(
    presence.point({ ...credentials, playerId: 'outsider' }, { gameId: 'round', index: 0 }),
  ).toBeNull()
  presence.update({ ...state, game: { ...state.game, phase: 'paused' } })
  expect(presence.point(credentials, { gameId: 'round', index: 7 })).toBeNull()
})
