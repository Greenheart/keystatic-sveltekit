import { makeGenericAPIRouteHandler } from '@keystatic/core/api/generic'
import type { Handle } from '@sveltejs/kit'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { transformWithEsbuild, type Plugin } from 'vite'

let cmsHTML: string | null = null

async function buildCMS() {
  if (cmsHTML) return cmsHTML
  const htmlTemplate = await readFile(resolve(import.meta.dirname, './keystatic.html'), 'utf-8')
  const rawClient = await readFile(resolve(import.meta.dirname, './client.tsx'), 'utf-8')
  const built = await transformWithEsbuild(rawClient, 'client.tsx', {
    jsx: 'automatic',
    platform: 'browser',
  })

  // This works successfully transforms the code, but the imports won't work since it wasn't done by the main Vite build
  // IDEA: Maybe bundling with ESBuild could solve this?
  // If bundling to one HTML file works, then we could add a vite plugin hook to do this when building the app, and serve the static version after that.
  // Basically this would mean copying the keystatic.html file to the build output, and serving it from there.
  cmsHTML = htmlTemplate.replace('%CMS%', `<script type="module">${built.code}</script>`)

  return cmsHTML
}

export async function renderKeystatic() {
  const body = await buildCMS()
  // const template = import.meta.glob('./keystatic.html')

  // const raw = ((await template['./keystatic.html']()) as any)?.default
  // console.log(raw)

  // // const raw = (await import('./keystatic.html?raw')).default

  // // TODO: Find a better way to resolve the actual module path.
  // // TODO: Make this work for production builds
  // // IDEA: Maybe this could be transformed in the keystatic Vite plugin instead of doing manual string replacements?
  // // There might be a way to call transformIndexHTML or similar to resolve imports in a given HTML file
  // // const body = raw.replace('./client.tsx', '/src/lib/keystatic/client.tsx')

  // const built = transformWithEsbuild()

  // TODO: If we transform the code with Esbuild, we should also do it during prerendering and use specific code for dev vs prod
  // Ideally not serving everything as one big html file, but it could work as a start.

  // IDEA: Or, perhaps we could prebuild the keystatic CMS with the Vite JS API, cache it in the node_modules directory?
  // Then during build, we could copy over those assets to the output directory so we can use it.
  return new Response(body, { headers: { 'Content-Type': 'text/html' } })
}

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
