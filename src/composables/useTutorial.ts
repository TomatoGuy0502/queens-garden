import { computed, shallowRef } from 'vue'
import type { Message } from '../../shared/message'
import { nextCell, type CellAction } from '../queens/cells'
import { classicCourse, goalMet, type TutorialCourse } from '../queens/tutorial'
import type { CellState } from '../queens/types'

export function useTutorial(course: TutorialCourse = classicCourse()) {
  const { lessons } = course
  const index = shallowRef(0)
  const cells = shallowRef<CellState[]>([...lessons[0].preset])
  const hint = shallowRef<{ message: Message; cells: number[] } | null>(null)
  const lesson = computed(() => lessons[index.value])
  const met = computed(() => goalMet(lesson.value.goal, cells.value, course))
  const conflicts = computed(() => course.conflicts(cells.value))
  const isFirst = computed(() => index.value === 0)
  const isLast = computed(() => index.value === lessons.length - 1)
  const highlighted = computed(() => hint.value?.cells ?? lesson.value.highlight)
  function load(target: number) {
    index.value = target
    cells.value = [...lessons[target].preset]
    hint.value = null
  }
  function edit(cell: number, action: CellAction = 'cycle') {
    // The closing lesson only shows the finished board.
    if (isLast.value) return
    cells.value = cells.value.map((state, i) => (i === cell ? nextCell(state, action) : state))
    hint.value = null
  }
  const next = () => !isLast.value && load(index.value + 1)
  const previous = () => !isFirst.value && load(index.value - 1)
  const restart = () => load(index.value)
  const showHint = () => (hint.value = course.hint(cells.value))
  return {
    lessons,
    index,
    lesson,
    cells,
    met,
    conflicts,
    hint,
    highlighted,
    isFirst,
    isLast,
    edit,
    next,
    previous,
    restart,
    showHint,
  }
}
