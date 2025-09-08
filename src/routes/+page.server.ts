import { listPosts } from '$lib/posts'

export const load = async () => {
  return { posts: await listPosts() }
}
