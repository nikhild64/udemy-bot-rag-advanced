import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FastifyRequest, FastifyReply } from 'fastify';
import { requireAuth } from './auth.middleware';

describe('requireAuth Middleware', () => {
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;
  let mockSend: ReturnType<typeof vi.fn>;
  let mockStatus: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSend = vi.fn();
    mockStatus = vi.fn().mockReturnValue({ send: mockSend });

    mockRequest = {};
    mockReply = {
      status: mockStatus,
    };
  });

  it('should return 401 if request.auth is missing', async () => {
    await requireAuth(mockRequest as FastifyRequest, mockReply as FastifyReply);

    expect(mockStatus).toHaveBeenCalledWith(401);
    expect(mockSend).toHaveBeenCalledWith({
      error: 'Unauthorized',
      message: 'Missing or invalid authentication token',
    });
  });

  it('should return 401 if request.auth.userId is missing', async () => {
    mockRequest.auth = {} as any; // No userId

    await requireAuth(mockRequest as FastifyRequest, mockReply as FastifyReply);

    expect(mockStatus).toHaveBeenCalledWith(401);
    expect(mockSend).toHaveBeenCalledWith({
      error: 'Unauthorized',
      message: 'Missing or invalid authentication token',
    });
  });

  it('should proceed without error if request.auth.userId is present', async () => {
    mockRequest.auth = { userId: 'user_123' } as any;

    const result = await requireAuth(mockRequest as FastifyRequest, mockReply as FastifyReply);

    // If it doesn't return anything (undefined), Fastify proceeds to the next handler
    expect(result).toBeUndefined();
    expect(mockStatus).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
  });
});
