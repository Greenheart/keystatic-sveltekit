import { type Handle } from '@sveltejs/kit'
import { sequence } from '@sveltejs/kit/hooks'

import { handleKeystatic } from '$lib/keystatic'

import config from '../keystatic.config'

export const handle: Handle = sequence(handleKeystatic({ config }))
