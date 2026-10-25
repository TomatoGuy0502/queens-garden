import { Worker } from 'node:worker_threads'
import { resolve } from 'node:path'
import type { Message } from '../shared/message'
import type { CellState, DeductionStep, GenerateOptions, QueensPuzzle } from '../src/queens/types'
export interface HintResult {
  step: DeductionStep | null
  message: Message
}
export type ComputeJob =
  | { type: 'generate'; options: GenerateOptions }
  | { type: 'generate-validated'; options: GenerateOptions }
  | { type: 'validate'; puzzle: QueensPuzzle; options: GenerateOptions }
  | { type: 'hint'; regions: number[][]; cells: CellState[] }
export interface ComputeReply {
  type: 'queens:compute-result'
  result?: unknown
  error?: string
  code?: string
}
export interface Compute {
  generate(options: GenerateOptions): Promise<QueensPuzzle>
  hint(regions: number[][], cells: CellState[]): Promise<HintResult>
  close(): Promise<void>
}
export type ComputePriority = 'foreground' | 'background'
export interface CatalogCompute extends Compute {
  generateValidated(options: GenerateOptions, priority?: ComputePriority): Promise<QueensPuzzle>
  validate(puzzle: QueensPuzzle, options: GenerateOptions): Promise<QueensPuzzle>
  cancelBackground(): void
  isIdle(): boolean
}
export class ComputeError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message)
  }
}
interface Task {
  job: ComputeJob
  priority: ComputePriority
  resolve(result: unknown): void
  reject(error: Error): void
}
export function workerPool(concurrency = 2, timeoutMs = 120000): CatalogCompute {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4)
    throw new Error('WORKER_CONCURRENCY must be between 1 and 4.')
  const foreground: Task[] = [],
    background: Task[] = []
  const running = new Map<
    Worker,
    { priority: ComputePriority; finish(error?: Error, result?: unknown): void }
  >()
  let closed = false
  function drain() {
    while (!closed && running.size < concurrency) {
      const task = foreground.shift() ?? (!running.size ? background.shift() : undefined)
      if (!task) break
      const worker = new Worker(resolve('dist-server/worker.js'), { execArgv: [] })
      let finished = false
      const finish = (error?: Error, result?: unknown) => {
        if (finished) return
        finished = true
        clearTimeout(timer)
        running.delete(worker)
        void worker.terminate()
        if (error) task.reject(error)
        else task.resolve(result)
        drain()
      }
      running.set(worker, { priority: task.priority, finish })
      const timer = setTimeout(
        () => finish(new ComputeError('Computation timed out.', 'COMPUTE_TIMEOUT')),
        task.priority === 'background' ? Math.min(timeoutMs, 15000) : timeoutMs,
      )
      // Node --watch also sends dependency messages through worker events.
      worker.on('message', (value: unknown) => {
        if (
          !value ||
          typeof value !== 'object' ||
          !('type' in value) ||
          value.type !== 'queens:compute-result'
        )
          return
        const reply = value as ComputeReply
        finish(
          reply.error ? new ComputeError(reply.error, reply.code ?? 'COMPUTE_ERROR') : undefined,
          reply.result,
        )
      })
      worker.once('error', (error) =>
        finish(error instanceof Error ? error : new Error('Computation failed.')),
      )
      worker.once('exit', () => {
        if (!finished) finish(new ComputeError('The compute service stopped.', 'COMPUTE_CLOSED'))
      })
      worker.postMessage(task.job)
    }
  }
  function execute<T>(job: ComputeJob, priority: ComputePriority = 'foreground'): Promise<T> {
    if (closed || foreground.length >= 16)
      return Promise.reject(new ComputeError('The compute service is busy.', 'COMPUTE_BUSY'))
    if (priority === 'background' && (running.size || foreground.length || background.length))
      return Promise.reject(
        new ComputeError('Preempted by a player request.', 'BACKGROUND_PREEMPTED'),
      )
    return new Promise<T>((resolve, reject) => {
      const task: Task = { job, priority, resolve: (value) => resolve(value as T), reject }
      if (priority === 'foreground') {
        foreground.push(task)
        for (const entry of running.values())
          if (entry.priority === 'background')
            entry.finish(new ComputeError('Preempted by a player request.', 'BACKGROUND_PREEMPTED'))
      } else background.push(task)
      drain()
    })
  }
  return {
    generate: (options) => execute<QueensPuzzle>({ type: 'generate', options }),
    generateValidated: (options, priority = 'foreground') =>
      execute<QueensPuzzle>({ type: 'generate-validated', options }, priority),
    validate: (puzzle, options) => execute<QueensPuzzle>({ type: 'validate', puzzle, options }),
    hint: (regions, cells) => execute<HintResult>({ type: 'hint', regions, cells }),
    cancelBackground() {
      for (const task of background.splice(0))
        task.reject(new ComputeError('Preempted by a player request.', 'BACKGROUND_PREEMPTED'))
      for (const entry of running.values())
        if (entry.priority === 'background')
          entry.finish(new ComputeError('Preempted by a player request.', 'BACKGROUND_PREEMPTED'))
    },
    isIdle: () => !running.size && !foreground.length && !background.length,
    async close() {
      closed = true
      for (const task of [...foreground.splice(0), ...background.splice(0)])
        task.reject(new ComputeError('The compute service is closed.', 'COMPUTE_CLOSED'))
      await Promise.all([...running.keys()].map((worker) => worker.terminate()))
    },
  }
}
