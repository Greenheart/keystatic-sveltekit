import { Keystatic } from '@keystatic/core/ui'
// @ts-expect-error This module is registered by the @keystatic/sveltekit Vite plugin
import config from 'virtual:keystatic.config'

export function Wrapper() {
  return Keystatic({ config })
}
