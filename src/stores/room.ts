import { computed, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { nextCell, type CellAction } from '../queens/cells'
import { LocalizedError, failureMessage, message, type Message } from '../../shared/message'
import {
  credentialsSchema,
  maxPlayers,
  type Credentials,
  type Point,
  type Hover,
  type RoomAccess,
  type RoomCommand,
  type RoomMode,
  type RoomSettings,
  type RoomSnapshot,
} from '../../shared/coop'
import { connectRoom } from '../services/roomClient'
import { useCoopGameStore } from './game'
type CommandInput = RoomCommand extends infer T
  ? T extends RoomCommand
    ? Omit<T, 'actionId' | 'gameId'> & { gameId?: string }
    : never
  : never
export const useRoomStore = defineStore('room', () => {
  const room = shallowRef<Omit<RoomSnapshot, 'game'> | null>(null),
    credentials = shallowRef<Credentials | null>(null)
  const connected = shallowRef(false),
    connecting = shallowRef(false),
    error = shallowRef<Message | null>(null),
    pending = shallowRef(0)
  const notice = shallowRef<{ id: number; message: Message } | null>(null)
  let noticeId = 0
  function notify(text: Message) {
    notice.value = { id: ++noticeId, message: text }
  }
  function dismissNotice() {
    notice.value = null
  }
  const hovers = shallowRef<Hover[]>([])
  let hoverIndex: number | null = null,
    hoverSentAt = 0
  const peerHovers = computed(() =>
    hovers.value.filter((hover) => hover.playerId !== credentials.value?.playerId),
  )
  const points = shallowRef<Point[]>([]),
    pendingCells = shallowRef<number[]>([]),
    assisting = shallowRef(false)
  let client: ReturnType<typeof connectRoom> | null = null
  const game = useCoopGameStore()
  const isHost = computed(
    () => !!credentials.value && credentials.value.playerId === room.value?.hostId,
  )
  const me = computed(() => room.value?.players.find((p) => p.id === credentials.value?.playerId))
  const canStart = computed(
    () =>
      isHost.value &&
      connected.value &&
      game.state?.phase === 'waiting' &&
      (room.value?.mode !== 'duel' || room.value.players.length >= maxPlayers('duel')),
  )
  const myActions = computed(
    () => game.state?.actions.filter((a) => a.playerId === credentials.value?.playerId) ?? [],
  )
  const undoAction = computed(() =>
    [...myActions.value]
      .reverse()
      .find(
        (a) =>
          !a.undone && a.changes.every((c, i) => game.state?.versions[c.index] === a.versions[i]),
      ),
  )
  const redoAction = computed(() =>
    [...myActions.value]
      .reverse()
      .find(
        (a) =>
          a.undone &&
          a.changes.every((c, i) => game.state?.versions[c.index] === a.undoVersions[i]),
      ),
  )
  function accept(snapshot: RoomSnapshot) {
    if (
      room.value?.id === snapshot.id &&
      (snapshot.revision < room.value.revision ||
        (snapshot.revision === room.value.revision && snapshot.serverNow < room.value.serverNow))
    )
      return
    if (game.state?.id !== snapshot.game.id) {
      pending.value = 0
      pendingCells.value = []
      assisting.value = false
      notice.value = null
    }
    if (game.state?.id !== snapshot.game.id || snapshot.game.phase !== 'playing') {
      points.value = []
      hovers.value = []
      hoverIndex = null
    } else
      hovers.value = hovers.value.filter((hover) =>
        snapshot.players.some((p) => p.id === hover.playerId && p.connected),
      )
    const { game: round, ...metadata } = snapshot
    room.value = metadata
    game.accept(round)
  }
  function close() {
    client?.close()
    client = null
    connected.value = false
    connecting.value = false
    pending.value = 0
    notice.value = null
    pendingCells.value = []
    assisting.value = false
    points.value = []
    hovers.value = []
    hoverIndex = null
    room.value = null
    credentials.value = null
    game.clear()
  }
  function remember(access: RoomAccess) {
    try {
      sessionStorage.setItem(
        `queens:room:${access.credentials.roomId}`,
        JSON.stringify(access.credentials),
      )
    } catch {
      /* The active session still works without storage. */
    }
    attach(access.credentials)
    accept(access.state)
  }
  function attach(value: Credentials) {
    close()
    credentials.value = value
    connecting.value = true
    error.value = null
    client = connectRoom(value, {
      state: accept,
      point(point) {
        if (point.gameId === game.state?.id)
          points.value = [
            ...points.value.filter((p) => p.playerId !== point.playerId),
            { ...point, expiresAt: Date.now() + 2500 },
          ]
      },
      hover(value) {
        if (value.gameId !== game.state?.id || game.state?.phase !== 'playing') return
        hovers.value = hovers.value.filter((hover) => hover.playerId !== value.playerId)
        if (value.index !== null)
          hovers.value = [...hovers.value, { ...value, expiresAt: Date.now() + 5000 }]
      },
      status(value, issue) {
        if (!value) hovers.value = []
        connected.value = value
        connecting.value = false
        if (issue) error.value = issue
        else if (value) error.value = null
      },
    })
  }
  function reconnect() {
    const saved = credentials.value
    if (saved) attach(saved)
  }
  function restore(id: string) {
    if (credentials.value?.roomId === id && client) return true
    close()
    error.value = null
    try {
      const stored: unknown = JSON.parse(sessionStorage.getItem(`queens:room:${id}`) ?? 'null')
      const parsed = credentialsSchema.safeParse(stored)
      if (parsed.success && parsed.data.roomId === id) {
        attach(parsed.data)
        return true
      }
    } catch {
      /* A user may join with a fresh guest identity. */
    }
    return false
  }
  async function post(path: string, body: unknown): Promise<RoomAccess> {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = (await response.json()) as RoomAccess & { error?: Message }
    if (!response.ok)
      throw new LocalizedError(data.error ?? message('coop.join.failed'), 'Request failed')
    return data
  }
  async function create(name: string, settings: RoomSettings, mode: RoomMode = 'coop') {
    error.value = null
    const access = await post('/api/rooms', { name, mode, ...settings })
    remember(access)
    return access.credentials.roomId
  }
  async function join(id: string, name: string) {
    error.value = null
    remember(await post(`/api/rooms/${encodeURIComponent(id)}/join`, { name }))
  }
  async function send(input: CommandInput) {
    if (!client || !connected.value) {
      notify(message('coop.errors.waitReconnect'))
      return false
    }
    const gameId = input.gameId ?? game.state?.id
    if (!gameId) {
      notify(message('coop.errors.syncing'))
      return false
    }
    const currentClient = client
    const operationEpoch = game.state?.id
    pending.value++
    try {
      const actionId = crypto.randomUUID()
      const command: RoomCommand =
        input.type === 'leave' ? { type: 'leave', actionId } : { ...input, actionId, gameId }
      const reply = await currentClient.command(command)
      if (client !== currentClient) return false
      if (reply.ok) {
        accept(reply.state)
        return true
      }
      notify(reply.error)
      currentClient.sync()
      return false
    } catch (reason) {
      if (client === currentClient) {
        notify(failureMessage(reason))
        currentClient.sync()
      }
      return false
    } finally {
      if (client === currentClient && game.state?.id === operationEpoch)
        pending.value = Math.max(0, pending.value - 1)
    }
  }
  async function edit(index: number, action: CellAction = 'cycle') {
    const state = game.state
    if (state?.phase !== 'playing' || pendingCells.value.includes(index)) return
    const before = state.cells[index]
    const nextState = nextCell(before, action)
    pendingCells.value = [...pendingCells.value, index]
    try {
      await send({
        type: 'setCell',
        gameId: state.id,
        index,
        expectedVersion: state.versions[index],
        nextState,
      })
    } finally {
      if (game.state?.id === state.id)
        pendingCells.value = pendingCells.value.filter((i) => i !== index)
    }
  }
  async function assist(type: 'hint' | 'check') {
    if (!game.state || assisting.value) return
    assisting.value = true
    const operationEpoch = game.state.id
    try {
      await send({ type, gameId: game.state.id })
    } finally {
      if (game.state?.id === operationEpoch) assisting.value = false
    }
  }
  function point(index: number) {
    if (game.state?.phase === 'playing') client?.point(game.state.id, index)
  }
  function hover(index: number | null) {
    if (index !== null && game.state?.phase !== 'playing') return
    if (index === hoverIndex) return
    hoverIndex = index
    if (connected.value && game.state?.phase === 'playing') {
      client?.hover(game.state.id, index)
      hoverSentAt = Date.now()
    }
  }
  function clock() {
    game.clock()
    hovers.value = hovers.value.filter((hover) => hover.expiresAt > Date.now())
    if (
      hoverIndex !== null &&
      connected.value &&
      game.state?.phase === 'playing' &&
      Date.now() - hoverSentAt >= 1500
    ) {
      client?.hover(game.state.id, hoverIndex)
      hoverSentAt = Date.now()
    }
    points.value = points.value.filter((p) => p.expiresAt > Date.now())
  }
  async function leave() {
    if (connected.value) await send({ type: 'leave' })
    if (credentials.value)
      try {
        sessionStorage.removeItem(`queens:room:${credentials.value.roomId}`)
      } catch {
        /* No stored credentials. */
      }
    close()
  }
  return {
    room,
    notice,
    dismissNotice,
    credentials,
    connected,
    connecting,
    error,
    pending,
    pendingCells,
    assisting,
    points,
    hovers,
    peerHovers,
    hover,
    isHost,
    me,
    canStart,
    undoAction,
    redoAction,
    create,
    join,
    restore,
    reconnect,
    close,
    send,
    edit,
    assist,
    point,
    clock,
    leave,
  }
})
