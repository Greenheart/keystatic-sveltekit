import { listPosts } from '../utils/posts.ts'

export const load = async () => {
  return { posts: await listPosts() }
}
