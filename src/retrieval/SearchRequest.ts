import { z } from 'zod';
import { RETRIEVAL_DEFAULTS } from './RetrievalOptions';

export const SearchRequestSchema = z.object({
  query: z.string().min(1, 'Query cannot be empty'),
  topK: z
    .number()
    .min(1)
    .max(RETRIEVAL_DEFAULTS.MAX_TOP_K)
    .optional()
    .default(RETRIEVAL_DEFAULTS.DEFAULT_TOP_K),
  minimumScore: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .default(RETRIEVAL_DEFAULTS.DEFAULT_MINIMUM_SCORE),
  filters: z.record(z.unknown()).optional(),
});

export type SearchRequest = z.input<typeof SearchRequestSchema>;
