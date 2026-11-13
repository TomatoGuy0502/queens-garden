import { growRegions, mutateRegions } from '../queens/regionGrower'
import { validRegions } from '../queens/validator'
import { validShape } from './geometry'

/** A skeleton is a Latin square, so the crowns of one layer are a row → column permutation. */
export const layerPlacement = (skeleton: number[][], z: number) =>
  skeleton.map((row) => row.indexOf(z))
/** Region ids are n per layer: id = z * n + the id the 2D grower gave within that layer. */
export const layerRegions = (regions: number[][][], z: number) =>
  regions[z].map((row) => row.map((id) => id - z * regions.length))

/** Grows n connected regions inside every layer, one around each crown of the skeleton. */
export function growRegions3d(
  skeleton: number[][],
  rng: () => number,
  minimumArea = 2,
): number[][][] {
  const n = skeleton.length
  return Array.from({ length: n }, (_, z) =>
    growRegions(layerPlacement(skeleton, z), rng, minimumArea).map((row) =>
      row.map((id) => z * n + id),
    ),
  )
}

/**
 * Moves one boundary cell to a neighbouring region of the same layer, preferring layers and
 * cells that alternative solutions use. Null when no layer has a legal move.
 */
export function mutateRegions3d(
  regions: number[][][],
  skeleton: number[][],
  rng: () => number,
  minimumArea = 2,
  alternatives: readonly number[][][] = [],
): number[][][] | null {
  const n = regions.length
  // Weight a layer by the crowns alternative solutions put there off the target; +1 keeps every layer possible.
  const layers = Array.from({ length: n }, (_, z) => ({
    z,
    order:
      -Math.log(1 - rng()) /
      (1 +
        alternatives.reduce(
          (sum, other) =>
            sum + other.flat().filter((layer, i) => layer === z && skeleton.flat()[i] !== z).length,
          0,
        )),
  })).sort((a, b) => a.order - b.order)
  for (const { z } of layers) {
    const mutated = mutateRegions(
      layerRegions(regions, z),
      layerPlacement(skeleton, z),
      rng,
      minimumArea,
      alternatives.map((other) => layerPlacement(other, z)),
    )
    if (mutated)
      return regions.map((layer, i) =>
        i === z ? mutated.map((row) => row.map((id) => z * n + id)) : layer,
      )
  }
  return null
}
/** Every region connected, large enough, and inside the layer its id belongs to. */
export function validRegions3d(regions: number[][][], minimumArea = 2): boolean {
  return (
    validShape(regions) &&
    regions.every((layer, z) => {
      const local = layerRegions(regions, z)
      return (
        layer.every((row) => row.every((id) => Math.floor(id / regions.length) === z)) &&
        validRegions(local, minimumArea)
      )
    })
  )
}
