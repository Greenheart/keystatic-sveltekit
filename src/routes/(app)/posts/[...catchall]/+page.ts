import { getPost } from '$lib/posts'

export const prerender = true

export const load = async ({ params }) => {
  // By using the [...catchall] rest parameter, we can render posts with any URL like for example
  // "/posts/{year}/some-post", "/posts/some-post" or any other URL format that you prefer.
  // You can customise the URLs by changing the structure of directories and files in `src/content/posts/**/*`
  const slug = params.catchall

  return {
    post: await getPost(slug),
  }
}
