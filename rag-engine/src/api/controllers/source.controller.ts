import { FastifyReply, FastifyRequest } from 'fastify';
import { SourceService } from '@/services/SourceService';
import { UploadService } from '@/services/UploadService';
import { createSourceSchema, updateSourceSchema, listSourcesQuerySchema } from '../schemas/source.schema';
import { UnauthorizedError, ValidationError } from '@/shared/errors';

import { IngestionQueue } from '@/infrastructure/queue/IngestionQueue';

const sourceService = new SourceService();
const defaultUploadService = new UploadService();
const ingestionQueue = new IngestionQueue();

function getUserId(request: FastifyRequest): string {
  const userId = request.auth?.userId || (request as any).userId;
  if (!userId) {
    throw new UnauthorizedError('Unauthorized');
  }
  return userId;
}

export async function createSourceController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const userId = getUserId(request);
  const { id: notebookId } = request.params as { id: string };
  const body = createSourceSchema.parse(request.body);

  const source = await sourceService.createSource(userId, {
    notebookId,
    type: body.type,
    displayName: body.displayName,
    title: body.title,
    storagePath: body.storagePath ?? undefined,
    fileUrl: body.fileUrl ?? undefined,
    mimeType: body.mimeType ?? undefined,
    size: body.size ?? undefined,
    metadata: body.metadata ?? undefined,
    status: body.status,
  });

  await reply.status(201).send(source);
}

export async function listSourcesController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const userId = getUserId(request);
  const { id: notebookId } = request.params as { id: string };
  const query = listSourcesQuerySchema.parse(request.query);

  const result = await sourceService.listSources(notebookId, userId, query);

  await reply.status(200).send(result);
}

export async function getSourceByIdController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const userId = getUserId(request);
  const { id } = request.params as { id: string };

  const source = await sourceService.getSource(id, userId);

  await reply.status(200).send(source);
}

export async function updateSourceController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const userId = getUserId(request);
  const { id } = request.params as { id: string };
  const body = updateSourceSchema.parse(request.body);

  const source = await sourceService.updateSource(id, userId, body);

  await reply.status(200).send(source);
}

export async function deleteSourceController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const userId = getUserId(request);
  const { id } = request.params as { id: string };

  await sourceService.deleteSource(id, userId);

  await reply.status(200).send({ success: true, message: 'Source deleted successfully' });
}

export async function uploadSourceFileController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const userId = getUserId(request);
  const params = request.params as { sourceId?: string; id?: string };
  const sourceId = params.sourceId || params.id;

  if (!sourceId) {
    throw new ValidationError('Source ID is required');
  }

  const fileData = await request.file();
  if (!fileData) {
    throw new ValidationError('No file uploaded in multipart request');
  }

  const buffer = await fileData.toBuffer();
  const uploadService: UploadService = request.server.uploadService || defaultUploadService;

  const result = await uploadService.uploadSourceFile(userId, sourceId, {
    filename: fileData.filename,
    buffer,
    mimetype: fileData.mimetype,
  });

  await reply.status(200).send(result);
}

export async function getSourceStatusController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const userId = getUserId(request);
  const params = request.params as { sourceId?: string; id?: string };
  const sourceId = params.sourceId || params.id;

  if (!sourceId) {
    throw new ValidationError('Source ID is required');
  }

  // 1. Verify source existence & ownership
  const service: SourceService = request.server.sourceService || sourceService;
  const source = await service.getSource(sourceId, userId);

  // 2. Fetch live job status from IngestionQueue
  const jobProgress = await ingestionQueue.getJobStatus(sourceId);

  if (jobProgress) {
    await reply.status(200).send({
      sourceId: source.id,
      status: jobProgress.status,
      progress: jobProgress.progress,
      currentStage: jobProgress.currentStage,
      error: jobProgress.error || null,
      updatedAt: jobProgress.updatedAt,
    });
    return;
  }

  // 3. Fallback status derived from database Source record
  const meta = (source.metadata as Record<string, any>) || {};
  let progress = 0;
  let currentStage = 'Queued';

  if (source.status === 'Indexed') {
    progress = 100;
    currentStage = 'Completed';
  } else if (source.status === 'Failed') {
    progress = 0;
    currentStage = 'Failed';
  } else if (source.status === 'Processing') {
    progress = 50;
    currentStage = 'Processing';
  } else if (source.status === 'Queued' || source.status === 'Uploaded') {
    progress = 0;
    currentStage = 'Queued';
  }

  await reply.status(200).send({
    sourceId: source.id,
    status: source.status,
    progress,
    currentStage,
    error: meta.error || null,
    updatedAt: source.updatedAt.toISOString(),
  });
}

