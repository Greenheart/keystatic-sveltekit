<script lang="ts">
  import { sveltify } from 'svelte-preprocess-react'
  import { Keystatic } from '@keystatic/core/ui'
  import { type Config } from '@keystatic/core'

  type Props = {
    /** Keystatic config */
    config: Config<any, any>
  }
  let { config }: Props = $props()

  const react = sveltify({ Keystatic }) // Optional step, but adds type-safety
</script>

<react.Keystatic {config} />
