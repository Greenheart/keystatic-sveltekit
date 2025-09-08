<script lang="ts">
  import { KeystaticCMS } from '$lib/keystatic'

  import config from '../../../../../keystatic.config'
</script>

<svelte:head>
  <title>Keystatic CMS</title>
</svelte:head>

<KeystaticCMS {config} />
