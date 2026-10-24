import Fastify from 'fastify'
import rateLimit from '@fastify/rate-limit'
import fastifyStatic from '@fastify/static'
import { Server } from 'socket.io'
import { resolve } from 'node:path'
import { ZodError } from 'zod'
import {
  commandSchema,
  createRoomSchema,
  credentialsSchema,
  joinRoomSchema,
  pointSchema,
  type ClientEvents,
  type Credentials,
  type RoomReply,
  type ServerEvents,
} from '../shared/coop'
import { RoomError, type RoomRepository } from './model'
import { RoomManager } from './rooms'
import type { Compute } from './compute'
export async function createApp(options: {
  repository: RoomRepository
  compute: Compute
  staticFiles?: boolean
  origin?: string
  logger?: boolean
}) {
  const app = Fastify({ logger: options.logger ?? false, trustProxy: true, bodyLimit: 8192 })
  await app.register(rateLimit, { global: false, max: 120, timeWindow: '1 minute' })
  const manager = new RoomManager(options.repository, options.compute)
  const origins = new Set(
    [
      options.origin,
      ...(process.env.NODE_ENV !== 'production'
        ? ['http://localhost:5173', 'http://127.0.0.1:5173']
        : []),
    ].filter((v): v is string => !!v),
  )
  const io = new Server<
    ClientEvents,
    ServerEvents,
    Record<string, never>,
    { credentials: Credentials }
  >(app.server, {
    maxHttpBufferSize: 16384,
    transports: ['websocket'],
    allowRequest: (request, callback) =>
      callback(null, !request.headers.origin || origins.has(request.headers.origin)),
  })
  manager.onState = (state) => {
    io.to(state.id).emit('room:state', state)
  }
  app.setErrorHandler((error, _request, reply) => {
    if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 429)
      return reply.code(429).send({ error: '操作太頻繁，請稍後再試。' })
    if (error instanceof ZodError) return reply.code(400).send({ error: '輸入資料格式不正確。' })
    if (error instanceof RoomError)
      return reply
        .code(error.code === 'NOT_FOUND' ? 404 : error.code === 'UNAUTHORIZED' ? 401 : 409)
        .send({ error: error.message, code: error.code })
    app.log.error(error)
    return reply.code(500).send({ error: '伺服器無法完成操作，請稍後再試。' })
  })
  app.get('/api/health', () => ({ ok: true }))
  app.post(
    '/api/rooms',
    { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (request) => {
      const { name, ...settings } = createRoomSchema.parse(request.body)
      return manager.create(name, settings)
    },
  )
  app.post<{ Params: { roomId: string } }>(
    '/api/rooms/:roomId/join',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request) => {
      if (!/^[a-f0-9]{12}$/.test(request.params.roomId))
        throw new RoomError('房間連結不正確。', 'NOT_FOUND')
      return manager.join(request.params.roomId, joinRoomSchema.parse(request.body).name)
    },
  )
  io.use((socket, next) => {
    const parsed = credentialsSchema.safeParse(socket.handshake.auth)
    if (!parsed.success) {
      next(new Error('房間身分格式不正確。'))
      return
    }
    socket.data.credentials = parsed.data
    void manager.connect(parsed.data, socket.id).then(
      () => next(),
      (error) => next(error instanceof Error ? error : new Error('連線失敗。')),
    )
  })
  io.on('connection', (socket) => {
    const credentials = socket.data.credentials
    let count = 0,
      windowStart = Date.now(),
      lastPoint = 0
    const errorReply = (error: unknown): RoomReply => ({
      ok: false,
      error: error instanceof RoomError ? error.message : '操作失敗，請稍後再試。',
      code: error instanceof RoomError ? error.code : 'SERVER_ERROR',
    })
    void socket.join(credentials.roomId)
    void manager
      .state(credentials)
      .then((state) => socket.emit('room:state', state))
      .catch((error) => {
        socket.emit('room:error', {
          message: error instanceof Error ? error.message : '同步失敗。',
        })
        socket.disconnect()
      })
    socket.on('room:command', (raw, ack) => {
      if (typeof ack !== 'function') return
      if (Date.now() - windowStart > 10000) {
        windowStart = Date.now()
        count = 0
      }
      if (++count > 80) {
        ack({ ok: false, error: '操作太頻繁，請稍後再試。', code: 'RATE_LIMIT' })
        return
      }
      const parsed = commandSchema.safeParse(raw)
      if (!parsed.success) {
        ack({ ok: false, error: '操作格式不正確。', code: 'INVALID_COMMAND' })
        return
      }
      void manager.command(credentials, parsed.data).then(
        (state) => ack({ ok: true, state }),
        (error) => ack(errorReply(error)),
      )
    })
    socket.on('room:sync', (ack) => {
      if (typeof ack === 'function')
        void manager.state(credentials).then(
          (state) => ack({ ok: true, state }),
          (error) => ack(errorReply(error)),
        )
    })
    socket.on('room:point', (raw) => {
      if (Date.now() - lastPoint < 250) return
      lastPoint = Date.now()
      const parsed = pointSchema.safeParse(raw)
      if (!parsed.success) return
      void manager
        .point(credentials, parsed.data.gameId, parsed.data.index)
        .then((point) => io.to(credentials.roomId).emit('room:point', point))
        .catch(() => {})
    })
    socket.on('disconnect', () => {
      void manager.disconnect(credentials, socket.id).catch((error) => app.log.error(error))
    })
  })
  if (options.staticFiles) {
    await app.register(fastifyStatic, { root: resolve('dist'), wildcard: false })
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api/') || request.url.startsWith('/assets/'))
        return reply.code(404).send({ error: '找不到資源。' })
      return reply.sendFile('index.html')
    })
  }
  const cleanup = setInterval(() => {
    void manager.cleanup().catch((error) => app.log.error(error))
  }, 60000)
  cleanup.unref()
  app.addHook('preClose', async () => {
    clearInterval(cleanup)
    io.disconnectSockets(true)
    io.engine.close()
    await manager.flush()
  })
  app.addHook('onClose', () => options.compute.close())
  return { app, io, manager }
}
