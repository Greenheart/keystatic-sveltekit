import { build, type Plugin } from 'vite'
import viteReact from '@vitejs/plugin-react'
import { cp, mkdir, rename } from 'node:fs/promises'
import { resolve } from 'node:path'

// TODO: We likely can't assume that the project root is process.cwd() in more complex project setups
// If this happens, we need a better way to consistently resolve the root package.json
const projectRoot = process.cwd()
const devDir = resolve(projectRoot, '.svelte-kit/keystatic')
const prodDir = resolve(projectRoot, '.svelte-kit/output/client/')
const virtualConfig = 'virtual:keystatic.config'

async function buildCMS() {
  // console.info('[keystatic-sveltekit] Building Keystatic CMS...')

  await build({
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

  // These filesystem tasks need to happen in order since they work with the same files
  await rename(resolve(devDir, 'index.html'), resolve(devDir, 'keystatic.html'))
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
