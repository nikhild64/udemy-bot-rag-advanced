import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const DEFAULT_MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const DEFAULT_ALLOWED_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'text/vtt',
  'application/x-subrip',
  'application/octet-stream',
  'application/zip',
  'application/x-zip-compressed',
];
const DEFAULT_ALLOWED_EXTENSIONS = ['.pdf', '.txt', '.vtt', '.srt', '.zip'];

const uploadSchema = z.object({
  UPLOAD_MAX_FILE_SIZE: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().positive())
    .default(DEFAULT_MAX_FILE_SIZE.toString()),
  UPLOAD_ALLOWED_MIME_TYPES: z
    .string()
    .transform((val) => val.split(',').map((s) => s.trim().toLowerCase()))
    .default(DEFAULT_ALLOWED_MIME_TYPES.join(',')),
  UPLOAD_ALLOWED_EXTENSIONS: z
    .string()
    .transform((val) => val.split(',').map((s) => s.trim().toLowerCase()))
    .default(DEFAULT_ALLOWED_EXTENSIONS.join(',')),
});

export interface UploadConfig {
  readonly maxFileSize: number;
  readonly allowedMimeTypes: string[];
  readonly allowedExtensions: string[];
}

function loadUploadConfig(): UploadConfig {
  const result = uploadSchema.safeParse(process.env);

  if (!result.success) {
    const errorDetails = result.error.errors
      .map((err) => `${err.path.join('.')}: ${err.message}`)
      .join(', ');
    throw new Error(`Upload configuration validation failed: ${errorDetails}`);
  }

  return {
    maxFileSize: result.data.UPLOAD_MAX_FILE_SIZE,
    allowedMimeTypes: result.data.UPLOAD_ALLOWED_MIME_TYPES,
    allowedExtensions: result.data.UPLOAD_ALLOWED_EXTENSIONS,
  };
}

export const uploadConfig: UploadConfig = loadUploadConfig();
