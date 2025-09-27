import type { Config } from '@keystatic/core'
import { makeGenericAPIRouteHandler } from '@keystatic/core/api/generic'
import { error, type Handle, type RequestEvent } from '@sveltejs/kit'
import { exec } from 'node:child_process'
import { cp, readdir, readFile, mkdir } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { promisify } from 'node:util'
import { type ConfigEnv, type Plugin } from 'vite'

/**
 * Wait until a condition is true.
 */
function until(isReady: () => boolean | Promise<boolean>, checkInterval = 400, timeout = 15_000) {
  const initial = Date.now()
  return new Promise<void>((resolve, reject) => {
    let interval = setInterval(async () => {
      if (!(await isReady())) {
        if (Date.now() - initial > timeout) {
          reject('[until] Timeout: Failed to resolve within allowed time')
        }
        return
      }
      clearInterval(interval)
      resolve()
    }, checkInterval)
  })
}

const isKeystaticPath = /^\/keystatic/
const isKeystaticAPIPath = /^\/api\/keystatic/

/**
 * Create a SvelteKit handle hook to serve the Keystatic CMS and API.
 */
export async function handleKeystatic(
  ...args: Parameters<typeof makeGenericAPIRouteHandler>
): Promise<Handle> {
  const handleAPI = makeGenericAPIRouteHandler(...args)

  const projectRoot = process.cwd()
  const devDir = resolve(projectRoot, '.svelte-kit/keystatic')
  const prodDir = resolve(projectRoot, '.svelte-kit/output/client/')
  const cmsOutDir = process.env.NODE_ENV !== 'development' ? prodDir : devDir
  const cmsHTMLFileName = 'keystatic.html'
  const htmlFile = resolve(cmsOutDir, cmsHTMLFileName)

  async function initCMS() {
    // Wait until we have some build result to show.
    // This is especially important for the first dev and production builds.
    await until(async () => {
      let entries = await readdir(cmsOutDir, 'utf-8')
      let hasCMSFiles = entries.includes(cmsHTMLFileName)

      if (!hasCMSFiles) {
        // Sometimes the CMS files are missing, and in those cases we can try to recover the situation.
        // During the production build, we need to copy the output after the SvelteKit build has completed.
        await mkdir(cmsOutDir, { recursive: true })
        await cp(devDir, cmsOutDir, { recursive: true })

        entries = await readdir(cmsOutDir, 'utf-8')
        hasCMSFiles = entries.includes(cmsHTMLFileName)
      }

      return hasCMSFiles
    })

    return async (event: RequestEvent) => {
      const { building } = await import('$app/environment')
      if (building) {
        // Throwing an HTTP error to triggers the `handleHttpError()` in `svelte.config.ts`
        // where we can prevent prerendering for the CMS
        throw error(400, 'Prerendering is disabled for Keystatic CMS')
      }

      // By serving the HTML response separately from the JS bundle, we can keep the JS cached in the browser,
      // since the same bundle is referenced by all pages. This improves performance for subsequent CMS page loads.
      if (event.url.pathname.endsWith('js')) {
        return new Response(
          await readFile(resolve(cmsOutDir, basename(event.url.pathname)), 'utf-8'),
          { headers: { 'Content-Type': 'application/javascript' } },
        )
      }

      return new Response(await readFile(htmlFile), {
        headers: { 'Content-Type': 'text/html' },
      })
    }
  }

  let renderUI: Awaited<ReturnType<typeof initCMS>>

  return async ({ event, resolve }) => {
    if (isKeystaticPath.test(event.url.pathname)) {
      if (!renderUI) {
        // Lazy init when the first request comes in
        // This ensures that the CMS has been configured and the CMS build has been started
        renderUI = await initCMS()
      }
      return renderUI(event)
    } else if (isKeystaticAPIPath.test(event.url.pathname)) {
      const { body, ...responseInit } = await handleAPI(event.request)
      return new Response(body, responseInit)
    }

    return resolve(event)
  }
}

declare global {
  /** Used to ensure the CMS is only built at most once per `vite` command executed */
  var HAS_CMS_BUILD_STARTED: boolean | undefined
}

type BuildMode = 'prio' | boolean

/**
 * Only (re)build the CMS when it makes sense.
 * This is a simple way to save resources during development,
 * while building for the actual production build, but not when serving.
 */
function getBuildMode(env: ConfigEnv): BuildMode {
  // console.log('Determining buildMode', process.uptime(), globalThis.HAS_CMS_BUILD_STARTED)

  // Avoid duplicate builds in the same execution of the `vite` command.
  // We only need to rebuild the CMS when dependencies have changed,
  // and a simple solution is to build the CMS the first time the Vite dev server or production build starts.
  if (globalThis.HAS_CMS_BUILD_STARTED) {
    return false
  } else {
    // We can use `globalThis` to reliably determine if there has been a previous build.
    // This is possible since `globalThis` is shared in the Vite parent process that restarts the build,
    // and because both the Vite config loading and the SvelteKit dev/build process are run by the same parent process,
    globalThis.HAS_CMS_BUILD_STARTED = true
  }

  if (env.mode !== 'development') {
    if (env.command === 'build') {
      // In production builds, we want to finish the CMS build before other parts of the app
      // This makes sure the CMS build finishes before other parts of the build.
      return 'prio'
    } else {
      // Don't build when serving in production - in those cases the CMS should already be built.
      return false
    }
  }

  // Build the first time during development
  return true
}

