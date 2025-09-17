import React from 'react'
import { Keystatic } from '@keystatic/core/ui'
import { createRoot } from 'react-dom/client'

createRoot(document.getElementById('root')!).render(
  // @ts-expect-error the actual config is injected by Esbuild
  <Keystatic config={KEYSTATIC_CONFIG} />,
)
