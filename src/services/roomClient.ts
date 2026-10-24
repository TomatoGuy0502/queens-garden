import { io, type Socket } from 'socket.io-client'
import type {
  ClientEvents,
  Credentials,
  Point,
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
  socket.on('connect', () => handlers.status(true))
  socket.on('disconnect', () => handlers.status(false))
  socket.on('connect_error', (error) => handlers.status(false, error.message))
  socket.on('room:error', (error) => handlers.status(false, error.message))
  socket.connect()
  return {
    command(command: RoomCommand): Promise<RoomReply> {
      if (!socket.connected) return Promise.reject(new Error('連線中斷，請等待重新連線。'))
      return new Promise((resolve, reject) =>
        socket
          .timeout(150000)
          .emit('room:command', command, (error: Error | null, response: RoomReply) =>
            error ? reject(new Error('等待伺服器回應逾時，請重新連線同步。')) : resolve(response),
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
    close() {
      socket.removeAllListeners()
      socket.disconnect()
    },
  }
}
