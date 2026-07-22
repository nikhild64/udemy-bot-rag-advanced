import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/shared/storage/supabase';
import { config } from '@/config';
import { logger } from '@/shared/logger';

export interface StorageUploadResult {
  path: string;
  publicUrl?: string;
}

export class StorageService {
  private readonly bucketName: string;

  constructor(private readonly supabase: SupabaseClient = getSupabaseClient()) {
    this.bucketName = config.supabase.bucketName;
  }

  async uploadFile(path: string, content: Buffer | Uint8Array, contentType?: string): Promise<StorageUploadResult> {
    const options: { upsert: boolean; contentType?: string } = { upsert: true };
    if (contentType) {
      options.contentType = contentType;
    }

    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .upload(path, content, options);

    if (error) {
      logger.error({ error, path }, 'Failed to upload file to storage');
      throw new Error(`Storage upload failed: ${error.message}`);
    }

    const publicUrl = this.getPublicUrl(data.path);
    return {
      path: data.path,
      publicUrl,
    };
  }

  getPublicUrl(path: string): string {
    const { data } = this.supabase.storage.from(this.bucketName).getPublicUrl(path);
    return data.publicUrl;
  }

  async deleteFile(path: string): Promise<boolean> {
    const { error } = await this.supabase.storage.from(this.bucketName).remove([path]);
    if (error) {
      logger.error({ error, path }, 'Failed to delete file from storage');
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
