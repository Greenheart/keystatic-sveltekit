<script lang="ts">
  import { sveltify } from 'svelte-preprocess-react'
  import { Keystatic } from '@keystatic/core/ui'
  // @ts-expect-error This module is registered by the @keystatic/sveltekit Vite plugin
  import config from 'virtual:keystatic.config'

  const react = sveltify({ Keystatic }) // Optional step, but adds type-safety
</script>

<react.Keystatic {config} />
