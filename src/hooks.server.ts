import { type Handle } from '@sveltejs/kit'

import { handleKeystaticAPI } from '$lib/keystatic'
import config from '../keystatic.config'

export const handle: Handle = handleKeystaticAPI({ config })
