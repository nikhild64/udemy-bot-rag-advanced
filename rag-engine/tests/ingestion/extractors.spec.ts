import { describe, it, expect } from 'vitest';
import { TxtExtractor } from '@/ingestion/extraction/extractors/TxtExtractor';
import { VttExtractor } from '@/ingestion/extraction/extractors/VttExtractor';
import { PdfExtractor } from '@/ingestion/extraction/extractors/PdfExtractor';
import { HtmlExtractor } from '@/ingestion/extraction/extractors/HtmlExtractor';
import { ExtractorFactory } from '@/ingestion/extraction/extractors/ExtractorFactory';
import { SourceType } from '@prisma/client';
import zlib from 'node:zlib';

describe('Document Extractors', () => {
  describe('TxtExtractor', () => {
    it('should extract plain text content', async () => {
      const extractor = new TxtExtractor();
      const buffer = Buffer.from('Hello world plain text', 'utf-8');
      const res = await extractor.extract(buffer, 'text/plain', 'sample.txt');

      expect(res.text).toBe('Hello world plain text');
      expect(res.content).toBe('Hello world plain text');
      expect(res.metadata?.fileName).toBe('sample.txt');
    });
  });

  describe('VttExtractor', () => {
    it('should parse VTT transcripts and strip headers/timestamps', async () => {
      const vttContent = `WEBVTT

1
00:00:01.000 --> 00:00:04.000
Welcome to this course!

2
00:00:04.500 --> 00:00:08.000
Today we will learn about RAG architectures.
`;
      const extractor = new VttExtractor();
      const res = await extractor.extract(Buffer.from(vttContent, 'utf-8'), 'text/vtt', 'intro.vtt');

      expect(res.text).toContain('Welcome to this course!');
      expect(res.text).toContain('Today we will learn about RAG architectures.');
      expect(res.metadata?.cueCount).toBe(2);
    });
  });

  describe('PdfExtractor', () => {
    it('should extract text from PDF buffer', async () => {
      const pdfSimulatedBuffer = Buffer.from('(Hello PDF World) Tj', 'utf-8');
      const extractor = new PdfExtractor();
      const res = await extractor.extract(pdfSimulatedBuffer, 'application/pdf', 'doc.pdf');

      expect(res.text).toContain('Hello PDF World');
    });

    it('extracts only content stream text and never PDF object structure', async () => {
      const compressedStream = zlib.deflateSync(Buffer.from('(Actual document text) Tj', 'latin1'));
      const pdf = Buffer.concat([
        Buffer.from('%PDF-1.7\n50 0 obj\n<< /Type /Page /Contents 425 0 R >>\nstream\n', 'latin1'),
        compressedStream,
        Buffer.from('\nendstream\nendobj\n%%EOF', 'latin1'),
      ]);

      const res = await new PdfExtractor().extract(pdf, 'application/pdf', 'document.pdf');

      expect(res.text).toContain('Actual document text');
      expect(res.text).not.toMatch(/endstream|endobj|\/Type \/Page|425 0 R/i);
    });
  });

  describe('HtmlExtractor', () => {
    it('should extract text and title from HTML content', async () => {
      const htmlBuffer = Buffer.from('<html><head><title>Test Title</title></head><body><p>Hello HTML World</p></body></html>', 'utf-8');
      const extractor = new HtmlExtractor();
      const res = await extractor.extract(htmlBuffer, 'text/html', 'page.html');

      expect(res.title).toBe('Test Title');
      expect(res.content).toContain('Hello HTML World');
    });
  });

  describe('ExtractorFactory', () => {
    it('should return correct extractor based on type, mimeType, extension, or RawContent', () => {
      const pdfExt = ExtractorFactory.getExtractor(SourceType.PDF, 'application/pdf', 'file.pdf');
      expect(pdfExt).toBeInstanceOf(PdfExtractor);

      const vttExt = ExtractorFactory.getExtractor(SourceType.VTT, 'text/vtt', 'file.vtt');
      expect(vttExt).toBeInstanceOf(VttExtractor);

      const htmlExt = ExtractorFactory.getExtractor(SourceType.WEBSITE, 'text/html', 'index.html');
      expect(htmlExt).toBeInstanceOf(HtmlExtractor);

      const txtExt = ExtractorFactory.getExtractor(SourceType.TEXT, 'text/plain', 'file.txt');
      expect(txtExt).toBeInstanceOf(TxtExtractor);

      const rawContentExt = ExtractorFactory.getExtractor({
        sourceId: '1',
        sourceType: 'WEBSITE',
        mimeType: 'text/html',
        content: '<html></html>',
        metadata: {},
      });
      expect(rawContentExt).toBeInstanceOf(HtmlExtractor);
    });
  });
});
