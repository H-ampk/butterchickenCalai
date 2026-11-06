import { handleHealth, HEALTH_PATH } from './health.ts'

export interface Env {
  DB?: D1Database
  ASSETS?: Fetcher
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url)
    if (pathname === HEALTH_PATH) {
      return handleHealth(request, env.DB)
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request)
    }

    return new Response(null, { status: 404 })
  },
} satisfies ExportedHandler<Env>
