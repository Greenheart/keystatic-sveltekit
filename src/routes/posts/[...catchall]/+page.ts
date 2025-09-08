import { getPost } from '$lib/posts'

export const prerender = true

export const load = async ({ params }) => {
  const slug = params.catchall

  return {
    post: await getPost(slug),
  }
}
