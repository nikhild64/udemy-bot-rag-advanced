import { z } from 'zod';

export const RetrievalConfigSchema = z.object({
  queryTransformationStrategy: z.string().default('noop'),
});

export type RetrievalConfig = z.infer<typeof RetrievalConfigSchema>;

export const retrievalConfig: RetrievalConfig = {
  queryTransformationStrategy: process.env.QUERY_TRANSFORMATION_STRATEGY || 'noop',
};
