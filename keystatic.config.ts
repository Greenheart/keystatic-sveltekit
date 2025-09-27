import { config, fields, collection } from '@keystatic/core'

// TODO: Customise the Markdoc config to allow custom tags (for example to handle images )
export const markdocConfig = fields.markdoc.createMarkdocConfig({})

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
      path: 'src/content/posts/**',
      format: { contentField: 'content' },
      schema: {
        title: fields.slug({
          name: { label: 'Title' },
          slug: {
            description:
              'Tip: You can save to a specific directory like for example "2025/new-post"',
          },
        }),
        content: fields.markdoc({ label: 'Content' }),
        date: fields.date({ label: 'Date', defaultValue: { kind: 'today' } }),
        // Testing
        updatedAt: fields.date({ label: 'Updated at 4 :)', defaultValue: { kind: 'today' } }),
      },
    }),
  },
})
