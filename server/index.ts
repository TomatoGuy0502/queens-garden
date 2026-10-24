import './env'
import { createApp } from './app'
import { workerPool } from './compute'
import { fileRepository, postgresRepository } from './repository'
const production = process.env.NODE_ENV === 'production'
if (production && !process.env.DATABASE_URL) throw new Error('Production requires DATABASE_URL.')
const postgres = process.env.DATABASE_URL ? postgresRepository(process.env.DATABASE_URL) : null
const repository =
  postgres?.repository ?? (await fileRepository(process.env.ROOM_FILE ?? '.data/rooms.json'))
const { app } = await createApp({
  repository,
  compute: workerPool(Number(process.env.WORKER_CONCURRENCY ?? 2)),
  staticFiles: production,
  origin: process.env.PUBLIC_ORIGIN ?? process.env.RENDER_EXTERNAL_URL,
  logger: true,
})
if (postgres) app.addHook('onClose', () => postgres.close())
await app.listen({ port: Number(process.env.PORT ?? 3001), host: '0.0.0.0' })
for (const signal of ['SIGTERM', 'SIGINT'] as const)
  process.once(signal, () => {
    void app.close().then(
      () => process.exit(0),
      (error) => {
        app.log.error(error)
        process.exit(1)
      },
    )
  })
