import { build } from 'esbuild'
import { cp, mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

// NOTE: We likely can't assume that the project root is process.cwd() in more complex project setups
// If this happens, we need a better way to consistently resolve the root package.json
// If this becomes a real need, then we could let the user specify which root directory to use
// when creating the keystatic vite plugin.
// This projectRoot option could then be passed down to the build process.
const projectRoot = process.cwd()
const devDir = resolve(projectRoot, '.svelte-kit/keystatic')
const prodDir = resolve(projectRoot, '.svelte-kit/output/client/')

async function emptyDir(dir: string) {
  let items
  try {
    items = await readdir(dir)
  } catch (error) {
    return mkdir(dir, { recursive: true })
  }

  return Promise.all(items.map((item) => unlink(join(dir, item))))
}

// IDEA: this script could accept a CLI argument to only (re)build the config file
// However, since we bundle everything and esbuild is fast, we might just as well bundle it all together during dev to keep it simple

// IDEA: We could keep track of if the CMS has been build before by using globalThis which is shared with the parent process
declare global {
  /** Used to ensure the CMS is only built at most once per `vite` command executed */
  var HAS_CMS_BUILD_STARTED: boolean | undefined
}

async function buildCMS() {
  // TODO: Only empty the outdir the first time
  await emptyDir(devDir)

  const {
    outputFiles: [rawJS],
  } = await build({
    entryPoints: [resolve(import.meta.dirname, 'cms.tsx')],
    bundle: true,
    minify: true,
    write: false,
    plugins: [
      {
        name: 'load-keystatic-config',
        setup(build) {
          build.onResolve({ filter: /^virtual\:keystatic.config/ }, () => ({
            path: resolve(projectRoot, 'keystatic.config.ts'),
          }))
        },
      },
    ],
    target: ['es2021'],
    define: {
      // Ensure the production bundle for React is used to improve performance.
      'process.env.NODE_ENV': '"production"',
    },
  })

  function ensureGDPRCompliantFonts(code: string) {
    const fontsURLRegex = /fonts\.googleapis\.com\/css2/g
    const replacement = 'fonts.bunny.net/css'

    return code.replaceAll(fontsURLRegex, replacement)
  }

  // TODO: Make these I/O calls in parallel to speed up the total build time
  await writeFile(resolve(devDir, 'keystatic.js'), ensureGDPRCompliantFonts(rawJS.text), 'utf-8')

  // TODO: Only build the HTML file the first time, since we need
  const rawHTML = await readFile(resolve(import.meta.dirname, 'cms.html'), 'utf-8')
  await writeFile(
    resolve(devDir, 'keystatic.html'),
    rawHTML.replace('%CMS%', './keystatic.js'),
    'utf-8',
  )

  await mkdir(prodDir, { recursive: true })
  await cp(devDir, prodDir, { recursive: true })
}

if (import.meta.main) {
  await buildCMS()
}
