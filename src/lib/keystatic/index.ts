import { makeGenericAPIRouteHandler } from '@keystatic/core/api/generic'
import type { Handle } from '@sveltejs/kit'
import type { Plugin } from 'vite'

import { renderKeystatic } from './ui'

/**
 * Create a handler for all requests to the Keystatic CMS and API.
 */
export function handleKeystatic(...args: Parameters<typeof makeGenericAPIRouteHandler>): Handle {
  const isKeystaticPath = /^\/keystatic/
  const isKeystaticAPIPath = /^\/api\/keystatic/
  const handleAPI = makeGenericAPIRouteHandler(...args)

  return async ({ event, resolve }) => {
    if (isKeystaticPath.test(event.url.pathname)) {
      return renderKeystatic()
    } else if (isKeystaticAPIPath.test(event.url.pathname)) {
      const { body, ...responseInit } = await handleAPI(event.request)
      return new Response(body, responseInit)
    }

    return resolve(event)
  }
}

/**
 * Vite plugin to integrate Keystatic with SvelteKit projects
 */
export function keystatic(): Plugin {
  const virtualConfig = 'virtual:keystatic.config'
  const virtualCMS = 'virtual:keystatic-cms'
  // const resolvedVirtualCMS = '\0' + virtualCMS

  return {
    name: 'keystatic',
    // enforce: 'pre',
    async resolveId(id) {
      if (id === virtualConfig) {
        return this.resolve('./keystatic.config', './a')
      }
      // else if (id === virtualCMS) {
      //   return resolvedVirtualCMS
      //   // return this.resolve('$lib/keystatic/keystatic.html?raw', './a', {
      //   //   isEntry: true,
      //   //   custom: [],
      //   // })
      // }
      // return null
    },
    // async load(id) {
    //   if (id === resolvedVirtualCMS) {
    //     return import('$lib/keystatic/keystatic.html?raw')

    //     return
    //   }
    // },
    config(config) {
      return {
        server: {
          // NOTE: The Keystatic SPA redirects to `127.0.0.1` when it loads, which doesn't work with the default SvelteKit + Vite configs.
          // Therefore, we need to make the Vite server host `127.0.0.1` to allow the server to be accessed both via localhost and 127.0.0.1
          // Related issue: https://github.com/Thinkmill/keystatic/issues/366
          // This might be possible to remove in a preprocessing step or by patching Keystatic
          // Ideally we should be able to could configure (or force) keystatic to use the same host as the Vite server.
          ...(config.server?.host ? {} : { host: '127.0.0.1' }),
          fs: {
            // This is required to allow the Keystatic frontend to import the keystatic config
            allow: ['./keystatic.config.ts'],
          },
        },
        optimizeDeps: {
          entries: ['keystatic.config.*'],
        },
      }
    },
  }
}
