import { shallowRef } from 'vue'
import { LocalizedError, errorMessage, type Message } from '../../shared/message'
import { savePlayerName } from './usePlayerName'
import type { Leaderboard, RunFinish, RunStart } from '../../shared/account'
import type { RunEvent } from '../queens/replay'

/** Neon Auth returns from Google with this one-time parameter; get-session trades it for a cookie. */
export const SESSION_VERIFIER = 'neon_auth_session_verifier'
export interface Account {
  name: string
  image: string | null
  /** Public name on leaderboards; null until the player picks one. */
  nickname: string | null
}
/** Whether the server offers sign-in at all (it needs a database and Neon Auth). */
const enabled = shallowRef(false)
const account = shallowRef<Account | null>(null)
let loaded: Promise<void> = Promise.resolve()

async function request<T>(path: string, init?: { method: string; body?: unknown }): Promise<T> {
  const response = await fetch(path, {
    method: init?.method ?? 'GET',
    headers: init?.body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  })
  const data = (await response.json().catch(() => null)) as (T & { error?: Message }) | null
  if (!response.ok) throw new LocalizedError(data?.error ?? errorMessage('SERVER_ERROR'))
  return data as T
}
/** Reads who is signed in; `verifier` completes a Google sign-in that just returned. */
export function loadAccount(verifier?: string | null) {
  loaded = readAccount(verifier)
  return loaded
}
async function readAccount(verifier?: string | null) {
  const query = verifier ? `?${SESSION_VERIFIER}=${encodeURIComponent(verifier)}` : ''
  const response = await fetch(`/api/auth/get-session${query}`).catch(() => null)
  enabled.value = !!response?.ok
  const session = response?.ok
    ? ((await response.json()) as { user?: { name: string; image: string | null } } | null)
    : null
  if (!session?.user) {
    account.value = null
    return
  }
  try {
    const { nickname } = await request<{ nickname: string | null }>('/api/profile')
    account.value = { name: session.user.name, image: session.user.image, nickname }
    if (nickname) savePlayerName(nickname)
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
