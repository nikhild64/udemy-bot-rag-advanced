export class DocumentNormalizer {
  /**
   * Normalizes document text content for chunking.
   */
  static normalize(text: string): string {
    if (!text) return '';

    return text
      // 1. Replace Windows / Mac line endings with standard Unix newline \n
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // 2. Strip non-printable null/control characters except tab and newline
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      // 3. Replace tabs with space
      .replace(/\t/g, ' ')
      // 4. Collapse multiple spaces into a single space on lines
      .replace(/[ ]+/g, ' ')
      // 5. Trim horizontal whitespace on each line
      .split('\n')
      .map((line) => line.trim())
      .join('\n')
      // 6. Collapse 3+ consecutive newlines into 2 (preserve paragraph boundaries)
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}
