<script lang="ts">
  let { data } = $props()
</script>

<h1>
  Welcome to <a href="https://svelte.dev/docs/kit" target="_blank">SvelteKit</a> +
  <a href="https://keystatic.com" target="_blank">Keystatic</a>
  + <a href="https://github.com/CollierCZ/markdoc-svelte" target="_blank">markdoc-svelte</a>
</h1>

<!-- TODO: Document how it works in a blog post -->
<!-- TODO: publish sample repo -->

<h2>Most recent posts</h2>

<ul>
  {#each data.posts as post}
    <li><a href={`/posts/${post.slug}`}>{post.title}</a></li>
  {/each}
</ul>

Edit posts in{' '}<a href="/keystatic" data-sveltekit-reload>Keystatic</a>
