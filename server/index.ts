import './env'
import { PuzzleCatalog } from './puzzleCatalog'
import { fileCatalogRepository } from './filePuzzleCatalog'
import { storageConfig } from './runtimeConfig'
import { createApp } from './app'
import { workerPool } from './compute'
import { fileRepository, postgresRepository } from './repository'
const { production, url, file } = storageConfig(process.env)
const postgres = url ? postgresRepository(url) : null
const repository = postgres?.repository ?? (await fileRepository(file))
const engine = workerPool(Number(process.env.WORKER_CONCURRENCY ?? 2))
const catalogRepository =
  postgres?.catalog ??
  (await fileCatalogRepository(process.env.PUZZLE_CATALOG_FILE ?? `${file}.puzzles.json`))
const catalog = new PuzzleCatalog(catalogRepository, engine, {
  enabled: process.env.PUZZLE_PREFILL !== '0',
  target: Number(process.env.PUZZLE_STOCK_TARGET ?? 3),
  report: (message) => console.warn('Puzzle catalog:', message),
})
console.info(`Room storage: ${postgres ? 'PostgreSQL' : `local file (${file})`}`)
const { app } = await createApp({
  repository,
  compute: engine,
  puzzles: catalog,
  staticFiles: production,
  origin: process.env.PUBLIC_ORIGIN ?? process.env.RENDER_EXTERNAL_URL,
  proxyHops: Number(process.env.TRUST_PROXY_HOPS ?? 1),
  roomLimit: Number(process.env.ROOM_CREATE_LIMIT ?? 5),
  logger: true,
})
app.addHook('preClose', () => catalog.stop())
if (postgres) app.addHook('onClose', () => postgres.close())
await app.listen({ port: Number(process.env.PORT ?? 3001), host: '0.0.0.0' })
catalog.start()
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
