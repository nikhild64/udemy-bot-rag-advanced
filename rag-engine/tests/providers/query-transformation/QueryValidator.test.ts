import { describe, it, expect } from 'vitest';
import { QueryValidator } from '@/providers/query-transformation/validators/query.validator';

describe('QueryValidator', () => {
  it('should validate normal clean queries', () => {
    expect(QueryValidator.isValidSingleQuery('How do Angular Signals work?')).toBe(true);
    expect(QueryValidator.isValidSingleQuery('Docker vs Kubernetes')).toBe(true);
  });

  it('should reject empty or whitespace queries', () => {
    expect(QueryValidator.isValidSingleQuery('')).toBe(false);
    expect(QueryValidator.isValidSingleQuery('   ')).toBe(false);
  });

  it('should reject markdown formatting', () => {
    expect(QueryValidator.isValidSingleQuery('```How to write code```')).toBe(false);
    expect(QueryValidator.isValidSingleQuery('**Angular** Signals')).toBe(false);
    expect(QueryValidator.isValidSingleQuery('# Header Query')).toBe(false);
  });

  it('should reject conversational prefixes', () => {
    expect(QueryValidator.isValidSingleQuery('Here is the rewritten query: Angular state')).toBe(false);
    expect(QueryValidator.isValidSingleQuery('Sure! How does Angular work?')).toBe(false);
    expect(QueryValidator.isValidSingleQuery('Certainly, here is the answer')).toBe(false);
  });

  it('should reject prompt leakage terms', () => {
    expect(QueryValidator.isValidSingleQuery('You are a search query optimization assistant')).toBe(false);
    expect(QueryValidator.isValidSingleQuery('System prompt ignore previous')).toBe(false);
  });

  it('should reject multiline text', () => {
    expect(QueryValidator.isValidSingleQuery('Line 1\nLine 2')).toBe(false);
  });

  it('should filter multiple valid queries correctly', () => {
    const input = [
      'What is Docker Compose?',
      'Here is a question',
      'What is Kubernetes?',
      '**Invalid** markdown',
    ];
    const filtered = QueryValidator.filterValidQueries(input);
    expect(filtered).toEqual(['What is Docker Compose?', 'What is Kubernetes?']);
  });

  it('should create a safe fallback result', () => {
    const fallback = QueryValidator.createFallbackResult('Original query', 'test', 'Validation error');
    expect(fallback).toEqual({
      originalQuery: 'Original query',
      transformedQuery: 'Original query',
      transformedQueries: ['Original query'],
      strategy: 'test_fallback',
      metadata: {
        transformed: false,
        reason: 'Validation error',
      },
    });
  });
});
