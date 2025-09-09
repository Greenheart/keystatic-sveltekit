<script lang="ts">
  import { sveltify } from 'svelte-preprocess-react'
  import { Keystatic } from '@keystatic/core/ui'
  import config from 'virtual:keystatic.config'

  const react = sveltify({ Keystatic }) // Optional step, but adds type-safety
</script>

<react.Keystatic {config} />
