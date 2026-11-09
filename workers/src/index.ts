import { handleHealth, HEALTH_PATH } from './health.ts'
import { errorResponse } from './readApi/errors.ts'
import { respondToReadApi } from './readApi/handleReadApi.ts'

export interface Env {
  DB?: D1Database
  ASSETS?: Fetcher
}

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  let pathname: string
  try {
    pathname = new URL(request.url).pathname
  } catch {
    return errorResponse('internal_error')
  }

  if (pathname === HEALTH_PATH) {
    return handleHealth(request, env.DB)
  }

  const readResponse = respondToReadApi(request)
  if (readResponse) {
    return readResponse
  }

  if (env.ASSETS) {
    return env.ASSETS.fetch(request)
  }

  return new Response(null, { status: 404 })
}

export default {
  fetch: handleRequest,
} satisfies ExportedHandler<Env>
