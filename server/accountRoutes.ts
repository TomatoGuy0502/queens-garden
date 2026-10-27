import type { FastifyInstance, FastifyRequest } from 'fastify'
import { neonAuth } from './auth'
import type { AccountRepository } from './accounts'
import type { Compute } from './compute'
import { RoomError } from './model'
import {
  finishRunSchema,
  profileSchema,
  type Leaderboard,
  type RunFinish,
  type RunStart,
} from '../shared/account'
import { dailyConfig, dateKey, isDailyPuzzle, isDateKey } from '../src/queens/daily'
import { scoreRun } from '../src/queens/replay'
import type { QueensPuzzle } from '../src/queens/types'

const LEADERBOARD_SIZE = 100

/** Sign-in, the player's profile, ranked dailies and the leaderboard. */
export function accountRoutes(
  app: FastifyInstance,
  options: { authUrl: string; origin?: string; accounts: AccountRepository; compute: Compute },
) {
  const { accounts, compute } = options
  const auth = neonAuth(app, options.authUrl, options.origin)
  const signedIn = async (request: FastifyRequest) => {
    const user = await auth.user(request)
    if (!user) throw new RoomError('SIGN_IN_REQUIRED')
    return user
  }
  // Every finisher of a day replays the same board; generate it once per seed.
  const boards = new Map<string, Promise<QueensPuzzle>>()
  function board(day: string, seed: number) {
    const key = `${day}:${seed}`
    let puzzle = boards.get(key)
    if (!puzzle) {
      if (boards.size >= 16) boards.clear()
      puzzle = compute.generate({ ...dailyConfig(day), seed })
      puzzle.catch(() => boards.delete(key))
      boards.set(key, puzzle)
    }
    return puzzle
  }

  app.get('/api/profile', async (request) => ({
    nickname: await accounts.nickname((await signedIn(request)).id),
  }))
  app.put(
    '/api/profile',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (request) => {
      const { id } = await signedIn(request)
      const { nickname } = profileSchema.parse(request.body)
      await accounts.setNickname(id, nickname)
      return { nickname }
    },
  )
  // Managed Neon Auth does not offer user deletion, so the Google sign-in record stays with Neon.
  app.delete('/api/profile', async (request) => {
    await accounts.delete((await signedIn(request)).id)
    return { ok: true }
  })

  app.post(
    '/api/daily/start',
    { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (request): Promise<RunStart> => {
      const { id } = await signedIn(request)
      const now = new Date()
      const day = dateKey(now)
      const run = await accounts.startRun(id, day, now)
      return { day, elapsedMs: now.getTime() - run.startedAt.getTime(), finished: run.finished }
    },
  )
  app.post(
    '/api/daily/finish',
    { bodyLimit: 256 * 1024, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request): Promise<RunFinish> => {
      const { id } = await signedIn(request)
      const { day, seed, log } = finishRunSchema.parse(request.body)
      const now = new Date()
      if (!isDateKey(day) || !isDailyPuzzle(day, { ...dailyConfig(day), seed }))
        throw new RoomError('RUN_REJECTED')
      // A finish without a start opens a run now, which the clock check then refuses.
      const run = await accounts.startRun(id, day, now)
      if (run.finished) throw new RoomError('RUN_FINISHED')
      const result = scoreRun(
        (await board(day, seed)).regions,
        log,
        now.getTime() - run.startedAt.getTime(),
      )
      if (!result) throw new RoomError('RUN_REJECTED')
      if (!(await accounts.finishRun(id, day, result, now))) throw new RoomError('RUN_FINISHED')
      const mine = (await accounts.leaderboard(day, id, 0)).find((entry) => entry.me)
      return { rank: mine?.rank ?? null, ...result }
    },
  )
  app.get<{ Querystring: { day?: string } }>('/api/leaderboard', async (request) => {
    const today = dateKey()
    const day = request.query.day ?? today
    if (!isDateKey(day) || day > today) throw new RoomError('INVALID_INPUT')
    // A reader whose session cannot be checked still sees the board, just without their own row.
    const user = await auth.user(request).catch(() => null)
    const entries = await accounts.leaderboard(day, user?.id ?? null, LEADERBOARD_SIZE)
    return { day, entries } satisfies Leaderboard
  })
}
