import { expect, it } from 'vitest'
import { parseRoomCode } from '../../shared/roomCode'
import { credentialsSchema, commandSchema } from '../../shared/coop'
import { randomUUID } from 'node:crypto'
it('normalizes five-character alphanumeric codes and share URLs while rejecting old codes', () => {
  expect(parseRoomCode(' a2b3c ')).toBe('A2B3C')
  expect(parseRoomCode('https://game.example/rooms/a2b3c?source=share')).toBe('A2B3C')
  for (const code of ['abcdef123456', 'AB-CD', 'ABCD', '中文123', 'ABCDEF'])
    expect(parseRoomCode(code)).toBeNull()
  expect(
    credentialsSchema.parse({ roomId: 'a2b3c', playerId: randomUUID(), token: 'a'.repeat(64) })
      .roomId,
  ).toBe('A2B3C')
  expect(
    commandSchema.safeParse({
      type: 'ready',
      actionId: randomUUID(),
      gameId: randomUUID(),
      ready: true,
    }).success,
  ).toBe(false)
})
