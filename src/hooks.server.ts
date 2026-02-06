import { type Handle } from '@sveltejs/kit'
import { handleKeystatic } from './lib/index.ts'
import config from '../keystatic.config.ts'

export const handle: Handle = await handleKeystatic({ config })
