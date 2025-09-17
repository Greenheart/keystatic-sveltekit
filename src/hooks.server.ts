import { type Handle } from '@sveltejs/kit'
import { sequence } from '@sveltejs/kit/hooks'

import { handleKeystaticAPI } from '$lib/keystatic'
import { renderKeystatic } from '$lib/keystatic/ui'

import config from '../keystatic.config'

export async function handleKeystaticUI(): Promise<Handle> {
  const isKeystaticPath = /^\/keystatic/

  return async ({ event, resolve }) => {
    if (isKeystaticPath.test(event.url.pathname)) {
      const body = await renderKeystatic()

      return new Response(body, { headers: { 'Content-Type': 'text/html' } })
    }

    return resolve(event)
  }
}

export const handle: Handle = sequence(handleKeystaticAPI({ config }), await handleKeystaticUI())
