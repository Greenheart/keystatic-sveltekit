import { type Handle } from '@sveltejs/kit'

import keystatic from '$lib/keystatic'

import config from '../keystatic.config'

export const handle: Handle = await keystatic.handleHook({ config })
