import { type Handle } from '@sveltejs/kit'
import { sequence } from '@sveltejs/kit/hooks'

import config from '../keystatic.config'
import { handleKeystaticAPI } from '$lib/keystatic'

// One benefit of prerendering Keystatic would be to build the UI as a static Vite SPA and serve it purely as static assets
// However by using the SSR, it would be easy to keep it updated and in sync with the latest version of Keystatic
export const handle: Handle = sequence(
  handleKeystaticAPI({ config }),
  async ({ event, resolve }) => {
    // } else if (isKeystaticUIPath.test(event.url.pathname)) {
    //   const react = sveltify({ Keystatic }, { createPortal, ReactDOM, renderToString }) // Optional step, but adds type-safety
    //   const keystatic = render(react.Keystatic, { props: { config: config as Config<any, any> } })

    //   // TODO: figure out which ID keystatic wants to render to and set it here
    //   // IDEA: Or make it render directly using the regular react SSR renderToString()
    //   // NOTE: Might be an alternative: https://github.com/ivstudio/ssr-express-react/blob/main/src/server/render.tsx
    //   const body = `<!doctype html>
    // <html lang="en">
    //   <head>
    //     <meta charset="utf-8" />
    //     <meta name="viewport" content="width=device-width, initial-scale=1" />
    //     ${keystatic.head}
    //   </head>
    //   <body>
    //     <div id="root">${keystatic.body}</div>
    //   </body>
    // </html>`

    //   return new Response(body, { headers: { 'Content-Type': 'text/html' } })
    // }

    // IDEA: Thanks to the generic API handler, it's possible to build integrations with any Vite-based framework.
    // Vue and Solid should probably be possible as well.
    // Keystatic could probably implement a vite plugin that allows usage with any Vite-based framework to serve a react frontend and handle incoming API requests.
    // handle requests before they are handled by the frontend/meta-frameworks.
    // IDEA: Create an issue about creating a vite plugin for Keystatic to allow usage with any Vite-based meta-framework

    return resolve(event)
  },
)
