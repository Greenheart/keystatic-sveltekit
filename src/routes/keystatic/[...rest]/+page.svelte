<script lang="ts">
  import { sveltify } from 'svelte-preprocess-react'
  import { Keystatic } from '@keystatic/core/ui'
  import { type Config } from '@keystatic/core'

  import keystaticConfig from '../../../../keystatic.config'

  const react = sveltify({ Keystatic }) // Optional step, but adds type-safety
</script>

<react.Keystatic config={keystaticConfig as Config<any, any>} />
