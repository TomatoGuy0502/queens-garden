export const ROOM_CODE_LENGTH = 5
export const ROOM_CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
export const ROOM_CODE_PATTERN = /^[A-Z0-9]{5}$/
export function parseRoomCode(value: string): string | null {
  let code = value.trim()
  try {
    code = new URL(code).pathname.split('/').filter(Boolean).at(-1) ?? ''
  } catch {
    /* A bare code is also valid. */
  }
  code = code.toUpperCase()
  return ROOM_CODE_PATTERN.test(code) ? code : null
}
