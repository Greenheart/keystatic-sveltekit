import { createRoot } from 'react-dom/client'
import { Keystatic } from '@keystatic/core/ui'
import { type Config } from '@keystatic/core'
import config from '../../keystatic.config'

// IDEA: create a SvelteKit handle hook that takes a config and returns a hook that can be combined with other code
export function handleKeystatic() {
  //
}

function renderKeystaticUI() {
  // Keystatic
  const body = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src"></script>
  </body>
</html>`

  return new Response(body, { headers: { 'Content-Type': 'text/html' } })
}

export function renderKeystaticUI() {
  return createRoot(document.querySelector('#root')!)

  // (Keystatic({ config: config as Config<any, any> }))
}
