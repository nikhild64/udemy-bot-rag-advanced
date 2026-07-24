import { describe, it, expect } from 'vitest';
import { SourceLoaderFactory } from '@/ingestion/loaders/SourceLoaderFactory';
import { FileSourceLoader } from '@/ingestion/loaders/FileSourceLoader';
import { WebsiteLoader } from '@/ingestion/loaders/WebsiteLoader';
import { YouTubeLoader } from '@/ingestion/loaders/YouTubeLoader';

describe('SourceLoaderFactory', () => {
  it('should instantiate FileSourceLoader for FILE, PDF, TEXT, VTT, DOCX types', () => {
    const pdfLoader = SourceLoaderFactory.getLoader('PDF');
    expect(pdfLoader).toBeInstanceOf(FileSourceLoader);

    const txtLoader = SourceLoaderFactory.getLoader('TEXT');
    expect(txtLoader).toBeInstanceOf(FileSourceLoader);

    const vttLoader = SourceLoaderFactory.getLoader('VTT');
    expect(vttLoader).toBeInstanceOf(FileSourceLoader);

    const docxLoader = SourceLoaderFactory.getLoader('DOCX');
    expect(docxLoader).toBeInstanceOf(FileSourceLoader);
  });

  it('should instantiate WebsiteLoader for WEBSITE or html URLs', () => {
    const webLoader = SourceLoaderFactory.getLoader('WEBSITE');
    expect(webLoader).toBeInstanceOf(WebsiteLoader);

    const urlLoader = SourceLoaderFactory.getLoader(undefined, { fileUrl: 'https://example.com/article' });
    expect(urlLoader).toBeInstanceOf(WebsiteLoader);
  });

  it('should instantiate FileSourceLoader for uploaded PDFs with public HTTPS URLs', () => {
    const uploadedPdfLoader = SourceLoaderFactory.getLoader('PDF', {
      type: 'PDF',
      fileUrl: 'https://storage.example.com/uploads/document.pdf',
      storagePath: 'uploads/user/notebook/source/document.pdf',
      mimeType: 'application/pdf',
    });

    expect(uploadedPdfLoader).toBeInstanceOf(FileSourceLoader);
    expect(uploadedPdfLoader).not.toBeInstanceOf(WebsiteLoader);
  });

  it('should instantiate YouTubeLoader for YOUTUBE or youtube.com URLs', () => {
    const ytLoader = SourceLoaderFactory.getLoader('YOUTUBE');
    expect(ytLoader).toBeInstanceOf(YouTubeLoader);

    const ytUrlLoader = SourceLoaderFactory.getLoader(undefined, { fileUrl: 'https://www.youtube.com/watch?v=12345678901' });
    expect(ytUrlLoader).toBeInstanceOf(YouTubeLoader);
  });
});
