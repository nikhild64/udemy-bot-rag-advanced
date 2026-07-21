import { describe, it, expect } from 'vitest';
import { QueryTransformationFactory } from '@/query/factory/query-transformation.factory';
import { NoOpQueryTransformationStrategy } from '@/providers/query-transformation/noop-strategy';
import { AppError } from '@/shared/errors';

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
    // Assuming default config is 'noop'
    const strategy = QueryTransformationFactory.create();
    expect(strategy).toBeInstanceOf(NoOpQueryTransformationStrategy);
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
