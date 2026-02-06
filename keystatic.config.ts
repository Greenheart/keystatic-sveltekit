import { config, fields, collection } from '@keystatic/core'
import { block, type ContentComponent } from '@keystatic/core/content-components'

const components: Record<string, ContentComponent> = {
  Counter: block({
    label: 'Counter',
    description: 'Interactive Svelte component',
    schema: {},
  }),
}

export default config({
  storage: {
    kind: 'local',
  },
  collections: {
    posts: collection({
      label: 'Posts',
      slugField: 'title',
      // This path allows you to store posts in any subdirectories, like for example "/posts/{year}/some-post"
      // Learn more: https://keystatic.com/docs/path-wildcard#nested-slug-example
      path: './src/content/posts/**',
      format: { contentField: 'content' },
      schema: {
        title: fields.slug({
          name: { label: 'Title' },
          slug: {
            description:
              'Tip: You can save to a specific directory like for example "2025/new-post"',
          },
        }),
        content: fields.markdoc({ label: 'Content', components }),
        date: fields.date({ label: 'Date', defaultValue: { kind: 'today' } }),
      },
    }),
  },
})
