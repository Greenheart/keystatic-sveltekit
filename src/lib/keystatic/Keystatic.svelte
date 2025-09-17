<script lang="ts">
  import { sveltify } from 'svelte-preprocess-react'
  import { Keystatic } from '@keystatic/core/ui'
  // @ts-expect-error This module is registered by the @keystatic/sveltekit Vite plugin
  import config from 'virtual:keystatic.config'

  // TODO: Investigate if we can just prerender the react code instead?
  // It would be awesome to skip another dependency
  // https://react.dev/blog/2024/12/05/react-19#new-react-dom-static-apis

  const react = sveltify({ Keystatic }) // Optional step, but adds type-safety
</script>

<react.Keystatic {config} />
