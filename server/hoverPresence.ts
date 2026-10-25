import type { Credentials, GameSnapshot, Hover, Player, RoomSnapshot } from '../shared/coop'
type Context = Pick<RoomSnapshot, 'id' | 'expiresAt'> & {
  players: Player[]
  game: Pick<GameSnapshot, 'id' | 'phase' | 'cells'>
}
/** Ephemeral presence for authenticated sockets; no database reads or writes on pointer movement. */
export class HoverPresence {
  private rooms = new Map<
    string,
    {
      gameId: string
      enabled: boolean
      cells: number
      expiresAt: number
      players: Map<string, string>
    }
  >()
  private positions = new Map<string, Map<string, { socketId: string; hover: Hover }>>()
  constructor(private now = Date.now) {}
  update(state: Context) {
    const players = new Map(state.players.filter((p) => p.connected).map((p) => [p.id, p.name]))
    this.rooms.set(state.id, {
      gameId: state.game.id,
      enabled: state.game.phase === 'playing',
      cells: state.game.cells.length,
      expiresAt: state.expiresAt,
      players,
    })
    const positions = this.positions.get(state.id)
    if (positions)
      for (const [id, entry] of positions) {
        if (
          state.game.phase !== 'playing' ||
          entry.hover.gameId !== state.game.id ||
          !players.has(id)
        )
          positions.delete(id)
      }
    if (!positions?.size) this.positions.delete(state.id)
  }
  move(
    credentials: Credentials,
    socketId: string,
    input: { gameId: string; index: number | null },
  ): Hover | null {
    const room = this.rooms.get(credentials.roomId),
      name = room?.players.get(credentials.playerId)
    if (
      !room ||
      !name ||
      !room.enabled ||
      room.expiresAt <= this.now() ||
      input.gameId !== room.gameId ||
      (input.index !== null &&
        (!Number.isInteger(input.index) || input.index < 0 || input.index >= room.cells))
    )
      return null
    const hover: Hover = {
      playerId: credentials.playerId,
      name,
      gameId: input.gameId,
      index: input.index,
      expiresAt: this.now() + 5000,
    }
    let positions = this.positions.get(credentials.roomId)
    if (input.index === null) {
      if (positions?.get(credentials.playerId)?.socketId !== socketId) return null
      positions.delete(credentials.playerId)
      if (!positions.size) this.positions.delete(credentials.roomId)
    } else {
      if (!positions) {
        positions = new Map()
        this.positions.set(credentials.roomId, positions)
      }
      positions.set(credentials.playerId, { socketId, hover })
    }
    return hover
  }
  disconnect(credentials: Credentials, socketId: string): Hover | null {
    const positions = this.positions.get(credentials.roomId),
      entry = positions?.get(credentials.playerId)
    if (entry?.socketId !== socketId) return null
    positions!.delete(credentials.playerId)
    if (!positions!.size) this.positions.delete(credentials.roomId)
    return { ...entry.hover, index: null, expiresAt: this.now() }
  }
  current(roomId: string) {
    return [...(this.positions.get(roomId)?.values() ?? [])]
      .filter((entry) => entry.hover.expiresAt > this.now())
      .map((entry) => entry.hover)
  }
  cleanup() {
    for (const [id, room] of this.rooms) {
      if (room.expiresAt <= this.now()) {
        this.rooms.delete(id)
        this.positions.delete(id)
        continue
      }
      const positions = this.positions.get(id)
      if (positions)
        for (const [player, entry] of positions)
          if (entry.hover.expiresAt <= this.now()) positions.delete(player)
      if (!positions?.size) this.positions.delete(id)
    }
  }
}
