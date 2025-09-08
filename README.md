# keystatic-svelte

- Allow running Keystatic with the same server as SvelteKit, to make deployments as well as local development easier.
- Uses `markdoc-svelte` to render rich content with support for embedding interactive Svelte components and other features of Markdoc.
- In order to separate app styles from Keystatic, we use SvelteKit [layout groups](<https://svelte.dev/docs/kit/advanced-routing#Advanced-layouts-(group)>).
  - Once SvelteKit supports [dynamically adding routes](https://github.com/sveltejs/kit/issues/8896), we could remove the need for using layout groups and render keystatic via the SvelteKit [handle](https://svelte.dev/docs/kit/hooks#Server-hooks-handle) hook. This would make it very simple to embed Keystatic within a SvelteKit project since there would no longer be a need to define custom keystatic routes since that would be handled by the `handleKeystatic()` hook.

- IDEA: Document how to only include keystatic during development but not in the production build
  - the API route should be dynamically imported
  - the keystatic routes should be disabled during production
    - Maybe there is a setting to tell SvelteKit to exclude certain routes during build?

---

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project in the current directory
npx sv create

# create a new project in my-app
npx sv create my-app
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.
