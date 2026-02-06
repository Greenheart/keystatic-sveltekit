import { error } from '@sveltejs/kit'
import type { MarkdocModule } from 'markdoc-svelte'
import type { Component } from 'svelte'
import { z } from 'zod'

export const postSchema = z.object({
  frontmatter: z.object({
    title: z.string(),
    date: z.coerce.date(),
  }),
})

type RawPost = z.infer<typeof postSchema>

export type BlogPost = RawPost['frontmatter'] & {
  slug: string
  Content: Component
}

const allPosts = Object.entries(import.meta.glob('/src/content/posts/**/*.{mdoc,md}')).reduce<
  Record<string, () => Promise<MarkdocModule>>
>((rawPosts, [path, loadPost]) => {
  const slug = path.replace('/src/content/posts/', '').replace(/\.(mdoc|md)$/, '')
  rawPosts[slug] = loadPost as () => Promise<MarkdocModule>
  return rawPosts
}, {})

/** Get a specific post */
export async function getPost(slug: string): Promise<BlogPost> {
  const loaded = await allPosts[slug]?.()
  if (!loaded) {
    throw new Error('No post with slug: ' + slug)
  }
  const { default: Content, ...rawPost } = loaded

  const { data, error } = postSchema.safeParse(rawPost)

  if (error) {
    throw new Error('Invalid frontmatter for post with slug: ' + slug, {
      cause: error,
    })
  }

  return { ...data.frontmatter, slug, Content }
}

const latestFirst = (a: Pick<BlogPost, 'date'>, b: Pick<BlogPost, 'date'>) =>
  b.date.getTime() - a.date.getTime()

/** List posts without content */
export async function listPosts() {
  return Promise.all(
    Object.keys(allPosts).map(async (slug) => {
      const { Content, ...post } = await getPost(slug)
      return post
    }),
  )
    .then((posts) => posts.sort(latestFirst))
    .catch((err) => {
      console.error(err)
      throw error(500, err.message)
    })
}
