import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Keystatic } from '@keystatic/core/ui'
import { Config } from '@keystatic/core'

import config from '../../keystatic.config'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Keystatic config={config as Config<any, any>} />
  </StrictMode>,
)
