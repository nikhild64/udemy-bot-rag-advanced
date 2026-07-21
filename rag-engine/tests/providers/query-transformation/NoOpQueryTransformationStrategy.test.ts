import { describe, it, expect } from 'vitest';
import { NoOpQueryTransformationStrategy } from '@/providers/query-transformation/noop-strategy';

describe('NoOpQueryTransformationStrategy', () => {
  it('should return the original query as the transformed query', async () => {
    const strategy = new NoOpQueryTransformationStrategy();
    const query = 'safearea';
    
    const result = await strategy.transform(query);
    
    expect(result.originalQuery).toBe(query);
    expect(result.transformedQuery).toBe(query);
    expect(result.strategy).toBe('noop');
    expect(result.metadata).toEqual({});
  });

  it('should trim whitespace from the transformed query', async () => {
    const strategy = new NoOpQueryTransformationStrategy();
    const query = '  safearea  ';
    
    const result = await strategy.transform(query);
    
    expect(result.originalQuery).toBe(query);
    expect(result.transformedQuery).toBe('safearea');
    expect(result.strategy).toBe('noop');
  });

  it('should handle empty queries gracefully', async () => {
    const strategy = new NoOpQueryTransformationStrategy();
    const query = '';
    
    const result = await strategy.transform(query);
    
    expect(result.originalQuery).toBe(query);
    expect(result.transformedQuery).toBe(query);
    expect(result.strategy).toBe('noop');
  });
});
