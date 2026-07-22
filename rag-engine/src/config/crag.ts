import { z } from 'zod';

export const CRAGConfigSchema = z.object({
  enabled: z.boolean().default(true),
  strategy: z.enum(['similarity', 'llm', 'hybrid']).default('hybrid'),
  similarityThreshold: z.coerce.number().default(0.7),
  maxRetries: z.coerce.number().default(2),
  retrievalLimitIncrement: z.coerce.number().default(5),
  maxRetrievalLimit: z.coerce.number().default(30),
  correctiveStrategy: z.enum(['rewrite', 'stepback', 'subquestion', 'increase_limit', 'relaxed_threshold', 'adaptive']).default('adaptive'),
  minChunkConfidence: z.coerce.number().default(0.5),
});

export type CRAGConfig = z.infer<typeof CRAGConfigSchema>;

export const cragConfig: CRAGConfig = {
  enabled: process.env.CRAG_ENABLED !== undefined ? process.env.CRAG_ENABLED === 'true' : true,
  strategy: (process.env.CRAG_STRATEGY as CRAGConfig['strategy']) || 'hybrid',
  similarityThreshold: process.env.CRAG_SIMILARITY_THRESHOLD ? parseFloat(process.env.CRAG_SIMILARITY_THRESHOLD) : 0.7,
  maxRetries: process.env.CRAG_MAX_RETRIES ? parseInt(process.env.CRAG_MAX_RETRIES, 10) : 2,
  retrievalLimitIncrement: process.env.CRAG_LIMIT_INCREMENT ? parseInt(process.env.CRAG_LIMIT_INCREMENT, 10) : 5,
  maxRetrievalLimit: process.env.CRAG_MAX_RETRIEVAL_LIMIT ? parseInt(process.env.CRAG_MAX_RETRIEVAL_LIMIT, 10) : 30,
  correctiveStrategy: (process.env.CRAG_CORRECTIVE_STRATEGY as CRAGConfig['correctiveStrategy']) || 'adaptive',
  minChunkConfidence: process.env.CRAG_MIN_CHUNK_CONFIDENCE ? parseFloat(process.env.CRAG_MIN_CHUNK_CONFIDENCE) : 0.5,
};
