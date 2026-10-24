/** Keep TLS certificate verification explicit for Neon without modifying managed env files. */
export function databaseUrl(value: string): string {
  const url = new URL(value)
  if (url.hostname.endsWith('.neon.tech')) url.searchParams.set('sslmode', 'verify-full')
  return url.toString()
}
