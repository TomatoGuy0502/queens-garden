import { Worker } from 'node:worker_threads'
import { resolve } from 'node:path'
import type { CellState, DeductionStep, GenerateOptions, QueensPuzzle } from '../src/queens/types'
export type HintResult = { step: DeductionStep | null; message: string }
export type ComputeJob =
  | { type: 'generate'; options: GenerateOptions }
  | { type: 'hint'; regions: number[][]; cells: CellState[] }
export interface ComputeReply {
  type: 'queens:compute-result'
  result?: unknown
  error?: string
}
export interface Compute {
  generate(options: GenerateOptions): Promise<QueensPuzzle>
  hint(regions: number[][], cells: CellState[]): Promise<HintResult>
  close(): Promise<void>
}
export function workerPool(concurrency = 2, timeoutMs = 120000): Compute {
  const queue: {
    job: ComputeJob
    resolve: (result: unknown) => void
    reject: (error: Error) => void
  }[] = []
  const running = new Set<Worker>()
  let closed = false
  function drain() {
    while (!closed && queue.length && running.size < concurrency) {
      const task = queue.shift()!
      const worker = new Worker(resolve('dist-server/worker.js'), { execArgv: [] })
      running.add(worker)
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
      const timer = setTimeout(() => finish(new Error('運算逾時，請更換設定後再試。')), timeoutMs)
      // Node --watch also reports dependency imports through worker message events.
      worker.on('message', (value: unknown) => {
        if (
          !value ||
          typeof value !== 'object' ||
          !('type' in value) ||
          value.type !== 'queens:compute-result'
        )
          return
        const reply = value as ComputeReply
        finish(reply.error ? new Error(reply.error) : undefined, reply.result)
      })
      worker.once('error', (error) =>
        finish(error instanceof Error ? error : new Error('運算失敗。')),
      )
      worker.once('exit', () => {
        if (!finished) finish(new Error('運算服務已停止。'))
      })
      worker.postMessage(task.job)
    }
  }
  function execute<T>(job: ComputeJob): Promise<T> {
    if (closed || queue.length >= 16) return Promise.reject(new Error('運算服務忙碌，請稍後再試。'))
    return new Promise<T>((resolve, reject) => {
      queue.push({ job, resolve: (value) => resolve(value as T), reject })
      drain()
    })
  }
  return {
    generate: (options) => execute<QueensPuzzle>({ type: 'generate', options }),
    hint: (regions, cells) => execute<HintResult>({ type: 'hint', regions, cells }),
    async close() {
      closed = true
      for (const task of queue.splice(0)) task.reject(new Error('運算服務已關閉。'))
      await Promise.all([...running].map((worker) => worker.terminate()))
    },
  }
}