/**
 * Build the CMS frontend in a separate process.
 *
 * This allows the rest of the dev server to start up without noticeable delay.
 */
async function buildCMS() {
  const { stdout, stderr } = await promisify(exec)(
    `node ${resolve(import.meta.dirname, 'build.ts')}`,
    // Ensure we build with the React production bundle to create the best possible experience
    // when using Keystatic CMS both locally and in production.
    { env: { NODE_ENV: 'production' } },
  )
  if (stdout) console.log(stdout)
  if (stderr) console.error(stderr)
}

// TODO: What happens if keystatic config changes during development?
// Does that mean the config for the CMS gets out of date?
// We might need to rebuild the CMS as soon as there are changes in the keystatic config
// Maybe could be solved with https://github.com/vitejs/vite/discussions/16708
// We could restart the entire server, but that would be a bit overkill
// A better solution would be to just trigger a new CMS build
// And this only applies during development.
// We could implement a minimal restart based on https://github.com/antfu/vite-plugin-restart/blob/main/src/index.ts

/**
 * Vite plugin to integrate Keystatic with SvelteKit projects
 */
export function keystatic(): Plugin {
  /** The project root directory */
  let projectRoot = ''
  /** Where the cms will be served from */
  let cmsOutDir = ''
  /** The development build is saved here */
  let devDir = ''
  /** The production build is saved here */
  let prodDir = ''
  let buildMode: 'prio' | boolean = false

  let timer: ReturnType<typeof setTimeout> | undefined

  function schedule(fn: () => void) {
    clearTimeout(timer)
    timer = setTimeout(fn, 500)
  }

  return {
    name: 'keystatic-sveltekit',
    apply(config, env) {
      projectRoot = config.root ?? process.cwd()

      devDir = resolve(projectRoot, '.svelte-kit/keystatic')
      prodDir = resolve(projectRoot, '.svelte-kit/output/client/')

      // We always build to both the development and prod directories
      // However, in production, it's important to serve from the production directory since that's included in the build
      cmsOutDir = env.mode !== 'development' ? prodDir : devDir
      buildMode = getBuildMode(env)

      return true
    },
    async config(config) {
      if (buildMode === 'prio') {
        console.log('[keystatic-sveltekit] Building Keystatic CMS...')
        await buildCMS()
      } else if (buildMode) {
        buildCMS()
      }

      const keystaticConfig: Config = (
        await import(/* @vite-ignore */ resolve(projectRoot, 'keystatic.config.ts'))
      ).default

      if (keystaticConfig.storage.kind !== 'local') {
        return {
          server: {
            // When using a Keystatic storage which uses OAuth (like `github`, `cloud`),
            // then both the CMS frontend and the API should be served from `127.0.0.1`
            // By configuring the Vite server host to `127.0.0.1`, we make the server accessible both via `localhost` and `127.0.0.1`.
            // Related issue: https://github.com/Thinkmill/keystatic/issues/366
            ...(config.server?.host ? {} : { host: '127.0.0.1' }),
          },
        }
      }
    },
    configureServer(server) {
      // Restart the server when the Keystatic config changes during development
      server.watcher.add(['./keystatic.config.ts'])
      server.watcher.on('change', async () => {
        await buildCMS()
        // IDEA: Maybe only send to keystatic paths
        // See if there are any examples for how it works
        // NOTE: This works but is super slow. It only updates after the build completed after 4-8 seconds
        // schedule(() => server.ws.send({ type: 'full-reload', path: '/keystatic/*' }))
        schedule(() => server.ws.send({ type: 'full-reload' }))
        // schedule(() => server.restart())
      })
      // TODO: Rebuild the files
      // Maybe it's possible to trigger a reload of specific routes like the Keystatic CMS?

      // IDEA: Maybe we could build the keystatic config separately from the keystatic CMS bundle?
      // If they are separate, it would be possible to only update the config and get quick hot reloads
      // We could export a function that initiates the CMS, which is then called within the index.html file
      // Then the config could be a separate module and loaded on its own. At least during development.
      // module 1: export the function initCMS() that takes the config as its argument
      // module 2 in the HTML, import and call initCMS() with the config
    },
  }
}

/**
 * Returns a boolean indicating whether the given URL path is a Keystatic CMS route.
 *
 * Use this to disable prerendering for Keystatic API routes in the `kit.prerender.handleHttpError()` function in your `svelte.config.js`.
 * This can also be combined with other logic.
 *
 * Learn more: https://svelte.dev/docs/kit/configuration#prerender
 *
 * @example
 * ```ts
 * handleHttpError({ path, message }) {
 *    // Ignore prerendering errors for Keystatic CMS since it's a SPA that only supports CSR.
 *    if (isKeystaticRoute(path)) return
 *
 *   // Fail the build in other cases.
 *   throw new Error(message)
 * }
 * ```
 */
export const isKeystaticRoute = (path: string) => isKeystaticPath.test(path)
