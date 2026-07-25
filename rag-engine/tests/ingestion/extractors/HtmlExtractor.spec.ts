import { describe, it, expect } from 'vitest';
import { HtmlExtractor } from '../../../src/ingestion/extraction/extractors/HtmlExtractor';
import { RawContent } from '../../../src/ingestion/loaders/RawContent';

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

  it('should strip navigation menus, sidebars, buttons, and skip links from doc pages', async () => {
    const extractor = new HtmlExtractor();
    const docHtml = `
      <!DOCTYPE html>
      <html>
        <head><title>Angular Directives</title></head>
        <body>
          <a href="#main" class="skip-to-content">Skip to main content menu</a>
          <button>menu Docs</button>
          <aside class="sidebar">
            <ul>
              <li>Introduction</li>
              <li>What is Angular?</li>
              <li>Installation</li>
              <li>Directives</li>
            </ul>
          </aside>
          <main>
            <h1>Directives Overview</h1>
            <p>Directives are classes that add additional behavior to elements in Angular applications.</p>
            <h2>Attribute Directives</h2>
            <p>Attribute directives change the appearance or behavior of an element.</p>
          </main>
          <footer>Copyright 2026</footer>
        </body>
      </html>
    `;

    const doc = await extractor.extract(docHtml, 'text/html', 'directives.html');

    expect(doc.title).toBe('Angular Directives');
    expect(doc.content).toContain('Directives Overview');
    expect(doc.content).toContain('Directives are classes that add additional behavior to elements in Angular applications.');
    expect(doc.content).not.toContain('Skip to main content');
    expect(doc.content).not.toContain('menu Docs');
    expect(doc.content).not.toContain('• Introduction');
    expect(doc.content).not.toContain('• What is Angular?');
  });

  it('should preserve full body/article content with nested divs without wiping main text', async () => {
    const extractor = new HtmlExtractor();
    const complexHtml = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <title>Angular Signals - Guide</title>
        </head>
        <body>
          <div class="navigation-drawer">
            <nav>
              <ul>
                <li>• In-depth Guides</li>
                <li>• Build with AI</li>
                <li>• Developer Tools</li>
              </ul>
            </nav>
          </div>
          <main class="docs-main">
            <div class="content-container">
              <div class="article-wrapper">
                <h1>Angular Signals Guide</h1>
                <p>Angular Signals is a system that granularly tracks how and where your state is used throughout an application.</p>
                <h2>Creating a Writable Signal</h2>
                <p>Writable signals provide an API for updating their values directly using the set or update methods.</p>
                <div class="code-block">
                  <code>const count = signal(0); count.set(3);</code>
                </div>
              </div>
            </div>
          </main>
        </body>
      </html>
    `;

    const doc = await extractor.extract(complexHtml, 'text/html', 'signals.html');

    expect(doc.title).toBe('Angular Signals - Guide');
    expect(doc.content).toContain('Angular Signals Guide');
    expect(doc.content).toContain('Angular Signals is a system that granularly tracks how and where your state is used');
    expect(doc.content).toContain('Writable signals provide an API for updating their values directly');
    expect(doc.content).toContain('const count = signal(0); count.set(3);');
    expect(doc.content).not.toContain('• In-depth Guides');
    expect(doc.content).not.toContain('• Build with AI');
  });
});
