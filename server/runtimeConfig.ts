/** Local development never falls back to production credentials pulled by Neon. */
export function storageConfig(env: NodeJS.ProcessEnv) {
  const production = env.NODE_ENV === 'production'
  const localTest = env.LOCAL_TEST_MODE === '1'
  const url = localTest ? undefined : production ? env.DATABASE_URL : env.LOCAL_DATABASE_URL
  if (production && !localTest && !url) throw new Error('Production requires DATABASE_URL.')
  return { production, url, file: env.ROOM_FILE ?? '.data/rooms.json' }
}
export function migrationUrl(env: NodeJS.ProcessEnv) {
  if (env.LOCAL_TEST_MODE === '1') throw new Error('Migrations are disabled in LOCAL_TEST_MODE.')
  const production = env.NODE_ENV === 'production' || env.DATABASE_TARGET === 'production'
  const url = production
    ? (env.DATABASE_URL_UNPOOLED ?? env.DATABASE_URL)
    : (env.LOCAL_DATABASE_URL_UNPOOLED ?? env.LOCAL_DATABASE_URL)
  if (!url)
    throw new Error(
      production
        ? 'Production migration requires DATABASE_URL_UNPOOLED.'
        : 'Local migration requires LOCAL_DATABASE_URL_UNPOOLED or LOCAL_DATABASE_URL. Production credentials are ignored locally.',
    )
  return url
}
