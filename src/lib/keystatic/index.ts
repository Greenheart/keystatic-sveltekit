import { makeGenericAPIRouteHandler } from '@keystatic/core/api/generic'
import type { Handle } from '@sveltejs/kit'

export { default as KeystaticCMS } from './KeystaticCMS.svelte'

/**
 * Create an API handler for all keystatic API requests.
 */
export function handleKeystaticAPI({
  config,
}: Parameters<typeof makeGenericAPIRouteHandler>[0]): Handle {
  const isKeystaticAPIPath = /^\/api\/keystatic/
  const handle = makeGenericAPIRouteHandler({ config })

  return async ({ event, resolve }) => {
    if (isKeystaticAPIPath.test(event.url.pathname)) {
      const { body, ...responseInit } = await handle(event.request)
      return new Response(body, responseInit)
    }

    return resolve(event)
  }
}
