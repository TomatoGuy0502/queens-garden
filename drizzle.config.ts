import './server/env'
import { migrationUrl } from './server/runtimeConfig'
import { databaseUrl } from './server/databaseUrl'
import { defineConfig } from 'drizzle-kit'
export default defineConfig({
  dialect: 'postgresql',
  migrations: { table: '__queens_migrations', schema: 'drizzle' },
  schema: './server/schema.ts',
  // Neon Auth owns the neon_auth schema in the same database.
  schemaFilter: ['public'],
  out: './drizzle',
  dbCredentials: {
    url: databaseUrl(migrationUrl(process.env)),
  },
})
