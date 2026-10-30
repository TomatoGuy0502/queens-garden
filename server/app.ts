import type { PuzzleSource } from './puzzleCatalog'
import { HoverPresence } from './hoverPresence'
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
  hoverSchema,
  roomCodeSchema,
  type ClientEvents,
  type Credentials,
  type RoomReply,
  type ServerEvents,
} from '../shared/coop'
import { errorMessage, type ErrorCode } from '../shared/message'
import { RoomError, type RoomRepository } from './model'
import { RoomManager } from './rooms'
import type { Compute } from './compute'
import { accountRoutes } from './accountRoutes'
import type { AccountRepository } from './accounts'
/** A refused handshake; socket.io passes `data` on to the client's connect_error handler. */
function refusal(reason: ErrorCode | RoomError) {
  const error = typeof reason === 'string' ? new RoomError(reason) : reason
  return Object.assign(new Error(error.code), { data: { message: error.localized } })
}
export async function createApp(options: {
  repository: RoomRepository
  compute: Compute
  puzzles?: PuzzleSource
  staticFiles?: boolean
  origin?: string
  /** Proxies in front of the app; only the address they appended to X-Forwarded-For is trusted. */
  proxyHops?: number
  /** Rooms one address may create per minute. */
  roomLimit?: number
  /** Neon Auth base URL; sign-in is unavailable without it and `accounts`. */
  authUrl?: string
  accounts?: AccountRepository
  logger?: boolean
}) {
  const proxyHops = options.proxyHops ?? 1
  const app = Fastify({
    logger: options.logger ?? false,
    trustProxy: (_address, hop) => hop < proxyHops,
    bodyLimit: 8192,
  })
  await app.register(rateLimit, { global: false, max: 120, timeWindow: '1 minute' })
  const manager = new RoomManager(options.repository, options.compute, undefined, options.puzzles)
  const presence = new HoverPresence()
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
    presence.update(state)
    io.to(state.id).emit('room:state', state)
  }
  app.setErrorHandler((error, _request, reply) => {
    if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 429)
      return reply.code(429).send({ error: errorMessage('RATE_LIMIT'), code: 'RATE_LIMIT' })
    if (error instanceof ZodError)
      return reply.code(400).send({ error: errorMessage('INVALID_INPUT'), code: 'INVALID_INPUT' })
    if (error instanceof RoomError)
      return reply
        .code(
          error.code === 'NOT_FOUND'
            ? 404
            : error.code === 'UNAUTHORIZED' || error.code === 'SIGN_IN_REQUIRED'
              ? 401
              : 409,
        )
        .send({ error: error.localized, code: error.code })
    app.log.error(error)
    return reply.code(500).send({ error: errorMessage('SERVER_ERROR'), code: 'SERVER_ERROR' })
  })
  app.get('/api/health', () => ({ ok: true }))
  const accounts = !!(options.authUrl && options.accounts)
  app.get('/api/features', () => ({ accounts }))
  if (options.authUrl && options.accounts)
    accountRoutes(app, {
      authUrl: options.authUrl,
      origin: options.origin,
      accounts: options.accounts,
      compute: options.compute,
    })
  app.post(
    '/api/rooms',
    { config: { rateLimit: { max: options.roomLimit ?? 5, timeWindow: '1 minute' } } },
    async (request) => {
      const { name, mode, ...settings } = createRoomSchema.parse(request.body)
      return manager.create(name, settings, mode)
    },
  )
  app.get<{ Params: { roomId: string } }>(
    '/api/rooms/:roomId',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request) => ({ mode: await manager.mode(roomCodeSchema.parse(request.params.roomId)) }),
  )
  app.post<{ Params: { roomId: string } }>(
    '/api/rooms/:roomId/join',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request) => {
      const id = roomCodeSchema.parse(request.params.roomId)
      return manager.join(id, joinRoomSchema.parse(request.body).name)
    },
  )
  io.use((socket, next) => {
    const parsed = credentialsSchema.safeParse(socket.handshake.auth)
    if (!parsed.success) {
      next(refusal('INVALID_CREDENTIALS'))
      return
    }
    socket.data.credentials = parsed.data
    void manager.connect(parsed.data, socket.id).then(
      () => next(),
      (error) => next(refusal(error instanceof RoomError ? error : 'CONNECT_FAILED')),
    )
  })
  io.on('connection', (socket) => {
    const credentials = socket.data.credentials
    let count = 0,
      windowStart = Date.now(),
      lastPoint = 0,
      lastHover = 0
    const errorReply = (error: unknown): RoomReply => ({
      ok: false,
      error: error instanceof RoomError ? error.localized : errorMessage('SERVER_ERROR'),
      code: error instanceof RoomError ? error.code : 'SERVER_ERROR',
    })
    void socket.join(credentials.roomId)
    void manager
      .state(credentials)
      .then((state) => {
        socket.emit('room:state', state)
        for (const hover of presence.current(credentials.roomId)) socket.emit('room:hover', hover)
      })
      .catch((error) => {
        socket.emit('room:error', {
          message: error instanceof RoomError ? error.localized : errorMessage('SYNC_FAILED'),
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
        ack({ ok: false, error: errorMessage('RATE_LIMIT'), code: 'RATE_LIMIT' })
        return
      }
      const parsed = commandSchema.safeParse(raw)
      if (!parsed.success) {
        ack({ ok: false, error: errorMessage('INVALID_COMMAND'), code: 'INVALID_COMMAND' })
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
      const point = presence.point(credentials, parsed.data)
      if (point) io.to(credentials.roomId).emit('room:point', point)
    })
    socket.on('room:hover', (raw) => {
      const parsed = hoverSchema.safeParse(raw)
      if (!parsed.success) return
      if (parsed.data.index !== null && Date.now() - lastHover < 80) return
      lastHover = Date.now()
      const hover = presence.move(credentials, socket.id, parsed.data)
      if (hover) io.to(credentials.roomId).emit('room:hover', hover)
    })
    socket.on('disconnect', () => {
      const hover = presence.disconnect(credentials, socket.id)
      if (hover) io.to(credentials.roomId).emit('room:hover', hover)
      void manager.disconnect(credentials, socket.id).catch((error) => app.log.error(error))
    })
  })
  if (options.staticFiles) {
    await app.register(fastifyStatic, { root: resolve('dist'), wildcard: false })
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api/') || request.url.startsWith('/assets/'))
        return reply
          .code(404)
          .send({ error: errorMessage('RESOURCE_NOT_FOUND'), code: 'RESOURCE_NOT_FOUND' })
      return reply.sendFile('index.html')
    })
  }
  const cleanup = setInterval(() => {
    presence.cleanup()
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
