import { type Handle } from '@sveltejs/kit'
import { handleKeystatic } from './lib/index.js'
import config from '../keystatic.config.js'

export const handle: Handle = await handleKeystatic({ config })
