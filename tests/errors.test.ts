import { describe, it, expect } from 'vitest';
import {
  AppError,
  ValidationError,
  ConfigurationError,
  ProviderError,
  NotFoundError,
} from '@/shared/errors';

describe('Custom Error Hierarchy', () => {
  it('should instantiate AppError with default properties', () => {
    const error = new AppError('Something went wrong');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
    expect(error.name).toBe('AppError');
    expect(error.message).toBe('Something went wrong');
    expect(error.statusCode).toBe(500);
    expect(error.code).toBe('APP_ERROR');
    expect(error.metadata).toBeUndefined();
  });

  it('should support optional metadata and custom statusCode/code in AppError', () => {
    const metadata = { detail: 'extra info', count: 42 };
    const error = new AppError('Custom app error', {
      statusCode: 418,
      code: 'TEAPOT_ERROR',
      metadata,
    });
    expect(error.statusCode).toBe(418);
    expect(error.code).toBe('TEAPOT_ERROR');
    expect(error.metadata).toEqual(metadata);
  });

  it('should correctly initialize ValidationError defaults and overrides', () => {
    const error = new ValidationError('Invalid email format', {
      metadata: { field: 'email' },
    });
    expect(error).toBeInstanceOf(AppError);
    expect(error.name).toBe('ValidationError');
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.metadata).toEqual({ field: 'email' });
  });

  it('should correctly initialize ConfigurationError defaults', () => {
    const error = new ConfigurationError('Missing env var');
    expect(error).toBeInstanceOf(AppError);
    expect(error.name).toBe('ConfigurationError');
    expect(error.statusCode).toBe(500);
    expect(error.code).toBe('CONFIGURATION_ERROR');
  });

  it('should correctly initialize ProviderError defaults', () => {
    const error = new ProviderError('Failed to connect to Qdrant');
    expect(error).toBeInstanceOf(AppError);
    expect(error.name).toBe('ProviderError');
    expect(error.statusCode).toBe(502);
    expect(error.code).toBe('PROVIDER_ERROR');
  });

  it('should correctly initialize NotFoundError defaults', () => {
    const error = new NotFoundError('Course not found');
    expect(error).toBeInstanceOf(AppError);
    expect(error.name).toBe('NotFoundError');
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('NOT_FOUND_ERROR');
  });
});
