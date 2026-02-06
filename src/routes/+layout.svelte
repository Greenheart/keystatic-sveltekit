<script lang="ts">
  import '../app.css'
  import favicon from '../assets/favicon.svg'

  let { children } = $props()
</script>

<svelte:head>
  <title>SvelteKit + Keystatic + markdoc-svelte</title>
  <link rel="icon" href={favicon} />
</svelte:head>

<nav>
  <a href="/">Home</a>
</nav>

{@render children?.()}
