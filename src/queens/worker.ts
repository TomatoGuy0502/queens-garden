/// <reference lib="webworker" />
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
      if (!current) throw new Error('請先產生關卡。')
      if (request.cells.length !== current.size * current.size) throw new Error('遊戲狀態不合法。')
      if (request.type === 'check') {
        response.mistakes = request.cells.flatMap((state, index) => {
          const isQueen =
            current!.solution[Math.floor(index / current!.size)] === index % current!.size
          return (state === 'queen' && !isQueen) || (state === 'marked' && isQueen) ? [index] : []
        })
        response.message = response.mistakes.length
          ? `找到 ${response.mistakes.length} 個與唯一解不符的皇冠或 X 標記。`
          : '目前的皇冠和 X 標記都正確，繼續吧。'
      } else {
        const allowed = createState(current.regions, request.cells).candidates
        const feasibility = solve(current.regions, 1, allowed)
        if (!feasibility.exhausted && !feasibility.solutionCount) {
          response.step = null
          response.message = '目前配置無法完成：至少一頂皇冠或 X 標記造成矛盾。請先檢查或撤回操作。'
        } else Object.assign(response, logicalHint(current.regions, request.cells))
      }
    }
  } catch (error) {
    response.error = error instanceof Error ? error.message : '運算失敗，請再試一次。'
  }
  self.postMessage(response)
}
