import { describe, it, expect } from 'vitest';
import { QueryTransformationFactory } from '@/query/factory/query-transformation.factory';
import { NoOpQueryTransformationStrategy } from '@/providers/query-transformation/noop-strategy';
import { AppError } from '@/shared/errors';
import { config } from '@/config';

describe('QueryTransformationFactory', () => {
  it('should return NoOpQueryTransformationStrategy for "noop"', () => {
    const strategy = QueryTransformationFactory.create('noop');
    expect(strategy).toBeInstanceOf(NoOpQueryTransformationStrategy);
  });

  it('should handle case insensitivity', () => {
    const strategy = QueryTransformationFactory.create('NoOp');
    expect(strategy).toBeInstanceOf(NoOpQueryTransformationStrategy);
  });

  it('should default to the configured strategy if none is provided', () => {
    // Temporarily mock config
    const originalStrategy = config.retrieval.queryTransformationStrategy;
    config.retrieval.queryTransformationStrategy = 'noop';
    
    try {
      const strategy = QueryTransformationFactory.create();
      expect(strategy).toBeInstanceOf(NoOpQueryTransformationStrategy);
    } finally {
      config.retrieval.queryTransformationStrategy = originalStrategy;
    }
  });

  it('should throw an AppError for an unsupported strategy', () => {
    expect(() => {
      QueryTransformationFactory.create('invalid-strategy');
    }).toThrowError(AppError);

    expect(() => {
      QueryTransformationFactory.create('invalid-strategy');
    }).toThrowError('Unsupported query transformation strategy: invalid-strategy');
  });
});
