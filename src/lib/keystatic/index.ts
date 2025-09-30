import type { Config } from '@keystatic/core'
import { type ConfigEnv, type Plugin } from 'vite'
import { error, type Handle, type RequestEvent } from '@sveltejs/kit'
import { makeGenericAPIRouteHandler } from '@keystatic/core/api/generic'
import { cp, readdir, readFile, mkdir } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { Worker } from 'node:worker_threads'
import { type WorkerPool } from './worker-pool.ts'

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

const keystaticRoutePrefix = '/keystatic'
const keystaticAPIRoutePrefix = '/api/keystatic'

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
      if (event.url.pathname.endsWith('.js')) {
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
    if (event.url.pathname.startsWith(keystaticRoutePrefix)) {
      if (!renderUI) {
        // Lazy init when the first request comes in
        // This ensures that the CMS has been configured and the CMS build has been started
        renderUI = await initCMS()
      }
      return renderUI(event)
    } else if (event.url.pathname.startsWith(keystaticAPIRoutePrefix)) {
      const { body, ...responseInit } = await handleAPI(event.request)
      return new Response(body, responseInit)
    }

    return resolve(event)
  }
}

declare global {
  var HAS_CMS_BUILD_STARTED: boolean | undefined
}

type BuildMode = 'prio' | boolean

/**
 * Ensure the initial CMS build only happens once.
 *
 * Since the `vite` command restarts the server multiple times both during development and
 * production builds within the same parent process, we use this function to avoid duplicate
 * builds in the same `vite` process. This also makes the initial build faster.
 */
function getBuildMode(env: ConfigEnv): BuildMode {
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
      // For production, make sure the CMS build finishes before other parts of the app build.
      return 'prio'
    } else {
      // Don't build when serving in production (e.g. preview). In these cases the CMS should already be built.
      return false
    }
  }

  // Build the first time during development
  return true
}

let pool: WorkerPool<undefined, boolean>

/**
 * By using worker threads, we can build the CMS faster compared to if we spawn child processes for every build.
 * This is especially noticeable for dev server restarts when we make multiple builds.
 */
async function buildCMS(buildMode?: BuildMode) {
  // For production builds, run a single worker and close it once done
  if (buildMode === 'prio') {
    return new Promise((done) => {
      const worker = new Worker(resolve(import.meta.dirname, 'build-worker.ts'))
      worker.once('message', (msg: { result: boolean }) => {
        done(msg.result)
        worker.terminate()
      })

      worker.postMessage({ id: randomUUID(), result: false })
    })
  }

  // During development, re-use the same worker in a pool
  pool ??= new (await import('./worker-pool.ts')).WorkerPool(
    resolve(import.meta.dirname, 'build-worker.ts'),
  )

  // Only keep the most recent build job if multiple changes happened rapidly
  const old = pool.taskQueue.shift()
  // Abort without reloading the CMS since no build happened
  old?.resolve(false)

  return pool.runTask()
}

/**
 * Vite plugin to integrate Keystatic with SvelteKit projects
 */
export function keystatic(): Plugin {
  /** The project root directory */
  let projectRoot = ''
  let buildMode: 'prio' | boolean = false

  return {
    name: 'keystatic-sveltekit',
    apply(config, env) {
      projectRoot = config.root ?? process.cwd()
      buildMode = getBuildMode(env)

      return true
    },
    async config(config) {
      if (buildMode === 'prio') {
        console.log('[keystatic-sveltekit] Building Keystatic CMS...')
        await buildCMS(buildMode)
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
      // During dev, reload the Keystatic CMS when the config changes
      server.watcher.add(['./keystatic.config.ts'])
      server.watcher.on('change', async (path) => {
        if (path === 'keystatic.config.ts') {
          const wasBuilt = await buildCMS()
          if (wasBuilt) {
            server.ws.send({ type: 'custom', event: 'keystatic:reload' })
          }
        }
      })
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
export const isKeystaticRoute = (path: string) => path.startsWith(keystaticRoutePrefix)
