// import { Keystatic } from '@keystatic/core/ui'
// import type { Config } from '@keystatic/core'
// import ReactDOM from 'react-dom/static.edge'
// @ ts-expect-error This module is registered by the @keystatic/sveltekit Vite plugin
// import defaultConfig from 'virtual:keystatic.config'
// @ ts-expect-error This module is registered by the @keystatic/sveltekit Vite plugin
// import KeystaticCMS from 'virtual:keystatic-cms'
// import { Wrapper } from './Wrapper'
// import { finished, pipeline } from 'stream/promises'
// import { arrayBuffer } from 'stream/consumers'

// The UI code is exported separately since it should only be
// imported to modules that can compile Svelte components.
// export { default as Keystatic } from './Keystatic.svelte'

// https://react.dev/blog/2024/12/05/react-19#new-react-dom-static-apis

// async function renderToString(component: Parameters<typeof ReactDOM.prerender>[0]) {
//   const { prelude } = await ReactDOM.prerender(component)

//   const reader = prelude.getReader()
//   let content = ''
//   while (true) {
//     const { done, value } = await reader.read()
//     if (done) {
//       return content
//     }
//     // TODO: Maybe use another approach that works with other runtimes too?
//     content += Buffer.from(value).toString('utf8')
//   }
// }

export async function renderKeystatic() {
  // @ ts-expect-error This module is registered by the @keystatic/sveltekit Vite plugin
  // return await import('virtual:keystatic-cms')
  const body = (await import('./keystatic.html?raw')).default

  // IDEA: Could I use @vite/plugin-react to manually transform the tsx file and inject it as a string into the HTML?
  // Or maybe if we manually include all the dependencies we don't need to include other things?

  // TODO: Find a better way to resolve the actual module path.
  // TODO: Make this work for production builds
  // IDEA: Maybe this could be transformed in the keystatic Vite plugin instead?
  return body.replace('./client.tsx', '/src/lib/keystatic/client.tsx')
}

// export async function renderKeystatic(
//   // Replace with generic Config<any, any>
//   props?: Omit<Parameters<typeof Keystatic>[0], 'config'> & { config: Config<any, any> },
// ) {
//   // const { prelude } = await ReactDOM.prerender(Wrapper(), {
//   //   // client.js is an external script by default
//   //   // IDEA: Maybe we could render to a string instead and just inject the HTML we want?
//   //   bootstrapScripts: ['./client.js'],
//   // })

//   // // NOTE: Maybe SvelteKit doesn't support async streaming rendering yet?
//   // // Render to string could work in that case

//   // return new Response(prelude, { headers: { 'Content-Type': 'text/html' } })

//   const { prelude } = await ReactDOM.prerender(Wrapper(), {
//     // client.js is an external script by default
//     // IDEA: Maybe we could render to a string instead and just inject the HTML we want?
//     bootstrapScripts: ['./client.js'],
//   })

//   // NOTE: Maybe SvelteKit doesn't support async streaming rendering yet?
//   // Render to string could work in that case

//   return new Response(prelude, { headers: { 'Content-Type': 'text/html' } })
//   // const { prelude } = await ReactDOM.prerender(Wrapper(), {
//   //   // client.js is an external script by default
//   //   // IDEA: Maybe we could render to a string instead and just inject the HTML we want?
//   //   bootstrapScripts: ['./client.js'],
//   // })

//   // // NOTE: Maybe SvelteKit doesn't support async streaming rendering yet?
//   // // Render to string could work in that case

//   // return new Response(prelude, { headers: { 'Content-Type': 'text/html' } })

//   // const res2 = res.prelude.getReader()

//   // const content = await res2.read()

//   // // const body = new TextDecoder().decode(content)
//   // // console.log('body', body)

//   // const content = await arrayBuffer(res2)

//   // console.log(content.byteLength)

//   // const body = new TextDecoder().decode(content)
//   // console.log('body', body.length)

//   // // When we get the HTML response to render, we could inject a fake favicon to supress the error.

//   // // await pipeline([res.prelude])
//   // // await finished(res.prelude)

//   // if (body.length) {
//   //   console.log("It's actually working! :D")
//   // }

//   // return new Response(body, { headers: { 'Content-Type': 'text/html' } })
// }
