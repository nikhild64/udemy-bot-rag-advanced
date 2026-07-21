import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { postChat } from '../controllers/chat.controller';

const chatRequestSchema = z.object({
  query: z.string().min(1, 'Query cannot be empty'),
  topK: z.number().int().positive().optional(),
  filters: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const citationSchema = z.object({
  chunkId: z.string(),
  courseName: z.string(),
  moduleTitle: z.string(),
  lessonTitle: z.string(),
  startTime: z.number(),
  endTime: z.number(),
  similarityScore: z.number(),
}).passthrough();

const retrievedChunkSchema = z.object({
  chunkId: z.string(),
  text: z.string(),
  metadata: z.record(z.unknown()),
  score: z.number(),
  citation: citationSchema,
}).passthrough();

const chatResponseSchema = z.object({
  answer: z.string(),
  citations: z.array(citationSchema).optional(),
  retrievedChunks: z.array(retrievedChunkSchema).optional(),
  metadata: z.record(z.unknown()).optional(),
}).passthrough();

export async function chatRoutes(app: FastifyInstance): Promise<void> {
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.post(
    '/chat',
    {
      schema: {
        description: 'Submit a query to the Knowledge Engine and get an AI-generated answer',
        tags: ['Chat'],
        body: chatRequestSchema,
        response: {
          200: chatResponseSchema,
          400: z.object({
            success: z.boolean(),
            error: z.object({
              message: z.string(),
              stack: z.string().optional(),
            }),
          }),
          500: z.object({
            success: z.boolean(),
            error: z.object({
              message: z.string(),
              stack: z.string().optional(),
            }),
          }),
        },
      },
    },
    postChat
  );
}
