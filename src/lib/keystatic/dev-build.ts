import { build, type Plugin } from 'esbuild'
import { cp, mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

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

let loadKeystaticConfig: Plugin = {
  name: 'load-keystatic-config',
  setup(build) {
    build.onResolve({ filter: /^virtual\:keystatic.config/ }, () => ({
      path: resolve(projectRoot, 'keystatic.config.ts'),
    }))
  },
}

// IDEA: this script could accept a CLI argument to only (re)build the config file
// However, since we bundle everything and esbuild is fast, we might just as well bundle it all together during dev to keep it simple

// To support fast rebuilds when the config changes during development, we need to use esbuild rather than rollup
async function buildForDev() {
  await emptyDir(devDir)

  const {
    outputFiles: [rawJS],
  } = await build({
    // IDEA: If we can use the same client.tsx for both dev and build, we could greatly simplify the project setup.
    entryPoints: [resolve(import.meta.dirname, 'client.tsx')],
    bundle: true,
    minify: true,
    write: false,
    plugins: [loadKeystaticConfig],
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

  await writeFile(resolve(devDir, 'keystatic.js'), ensureGDPRCompliantFonts(rawJS.text), 'utf-8')

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
  await buildForDev()
}
