import { LocalizedError, errorMessage, type Message } from '../../shared/message'

/** Calls the game's JSON API; a failure carries the server's message for the reader. */
export async function request<T>(
  path: string,
  init?: { method: string; body?: unknown },
): Promise<T> {
  const response = await fetch(path, {
    method: init?.method ?? 'GET',
    headers: init?.body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  })
  const data = (await response.json().catch(() => null)) as (T & { error?: Message }) | null
  if (!response.ok) throw new LocalizedError(data?.error ?? errorMessage('SERVER_ERROR'))
  return data as T
}
