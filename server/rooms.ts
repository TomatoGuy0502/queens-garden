import { createHash, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto'
import { MAX_ROOM_PLAYERS } from '../shared/coop'
import type {
  BoardAction,
  Change,
  Credentials,
  RoomAccess,
  RoomCommand,
  RoomSettings,
  RoomSnapshot,
} from '../shared/coop'
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, ROOM_CODE_PATTERN } from '../shared/roomCode'
import type { CellState, PuzzleDefinition } from '../src/queens/types'
import { conflictCells } from '../src/queens/validator'
import { RoomError, type RoomRepository, type StoredPlayer, type StoredRoom } from './model'
import type { Compute, HintResult } from './compute'
const ROOM_TTL = 24 * 60 * 60 * 1000
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
function player(name: string): { stored: StoredPlayer; token: string } {
  const token = randomBytes(32).toString('hex')
  return {
    token,
    stored: {
      id: randomUUID(),
      name,
      tokenHash: hash(token),
      lastSeenAt: Date.now(),
    },
  }
}
function freshGame(room: StoredRoom) {
  room.gameId = randomUUID()
  room.phase = 'waiting'
  room.puzzle = null
  room.cells = []
  room.versions = []
  room.boardRevision = 0
  room.actions = []
  room.receipts = {}
  room.startedAt = null
  room.pausedAt = null
  room.pausedMs = 0
  room.finishedAt = null
  room.moves = 0
  room.hints = 0
  room.hint = null
  room.message = ''
  room.mistakes = []
}
export class RoomManager {
  private queues = new Map<string, Promise<void>>()
  private generating = new Set<string>()
  private connections = new Map<string, Map<string, Set<string>>>()
  onState: (state: RoomSnapshot) => void = () => {}
  constructor(
    private repository: RoomRepository,
    private compute: Compute,
    private makeCode = () =>
      Array.from(
        { length: ROOM_CODE_LENGTH },
        () => ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)],
      ).join(''),
  ) {}
  private serial<T>(id: string, work: () => Promise<T>): Promise<T> {
    const result = (this.queues.get(id) ?? Promise.resolve()).then(work)
    const tail = result.then(
      () => {},
      () => {},
    )
    this.queues.set(id, tail)
    void tail.then(() => {
      if (this.queues.get(id) === tail) this.queues.delete(id)
    })
    return result
  }
  private async load(id: string) {
    if (!ROOM_CODE_PATTERN.test(id)) throw new RoomError('房間代碼格式不正確。', 'NOT_FOUND')
    const room = await this.repository.get(id)
    if (!room || room.expiresAt < Date.now())
      throw new RoomError('房間不存在或已過期。', 'NOT_FOUND')
    return room
  }
  private authorize(room: StoredRoom, credentials: Credentials) {
    const member = room.players.find((p) => p.id === credentials.playerId)
    if (
      !member ||
      !timingSafeEqual(
        Buffer.from(member.tokenHash, 'hex'),
        Buffer.from(hash(credentials.token), 'hex'),
      )
    )
      throw new RoomError('無法驗證房間身分，請重新加入。', 'UNAUTHORIZED')
    return member
  }
  private online(id: string, playerId: string) {
    return !!this.connections.get(id)?.get(playerId)?.size
  }
  snapshot(room: StoredRoom): RoomSnapshot {
    const now = Date.now()
    let elapsedMs = 0
    if (room.startedAt !== null)
      elapsedMs = Math.max(
        0,
        (room.finishedAt ?? room.pausedAt ?? now) - room.startedAt - room.pausedMs,
      )
    let definition: PuzzleDefinition | null = null
    if (room.puzzle) {
      const { solution: _solution, analysis: _analysis, ...publicPuzzle } = room.puzzle
      definition = publicPuzzle
    }
    return {
      id: room.id,
      hostId: room.hostId,
      settings: room.settings,
      revision: room.revision,
      serverNow: now,
      expiresAt: room.expiresAt,
      players: room.players.map((p) => ({
        id: p.id,
        name: p.name,
        connected: this.online(room.id, p.id),
      })),
      game: {
        id: room.gameId,
        phase: room.phase,
        puzzle: definition,
        cells: room.cells,
        versions: room.versions,
        boardRevision: room.boardRevision,
        actions: room.actions,
        elapsedMs,
        moves: room.moves,
        hints: room.hints,
        hint: room.hint,
        message: room.message,
        mistakes: room.mistakes,
      },
    }
  }
  private async commit(
    room: StoredRoom,
    type: string,
    playerId: string,
    actionId?: string,
    changes?: BoardAction['changes'],
  ) {
    room.revision++
    room.checkpointAt = Date.now()
    room.expiresAt = Date.now() + ROOM_TTL
    const completed = room.phase === 'completed' && ['setCell', 'applyHint', 'redo'].includes(type)
    const result = completed
      ? {
          gameId: room.gameId,
          puzzleId: room.puzzle!.id,
          elapsedMs: room.finishedAt! - room.startedAt! - room.pausedMs,
          moves: room.moves,
          hints: room.hints,
          players: room.players.map((p) => ({ id: p.id, name: p.name })),
        }
      : undefined
    const boardAction = room.actions.find((action) => action.id === actionId)
    await this.repository.save(room, {
      type,
      playerId,
      actionId,
      changes: changes ?? boardAction?.changes,
      result,
    })
    const state = this.snapshot(room)
    this.onState(state)
    return state
  }
  async create(name: string, settings: RoomSettings): Promise<RoomAccess> {
    for (let attempt = 0; attempt < 16; attempt++) {
      const id = this.makeCode()
      const access = await this.serial(id, async () => {
        if (await this.repository.get(id)) return null
        const { stored, token } = player(name)
        const room = {
          id,
          hostId: stored.id,
          settings,
          players: [stored],
          revision: 0,
          expiresAt: Date.now() + ROOM_TTL,
        } as StoredRoom
        freshGame(room)
        try {
          const state = await this.commit(room, 'created', stored.id)
          return { credentials: { roomId: id, playerId: stored.id, token }, state }
        } catch (error) {
          if (error instanceof RoomError && error.code === 'STATE_CONFLICT') return null
          throw error
        }
      })
      if (access) return access
    }
    throw new RoomError('暫時無法取得房間代碼，請稍後再試。', 'ROOM_CODE_EXHAUSTED')
  }
  async join(id: string, name: string): Promise<RoomAccess> {
    return this.serial(id, async () => {
      const room = await this.load(id)
      // Keep an offline guest's seat for five minutes; the host retains their room identity.
      room.players = room.players.filter(
        (p) => p.id === room.hostId || this.online(id, p.id) || Date.now() - p.lastSeenAt < 300000,
      )
      if (room.players.length >= MAX_ROOM_PLAYERS)
        throw new RoomError(`房間已滿，最多 ${MAX_ROOM_PLAYERS} 人合作。`, 'ROOM_FULL')
      const { stored, token } = player(name)
      room.players.push(stored)
      if (!room.hostId) room.hostId = stored.id
      const state = await this.commit(room, 'joined', stored.id)
      return { credentials: { roomId: id, playerId: stored.id, token }, state }
    })
  }
  async state(credentials: Credentials) {
    return this.serial(credentials.roomId, async () => {
      const room = await this.load(credentials.roomId)
      this.authorize(room, credentials)
      return this.snapshot(room)
    })
  }
  async connect(credentials: Credentials, socketId: string) {
    return this.serial(credentials.roomId, async () => {
      const room = await this.load(credentials.roomId),
        member = this.authorize(room, credentials)
      let members = this.connections.get(room.id)
      if (!members) {
        members = new Map()
        this.connections.set(room.id, members)
      }
      let sockets = members.get(member.id)
      if (!sockets) {
        sockets = new Set()
        members.set(member.id, sockets)
      }
      sockets.add(socketId)
      member.lastSeenAt = Date.now()
      if (!this.online(room.id, room.hostId)) room.hostId = member.id
      if (room.phase === 'generating' && !this.generating.has(room.gameId)) {
        room.phase = 'waiting'
        room.message = '服務已重新啟動，房主可重新產生關卡。'
      }
      try {
        return await this.commit(room, 'connected', member.id)
      } catch (error) {
        sockets.delete(socketId)
        throw error
      }
    })
  }
  async disconnect(credentials: Credentials, socketId: string) {
    const members = this.connections.get(credentials.roomId),
      sockets = members?.get(credentials.playerId)
    sockets?.delete(socketId)
    if (!sockets?.size) members?.delete(credentials.playerId)
    if (!members?.size) this.connections.delete(credentials.roomId)
    await this.serial(credentials.roomId, async () => {
      const room = await this.repository.get(credentials.roomId)
      if (!room) return
      const member = room.players.find((p) => p.id === credentials.playerId)
      if (!member) return
      member.lastSeenAt = Date.now()
      if (!this.online(room.id, member.id) && room.hostId === member.id) {
        const next = room.players.find((p) => this.online(room.id, p.id))
        if (next) room.hostId = next.id
      }
      await this.commit(room, 'disconnected', member.id)
    })
  }
  private receipt(room: StoredRoom, credentials: Credentials, command: RoomCommand): boolean {
    const previous = room.receipts[command.actionId]
    if (!previous) return false
    if (
      previous.playerId !== credentials.playerId ||
      previous.fingerprint !== hash(JSON.stringify(command))
    )
      throw new RoomError('操作識別碼已被使用。', 'ACTION_ID_REUSED')
    return true
  }
  private remember(room: StoredRoom, credentials: Credentials, command: RoomCommand) {
    if (Object.keys(room.receipts).length >= 4000)
      throw new RoomError('本局操作已達上限，請開始下一局。', 'ACTION_LIMIT')
    room.receipts[command.actionId] = {
      playerId: credentials.playerId,
      fingerprint: hash(JSON.stringify(command)),
    }
  }
  private host(room: StoredRoom, memberId: string) {
    if (room.hostId !== memberId) throw new RoomError('只有房主可以進行這項操作。', 'HOST_ONLY')
  }
  private round(room: StoredRoom, gameId: string) {
    if (room.gameId !== gameId) throw new RoomError('這是上一局的操作，已忽略。', 'STALE_GAME')
  }
  private editable(room: StoredRoom) {
    if (room.phase !== 'playing') throw new RoomError('請先開始或繼續遊戲。', 'NOT_PLAYING')
  }
  private completion(room: StoredRoom) {
    const queens = room.cells.flatMap((cell, index) =>
      cell === 'queen'
        ? [{ row: Math.floor(index / room.settings.size), col: index % room.settings.size }]
        : [],
    )
    const solved =
      queens.length === room.settings.size &&
      conflictCells(room.puzzle!.regions, queens).length === 0
    if (solved && room.phase !== 'completed') {
      room.phase = 'completed'
      room.finishedAt = Date.now()
      room.message = '團隊已完成關卡。'
    } else if (!solved && room.phase === 'completed') {
      room.pausedMs += Date.now() - room.finishedAt!
      room.finishedAt = null
      room.phase = 'playing'
      room.pausedAt = null
    }
  }
  private apply(room: StoredRoom, memberId: string, id: string, changes: BoardAction['changes']) {
    if (!changes.length) throw new RoomError('格子狀態沒有變更。')
    if (room.actions.length >= 1000) throw new RoomError('本局操作歷史已達上限，請開始下一局。')
    for (const change of changes) {
      room.cells[change.index] = change.after
      room.versions[change.index]++
    }
    room.actions.push({
      id,
      playerId: memberId,
      changes,
      versions: changes.map((c) => room.versions[c.index]),
      undoVersions: [],
      undone: false,
    })
    room.boardRevision++
    room.moves++
    room.hint = null
    room.message = ''
    room.mistakes = []
    this.completion(room)
  }
  async command(credentials: Credentials, command: RoomCommand): Promise<RoomSnapshot> {
    if (command.type === 'hint' || command.type === 'check')
      return this.assist(credentials, command)
    let launch = false
    const state = await this.serial(credentials.roomId, async () => {
      const room = await this.load(credentials.roomId),
        member = this.authorize(room, credentials)
      if (this.receipt(room, credentials, command)) return this.snapshot(room)
      if ('gameId' in command) this.round(room, command.gameId)
      switch (command.type) {
        case 'configure':
          this.host(room, member.id)
          if (room.phase !== 'waiting') throw new RoomError('只能在等待室調整關卡。')
          room.settings = command.settings
          break
        case 'start':
          this.host(room, member.id)
          if (room.phase !== 'waiting') throw new RoomError('目前無法開始新局。')
          room.phase = 'generating'
          room.gameId = randomUUID()
          room.message = ''
          launch = true
          break
        case 'reset':
          this.host(room, member.id)
          freshGame(room)
          break
        case 'leave':
          room.players = room.players.filter((p) => p.id !== member.id)
          if (room.hostId === member.id)
            room.hostId =
              room.players.find((p) => this.online(room.id, p.id))?.id ?? room.players[0]?.id ?? ''
          room.message = `${member.name} 已離開房間。`
          break
        case 'pause':
          if (room.phase !== 'playing' && room.phase !== 'paused')
            throw new RoomError('目前無法暫停或繼續。')
          if (command.paused && room.phase === 'playing') {
            room.phase = 'paused'
            room.pausedAt = Date.now()
          } else if (!command.paused && room.phase === 'paused') {
            room.pausedMs += Date.now() - room.pausedAt!
            room.pausedAt = null
            room.phase = 'playing'
          }
          room.message = command.paused ? '遊戲已暫停。' : ''
          break
        case 'setCell':
          this.editable(room)
          if (command.index >= room.cells.length) throw new RoomError('格子超出棋盤範圍。')
          if (room.versions[command.index] !== command.expectedVersion)
            throw new RoomError('這一格已被其他操作更新，請依最新狀態再操作。', 'CELL_CONFLICT')
          this.apply(room, member.id, command.actionId, [
            { index: command.index, before: room.cells[command.index], after: command.nextState },
          ])
          break
        case 'undo':
        case 'redo': {
          if (room.phase !== 'playing' && room.phase !== 'completed')
            throw new RoomError('請先繼續遊戲。')
          const action = room.actions.find(
            (a) => a.id === command.targetId && a.playerId === member.id,
          )
          const undo = command.type === 'undo'
          if (!action || action.undone === undo) throw new RoomError('沒有可復原或重做的操作。')
          const versions = undo ? action.versions : action.undoVersions
          if (action.changes.some((c, i) => room.versions[c.index] !== versions[i]))
            throw new RoomError('這些格子已有後續修改，無法覆蓋。', 'UNDO_CONFLICT')
          action.changes.forEach((c) => {
            room.cells[c.index] = undo ? c.before : c.after
            room.versions[c.index]++
          })
          action.undone = undo
          if (undo) action.undoVersions = action.changes.map((c) => room.versions[c.index])
          else action.versions = action.changes.map((c) => room.versions[c.index])
          room.boardRevision++
          room.moves++
          room.hint = null
          room.mistakes = []
          room.message = ''
          this.completion(room)
          break
        }
        case 'applyHint': {
          this.editable(room)
          const hint = room.hint
          if (
            !hint?.step ||
            hint.id !== command.hintId ||
            hint.boardRevision !== room.boardRevision
          )
            throw new RoomError('提示已過期，請重新取得。', 'STALE_HINT')
          const changes = hint.step.cells
            .map((index): Change => ({
              index,
              before: room.cells[index],
              after: hint.step!.action === 'place' ? 'queen' : 'marked',
            }))
            .filter((c) => c.before !== c.after)
          this.apply(room, member.id, command.actionId, changes)
          break
        }
      }
      this.remember(room, credentials, command)
      return this.commit(room, command.type, member.id, command.actionId)
    })
    if (launch) void this.generate(credentials.roomId, state.game.id)
    return state
  }
  private async generate(id: string, gameId: string) {
    this.generating.add(gameId)
    try {
      const initial = await this.load(id)
      const seed = randomBytes(4).readUInt32LE()
      const puzzle = await this.compute.generate({ ...initial.settings, seed })
      await this.serial(id, async () => {
        const room = await this.load(id)
        if (room.gameId !== gameId || room.phase !== 'generating') return
        room.puzzle = puzzle
        room.cells = Array<CellState>(puzzle.size ** 2).fill('empty')
        room.versions = Array<number>(puzzle.size ** 2).fill(0)
        room.startedAt = Date.now()
        room.phase = 'playing'
        room.pausedAt = null
        await this.commit(room, 'generated', room.hostId)
      })
    } catch (error) {
      await this.serial(id, async () => {
        const room = await this.load(id)
        if (room.gameId !== gameId || room.phase !== 'generating') return
        room.phase = 'waiting'
        room.message = error instanceof Error ? error.message : '生成失敗，請重試。'
        await this.commit(room, 'generation_failed', room.hostId)
      }).catch(() => {})
    } finally {
      this.generating.delete(gameId)
    }
  }
  private async assist(
    credentials: Credentials,
    command: Extract<RoomCommand, { type: 'hint' | 'check' }>,
  ) {
    const context = await this.serial(credentials.roomId, async () => {
      const room = await this.load(credentials.roomId)
      this.authorize(room, credentials)
      this.round(room, command.gameId)
      if (this.receipt(room, credentials, command)) return { room, duplicate: true }
      this.editable(room)
      return { room, duplicate: false }
    })
    if (context.duplicate) return this.snapshot(context.room)
    let result: HintResult | null = null
    const mistakes: number[] = []
    if (command.type === 'hint')
      result = await this.compute.hint(context.room.puzzle!.regions, context.room.cells)
    else
      context.room.cells.forEach((state, index) => {
        const queen =
          context.room.puzzle!.solution[Math.floor(index / context.room.settings.size)] ===
          index % context.room.settings.size
        if ((state === 'queen' && !queen) || (state === 'marked' && queen)) mistakes.push(index)
      })
    return this.serial(credentials.roomId, async () => {
      const room = await this.load(credentials.roomId)
      this.authorize(room, credentials)
      this.round(room, command.gameId)
      if (this.receipt(room, credentials, command)) return this.snapshot(room)
      this.editable(room)
      if (room.boardRevision !== context.room.boardRevision)
        throw new RoomError('棋盤已改變，請重新取得提示。', 'STALE_HINT')
      this.remember(room, credentials, command)
      if (result) {
        room.hints++
        room.hint = { ...result, id: command.actionId, boardRevision: room.boardRevision }
        room.message = result.message
        room.mistakes = []
      } else {
        room.hint = null
        room.mistakes = mistakes
        room.message = mistakes.length
          ? `找到 ${mistakes.length} 個與唯一解不符的皇冠或 X。`
          : '目前的皇冠和 X 標記都正確。'
      }
      return this.commit(room, command.type, credentials.playerId, command.actionId)
    })
  }
  async point(credentials: Credentials, gameId: string, index: number) {
    const room = await this.load(credentials.roomId),
      member = this.authorize(room, credentials)
    this.round(room, gameId)
    if (!room.puzzle || index >= room.cells.length || room.phase !== 'playing')
      throw new RoomError('目前無法指示格子。')
    return { playerId: member.id, name: member.name, index, gameId, expiresAt: Date.now() + 2500 }
  }
  async flush() {
    await Promise.all(this.queues.values())
  }
  async cleanup() {
    await this.repository.deleteExpired(Date.now())
  }
}
