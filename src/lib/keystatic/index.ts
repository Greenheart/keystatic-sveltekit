import type { Config } from '@keystatic/core'
import { makeGenericAPIRouteHandler } from '@keystatic/core/api/generic'
import { error, type Handle, type RequestEvent } from '@sveltejs/kit'
import { cp, readdir, readFile, mkdir } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { type ConfigEnv, type Plugin } from 'vite'
import { Worker } from 'node:worker_threads'
import { randomUUID, type UUID } from 'node:crypto'

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

type TaskResolver<TaskResult> = (result: TaskResult) => void

type ActiveTask<TaskResult> = {
  worker: Worker
  resolve: TaskResolver<TaskResult>
}

class WorkerPool<
  TaskInput,
  TaskResult,
  Task extends { id: UUID; data?: TaskInput } = { id: UUID; data?: TaskInput },
> {
  taskQueue: { task: Task; resolve: TaskResolver<TaskResult> }[] = []

  #workerPath: string
  #workers: Worker[] = []
  #activeTasks: Map<string, ActiveTask<TaskResult>> = new Map()

  constructor(workerPath: string, poolSize = 1) {
    this.#workerPath = workerPath

    for (let i = 0; i < poolSize; i++) {
      this.addWorker()
    }
  }

  addWorker() {
    const worker = new Worker(this.#workerPath)
    worker.on('message', (msg) => {
      const { resolve } = this.#activeTasks.get(msg.id)!
      this.#activeTasks.delete(msg.id)
      resolve(msg.result)
      this.checkQueue(worker)
    })
    worker.on('error', console.error)
    worker.on('exit', () => {
      this.#workers = this.#workers.filter((w) => w !== worker)
      this.addWorker() // Replace worker if it exits unexpectedly
    })
    this.#workers.push(worker)
  }

  runTask(data?: TaskInput) {
    return new Promise((resolve) => {
      this.taskQueue.push({ task: { id: randomUUID(), data } as Task, resolve })
      this.checkQueue()
    })
  }

  checkQueue(workerOverride?: Worker) {
    if (this.taskQueue.length === 0) return

    const idleWorker =
      workerOverride ||
      this.#workers.find(
        (worker) => ![...this.#activeTasks.values()].some((task) => task.worker === worker),
      )

    if (!idleWorker) return

    const { task, resolve } = this.taskQueue.shift()!
    this.#activeTasks.set(task.id, { worker: idleWorker, resolve })
    idleWorker.postMessage(task)
  }

  destroy() {
    this.#workers.forEach((worker) => worker.terminate())
  }
}

let pool: WorkerPool<undefined, boolean>

/**
 * By using worker threads, we can build the CMS faster compared to if we spawn child processes for every build.
 */
async function buildCMS() {
  pool ??= new WorkerPool(resolve(import.meta.dirname, 'build-worker.ts'))

  // Only keep the most recent build job if multiple changes happened rapidly
  const old = pool.taskQueue.shift()
  // Abort without reloading the CMS since no build happened
  old?.resolve(false)

  return pool.runTask()
}

// let worker: Worker
// let task: Promise<void> | null = null
// let queue: { resolve: (result: any) => void }[] = []

// async function buildCMS_worker() {
//   if (!worker) {
//     worker = new Worker('./build-worker.ts')
//     worker.on('error', console.error)
//     // worker.on('exit', () => {
//     //   worker = new Worker('./build-worker.ts')
//     // })
//   }

//   return new Promise((resolve) => {
//     // only allow one task in the queue at a time
//     queue
//     // queue.push({ resolve })

//     worker.once('message', (result) => {
//       resolve(result)
//     })
//   })
// }

/**
 * Vite plugin to integrate Keystatic with SvelteKit projects
 */
export function keystatic(): Plugin {
  /** The project root directory */
  let projectRoot = ''
  /** The development build is saved here */
  let devDir = ''
  /** The production build is saved here */
  let prodDir = ''
  let buildMode: 'prio' | boolean = false

  return {
    name: 'keystatic-sveltekit',
    apply(config, env) {
      projectRoot = config.root ?? process.cwd()

      devDir = resolve(projectRoot, '.svelte-kit/keystatic')
      prodDir = resolve(projectRoot, '.svelte-kit/output/client/')
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
      // During dev, reload the Keystatic CMS when the config changes
      server.watcher.add(['./keystatic.config.ts'])
      server.watcher.on('change', async (path) => {
        if (path === 'keystatic.config.ts') {
          const wasBuilt = await buildCMS()
          console.log(wasBuilt)
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
