import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import fastifyMultipart from '@fastify/multipart';
import { sourceRoutes } from '@/api/routes/source.routes';
import { globalErrorHandler } from '@/api/middlewares/error.handler';
import { SourceStatus } from '@prisma/client';
import { UploadService } from '@/services/UploadService';

vi.mock('@/services/UploadService');

function createMultipartPayload(filename: string, contentType: string, content: string): { body: Buffer; boundary: string } {
  const boundary = '--------------------------123456789012345678901234';
  const header = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`;
  const footer = `\r\n--${boundary}--\r\n`;
  const body = Buffer.concat([
    Buffer.from(header, 'utf-8'),
    Buffer.from(content, 'utf-8'),
    Buffer.from(footer, 'utf-8'),
  ]);
  return { body, boundary };
}

describe('POST /api/sources/:sourceId/upload Route', () => {
  let app: FastifyInstance;
  let mockUploadService: any;

  beforeEach(async () => {
    app = fastify();
    app.setErrorHandler(globalErrorHandler);

    // Register multipart plugin
    await app.register(fastifyMultipart, {
      limits: { fileSize: 50 * 1024 * 1024 },
    });

    // Mock auth middleware by injecting request.auth
    app.addHook('onRequest', async (req) => {
      req.auth = { userId: 'user_123' };
    });

    // Create mock UploadService instance
    mockUploadService = {
      uploadSourceFile: vi.fn(),
    };

    app.decorate('uploadService', mockUploadService as unknown as UploadService);

    await app.register(sourceRoutes);
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  it('should handle multipart file upload and return 200 with UploadSourceResponse', async () => {
    const mockResponse = {
      sourceId: 'src_1',
      status: SourceStatus.Uploaded,
      storagePath: 'uploads/user_123/nb_1/src_1/document.pdf',
      fileUrl: 'https://storage.supabase.co/bucket/uploads/user_123/nb_1/src_1/document.pdf',
      uploadedAt: '2026-07-22T22:00:00.000Z',
    };
    mockUploadService.uploadSourceFile.mockResolvedValue(mockResponse);

    const { body, boundary } = createMultipartPayload('document.pdf', 'application/pdf', '%PDF-1.4 dummy content');

    const response = await app.inject({
      method: 'POST',
      url: '/api/sources/src_1/upload',
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: body,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(mockResponse);
    expect(mockUploadService.uploadSourceFile).toHaveBeenCalledWith('user_123', 'src_1', expect.objectContaining({
      filename: 'document.pdf',
      mimetype: 'application/pdf',
    }));
  });

  it('should return 400 Bad Request when no file is uploaded in request', async () => {
    const boundary = '--------------------------123456789012345678901234';
    const emptyBody = Buffer.from(`--${boundary}--\r\n`);

    const response = await app.inject({
      method: 'POST',
      url: '/api/sources/src_1/upload',
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: emptyBody,
    });

    expect(response.statusCode).toBe(400);
  });
});
