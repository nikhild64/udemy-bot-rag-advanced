import { describe, it, expect } from 'vitest';
import { HtmlExtractor } from '@/ingestion/extraction/extractors/HtmlExtractor';
import { RawContent } from '@/ingestion/loaders/RawContent';

describe('HtmlExtractor', () => {
  it('should extract title, clean text, and metadata from RawContent HTML', async () => {
    const extractor = new HtmlExtractor();

    const rawContent: RawContent = {
      sourceId: 'src-html-1',
      sourceType: 'WEBSITE',
      mimeType: 'text/html',
      content: `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <title>Advanced RAG System Guide</title>
            <meta name="author" content="Jane Doe" />
          </head>
          <body>
            <header>
              <h1>Vector Search & Embeddings</h1>
            </header>
            <main>
              <h2>Introduction</h2>
              <p>Retrieval-Augmented Generation enhances LLM responses with facts.</p>
              <h3>Key Components</h3>
              <p>Vector databases store high-dimensional embeddings efficiently.</p>
            </main>
          </body>
        </html>
      `,
      metadata: { url: 'https://example.com/rag' },
    };

    const doc = await extractor.extract(rawContent);

    expect(doc.title).toBe('Advanced RAG System Guide');
    expect(doc.content).toContain('Vector Search & Embeddings');
    expect(doc.content).toContain('Retrieval-Augmented Generation enhances LLM responses with facts.');
    expect(doc.metadata.author).toBe('Jane Doe');
    expect(doc.metadata.language).toBe('en');
    expect(doc.metadata.headings).toEqual([
      'Vector Search & Embeddings',
      'Introduction',
      'Key Components',
    ]);
  });

  it('should handle Buffer or string input directly', async () => {
    const extractor = new HtmlExtractor();
    const htmlString = '<html><head><title>Simple Page</title></head><body><p>Hello World from HTML!</p></body></html>';

    const doc = await extractor.extract(Buffer.from(htmlString), 'text/html', 'page.html');

    expect(doc.title).toBe('Simple Page');
    expect(doc.content).toBe('Hello World from HTML!');
    expect(doc.metadata.fileName).toBe('page.html');
  });
});
