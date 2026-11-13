import { SOLO_ONLY } from '../deployment'
import type { PuzzleDefinition } from '../queens/types'

/** A link that opens this board, or the day's challenge when a daily date is given. */
export function puzzleLink(
  puzzle: Pick<PuzzleDefinition, 'size' | 'difficulty' | 'seed' | 'version'>,
  path = '/solo',
  daily: string | null = null,
): string {
  const url = new URL(location.pathname, location.origin)
  const query = new URLSearchParams(
    daily
      ? { daily }
      : {
          size: String(puzzle.size),
          difficulty: puzzle.difficulty,
          seed: String(puzzle.seed),
          v: puzzle.version,
        },
  ).toString()
  if (SOLO_ONLY) url.hash = `${path}?${query}`
  else url.search = query
  return url.href
}
