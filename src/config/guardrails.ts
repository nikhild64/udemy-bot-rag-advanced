import { z } from 'zod';

const guardrailsSchema = z.object({
  INPUT_MAX_QUERY_LENGTH: z.coerce.number().default(4000),
  ALLOW_URLS: z.coerce.boolean().default(true),
  ENABLE_PROMPT_INJECTION_GUARD: z.coerce.boolean().default(true),
  ENABLE_JAILBREAK_GUARD: z.coerce.boolean().default(true),
  ENABLE_SQL_INJECTION_GUARD: z.coerce.boolean().default(true),
  ENABLE_XSS_GUARD: z.coerce.boolean().default(true),
  ENABLE_PATH_TRAVERSAL_GUARD: z.coerce.boolean().default(true),
  ENABLE_SPAM_GUARD: z.coerce.boolean().default(true),
  ENABLE_PII_GUARD: z.coerce.boolean().default(true),
});

const parsed = guardrailsSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    '❌ Invalid guardrails configuration:',
    parsed.error.format()
  );
  process.exit(1);
}

export type GuardrailsConfig = z.infer<typeof guardrailsSchema>;
export const guardrailsConfig = parsed.data;
