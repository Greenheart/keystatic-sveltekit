# keystatic-sveltekit

Library for integrating the Git-based [Keystatic](https://keystatic.com/) CMS with SvelteKit. This allows you to serve the CMS from the same server as your main SvelteKit app. You can read the [blog post](https://samuelplumppu.se/blog/keystatic-sveltekit-markdoc) to learn more about why this is useful, and the background to this project.

```sh
pnpm add keystatic-sveltekit
```

## Library key features

- Make it easy to integrate a high-quality Git-based CMS with SvelteKit projects.

- This library allows serving Keystatic CMS with the same server as SvelteKit. This improved both development and production builds by removing the need to install and maintain a separate metaframework just for the CMS. If you already use SvelteKit, why not use it for the CMS as well?

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

You can also pass in additional configuration like environment variables, which is useful if you have nonstandard names for your environment variables. Refer to the parameters of `handleKeystatic()` for more info.

---

> [!NOTE]
> This section should be removed once the upstream Keystatic fixes [issue 366](https://github.com/Thinkmill/keystatic/issues/366)

**Temporary step:** Finally, there is one quirk with Keystatic that we need to address before [this PR](https://github.com/Thinkmill/keystatic/pull/1465) gets merged. Keystatic always redirects to 127.0.0.1 (the loopback address) when visiting the `/keystatic` admin UI. This is technically necessary when using the [GitHub mode](https://keystatic.com/docs/github-mode)) to properly support OAuth redirects. However, when using [local mode](https://keystatic.com/docs/local-mode), this redirect is not necessary and quite disruptive when everything else is hosted on `localhost`.

There are two workarounds:

1. Change `vite.config.ts` to set `server.host` to `127.0.0.1` to host SvelteKit on both `localhost` and `127.0.0.1`. This is the easy solution, but might cause weird behaviours with redirects from `localhost` to `127.0.0.1` when opening Keystatic.
2. Use `pnpm patch` ([instructions](https://pnpm.io/cli/patch)) to add [this patch](./patches/@keystatic__core.patch) and implement the same workaround as in the upstream [PR](https://github.com/Thinkmill/keystatic/pull/1465).

---

Once all steps are completed, you can run `pnpm dev` and access Keystatic CMS at <http://localhost:5173/keystatic>.

If you plan to use [GitHub mode](https://keystatic.com/docs/github-mode), follow the guide for further instructions on how to create and configure a GitHub app.

Remember that you can configure GitHub mode for production and still use [local mode](https://keystatic.com/docs/local-mode) during development, by modifying your `keystatic.config.ts` like this:

```ts
// keystatic.config.ts
export default config({
  storage: import.meta.env.DEV
    ? {
        kind: 'local',
      }
    : {
        kind: 'github',
        repo: 'user/repo',
      },
})
```

### Read content and use it in your SvelteKit project

The [Keystatic Reader API](https://keystatic.com/docs/reader-api) is a good way to read your content and use it on the server side of SvelteKit.

See the demo project below to see one way to implement it.

---

## Demo project and Markdoc integration

The Git repository for [keystatic-sveltekit](https://github.com/Greenheart/keystatic-sveltekit) also includes a demo project showing how to set up `keystatic-sveltekit` and how to use [markdoc-svelte](https://github.com/CollierCZ/markdoc-svelte) to render rich [Markdoc](https://markdoc.dev/) content with support for embedding interactive Svelte components and other useful features.

### Key features

- Posts can be deeply nested, giving more flexibility for how to organise posts and their URLs. A similar config could be used to create a more general `pages` content type which could enable block-based content editing.
- Hot reloading while editing posts gives you rapid live previews. Ideal for viewing both the CMS/code editor and the live project side by side.
- Possibility to embed interactive Svelte components in the Markdoc content, creating rich experiences. This enables flexible and powerful content blocks.
- Markdoc content validation via schemas to catch errors early. A big advantage over a similar solution like [MDX](https://mdxjs.com/).

### Explore the demo

You can explore the demo by cloning the Git repo and running the following commands:

```sh
pnpm i
pnpm dev
```

Then you can visit:

- Demo page: <http://localhost:5173>
- CMS: <http://localhost:5173/keystatic>

Try making changes to posts and see how the live project hot reloads both for configuration changes in `keystatic.config.ts` and when editing posts.

---

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

3. You can also consider moving some dependencies like `keystatic-sveltekit` and `@keystatic/core` to `devDependencies` so they won't be installed for production environments.

## License

MIT
