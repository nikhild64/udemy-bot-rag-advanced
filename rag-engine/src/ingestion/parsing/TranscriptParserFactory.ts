import { TranscriptFormat } from '@/types';
import { ParsingError } from '@/shared/errors';
import { TranscriptParser, VttTranscriptParser, SrtTranscriptParser } from './parsers';

export interface ITranscriptParserFactory {
  /**
   * Returns the appropriate parser for the given format or file name/path.
   */
  getParser(formatOrFileName: TranscriptFormat | string): TranscriptParser;

  /**
   * Registers a custom parser implementation for a specific transcript format.
   */
  registerParser(format: TranscriptFormat, parser: TranscriptParser): void;
}

export class TranscriptParserFactory implements ITranscriptParserFactory {
  private readonly parsers: Map<TranscriptFormat, TranscriptParser>;

  constructor(customParsers?: Map<TranscriptFormat, TranscriptParser>) {
    this.parsers =
      customParsers ??
      new Map<TranscriptFormat, TranscriptParser>([
        [TranscriptFormat.VTT, new VttTranscriptParser()],
        [TranscriptFormat.SRT, new SrtTranscriptParser()],
      ]);
  }

  registerParser(format: TranscriptFormat, parser: TranscriptParser): void {
    this.parsers.set(format, parser);
  }

  getParser(formatOrFileName: TranscriptFormat | string): TranscriptParser {
    let format: TranscriptFormat | undefined;

    const values = Object.values(TranscriptFormat) as string[];
    if (values.includes(formatOrFileName)) {
      format = formatOrFileName as TranscriptFormat;
    } else if (typeof formatOrFileName === 'string') {
      const lower = formatOrFileName.toLowerCase();
      if (lower.endsWith('.vtt') || lower === 'vtt') {
        format = TranscriptFormat.VTT;
      } else if (lower.endsWith('.srt') || lower === 'srt') {
        format = TranscriptFormat.SRT;
      }
    }

    if (!format || !this.parsers.has(format)) {
      const supported = Array.from(this.parsers.keys()).join(', ');
      throw new ParsingError(
        `Unsupported transcript format: "${formatOrFileName}". Supported formats: ${supported}`,
      );
    }

    const parser = this.parsers.get(format);
    if (!parser) {
      throw new ParsingError(`No parser registered for format: "${format}"`);
    }

    return parser;
  }
}
