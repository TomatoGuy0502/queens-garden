import { growRegions } from '../queens/regionGrower'

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
