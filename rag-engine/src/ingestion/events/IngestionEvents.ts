import { logger } from '@/shared/logger';
import { EventEmitter } from 'node:events';

export type IngestionEventType =
  | 'Job Created'
  | 'Job Started'
  | 'Download Started'
  | 'Extraction Completed'
  | 'Normalization Completed'
  | 'Chunking Completed'
  | 'Embedding Completed'
  | 'Indexing Completed'
  | 'Job Finished'
  | 'Job Failed';

export interface IngestionEventPayload {
  event: IngestionEventType;
  jobId: string;
  sourceId: string;
  notebookId: string;
  stage?: string;
  details?: Record<string, any>;
  timestamp: string;
}

class IngestionEventEmitter extends EventEmitter {
  publish(event: IngestionEventType, data: Omit<IngestionEventPayload, 'event' | 'timestamp'>): void {
    const payload: IngestionEventPayload = {
      event,
      ...data,
      timestamp: new Date().toISOString(),
    };

    logger.info(
      {
        event: payload.event,
        jobId: payload.jobId,
        sourceId: payload.sourceId,
        notebookId: payload.notebookId,
        stage: payload.stage,
        ...payload.details,
      },
      `[IngestionEvent] ${payload.event}`,
    );

    this.emit(event, payload);
    this.emit('*', payload);
  }
}

export const ingestionEvents = new IngestionEventEmitter();
