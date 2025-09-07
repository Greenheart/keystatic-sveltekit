import { makeGenericAPIRouteHandler } from '@keystatic/core/api/generic'
import type { Handle } from '@sveltejs/kit'

// IDEA: Thanks to the generic API handler, it's possible to build integrations with any Vite-based framework.
// Keystatic could probably implement a vite plugin that allows usage with any Vite-based framework to serve a react frontend and handle incoming API requests.
// handle requests before they are handled by the frontend/meta-frameworks.
// IDEA: Create an issue about creating a vite plugin for Keystatic to allow usage with any Vite-based meta-framework

/**
 * Create an API handler for all keystatic API requests.
 */
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
