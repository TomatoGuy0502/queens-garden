import { computed, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import {
  credentialsSchema,
  type Credentials,
  type Point,
  type RoomAccess,
  type RoomCommand,
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
    error = shallowRef(''),
    pending = shallowRef(0)
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
    () => isHost.value && connected.value && game.state?.phase === 'waiting',
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
    if (game.state?.id !== snapshot.game.id) points.value = []
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
    pendingCells.value = []
    assisting.value = false
    points.value = []
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
    error.value = ''
    client = connectRoom(value, {
      state: accept,
      point(point) {
        if (point.gameId === game.state?.id)
          points.value = [
            ...points.value.filter((p) => p.playerId !== point.playerId),
            { ...point, expiresAt: Date.now() + 2500 },
          ]
      },
      status(value, issue) {
        connected.value = value
        connecting.value = false
        if (issue) error.value = issue
        else if (value) error.value = ''
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
    error.value = ''
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
    const data = (await response.json()) as RoomAccess & { error?: string }
    if (!response.ok) throw new Error(data.error ?? '無法加入房間。')
    return data
  }
  async function create(name: string, settings: RoomSettings) {
    error.value = ''
    const access = await post('/api/rooms', { name, ...settings })
    remember(access)
    return access.credentials.roomId
  }
  async function join(id: string, name: string) {
    error.value = ''
    remember(await post(`/api/rooms/${encodeURIComponent(id)}/join`, { name }))
  }
  async function send(input: CommandInput) {
    if (!client || !connected.value) {
      error.value = '請等待重新連線後操作。'
      return false
    }
    const gameId = input.gameId ?? game.state?.id
    if (!gameId) {
      error.value = '正在同步房間，請稍後再試。'
      return false
    }
    const currentClient = client
    pending.value++
    error.value = ''
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
      error.value = reply.error
      currentClient.sync()
      return false
    } catch (reason) {
      if (client === currentClient) {
        error.value = (reason as Error).message
        currentClient.sync()
      }
      return false
    } finally {
      if (client === currentClient) pending.value = Math.max(0, pending.value - 1)
    }
  }
  async function edit(index: number, mark = false) {
    const state = game.state
    if (!state || state.phase !== 'playing' || pendingCells.value.includes(index)) return
    const before = state.cells[index]
    const nextState = mark
      ? before === 'marked'
        ? 'empty'
        : 'marked'
      : before === 'empty'
        ? 'queen'
        : before === 'queen'
          ? 'marked'
          : 'empty'
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
    try {
      await send({ type, gameId: game.state.id })
    } finally {
      assisting.value = false
    }
  }
  function point(index: number) {
    if (game.state?.phase === 'playing') client?.point(game.state.id, index)
  }
  function clock() {
    game.clock()
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
    credentials,
    connected,
    connecting,
    error,
    pending,
    pendingCells,
    assisting,
    points,
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
