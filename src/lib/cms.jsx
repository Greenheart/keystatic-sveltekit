import React from 'react'
import { Keystatic } from '@keystatic/core/ui'
import { createRoot } from 'react-dom/client'

// @ts-expect-error This module is registered by the @keystatic/sveltekit Vite plugin
import config from 'virtual:keystatic.config'

createRoot(document.getElementById('app')).render(<Keystatic config={config} />)
