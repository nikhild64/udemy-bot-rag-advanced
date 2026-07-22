import { describe, it, expect } from 'vitest';
import { DocumentNormalizer } from '@/ingestion/normalization/DocumentNormalizer';

describe('DocumentNormalizer', () => {
  it('should normalize line endings, spaces, and non-printable control characters', () => {
    const rawInput = "Line 1\r\nLine 2\r\rLine 3 \t \x00\x07\n\n\n\nLine 4";
    const normalized = DocumentNormalizer.normalize(rawInput);

    expect(normalized).toBe("Line 1\nLine 2\n\nLine 3\n\nLine 4");
  });

  it('should handle empty or whitespace text gracefully', () => {
    expect(DocumentNormalizer.normalize('')).toBe('');
    expect(DocumentNormalizer.normalize('   \t\r\n   ')).toBe('');
  });
});
