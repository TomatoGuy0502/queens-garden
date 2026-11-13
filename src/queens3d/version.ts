/** Separate from the 2D generator version: changing either algorithm must not move the other. */
export const GENERATOR_3D_VERSION = '1.0.0'
/** Default work budget of a generation recipe; changing either changes every seed's board. */
export const DEFAULT_3D_MAX_ATTEMPTS = 160
export const DEFAULT_3D_MUTATION_BUDGET = 100
export const BOARD_SIZES_3D = [5, 6] as const
