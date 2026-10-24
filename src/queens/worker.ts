/// <reference lib="webworker" />
import { LocalizedError, errorMessage, message } from '../../shared/message'
import { generatePuzzle } from './generator'
import { logicalHint } from './difficulty'
import { createState } from './deductions/state'
import { solve } from './solver'
import type { QueensPuzzle } from './types'
import type { WorkerRequest, WorkerResponse } from './protocol'
let current: QueensPuzzle | null = null
self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data
  const response: WorkerResponse = { id: request.id }
  try {
    if (request.type === 'generate') {
      current = generatePuzzle(request.options)
      const { solution: _solution, analysis: _analysis, ...definition } = current
      response.puzzle = definition
    } else {
      if (!current) throw new LocalizedError(errorMessage('NO_PUZZLE'))
      if (request.cells.length !== current.size * current.size)
        throw new LocalizedError(errorMessage('INVALID_STATE'))
      if (request.type === 'check') {
        response.mistakes = request.cells.flatMap((state, index) => {
          const isQueen =
            current!.solution[Math.floor(index / current!.size)] === index % current!.size
          return (state === 'queen' && !isQueen) || (state === 'marked' && isQueen) ? [index] : []
        })
        response.message = response.mistakes.length
          ? message('check.mistakes', { count: response.mistakes.length })
          : message('check.correct')
      } else {
        const allowed = createState(current.regions, request.cells).candidates
        const feasibility = solve(current.regions, 1, allowed)
        if (!feasibility.exhausted && !feasibility.solutionCount) {
          response.step = null
          response.message = message('hint.impossible')
        } else Object.assign(response, logicalHint(current.regions, request.cells))
      }
    }
  } catch (error) {
    response.error =
      error instanceof LocalizedError ? error.localized : errorMessage('COMPUTE_ERROR')
  }
  self.postMessage(response)
}
