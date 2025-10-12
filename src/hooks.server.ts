import { type Handle } from '@sveltejs/kit'
import { handleKeystatic } from '$lib/keystatic'
import config from '../keystatic.config'

export const handle: Handle = await handleKeystatic({ config })
