import { makeGenericAPIRouteHandler } from '@keystatic/core/api/generic'
import type { Handle, RequestEvent } from '@sveltejs/kit'
import viteReact from '@vitejs/plugin-react'
import { cp, mkdir, readdir, readFile, rename } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { type Plugin, build } from 'vite'

// IDEA: Or maybe a simpler alternative: use simple exported functions and let the hook poll for changes in the file system
// Maybe write a temp file when starting the vite plugin, and update it whenever changes occur?
// Write a manifest file that the hook handler can use.
// If the file does not exist, wait until it does
// If the file exists but the entries specified in it do not, then wait a while and try again. If it still fails after 30 seconds, throw an error.
// In the vite plugin, whenever a new build starts, empty the file and write the updatedAt timestamp as well as an empty array of entries

/**
 * Wait until a condition is true.
 */
function until(isReady: () => Promise<boolean>, checkInterval = 100, timeout = 30_000) {
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

/**
 * Create a SvelteKit handle hook to serve the Keystatic CMS and API.
 */
export async function handleKeystatic(
  ...args: Parameters<typeof makeGenericAPIRouteHandler>
): Promise<Handle> {
  const isKeystaticPath = /^\/keystatic/
  const isKeystaticAPIPath = /^\/api\/keystatic/
  const handleAPI = makeGenericAPIRouteHandler(...args)

  const projectRoot = process.cwd()
  const devDir = resolve(projectRoot, '.svelte-kit/keystatic')
  const prodDir = resolve(projectRoot, '.svelte-kit/output/client/')
  const cmsOutDir = !import.meta.env.DEV ? prodDir : devDir
  const htmlFile = resolve(cmsOutDir, 'keystatic.html')

  async function initCMS() {
    // Wait until we have some build result to show.
    // This is especially important for the very first dev or production builds.
    // Instead of checking if we have the latest version, we simply read the latest matching file for every request
    await until(async () => {
      const entries = await readdir(cmsOutDir, 'utf-8')
      return entries.includes('keystatic.html')
    })

    return async (event: RequestEvent) => {
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

function ensureGDPRCompliantFonts(): Plugin {
  const fontsURLRegex = /fonts\.googleapis\.com\/css2/g
  const replacement = 'fonts.bunny.net/css'
  return {
    name: 'gdpr-compliant-fonts',
    enforce: 'post',
    transform(code) {
      if (fontsURLRegex.test(code)) {
        return code.replaceAll(fontsURLRegex, replacement)
      }
    },
  }
}

/**
 * Vite plugin to integrate Keystatic with SvelteKit projects
 */
export function keystatic(): Plugin {
  const virtualConfig = 'virtual:keystatic.config'

  /** The project root directory */
  let projectRoot = ''
  /** Where the cms will be served from */
  let cmsOutDir = ''
  /** The development build is saved here */
  let devDir = ''
  /** The production build is saved here */
  let prodDir = ''
  /** Resolves to a Set with all filenames of the latest CMS frontend build */
  let frontendBuildAssets: Promise<Set<string> | null> | null = null
  let shouldBuild = true

  // console.log('KEYSTATIC ENV', process.env.NODE_ENV)
  // NOTE: When building the Keystatic CMS frontend, we could use process.env.NODE_ENV to either
  // 1) during development, output to the tmp directory in node_modules (during dev)
  // 2) during production, build to the static directory (after SvelteKit) has been built.
  // basically this just determines where the CMS frontend is stored, and from where it is served.
  // If this works, we could then serve the built assets.
  // We could use this to conditionally pre-build the CMS, or just serve it: https://vite.dev/guide/api-plugin.html#conditional-application

  async function buildCMS() {
    // console.info('[keystatic-sveltekit] Building Keystatic CMS...')

    // Only rebuild the CMS when the Vite process recently started.
    // This is a simple way to save resources during development.
    if (process.env.NODE_ENV === 'development' && process.uptime() > 30) {
      return frontendBuildAssets
    }

    // If we build this in a child process, we might be able to override process.env.NODE_ENV to
    // force the usage of the production react code
    // Either in a child process, or maybe Vite or Rollup allow us to do something like that.
    // TODO: Building in a child_process would improve performance for the first incoming request
    // (except for those coming to Keystatic)  since it would avoid blocking the main thread.
    const result = await build({
      appType: 'spa',
      logLevel: 'error',
      base: '/keystatic',
      mode: 'production',
      build: {
        outDir: devDir,
        emptyOutDir: true,
        rollupOptions: {
          output: {
            entryFileNames: 'keystatic-[hash].js',
          },
        },
      },
      root: resolve(import.meta.dirname),
      plugins: [
        viteReact(),
        {
          name: 'resolve-config',
          resolveId(id) {
            if (id === virtualConfig) {
              return this.resolve('./keystatic.config', './a')
            }
          },
        },
        ensureGDPRCompliantFonts(),
      ],
    })

    // These filesystem-tasks need to happen in order since they work with the same files
    await rename(resolve(devDir, 'index.html'), resolve(devDir, 'keystatic.html'))
    await mkdir(prodDir, { recursive: true })
    // NOTE: Sometimes copying fails on rapid succesive builds. This might be avoided by only building in the beginning.
    await cp(devDir, prodDir, { recursive: true })

    function getFileNames(result: Awaited<ReturnType<typeof build>>) {
      if ('output' in result) {
        return result.output.map(({ fileName }) => fileName)
      } else if (Array.isArray(result)) {
        return result.flatMap(({ output }) => output.map(({ fileName }) => fileName))
      }
      throw new Error('[keystatic-sveltekit] Unexpected output from CMS build: \n' + result)
    }

    return new Set(
      getFileNames(result).map((name) => (/\.html$/.test(name) ? 'keystatic.html' : name)),
    )
  }

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

      if (env.mode === 'production') {
        if (env.command === 'serve') {
          shouldBuild = false
        }
        cmsOutDir = prodDir
      } else {
        cmsOutDir = devDir
      }

      return true
    },
    async config(config) {
      if (shouldBuild) {
        // Start the CMS frontend build, but don't wait for it to finish yet.
        // This allows the rest of the dev server to start up without noticeable delay.
        // By keeping the Promise, we only start one build per server restart during development
        frontendBuildAssets ??= buildCMS()
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
