import { z } from 'zod';

const guardrailsSchema = z.object({
  // Input Guards
  INPUT_MAX_QUERY_LENGTH: z.coerce.number().default(4000),
  ALLOW_URLS: z.coerce.boolean().default(true),
  ENABLE_PROMPT_INJECTION_GUARD: z.coerce.boolean().default(true),
  ENABLE_JAILBREAK_GUARD: z.coerce.boolean().default(true),
  ENABLE_SQL_INJECTION_GUARD: z.coerce.boolean().default(true),
  ENABLE_XSS_GUARD: z.coerce.boolean().default(true),
  ENABLE_PATH_TRAVERSAL_GUARD: z.coerce.boolean().default(true),
  ENABLE_SPAM_GUARD: z.coerce.boolean().default(true),
  ENABLE_PII_GUARD: z.coerce.boolean().default(true),

  // Output Guards
  OUTPUT_MAX_RESPONSE_LENGTH: z.coerce.number().default(25000),
  ENABLE_EMPTY_RESPONSE_GUARD: z.coerce.boolean().default(true),
  ENABLE_CITATION_GUARD: z.coerce.boolean().default(true),
  ENABLE_PROMPT_LEAKAGE_GUARD: z.coerce.boolean().default(true),
  ENABLE_CHAIN_OF_THOUGHT_GUARD: z.coerce.boolean().default(true),
  ENABLE_SENSITIVE_DATA_GUARD: z.coerce.boolean().default(true),
  ENABLE_HALLUCINATED_CITATION_GUARD: z.coerce.boolean().default(true),
  ENABLE_MARKDOWN_GUARD: z.coerce.boolean().default(true),
  ENABLE_HTML_GUARD: z.coerce.boolean().default(true),
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
