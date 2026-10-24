import { io, type Socket } from 'socket.io-client'
import { i18n } from '../i18n'
import type {
  ClientEvents,
  Credentials,
  Point,
  Hover,
  RoomCommand,
  RoomReply,
  RoomSnapshot,
  ServerEvents,
} from '../../shared/coop'
export function connectRoom(
  credentials: Credentials,
  handlers: {
    state: (state: RoomSnapshot) => void
    point: (point: Point) => void
    hover: (hover: Hover) => void
    status: (connected: boolean, error?: string) => void
  },
) {
  const socket: Socket<ServerEvents, ClientEvents> = io({
    auth: credentials,
    transports: ['websocket'],
    autoConnect: false,
    forceNew: true,
    reconnectionDelay: 300,
    reconnectionDelayMax: 3000,
  })
  socket.on('room:state', handlers.state)
  socket.on('room:point', handlers.point)
  socket.on('room:hover', handlers.hover)
  socket.on('connect', () => handlers.status(true))
  socket.on('disconnect', () => handlers.status(false))
  socket.on('connect_error', (error) => handlers.status(false, error.message))
  socket.on('room:error', (error) => handlers.status(false, error.message))
  let hoverTimer: ReturnType<typeof setTimeout> | undefined
  let queuedHover: { gameId: string; index: number | null } | null = null
  let lastHoverAt = 0
  function flushHover() {
    clearTimeout(hoverTimer)
    hoverTimer = undefined
    if (socket.connected && queuedHover) {
      socket.volatile.emit('room:hover', queuedHover)
      lastHoverAt = performance.now()
    }
    queuedHover = null
  }
  socket.connect()
  return {
    command(command: RoomCommand): Promise<RoomReply> {
      if (!socket.connected)
        return Promise.reject(new Error(i18n.global.t('coop.errors.disconnected')))
      return new Promise((resolve, reject) =>
        socket
          .timeout(150000)
          .emit('room:command', command, (error: Error | null, response: RoomReply) =>
            error ? reject(new Error(i18n.global.t('coop.errors.timeout'))) : resolve(response),
          ),
      )
    },
    sync() {
      socket.timeout(10000).emit('room:sync', (error: Error | null, response: RoomReply) => {
        if (!error && response.ok) handlers.state(response.state)
      })
    },
    point(gameId: string, index: number) {
      if (socket.connected) socket.volatile.emit('room:point', { gameId, index })
    },
    hover(gameId: string, index: number | null) {
      queuedHover = { gameId, index }
      const delay = index === null ? 0 : Math.max(0, 100 - (performance.now() - lastHoverAt))
      if (!delay) flushHover()
      else if (!hoverTimer) hoverTimer = setTimeout(flushHover, delay)
    },
    close() {
      clearTimeout(hoverTimer)
      queuedHover = null
      socket.removeAllListeners()
      socket.disconnect()
    },
  }
}
