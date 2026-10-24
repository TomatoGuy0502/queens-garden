import { expect, it } from 'vitest'
import { connected, validRegions, validPlacement, conflictCells } from '../queens/validator'
import { growRegions, mutateRegions } from '../queens/regionGrower'
import { generatePlacement, random } from '../queens/random'

it('connectivity uses only orthogonal edges and checks all region identifiers', () => {
  expect(connected([0, 4], 3)).toBe(false)
  expect(connected([0, 1, 4], 3)).toBe(true)
  expect(connected([], 3)).toBe(false)
  expect(
    validRegions([
      [0, 0],
      [0, 0],
    ]),
  ).toBe(false)
  expect(
    validRegions([
      [0, 0],
      [1, 2],
    ]),
  ).toBe(false)
  expect(
    validRegions([
      [0, 0],
      [1, 1],
    ]),
  ).toBe(true)
})
it('distinguishes row, column, region, adjacency and invalid column violations', () => {
  const regions = Array.from({ length: 6 }, (_, r) => Array<number>(6).fill(r))
  expect(
    conflictCells(regions, [
      { row: 0, col: 0 },
      { row: 0, col: 5 },
    ]),
  ).toHaveLength(2)
  expect(
    conflictCells(regions, [
      { row: 0, col: 0 },
      { row: 3, col: 0 },
    ]),
  ).toHaveLength(2)
  expect(
    conflictCells(regions, [
      { row: 0, col: 2 },
      { row: 1, col: 3 },
    ]),
  ).toHaveLength(2)
  expect(validPlacement(regions, [1, 3, 5, 0, 2, 4])).toBe(true)
  expect(validPlacement(regions, [1, 3, 5, -1, 2, 4])).toBe(false)
  expect(validPlacement(regions, [1, 3])).toBe(false)
})
it('hundreds of boundary mutations preserve connectivity and every solution anchor', () => {
  const rng = random(784)
  const placement = generatePlacement(8, rng)
  let regions = growRegions(placement, rng)
  for (let i = 0; i < 250; i++) {
    regions = mutateRegions(regions, placement, rng) ?? regions
    expect(validRegions(regions)).toBe(true)
    expect(validPlacement(regions, placement)).toBe(true)
    placement.forEach((c, r) => expect(regions[r][c]).toBe(r))
  }
})

it('rejects singleton regions and enforces inclusive difficulty area thresholds', () => {
  expect(validRegions([[0]])).toBe(false)
  expect(
    validRegions([
      [0, 1, 1],
      [2, 1, 1],
      [2, 2, 2],
    ]),
  ).toBe(false)
  const threeCellsEach = [
    [0, 0, 0],
    [1, 1, 1],
    [2, 2, 2],
  ]
  expect(validRegions(threeCellsEach, 3)).toBe(true)
  expect(validRegions(threeCellsEach, 4)).toBe(false)
  const fourCellsEach = Array.from({ length: 4 }, (_, r) => Array<number>(4).fill(r))
  expect(validRegions(fourCellsEach, 4)).toBe(true)
  expect(validRegions(fourCellsEach, 0)).toBe(false)
})

for (const minimumArea of [2, 3, 4])
  it(`boundary mutations never shrink a donor below ${minimumArea} cells`, () => {
    const rng = random(734)
    const solution = generatePlacement(6, rng)
    let regions = Array.from({ length: 6 }, (_, r) => Array<number>(6).fill(r))
    for (let i = 0; i < 100; i++) {
      regions = mutateRegions(regions, solution, rng, minimumArea) ?? regions
      expect(validRegions(regions, minimumArea)).toBe(true)
      expect(validPlacement(regions, solution)).toBe(true)
    }
  })
