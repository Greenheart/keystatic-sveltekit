import { defineEnvVars } from '@sveltejs/kit/env'
import z from 'zod'

const optionalString = z.string().optional()

export const variables = defineEnvVars({
  KEYSTATIC_GITHUB_CLIENT_ID: { schema: optionalString },
  KEYSTATIC_GITHUB_CLIENT_SECRET: { schema: optionalString },
  KEYSTATIC_SECRET: { schema: optionalString },
  PUBLIC_KEYSTATIC_GITHUB_APP_SLUG: { public: true, optionalString },
})
