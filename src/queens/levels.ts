export const DIFFICULTIES = ['easy', 'medium', 'hard', 'expert'] as const
export const BOARD_SIZES = [6, 7, 8, 9, 10, 12] as const
/** "6 × 6", or "5 × 5 × 5" for a stacked board, which has as many layers as rows. */
export const boardLabel = (size: number, stacked = false) =>
  `${size} × ${size}${stacked ? ` × ${size}` : ''}`
