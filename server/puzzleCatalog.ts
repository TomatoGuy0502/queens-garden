import { randomBytes } from 'node:crypto'
import type { GenerateOptions, QueensPuzzle } from '../src/queens/types'
import { DIFFICULTIES } from '../src/queens/levels'
import type { CatalogCompute } from './compute'
import { ComputeError } from './compute'
import {
  catalogRecord,
  type CatalogBucket,
  type CatalogRepository,
  type CatalogRequest,
} from './puzzleCatalogModel'
/** Seeds tried for a request without a fixed seed; large boards often exhaust the budget. */
const RANDOM_SEED_ATTEMPTS = 3
export interface PuzzleSource {
  get(request: CatalogRequest): Promise<QueensPuzzle>
}
export const DEFAULT_STOCK: CatalogBucket[] = DIFFICULTIES.map((difficulty) => ({
  size: 8,
  difficulty,
}))
export interface CatalogOptions {
  enabled?: boolean
  target?: number
  buckets?: CatalogBucket[]
  idleMs?: number
  retryMs?: number
  seed?: () => number
  report?: (message: string) => void
}
/** Verified persistent archive plus a small, demand-driven idle stock. */
export class PuzzleCatalog implements PuzzleSource {
  private timer: ReturnType<typeof setTimeout> | undefined
  private refill: Promise<void> | undefined
  private closed = false
  private active = 0
  private lastDemand = 0
  private failures = 0
  private cursor = 0
  private exactRequests = new Map<string, Promise<QueensPuzzle>>()
  private options: Required<Omit<CatalogOptions, 'report'>> & { report: (message: string) => void }
  readonly stats = { stockHits: 0, seedHits: 0, generated: 0, prefilled: 0, rejected: 0 }
  constructor(
    private repository: CatalogRepository,
    private compute: CatalogCompute,
    options: CatalogOptions = {},
  ) {
    this.options = {
      enabled: true,
      target: 3,
      buckets: DEFAULT_STOCK,
      idleMs: 3000,
      retryMs: 30000,
      seed: () => randomBytes(4).readUInt32LE(),
      report: () => undefined,
      ...options,
    }
    if (
      !Number.isInteger(this.options.target) ||
      this.options.target < 1 ||
      this.options.target > 5
    )
      throw new Error('Puzzle stock target must be between 1 and 5.')
  }
  private async storage<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation()
    } catch {
      this.options.report('題庫儲存操作失敗。')
      throw new Error('暫時無法讀取或儲存題庫，請稍後再試。')
    }
  }
  get(request: CatalogRequest): Promise<QueensPuzzle> {
    if (this.closed) return Promise.reject(new Error('題庫服務已停止。'))
    if (request.seed !== undefined) {
      const key = `${request.size}:${request.difficulty}:${request.seed}`
      const existing = this.exactRequests.get(key)
      if (existing) return existing.then((puzzle) => structuredClone(puzzle))
      const work = this.obtain(request)
      this.exactRequests.set(key, work)
      void work
        .finally(() => {
          if (this.exactRequests.get(key) === work) this.exactRequests.delete(key)
        })
        .catch(() => undefined)
      return work
    }
    return this.obtain(request)
  }
  private async obtain(request: CatalogRequest): Promise<QueensPuzzle> {
    this.active++
    this.lastDemand = Date.now()
    this.failures = 0
    this.compute.cancelBackground()
    try {
      const cached = await this.storage(() =>
        request.seed !== undefined
          ? this.repository.exact({ ...request, seed: request.seed })
          : this.repository.takeFresh(request),
      )
      if (cached) {
        try {
          const options: GenerateOptions = {
            size: request.size,
            difficulty: request.difficulty,
            seed: request.seed ?? cached.puzzle.seed,
          }
          const puzzle = await this.compute.validate(cached.puzzle, options)
          if (catalogRecord(puzzle).hash !== cached.hash)
            throw new ComputeError('題庫盤面指紋不符。', 'CATALOG_INVALID')
          if (request.seed !== undefined) this.stats.seedHits++
          else this.stats.stockHits++
          return puzzle
        } catch (error) {
          if (!(error instanceof ComputeError) || error.code !== 'CATALOG_INVALID') throw error
          this.stats.rejected++
          await this.storage(() => this.repository.invalidate(cached.hash))
        }
      }
      const puzzle = await this.generate(request)
      const record = catalogRecord(puzzle)
      await this.storage(() => this.repository.save(record, { served: true }))
      this.stats.generated++
      return puzzle
    } finally {
      this.active--
      this.lastDemand = Date.now()
      this.schedule()
    }
  }
  /** A seed the player did not choose is ours to replace when its budget runs out; theirs is not. */
  private async generate(request: CatalogRequest): Promise<QueensPuzzle> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.compute.generateValidated({
          ...request,
          seed: request.seed ?? this.options.seed(),
        })
      } catch (error) {
        const exhausted = error instanceof ComputeError && error.code === 'GENERATION_BUDGET'
        if (!exhausted || request.seed !== undefined || attempt >= RANDOM_SEED_ATTEMPTS) throw error
      }
    }
  }
  start() {
    this.schedule()
  }
  private schedule(delay = this.options.idleMs) {
    if (this.closed || !this.options.enabled || this.failures >= 3) return
    clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      this.timer = undefined
      void this.refillOnce()
    }, delay)
    this.timer.unref()
  }
  /** One bounded background attempt; public for local diagnostics and deterministic tests. */
  async refillOnce(): Promise<void> {
    if (this.closed || !this.options.enabled || this.refill || this.failures >= 3) return
    if (
      this.active ||
      !this.compute.isIdle() ||
      Date.now() - this.lastDemand < this.options.idleMs
    ) {
      this.schedule()
      return
    }
    const work = this.fill()
    this.refill = work
    try {
      await work
    } finally {
      if (this.refill === work) this.refill = undefined
    }
  }
  private async fill() {
    try {
      for (let offset = 0; offset < this.options.buckets.length; offset++) {
        const index = (this.cursor + offset) % this.options.buckets.length,
          bucket = this.options.buckets[index]
        const count = await this.storage(() => this.repository.countFresh(bucket))
        if (this.closed) return
        if (count >= this.options.target) continue
        if (this.active || !this.compute.isIdle()) {
          this.schedule()
          return
        }
        this.cursor = (index + 1) % this.options.buckets.length
        const puzzle = await this.compute.generateValidated(
          { ...bucket, seed: this.options.seed() },
          'background',
        )
        if (this.closed) return
        await this.storage(() => this.repository.save(catalogRecord(puzzle)))
        const after = await this.storage(() => this.repository.countFresh(bucket))
        if (after <= count) {
          this.failures++
          this.schedule(this.options.retryMs)
        } else {
          this.failures = 0
          this.stats.prefilled++
          this.schedule(1000)
        }
        return
      }
      // Full stock is dormant: no database polling until the next player demand.
    } catch (error) {
      if (this.closed) return
      if (error instanceof ComputeError && error.code === 'BACKGROUND_PREEMPTED') {
        this.schedule()
        return
      }
      this.failures++
      this.options.report('背景出題未完成，稍後重試；連續三次失敗後停止，直到新的玩家請求。')
      this.schedule(this.options.retryMs)
    }
  }
  async stop() {
    this.closed = true
    clearTimeout(this.timer)
    this.compute.cancelBackground()
    await this.refill
  }
}
