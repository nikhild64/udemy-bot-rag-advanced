import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/shared/storage/supabase';
import { config } from '@/config';
import { logger } from '@/shared/logger';
import { StorageError, ValidationError } from '@/shared/errors';
import path from 'node:path';

export interface StorageUploadResult {
  path: string;
  publicUrl?: string;
}

export class StorageService {
  private readonly bucketName: string;

  constructor(private readonly supabase: SupabaseClient = getSupabaseClient()) {
    this.bucketName = config.supabase.bucketName;
  }

  validateUpload(filename: string, mimetype: string, size: number): void {
    if (!filename || typeof filename !== 'string') {
      throw new ValidationError('Filename is required');
    }

    if (size <= 0) {
      throw new ValidationError('Uploaded file cannot be empty');
    }

    if (size > config.upload.maxFileSize) {
      const maxMb = Math.round(config.upload.maxFileSize / (1024 * 1024));
      throw new ValidationError(`File size exceeds maximum limit of ${maxMb}MB`);
    }

    const ext = path.extname(filename).toLowerCase();
    if (!ext || !config.upload.allowedExtensions.includes(ext)) {
      throw new ValidationError(
        `Invalid file extension '${ext}'. Allowed extensions: ${config.upload.allowedExtensions.join(', ')}`,
      );
    }

    const cleanMime = mimetype.toLowerCase();
    const isMimeAllowed = config.upload.allowedMimeTypes.some(
      (allowed) => cleanMime === allowed || cleanMime.startsWith(allowed.split('/')[0] + '/'),
    );

    if (!isMimeAllowed) {
      throw new ValidationError(
        `Invalid MIME type '${mimetype}'. Allowed MIME types: ${config.upload.allowedMimeTypes.join(', ')}`,
      );
    }
  }

  async uploadFile(storagePath: string, content: Buffer | Uint8Array, contentType?: string): Promise<StorageUploadResult> {
    const options: { upsert: boolean; contentType?: string } = { upsert: true };
    if (contentType) {
      options.contentType = contentType;
    }

    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .upload(storagePath, content, options);

    if (error) {
      logger.error({ error, path: storagePath }, 'Failed to upload file to storage');
      throw new StorageError(`Storage upload failed: ${error.message}`);
    }

    const publicUrl = this.getPublicUrl(data.path);
    return {
      path: data.path,
      publicUrl,
    };
  }

  async downloadFile(storagePath: string): Promise<Buffer> {
    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .download(storagePath);

    if (error || !data) {
      logger.error({ error, path: storagePath }, 'Failed to download file from storage');
      throw new StorageError(`Storage download failed: ${error?.message || 'File not found'}`);
    }

    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  getPublicUrl(storagePath: string): string {
    const { data } = this.supabase.storage.from(this.bucketName).getPublicUrl(storagePath);
    return data.publicUrl;
  }

  async createSignedUrl(storagePath: string, expiresIn: number = 3600): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .createSignedUrl(storagePath, expiresIn);

    if (error || !data) {
      logger.error({ error, path: storagePath }, 'Failed to create signed URL');
      throw new StorageError(`Failed to generate signed URL: ${error?.message || 'Unknown error'}`);
    }

    return data.signedUrl;
  }

  async deleteFile(storagePath: string): Promise<boolean> {
    const { error } = await this.supabase.storage.from(this.bucketName).remove([storagePath]);
    if (error) {
      logger.error({ error, path: storagePath }, 'Failed to delete file from storage');
      return false;
    }
    return true;
  }

  async checkHealth(): Promise<boolean> {
    try {
      const { data, error } = await this.supabase.storage.listBuckets();
      if (error) {
        logger.warn({ error: error.message }, 'Supabase Storage health check warning');
        return false;
      }
      return Array.isArray(data);
    } catch (err) {
      logger.warn({ err }, 'Supabase Storage connection failed');
      return false;
    }
  }
}
