<script lang="ts">
  let { data } = $props()
</script>

<article>
  <h1>{data.post.title}</h1>

  <time datetime={data.post.date.toISOString()}>{data.post.date.toLocaleDateString()}</time>

  <data.post.Content />
</article>
