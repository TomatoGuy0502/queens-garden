import './server/env'
import { databaseUrl } from './server/databaseUrl'
import { defineConfig } from 'drizzle-kit'
export default defineConfig({
  dialect: 'postgresql',
  migrations: { table: '__queens_migrations', schema: 'drizzle' },
  schema: './server/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: databaseUrl(
      process.env.DATABASE_URL_UNPOOLED ??
        process.env.DATABASE_URL ??
        'postgres://queens:queens@localhost:5432/queens',
    ),
  },
})
