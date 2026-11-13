/// <reference lib="webworker" />
import { LocalizedError, errorMessage, message } from '../../shared/message'
import { createState3d } from './deductions/state'
import { logicalHint3d } from './difficulty'
import { generatePuzzle3d } from './generator'
import { cellAt } from './geometry'
import type { Worker3DRequest, Worker3DResponse } from './protocol'
import { solve3d } from './solver'
import type { Queens3DPuzzle } from './types'

let current: Queens3DPuzzle | null = null
self.onmessage = (event: MessageEvent<Worker3DRequest>) => {
  const request = event.data
  const response: Worker3DResponse = { id: request.id }
  try {
    if (request.type === 'generate') {
      current = generatePuzzle3d(request.options)
      // The solution and the reasoning never leave the worker.
      const { solution: _solution, analysis: _analysis, ...definition } = current
      response.puzzle = definition
    } else {
      const puzzle = current
      if (!puzzle) throw new LocalizedError(errorMessage('NO_PUZZLE'))
      if (request.cells.length !== puzzle.size ** 3)
        throw new LocalizedError(errorMessage('INVALID_STATE'))
      if (request.type === 'check') {
        response.mistakes = request.cells.flatMap((state, cell) => {
          const { z, r, c } = cellAt(puzzle.size, cell)
          const isQueen = puzzle.solution[r][c] === z
          return (state === 'queen' && !isQueen) || (state === 'marked' && isQueen) ? [cell] : []
        })
        response.message = response.mistakes.length
          ? message('check.mistakes', { count: response.mistakes.length })
          : message('check.correct')
      } else {
        const allowed = createState3d(puzzle.regions, request.cells).candidates
        const feasibility = solve3d(puzzle.regions, 1, allowed)
        if (!feasibility.exhausted && !feasibility.solutionCount) {
          response.step = null
          response.message = message('hint.impossible')
        } else Object.assign(response, logicalHint3d(puzzle.regions, request.cells))
      }
    }
  } catch (error) {
    response.error =
      error instanceof LocalizedError ? error.localized : errorMessage('COMPUTE_ERROR')
  }
  self.postMessage(response)
}
