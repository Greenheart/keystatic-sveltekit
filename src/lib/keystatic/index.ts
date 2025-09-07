import { makeGenericAPIRouteHandler } from '@keystatic/core/api/generic'
import type { Handle } from '@sveltejs/kit'

export function handleKeystaticAPI({
  config,
}: Parameters<typeof makeGenericAPIRouteHandler>[0]): Handle {
  const isKeystaticAPIPath = /^\/api\/keystatic/i
  const handle = makeGenericAPIRouteHandler({ config })

  return async ({ event, resolve }) => {
    if (isKeystaticAPIPath.test(event.url.pathname)) {
      const { body, ...responseInit } = await handle(event.request)
      return new Response(body, responseInit)
    }

    return resolve(event)
  }
}
