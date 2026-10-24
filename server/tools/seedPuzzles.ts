import '../env'
import { parseArgs } from 'node:util'
import { availableParallelism } from 'node:os'
import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import { z } from 'zod'
import { workerPool } from '../compute'
import { batchOptionsSchema, generateBatch } from '../puzzleBatch'
import { fileCatalogRepository } from '../filePuzzleCatalog'
import { postgresRepository } from '../repository'
import { catalogRecord } from '../puzzleCatalogModel'

const { values } = parseArgs({
  options: {
    help: { type: 'boolean', short: 'h' },
    count: { type: 'string', default: '5' },
    difficulty: { type: 'string', default: 'all' },
    workers: {
      type: 'string',
      default: String(Math.min(4, Math.max(1, availableParallelism() - 1))),
    },
    target: { type: 'string', default: 'file' },
    checkpoint: { type: 'string' },
    'max-attempts': { type: 'string' },
    'timeout-seconds': { type: 'string', default: '60' },
    minutes: { type: 'string', default: '10' },
  },
})
if (values.help) {
  console.info(`12×12 已驗證題庫批次生成器
npm run puzzles:seed -- [options]
  --count 5                 每種難度的題數（1–1000）
  --difficulty all          all / easy / medium / hard
  --workers 4               本機平行運算數（1–4）
  --target file             file（隔離檔案）/ local（LOCAL_DATABASE_URL）/ production（DATABASE_URL）
  --checkpoint PATH         保留題目的批次檔；相同路徑可續跑或重新入庫
  --max-attempts N           全批次最多嘗試次數，預設總題數 × 10
  --timeout-seconds 60       每次生成的時間上限（1–300）
  --minutes 10               生成整批的時間上限（1–120）
預設只寫獨立本地檔案，不會使用正式資料庫。Ctrl+C 保留已完成題目，可指定批次檔續跑。`)
} else {
  const target = z.enum(['file', 'local', 'production']).parse(values.target)
  const difficulties =
    values.difficulty === 'all'
      ? (['easy', 'medium', 'hard'] as const)
      : [z.enum(['easy', 'medium', 'hard']).parse(values.difficulty)]
  const options = batchOptionsSchema.parse({
    count: values.count,
    difficulties,
    workers: values.workers,
    maxAttempts: values['max-attempts'] ?? Number(values.count) * difficulties.length * 10,
    checkpoint: resolve(values.checkpoint ?? `.data/puzzle-batches/12x12-${randomUUID()}.json`),
  })
  const timeout = z.coerce.number().int().min(1).max(300).parse(values['timeout-seconds']) * 1000
  const minutes = z.coerce.number().min(1).max(120).parse(values.minutes)
  const url =
    target === 'production'
      ? process.env.DATABASE_URL
      : target === 'local'
        ? process.env.LOCAL_DATABASE_URL
        : undefined
  if (target !== 'file' && !url)
    throw new Error(`未設定 ${target === 'production' ? 'DATABASE_URL' : 'LOCAL_DATABASE_URL'}。`)
  if (target === 'production' && process.env.LOCAL_TEST_MODE === '1')
    throw new Error('LOCAL_TEST_MODE 禁止寫入正式資料庫。')
  const database = url ? postgresRepository(url) : undefined
  const repository =
    database?.catalog ?? (await fileCatalogRepository(`${options.checkpoint}.catalog.json`))
  const compute = workerPool(options.workers, timeout)
  const controller = new AbortController()
  let interrupted = false
  function stop() {
    interrupted = true
    controller.abort()
    void compute.close()
  }
  const timer = setTimeout(stop, minutes * 60000)
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)
  console.info(
    `目標：${target}${url ? ` (${new URL(url).hostname})` : '（隔離檔案）'}；12×12；每種 ${options.count} 題；${options.workers} workers`,
  )
  console.info(`批次檔：${options.checkpoint}`)
  try {
    // Test the destination before spending CPU; counts do not claim puzzles or alter usage.
    for (const difficulty of difficulties)
      console.info(
        `${difficulty} 入庫前未使用庫存：${await repository.countFresh({ size: 12, difficulty })}`,
      )
    const result = await generateBatch(options, compute, controller.signal, console.info)
    clearTimeout(timer)
    if (interrupted) {
      console.info('生成已中斷，已完成題目保留於批次檔；未進行本次入庫。')
      process.exitCode = 130
    } else {
      const selected = result.puzzles.filter((puzzle) => difficulties.includes(puzzle.difficulty))
      for (const puzzle of selected) await repository.save(catalogRecord(puzzle))
      console.info(
        `已入庫 ${selected.length} 題（依盤面去重、不標記為已使用）；生成嘗試 ${result.attempts} 次，失敗 ${result.failures} 次。`,
      )
      for (const difficulty of difficulties)
        console.info(
          `${difficulty} 入庫後未使用庫存：${await repository.countFresh({ size: 12, difficulty })}`,
        )
      if (!result.complete) {
        console.info('已達嘗試上限，僅入庫已驗證題目；尚未達到全部目標，可使用相同批次檔續跑。')
        process.exitCode = 2
      }
    }
  } catch {
    console.error(
      '批次未完成。請檢查資料庫連線、批次檔或運算服務；已寫入批次檔的題目可使用相同 --checkpoint 重新驗證並入庫。',
    )
    process.exitCode = interrupted ? 130 : 1
  } finally {
    clearTimeout(timer)
    process.removeListener('SIGINT', stop)
    process.removeListener('SIGTERM', stop)
    await compute.close()
    await database?.close()
  }
}
