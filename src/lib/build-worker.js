import { build } from 'rolldown'
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parentPort } from 'node:worker_threads'

// NOTE: We likely can't assume that the project root is process.cwd() in more complex project setups
// If this happens, we need a better way to consistently resolve the root package.json
// If this becomes a real need, then we could let the user specify which root directory to use
// when creating the Keystatic vite plugin.
// This projectRoot option could then be passed down to the build process.
// Similarly, we could also allow passing in a custom path to the file `keystatic.config.ts`
const projectRoot = process.cwd()
const devDir = resolve(projectRoot, '.svelte-kit/keystatic')
const prodDir = resolve(projectRoot, '.svelte-kit/output/client/')

/**
 * @param {string} code
 */
function ensureGDPRCompliantFonts(code) {
  const fontsURLRegex = /fonts\.googleapis\.com\/css2/g
  const replacement = 'fonts.bunny.net/css'
  return code.replaceAll(fontsURLRegex, replacement)
}

/**
 * Bundle all CMS code, including the latest config.
 *
 * It's not ideal to bundle React and the full CMS every time during dev,
 * but since the Keystatic config includes the React runtime anyhow to support
 * custom widgets, the simplest solution is to just bundle everything together.
 * @returns {Promise<void>}
 */
async function buildCMS() {
  const htmlFilePath = resolve(devDir, 'keystatic.html')
  await Promise.all([
    build({
      input: [resolve(import.meta.dirname, 'cms.jsx')],
      write: false,
      resolve: {
        alias: {
          'virtual:keystatic.config': resolve(projectRoot, 'keystatic.config.ts'),
        },
      },
      transform: {
        jsx: 'react-jsx',
        target: 'es2022',
        define: {
          // Ensure the production bundle for React is used to improve performance.
          'process.env.NODE_ENV': '"production"',
        },
      },
      output: {
        minify: true,
        file: 'keystatic.js',
      },
    }).then(({ output: [rawJS] }) =>
      writeFile(resolve(devDir, 'keystatic.js'), ensureGDPRCompliantFonts(rawJS.code), 'utf-8'),
    ),
    cp(resolve(import.meta.dirname, 'cms.html'), htmlFilePath),
  ])

  // Replace dev script for production builds
  if (process.env.NODE_ENV !== 'development') {
    const rawHTML = await readFile(htmlFilePath, 'utf-8')
    await writeFile(
      htmlFilePath,
      rawHTML.replace(/\ +<script id="cms-dev".*?<\/script>\n/gs, ''),
      'utf-8',
    )
  }

  await mkdir(prodDir, { recursive: true })
  await cp(devDir, prodDir, { recursive: true })
}

if (!parentPort) throw new Error('Missing parentPort')

parentPort.on('message', async (task) => {
  await buildCMS()
  parentPort?.postMessage({ id: task.id, result: true })
})

/**
 * NOTE: Why do we export the build mode from the worker module, even though it should really be in index.js?
 * Because this ensures this internal type won't be included in the generated index.d.ts file.
 * @typedef {'prio' | boolean} BuildMode
 */
