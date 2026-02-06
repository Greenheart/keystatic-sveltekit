import { type Config } from '@sveltejs/kit'
import adapter from '@sveltejs/adapter-auto'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'
import { markdocPreprocess } from 'markdoc-svelte'
import { glob } from 'node:fs/promises'
import { isKeystaticRoute } from './src/lib/index.ts'

export async function getPrerenderEntries() {
  const posts = (await Array.fromAsync(glob('src/content/posts/**/*.{mdoc,md}'))).flatMap(
    (file: string) => file.split('/content')[1].replace(/\.md(?:oc)/, ''),
  )

  // Add loaders for more prerenderable content types here
  return [posts].flat()
}

const config = {
  extensions: ['.svelte', '.mdoc', '.md'],
  preprocess: [
    vitePreprocess(),
    markdocPreprocess({
      components: '$components/markdoc',
      tags: {
        Counter: {
          render: 'Counter',
          selfClosing: true,
        },
      },
    }),
  ],
  kit: {
    adapter: adapter(),
    prerender: {
      entries: ['*', await getPrerenderEntries()].flat(),
      handleHttpError({ path, message }) {
        // Ignore prerendering errors for Keystatic CMS since it's a SPA that only supports CSR.
        if (isKeystaticRoute(path)) return

        // Fail the build in other cases.
        throw new Error(message)
      },
    },
    alias: {
      '$components/*': './src/components/*',
    },
  },
} satisfies Config

export default config
