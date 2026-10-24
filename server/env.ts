import { existsSync } from 'node:fs'
// Runtime environment variables take priority. Neon writes .env.local unless .env exists.
for (const path of ['.env.local', '.env']) if (existsSync(path)) process.loadEnvFile(path)
