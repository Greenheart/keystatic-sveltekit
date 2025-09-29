import { build } from 'esbuild'
import { cp, mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parentPort } from 'node:worker_threads'

// NOTE: We likely can't assume that the project root is process.cwd() in more complex project setups
// If this happens, we need a better way to consistently resolve the root package.json
// If this becomes a real need, then we could let the user specify which root directory to use
// when creating the keystatic vite plugin.
// This projectRoot option could then be passed down to the build process.
const projectRoot = process.cwd()
const devDir = resolve(projectRoot, '.svelte-kit/keystatic')
const prodDir = resolve(projectRoot, '.svelte-kit/output/client/')

function ensureGDPRCompliantFonts(code: string) {
  const fontsURLRegex = /fonts\.googleapis\.com\/css2/g
  const replacement = 'fonts.bunny.net/css'

  return code.replaceAll(fontsURLRegex, replacement)
}

/**
 * Bundle all CMS code, including the latest config.
 *
 * It's not ideal to bundle React and the full CMS every time during dev,
 * but since the keystatic config includes the React runtime anyhow to support
 * custom widgets, the simplest solution is to just bundle everything together.
 */
async function buildCMS() {
  await Promise.all([
    build({
      entryPoints: [resolve(import.meta.dirname, 'cms.tsx')],
      bundle: true,
      minify: true,
      write: false,
      plugins: [
        {
          name: 'load-keystatic-config',
          setup(build) {
            build.onResolve({ filter: /^virtual\:keystatic.config$/ }, () => ({
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
    }).then(({ outputFiles: [rawJS] }) =>
      writeFile(resolve(devDir, 'keystatic.js'), ensureGDPRCompliantFonts(rawJS.text), 'utf-8'),
    ),
    cp(resolve(import.meta.dirname, 'cms.html'), resolve(devDir, 'keystatic.html')),
  ])

  await mkdir(prodDir, { recursive: true })
  await cp(devDir, prodDir, { recursive: true })
}

if (!parentPort) throw new Error('Missing parentPort')

parentPort.on('message', async (task) => {
  await buildCMS()
  parentPort?.postMessage({ id: task.id, result: true })
})
