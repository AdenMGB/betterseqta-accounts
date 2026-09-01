import { proxyRequest } from 'h3'

/**
 * Dev-only API proxy: forwards /api/* to the local wrangler worker (default :8788) or NUXT_DEV_API_PROXY.
 * Not included in static `pnpm generate` output (production uses the CF worker).
 */
function defaultDevProxyTarget(): string {
  if (process.env.NUXT_DEV_API_PROXY) {
    return process.env.NUXT_DEV_API_PROXY.replace(/\/$/, '')
  }
  if (process.env.NODE_ENV === 'development' || process.env.CF_DEV === '1') {
    return (process.env.DEV_ACCOUNTS_URL || 'http://localhost:8788').replace(/\/$/, '')
  }
  return 'https://accounts.betterseqta.org'
}

export default defineEventHandler((event) => {
  const target = defaultDevProxyTarget()
  return proxyRequest(event, `${target}${event.path}`)
})
