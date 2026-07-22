import { describe, it, expect } from 'vitest';
import { QueryTransformationFactory } from '@/query/factory/query-transformation.factory';
import {
  NoOpQueryTransformationStrategy,
  RewriteQueryTransformationStrategy,
  StepBackQueryTransformationStrategy,
  SubQuestionQueryTransformationStrategy,
  CompositeQueryTransformationStrategy,
} from '@/providers/query-transformation';
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

  it('should return CompositeQueryTransformationStrategy for "all" or "auto"', () => {
    const strategyAll = QueryTransformationFactory.create('all');
    expect(strategyAll).toBeInstanceOf(CompositeQueryTransformationStrategy);

    const strategyAuto = QueryTransformationFactory.create('auto');
    expect(strategyAuto).toBeInstanceOf(CompositeQueryTransformationStrategy);
  });

  it('should return CompositeQueryTransformationStrategy for comma-separated list', () => {
    const strategy = QueryTransformationFactory.create('rewrite,step-back');
    expect(strategy).toBeInstanceOf(CompositeQueryTransformationStrategy);
  });

  it('should default to configured strategy if none provided', () => {
    const original = config.retrieval.queryTransformationStrategy;
    config.retrieval.queryTransformationStrategy = 'noop';
    try {
      const strategy = QueryTransformationFactory.create();
      expect(strategy).toBeInstanceOf(NoOpQueryTransformationStrategy);
    } finally {
      config.retrieval.queryTransformationStrategy = original;
    }
  });

  it('should throw AppError for an unsupported strategy', () => {
    expect(() => {
      QueryTransformationFactory.create('invalid-strategy');
    }).toThrowError(AppError);
  });
});
