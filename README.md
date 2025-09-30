# keystatic-sveltekit

This project shows how to integrate [Keystatic CMS](https://keystatic.com/) with SvelteKit. You can read the [blog post](https://samuelplumppu.se/blog/keystatic-sveltekit-markdoc) to learn more about why this is useful, and how it works.

## Some of the key features

- This setup makes it simple to run Keystatic with the same server as SvelteKit. This improves both local development and production builds. Especially smaller projects will benefit from having less moving parts, while larger projects can separate the CMS server from the main app/website server while still benefitting from not having to install and maintain an additional metaframework just for the CMS. If you already use SvelteKit, why not use it for the CMS as well?

- Uses `markdoc-svelte` to render rich content with support for embedding interactive Svelte components and other features of Markdoc.

- Supports deeply nested pages, giving more flexibility for how to organise posts and their URLs.

- Supports hot reloading during development to make it simple and enjoyable to edit `keystatic.config.ts` and quickly see the results in the CMS.

## How to only enable Keystatic CMS during `development`:

If you use the Keystatic `local` storage mode, here's how you enable the CMS only during `development`:

```ts
// src/hooks.server.ts
import { type Handle, sequence } from '@sveltejs/kit'
import { sequence } from '@sveltejs/kit/hooks'
import { dev } from '$app/environment'

// Add your other hooks here
const hooks: Handle[] = []

// Only enable Keystatic during development
if (dev) {
  // Use a dynamic import to reduce the size of the production build.
  const { handleKeystatic } = await import('$lib/keystatic')
  hooks.push(await handleKeystatic())
}

export const handle = sequence(hooks)
```

## License

MIT
