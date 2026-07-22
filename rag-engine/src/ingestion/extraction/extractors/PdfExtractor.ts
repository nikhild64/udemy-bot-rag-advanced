import { IDocumentExtractor, ExtractedDocument } from './IDocumentExtractor';

export class PdfExtractor implements IDocumentExtractor {
  async extract(fileBuffer: Buffer, _mimeType?: string, fileName?: string): Promise<ExtractedDocument> {
    const contentStr = fileBuffer.toString('utf-8');
    const binaryStr = fileBuffer.toString('latin1');
    const textPieces: string[] = [];

    // 1. Extract text from Tj / TJ operators in PDF streams
    const tjRegex = /\(([^)]+)\)\s*Tj/g;
    let match: RegExpExecArray | null;
    while ((match = tjRegex.exec(contentStr)) !== null) {
      if (match[1]) {
        textPieces.push(match[1]);
      }
    }

    // Array TJ operators: [(Hello) 10 (World)] TJ
    const arrayTjRegex = /\[((?:[^\]]+))\]\s*TJ/g;
    while ((match = arrayTjRegex.exec(contentStr)) !== null) {
      if (match[1]) {
        const innerStr = match[1];
        const innerPieces = innerStr.match(/\(([^)]+)\)/g);
        if (innerPieces) {
          innerPieces.forEach((p) => {
            textPieces.push(p.replace(/^\(|\)$/g, ''));
          });
        }
      }
    }

    // 2. If PDF stream text operators weren't matched (e.g. compressed streams or plain text), fallback to clean text scan
    let extractedText = textPieces.join(' ').trim();
    if (!extractedText || extractedText.length < 10) {
      // Clean readable ascii text sequence fallback
      const cleanAscii = binaryStr.replace(/[^\x20-\x7E\n\r\t]/g, ' ');
      const words = cleanAscii.match(/[A-Za-z0-9.,!?'"()\-\s]{4,}/g) || [];
      extractedText = words
        .map((w) => w.trim())
        .filter((w) => w.length > 3 && !w.startsWith('%PDF') && !w.startsWith('endobj') && !w.startsWith('xref'))
        .join(' ');
    }

    return {
      text: extractedText,
      metadata: {
        fileName,
        charCount: extractedText.length,
      },
    };
  }
}
