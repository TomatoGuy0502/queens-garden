/** Static solo builds never require the game server. */
export const SOLO_ONLY = import.meta.env.MODE === 'solo'
