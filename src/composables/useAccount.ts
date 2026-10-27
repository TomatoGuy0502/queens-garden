import { shallowRef } from 'vue'
import { request } from '../services/api'
import { forgetStats, syncStats } from './useGameStats'
import { savePlayerName } from './usePlayerName'
import type { Leaderboard, RunFinish, RunStart } from '../../shared/account'
import type { RunEvent } from '../queens/replay'

/** Neon Auth returns from Google with this one-time parameter; get-session trades it for a cookie. */
export const SESSION_VERIFIER = 'neon_auth_session_verifier'
export interface Account {
  id: string
  name: string
  image: string | null
  /** Public name on leaderboards; null until the player picks one. */
  nickname: string | null
}
/** Whether the server offers sign-in at all (it needs a database and Neon Auth). */
const enabled = shallowRef(false)
const account = shallowRef<Account | null>(null)
let loaded: Promise<void> = Promise.resolve()

/** Reads who is signed in; `verifier` completes a Google sign-in that just returned. */
export function loadAccount(verifier?: string | null) {
  loaded = readAccount(verifier)
  return loaded
}
async function readAccount(verifier?: string | null) {
  const features = await request<{ accounts: boolean }>('/api/features').catch(() => null)
  enabled.value = !!features?.accounts
  const query = verifier ? `?${SESSION_VERIFIER}=${encodeURIComponent(verifier)}` : ''
  const session = enabled.value
    ? await request<{ user?: { id: string; name: string; image: string | null } } | null>(
        `/api/auth/get-session${query}`,
      ).catch(() => undefined)
    : null
  if (!session?.user) {
    account.value = null
    // A session that ended takes the account's statistics off this device; an outage does not.
    if (session !== undefined) forgetStats()
    return
  }
  try {
    const { nickname } = await request<{ nickname: string | null }>('/api/profile')
    const { id, name, image } = session.user
    account.value = { id, name, image, nickname }
    if (nickname) savePlayerName(nickname)
    await syncStats(id)
  } catch {
    // Signed in, but the profile is unreachable for now; play on as a guest.
    account.value = null
  }
}
async function signIn() {
  const { url } = await request<{ url: string }>('/api/auth/sign-in/social', {
    method: 'POST',
    body: { provider: 'google', callbackURL: location.href },
  })
  location.assign(url)
}
async function signOut() {
  await request('/api/auth/sign-out', { method: 'POST', body: {} })
  account.value = null
  forgetStats()
}
async function setNickname(value: string) {
  const { nickname } = await request<{ nickname: string }>('/api/profile', {
    method: 'PUT',
    body: { nickname: value },
  })
  if (account.value) account.value = { ...account.value, nickname }
  savePlayerName(nickname)
}
async function deleteAccount() {
  await request('/api/profile', { method: 'DELETE' })
  await signOut()
}
/** Starts (or resumes) today's ranked daily; null when the player is not signed in. */
export async function startRankedRun(): Promise<RunStart | null> {
  await loaded
  if (!account.value) return null
  return request<RunStart>('/api/daily/start', { method: 'POST', body: {} })
}
export const finishRankedRun = (day: string, seed: number, log: RunEvent[]) =>
  request<RunFinish>('/api/daily/finish', { method: 'POST', body: { day, seed, log } })
export const fetchLeaderboard = (day: string) =>
  request<Leaderboard>(`/api/leaderboard?day=${encodeURIComponent(day)}`)
export function useAccount() {
  return { enabled, account, signIn, signOut, setNickname, deleteAccount }
}
