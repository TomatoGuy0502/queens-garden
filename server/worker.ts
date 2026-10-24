import { validateCatalogPuzzle, CatalogValidationError } from './puzzleValidation'
import { parentPort } from 'node:worker_threads'
import { generatePuzzle } from '../src/queens/generator'
import { logicalHint } from '../src/queens/difficulty'
import { createState } from '../src/queens/deductions/state'
import { solve } from '../src/queens/solver'
import type { ComputeJob, ComputeReply } from './compute'
parentPort!.on('message', (job: ComputeJob) => {
  try {
    if (job.type === 'generate' || job.type === 'generate-validated') {
      const puzzle = generatePuzzle(job.options)
      parentPort!.postMessage({
        type: 'queens:compute-result',
        result:
          job.type === 'generate-validated' ? validateCatalogPuzzle(puzzle, job.options) : puzzle,
      } satisfies ComputeReply)
      return
    }
    if (job.type === 'validate') {
      parentPort!.postMessage({
        type: 'queens:compute-result',
        result: validateCatalogPuzzle(job.puzzle, job.options),
      } satisfies ComputeReply)
      return
    }
    const feasibility = solve(job.regions, 1, createState(job.regions, job.cells).candidates)
    const result =
      !feasibility.exhausted && feasibility.solutionCount === 0
        ? { step: null, message: '目前配置無法完成，請先撤回造成矛盾的皇冠或 X。' }
        : logicalHint(job.regions, job.cells)
    parentPort!.postMessage({ type: 'queens:compute-result', result } satisfies ComputeReply)
  } catch (error) {
    parentPort!.postMessage({
      type: 'queens:compute-result',
      error: error instanceof Error ? error.message : '運算失敗。',
      code: error instanceof CatalogValidationError ? error.code : 'COMPUTE_ERROR',
    } satisfies ComputeReply)
  }
})
