import type { RequestHandler } from '@sveltejs/kit'
import { makeGenericAPIRouteHandler } from '@keystatic/core/api/generic'

import config from '../../../../../keystatic.config'

const handler = makeGenericAPIRouteHandler({ config })

export const fallback: RequestHandler = async ({ request }) => {
  const { body, ...responseInit } = await handler(request)
  return new Response(body, responseInit)
}
