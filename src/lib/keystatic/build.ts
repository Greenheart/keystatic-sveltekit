import { build, type Plugin, type Rollup } from 'vite'
import viteReact from '@vitejs/plugin-react'
import { cp, mkdir, readdir, unlink, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

// TODO: We likely can't assume that the project root is process.cwd() in more complex project setups
// If this happens, we need a better way to consistently resolve the root package.json
// IDEA: If this becomes a real need, then we could let the user specify which root directory to use
// when creating the keystatic vite plugin.
// This projectRoot option could then be passed down to the build process.
const projectRoot = process.cwd()
const devDir = resolve(projectRoot, '.svelte-kit/keystatic')
const prodDir = resolve(projectRoot, '.svelte-kit/output/client/')
const virtualConfig = 'virtual:keystatic.config'

async function emptyDir(dir: string) {
  let items
  try {
    items = await readdir(dir)
  } catch (error) {
    return mkdir(dir, { recursive: true })
  }

  return Promise.all(items.map((item) => unlink(join(dir, item))))
}

async function buildCMS() {
  const bundle = (await build({
    appType: 'spa',
    logLevel: 'error',
    base: '/keystatic',
    mode: 'production',
    build: {
      write: false,
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
  })) as Rollup.RollupOutput

  if (!bundle.output) {
    console.dir(bundle)
    throw new Error('[keystatic-sveltekit] Unexpected output format')
  }

  await emptyDir(devDir)

  // Output files directly with their expected filenames
  await Promise.all(
    bundle.output.map((file) =>
      writeFile(
        resolve(devDir, file.fileName.endsWith('.html') ? 'keystatic.html' : file.fileName),
        'code' in file ? file.code : file.source,
        'utf-8',
      ),
    ),
  )

  await mkdir(prodDir, { recursive: true })
  await cp(devDir, prodDir, { recursive: true })
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

if (import.meta.main) {
  await buildCMS()
}
