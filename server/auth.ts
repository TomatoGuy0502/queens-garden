import type { FastifyInstance, FastifyRequest } from 'fastify'

const COOKIE_PREFIX = '__Secure-neon-auth'
/** The only Neon Auth endpoints the app needs; everything else stays unreachable through it. */
const PROXIED = new Set(['get-session', 'sign-in/social', 'sign-out'])
const SESSION_TTL_MS = 60000

export interface SessionUser {
  id: string
}

/** Neon Auth cookies from a request, forwarded upstream as-is. */
function neonCookies(header: string | undefined) {
  return (header ?? '')
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.startsWith(COOKIE_PREFIX))
    .join('; ')
}
/** Rewrites an upstream cookie for this origin, so the browser only ever stores first-party cookies. */
export function firstPartyCookie(header: string) {
  return [
    ...header
      .split(';')
      .map((part) => part.trim())
      .filter((part) => !/^(domain|samesite|partitioned)\b/i.test(part)),
    'SameSite=Lax',
  ].join('; ')
}

/**
 * Proxies Neon Auth under `/api/auth/*` so its session cookie is set on this origin, which keeps
 * sign-in working where third-party cookies are blocked (Safari).
 */
export function neonAuth(app: FastifyInstance, baseUrl: string, publicOrigin?: string) {
  const sessions = new Map<string, { user: SessionUser | null; expiresAt: number }>()
  const upstream = (
    path: string,
    init: { method: string; cookie: string; origin: string; search?: string; body?: unknown },
  ) =>
    fetch(`${baseUrl}/${path}${init.search ?? ''}`, {
      method: init.method,
      headers: {
        cookie: init.cookie,
        origin: init.origin,
        ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      redirect: 'manual',
    })
  const originOf = (request: FastifyRequest) =>
    request.headers.origin ??
    (request.headers.referer ? new URL(request.headers.referer).origin : undefined) ??
    publicOrigin ??
    `${request.protocol}://${request.host}`

  app.route<{ Params: { '*': string } }>({
    method: ['GET', 'POST'],
    url: '/api/auth/*',
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    async handler(request, reply) {
      const path = request.params['*']
      if (!PROXIED.has(path)) return reply.code(404).send()
      const response = await upstream(path, {
        method: request.method,
        cookie: neonCookies(request.headers.cookie),
        origin: originOf(request),
        search: new URL(request.url, 'http://local').search,
        body: request.method === 'POST' ? (request.body ?? {}) : undefined,
      })
      const cookies = response.headers.getSetCookie().map(firstPartyCookie)
      if (cookies.length) reply.header('set-cookie', cookies)
      const type = response.headers.get('content-type')
      if (type) reply.type(type)
      return reply.code(response.status).send(Buffer.from(await response.arrayBuffer()))
    },
  })

  /** The signed-in user behind a request, briefly cached so API calls do not each reach Neon. */
  async function user(request: FastifyRequest): Promise<SessionUser | null> {
    const cookie = neonCookies(request.headers.cookie)
    if (!cookie.includes(`${COOKIE_PREFIX}.session_token=`)) return null
    const cached = sessions.get(cookie)
    if (cached && cached.expiresAt > Date.now()) return cached.user
    const response = await upstream('get-session', {
      method: 'GET',
      cookie,
      origin: originOf(request),
    })
    if (!response.ok) throw new Error(`Neon Auth session lookup failed: ${response.status}`)
    const body = (await response.json()) as { user?: { id?: unknown } } | null
    const found = typeof body?.user?.id === 'string' ? { id: body.user.id } : null
    for (const [key, entry] of sessions) if (entry.expiresAt <= Date.now()) sessions.delete(key)
    sessions.set(cookie, { user: found, expiresAt: Date.now() + SESSION_TTL_MS })
    return found
  }
  return { user }
}
