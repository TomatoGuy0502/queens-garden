import './server/env'
import { migrationUrl } from './server/runtimeConfig'
import { databaseUrl } from './server/databaseUrl'
import { defineConfig } from 'drizzle-kit'
export default defineConfig({
  dialect: 'postgresql',
  migrations: { table: '__queens_migrations', schema: 'drizzle' },
  schema: './server/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: databaseUrl(migrationUrl(process.env)),
  },
})
