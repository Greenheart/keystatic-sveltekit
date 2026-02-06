# keystatic-sveltekit

This project shows how to integrate [Keystatic CMS](https://keystatic.com/) with SvelteKit. You can read the [blog post](https://samuelplumppu.se/blog/keystatic-sveltekit-markdoc) to learn more about why this is useful, and how it works.

```sh
pnpm add keystatic-sveltekit
```

## Key features

- This setup makes it simple to run Keystatic with the same server as SvelteKit. This improves both local development and production builds. Especially smaller projects will benefit from having less moving parts, while larger projects can separate the CMS server from the main app/website server while still benefitting from not having to install and maintain an additional metaframework just for the CMS. If you already use SvelteKit, why not use it for the CMS as well?

- Supports deeply nested pages, giving more flexibility for how to organise posts and their URLs.

- Supports hot reloading during development to make it simple and enjoyable to edit `keystatic.config.ts` and quickly see the results in the CMS.

## Get started

You need a SvelteKit project before adding `keystatic-sveltekit`.

```sh
npx sv create my-app
# Alternatively, if you already have a project:
cd my-app
```

Install the required dependencies:

```sh
pnpm add keystatic-sveltekit @keystatic/core react react-dom
```

Alternatively, if you plan to [only use Keystatic CMS locally during development](#how-to-only-enable-keystatic-cms-during-development):

```sh
pnpm add -D keystatic-sveltekit @keystatic/core react react-dom
```

### Adding Keystatic CMS in your SvelteKit project

Add `keystatic.config.ts` to your project root directory:

```ts
// keystatic.config.ts
import { config } from '@keystatic/core'

export default config({
  // See https://keystatic.com/docs/configuration
})
```

Add the Vite plugin:

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { sveltekit } from '@sveltejs/kit/vite'
import { keystatic } from 'keystatic-sveltekit'

export default defineConfig({
  // Register the keystatic plugin before SvelteKit
  plugins: [keystatic(), sveltekit()],
})
```

Register the Keystatic routes in a [SvelteKit server hook](https://svelte.dev/docs/kit/hooks#Server-hooks). This will serve both the CMS frontend and API routes.

```ts
// src/hooks.server.ts
import { type Handle } from '@sveltejs/kit'
import { handleKeystatic } from 'keystatic-sveltekit'
import config from '../keystatic.config.ts'

export const handle: Handle = await handleKeystatic({ config })
```

You can now access Keystatic CMS at <http://localhost:5173/keystatic>.

### Read content and use it in your SvelteKit project

The [Keystatic Reader API](https://keystatic.com/docs/reader-api) is a good way to read your content and use it on the server side of SvelteKit.

---

## Demo project and Markdoc integration

The Git repository for `keystatic-sveltekit` also includes a demo project showcasing how to use [markdoc-svelte](https://github.com/CollierCZ/markdoc-svelte) to render rich [Markdoc](https://markdoc.dev/) content with support for embedding interactive Svelte components and other useful features.

You can explore the demo by cloning the Git repo and running the following commands:

```sh
pnpm i
pnpm dev
```

Visit <http://localhost:5173> for the demo page, and <http://localhost:5173/keystatic> for the CMS.

## How to only enable Keystatic CMS during `development`:

If you use the Keystatic `local` storage mode, here's how you enable the CMS only during `development`:

1. Only import and enable the Vite plugin during `dev`:

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { sveltekit } from '@sveltejs/kit/vite'

const dev = process.env.NODE_ENV === 'development'

export default defineConfig({
  plugins: [dev && (await import('keystatic-sveltekit')).keystatic(), sveltekit()],
})
```

2. Only import and enable the SvelteKit hook during `dev`:

```ts
// src/hooks.server.ts
import { type Handle } from '@sveltejs/kit'
import { sequence } from '@sveltejs/kit/hooks'
import { dev } from '$app/environment'

// Add your other hooks here
const hooks: Handle[] = []

// Only enable Keystatic during development
if (dev) {
  // Use dynamic imports to reduce the size of the production build.
  const config = (await import('../keystatic.config.ts')).default
  const { handleKeystatic } = await import('keystatic-sveltekit')
  hooks.push(await handleKeystatic({ config }))
}

export const handle = sequence(...hooks)
```

## License

MIT
