import './env'
import { storageConfig } from './runtimeConfig'
import { createApp } from './app'
import { workerPool } from './compute'
import { fileRepository, postgresRepository } from './repository'
const { production, url, file } = storageConfig(process.env)
const postgres = url ? postgresRepository(url) : null
const repository = postgres?.repository ?? (await fileRepository(file))
console.info(`Room storage: ${postgres ? 'PostgreSQL' : `local file (${file})`}`)
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
