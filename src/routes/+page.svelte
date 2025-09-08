<script lang="ts">
  let { data } = $props()
</script>

<h1>Welcome to SvelteKit</h1>
<p>Visit <a href="https://svelte.dev/docs/kit">svelte.dev/docs/kit</a> to read the documentation</p>

<h2>Most recent posts</h2>

<ul>
  {#each data.posts as post}
    <li><a href={`/posts/${post.slug}`}>{post.title}</a></li>
  {/each}
</ul>
