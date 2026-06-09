import { proxyRequest } from 'h3'

/**
 * Dev-only API proxy: forwards /api/* to the official backend.
 * Not included in static `pnpm generate` output (production uses the CF worker).
 */
export default defineEventHandler((event) => {
  const target = (process.env.NUXT_DEV_API_PROXY || 'https://accounts.betterseqta.org').replace(/\/$/, '')
  return proxyRequest(event, `${target}${event.path}`)
})
