import type { Handle } from '@sveltejs/kit'
import { makeGenericAPIRouteHandler } from '@keystatic/core/api/generic'

import config from '../keystatic.config'

const handleKeystatic = makeGenericAPIRouteHandler({ config })

export const handle: Handle = async ({ event, resolve }) => {
  if (event.url.pathname.startsWith('/api/keystatic')) {
    const { body, headers, status, statusText } = await handleKeystatic(event.request)
    return new Response(body, { headers, status, statusText })
  } else if (event.url.pathname.startsWith('/keystatic')) {
    // IDEA: Maybe enable SSR to allow serving the frontend directly from the handle hook
    // Generally SSR could improve the perceived performance of the page
    // Since the SveltKit prerendering doesn't seem to work as well as expected,
    // it makes sense to enabling SSR similarly to how it's done in Remix and Astro.
    // This would also handle fallback routes, allowing the CMS to be started with any collection.
    return resolve(event)
  }

  // IDEA: Let the handle hook implement the /keystatic routes as well.
  // This way, we can hide everything related to Keystatic in a handle-hook to make it very convenient to use.

  // IDEA: Thanks to the generic API handler, it's possible to build integrations with any Vite-based framework.
  // Vue and Solid should probably be possible as well.
  // Keystatic could probably implement a vite plugin that allows usage with any Vite-based framework to serve a react frontend and handle incoming API requests.
  // handle requests before they are handled by the frontend/meta-frameworks.
  // IDEA: Create an issue about creating a vite plugin for Keystatic to allow usage with any Vite-based meta-framework

  return resolve(event)
}
