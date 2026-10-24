/** Mulberry32: all random choices go through this stable, versioned PRNG. */
export function random(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let x = Math.imul(state ^ (state >>> 15), 1 | state)
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x)
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}
export function shuffle<T>(values: readonly T[], rng: () => number): T[] {
  const result = [...values]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}
export function generatePlacement(size: number, rng: () => number): number[] {
  const columns = Array.from({ length: size }, (_, i) => i)
  const result: number[] = []
  let nodes = 0
  function visit(): boolean {
    if (++nodes > 200000) return false
    if (result.length === size) return true
    for (const col of shuffle(columns, rng)) {
      if (result.includes(col) || (result.length && Math.abs(result.at(-1)! - col) <= 1)) continue
      result.push(col)
      if (visit()) return true
      result.pop()
    }
    return false
  }
  if (!visit()) throw new Error('Queen 配置搜尋已達上限。')
  return result
}
