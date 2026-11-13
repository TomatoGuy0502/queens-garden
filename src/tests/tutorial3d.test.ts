import { expect, it } from 'vitest'
import { renderSource } from '../i18n/source'
import { goalMet } from '../queens/tutorial'
import type { CellState } from '../queens/types'
import { layersAmbiguous } from '../queens3d/generator'
import { cellAt } from '../queens3d/geometry'
import { solve3d, uniqueSolution3d } from '../queens3d/solver'
import { TUTORIAL_3D_PUZZLE, stackedCourse } from '../queens3d/tutorial'

const course = stackedCourse()
const find = (id: string) => course.lessons.find((lesson) => lesson.id === id)!
const { regions } = TUTORIAL_3D_PUZZLE
const solution = solve3d(regions, 2).solutions[0]
const inSolution = (cell: number) => {
  const { z, r, c } = cellAt(regions.length, cell)
  return solution[r][c] === z
}

it('teaches on a stacked board with one solution that no single layer gives away', () => {
  expect(solve3d(regions, 2).solutionCount).toBe(1)
  expect(uniqueSolution3d(regions, solution)).toBe(true)
  expect(layersAmbiguous(regions)).toBe(true)
})
it('builds every lesson with a goal that is not yet met, except read-only lessons', () => {
  expect(course.lessons.map((lesson) => lesson.id)).toEqual([
    'rules',
    'pillar',
    'stack',
    'single',
    'finish',
    'done',
  ])
  for (const lesson of course.lessons) {
    expect(lesson.preset).toHaveLength(125)
    if (lesson.goal.type === 'continue') expect(lesson.task).toBeNull()
    else expect(goalMet(lesson.goal, lesson.preset, course), lesson.id).toBe(false)
  }
})
it('never presets or asks for a crown or X that contradicts the solution', () => {
  for (const id of ['pillar', 'single', 'finish', 'done']) {
    const lesson = find(id)
    const cells = [...lesson.preset]
    if (lesson.goal.type === 'mark-all') for (const c of lesson.goal.cells) cells[c] = 'marked'
    if (lesson.goal.type === 'queen-at') cells[lesson.goal.cell] = 'queen'
    if (lesson.goal.type !== 'solved') expect(goalMet(lesson.goal, cells, course), id).toBe(true)
    cells.forEach((state, cell) => {
      if (state === 'queen') expect(inSolution(cell), `${id} crown ${cell}`).toBe(true)
      if (state === 'marked') expect(inSolution(cell), `${id} X ${cell}`).toBe(false)
    })
  }
})
it('the pillar lessons are about one pillar', () => {
  expect(course.conflicts(find('stack').preset)).toHaveLength(2)
  const single = find('single')
  if (single.goal.type !== 'queen-at') throw new Error('unexpected goal')
  const pillar = single.goal.cell % 25
  expect(single.highlight.every((cell) => cell % 25 === pillar)).toBe(true)
  expect(single.highlight.filter((cell) => single.preset[cell] === 'empty')).toEqual([
    single.goal.cell,
  ])
})
it('the finishing lesson leaves ten crowns and can be completed by following the hints', () => {
  let cells: CellState[] = [...find('finish').preset]
  expect(cells.filter((state) => state === 'queen')).toHaveLength(15)
  for (let i = 0; i < 100 && !goalMet({ type: 'solved' }, cells, course); i++) {
    const hint = course.hint(cells)
    expect(hint.action, renderSource(hint.message)).not.toBeNull()
    cells = cells.map((value, c) =>
      hint.cells.includes(c) ? (hint.action === 'place' ? 'queen' : 'marked') : value,
    )
  }
  expect(goalMet({ type: 'solved' }, cells, course)).toBe(true)
  expect(goalMet({ type: 'solved' }, find('done').preset, course)).toBe(true)
})
