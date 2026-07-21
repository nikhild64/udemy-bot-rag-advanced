import { z } from 'zod';

export const RetrievalConfigSchema = z.object({
  queryTransformationStrategy: z.string().default('noop'),
  rerankerProvider: z.string().default('noop'),
  rerankerTopK: z.coerce.number().default(10),
  rerankerBatchSize: z.coerce.number().default(10),
});

export type RetrievalConfig = z.infer<typeof RetrievalConfigSchema>;

export const retrievalConfig: RetrievalConfig = {
  queryTransformationStrategy: process.env.QUERY_TRANSFORMATION_STRATEGY || 'noop',
  rerankerProvider: process.env.RERANKER_PROVIDER || 'noop',
  rerankerTopK: process.env.RERANKER_TOP_K ? parseInt(process.env.RERANKER_TOP_K, 10) : 10,
  rerankerBatchSize: process.env.RERANKER_BATCH_SIZE ? parseInt(process.env.RERANKER_BATCH_SIZE, 10) : 10,
};
