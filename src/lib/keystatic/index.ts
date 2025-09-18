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
    // This is especially important for the very first dev or production builds.
    // Instead of checking if we have the latest version, we simply read the latest matching file for every request
    await until(async () => {
      let entries = await readdir(cmsOutDir, 'utf-8')
      // TODO: Find a better way to detect changes in production.
      // We need to wait for the build to finish, but not delay further than necessary
      // Looking at the log output, it seems like we need to enforce execution at the very last moment, so our build output doesn't get overwritten by SvelteKit
      // We could also consider if we want to block the build at the start, or do it in parallell with SvelteKit and detect once that build is completed.
      // If we could run the build last, that would be great. Otherwise we could watch the directories for changes
      let hasCMSFiles = entries.includes(cmsHTMLFileName)

      if (!hasCMSFiles) {
        // Try copying the files over again.
        // This usually happens after the SvelteKit build has finished.
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
      // IDEA: Use {building} from '$app/environment' to determine if we are prerenering the app
      // IDEA: throw an error and use the handleHttpError to disable prerendering for keystatic routes
      // since we can't specify the prerender option in other ways from our hook.
      // IDEA: Disable prerendering in the root layout and re-enable everywhere.
      // --> this could require significant changes to the project routing
      // IDEA: Disable the crawler and explicitly add all prerendering entries
      // --> this could require significant work as well, especially for larger sites
      // IDEA: We could export a function which could be added to `kit.prerender.handleHttpError`,
      // or called within your wrapping function if you need a more advanced alternative.
      // Conclusion: This is the simplest solution, since you would just have to add this function, and would be
      // free to keep your existing app structure apart from that. In the future, it might be possible to
      // enable/disable prerendering when injecting routes from integrations/plugins.

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
  // TODO: Serve the CMS from a specific directory. This needs access to the plugin context

  // TODO: Maybe prerender the CMS app and inject it as static assets served from node modules?
  // This would work in development, but likely not in preview and prod - in those cases we would need to actually copy the app to the static directory
  // Or could it be solved with symlinks? Though that's not reliable across all platforms
  // Likely static assets will be the best option.

  // We could build the Keystatic app separately (using the locall installed versions of vite, react, react-dom, @keystatic/core)
  // Then capture the output files and update them.
  // Initially build during every server startup.
  // TODO: Verify these injected static assets are handled properly by the SvelteKit router. Maybe we need to adjust the manifest file?
  // TODO: Verify copying the pre-built static assets also works for production.
  // NOTE: Looks like we need to edit .svelte-kit/output/server/manifest.js and .svelte-kit/output/server/manifest-full.js
  // so these both include the expected static assets: keystatic.html and the bundled JS.
  // OR: Maybe we don't need to do that, since these are no special static assets, but only used by the keystatic plugin.
  // As long as the files get copied over to the final build, that's all that matters

  // IDEA: Another approach would be to output the generated keystatic CMS frontend to the regular static directory of the SvelteKit app
  // and let people add it to their git history to automatically include it in their build. Or if they only want to use Keystatic locally during development,
  // they could .gitignore the keystatic files. This would however still include them as static assets during production builds.
  // In that case, they should .gitignore the generated Keystatic CMS files, and disable the keystatic plugin for the production environment, which would prevent the CMS files from being added to the production build.
  // The keystatic plugin could inform about this by having a required option.

  // NOTE: During dev, we can just serve any file we want using the vite plugin.
  // For the production build, we could detect the environment

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
    // Ensure we build with the React production build to create the best possible experience
    // when using Keystatic CMS both locally and in production.
    { env: { NODE_ENV: 'production' } },
  )
  if (stdout) console.log(stdout)
  if (stderr) console.error(stderr)
}

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

  // console.log('KEYSTATIC ENV', process.env.NODE_ENV)
  // NOTE: When building the Keystatic CMS frontend, we could use process.env.NODE_ENV to either
  // 1) during development, output to the tmp directory in node_modules (during dev)
  // 2) during production, build to the static directory (after SvelteKit) has been built.
  // basically this just determines where the CMS frontend is stored, and from where it is served.
  // If this works, we could then serve the built assets.
  // We could use this to conditionally pre-build the CMS, or just serve it: https://vite.dev/guide/api-plugin.html#conditional-application

  return {
    name: 'keystatic-sveltekit',
    apply(config, env) {
      // TODO: detect if we are running in production or not
      // detect if we are serving the app or not

      // if command === build and mode production --> then we should use the prod directory
      // if command === serve and mode production --> then we should use the prod directory
      // if command === serve and mode development --> then we should use the dev directory
      // However, this will also happen for prerendering it seems. So we should build to both locations just in case
      // build to .svelte-kit/output/client/ if it exists. Otherwise, only build to dev.

      // Build during serve and development
      // Build if command is build, no matter the environment, and build to both locations
      // During serve and production, we should hopefully be able to only serve, and if not fall back to build again

      // Conclusion 1: Always build to node_modules
      // Conslusion 2: Always copy the fresh build to .svelte-kit/output/client/ if the directory exists.
      // If command === serve and mode === production --> then serve from the prod directory

      projectRoot = config.root ?? process.cwd()

      devDir = resolve(projectRoot, '.svelte-kit/keystatic')
      prodDir = resolve(projectRoot, '.svelte-kit/output/client/')

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

      return {
        server: {
          // NOTE: The Keystatic SPA redirects to `127.0.0.1` when it loads, which doesn't work with the default SvelteKit + Vite configs.
          // Therefore, we need to make the Vite server host `127.0.0.1` to allow the server to be accessed both via localhost and 127.0.0.1
          // Related issue: https://github.com/Thinkmill/keystatic/issues/366
          // This might be possible to remove in a preprocessing step or by patching Keystatic
          // Ideally we should be able to could configure (or force) keystatic to use the same host as the Vite server.
          ...(config.server?.host ? {} : { host: '127.0.0.1' }),
          // fs: {
          //   // This is required to allow the Keystatic frontend to import the keystatic config
          //   allow: ['./keystatic.config.ts'],
          // },
        },
        // optimizeDeps: {
        //   entries: ['keystatic.config.*'],
        // },
      }
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
