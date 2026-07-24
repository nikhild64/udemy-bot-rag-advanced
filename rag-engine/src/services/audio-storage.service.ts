import fs from 'fs';
import path from 'path';
import { logger } from '../shared/logger';
import { supabaseConfig } from '../config/supabase';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export class AudioStorageService {
  private supabase: SupabaseClient | null = null;
  private localStorageDir: string;

  constructor() {
    this.localStorageDir = path.resolve(process.cwd(), 'data', 'podcasts');
    if (!fs.existsSync(this.localStorageDir)) {
      fs.mkdirSync(this.localStorageDir, { recursive: true });
    }

    if (supabaseConfig.url && !supabaseConfig.url.includes('mock-supabase')) {
      const key = supabaseConfig.serviceRoleKey || supabaseConfig.anonKey;
      this.supabase = createClient(supabaseConfig.url, key);
    }
  }

  /**
   * Uploads podcast MP3 audio file to Supabase Storage or local disk fallback
   */
  async uploadPodcastAudio(notebookId: string, audioBuffer: Buffer): Promise<string> {
    const storagePath = `podcasts/${notebookId}/episode.mp3`;

    // Try Supabase Storage first if configured
    if (this.supabase) {
      try {
        const { error } = await this.supabase.storage
          .from(supabaseConfig.bucketName)
          .upload(storagePath, audioBuffer, {
            contentType: 'audio/mpeg',
            upsert: true,
          });

        if (!error) {
          const { data } = this.supabase.storage
            .from(supabaseConfig.bucketName)
            .getPublicUrl(storagePath);

          if (data?.publicUrl) {
            logger.info({ notebookId, publicUrl: data.publicUrl }, '[AudioStorage] Uploaded MP3 to Supabase Storage');
            return data.publicUrl;
          }
        } else {
          logger.warn({ error: error.message }, '[AudioStorage] Supabase upload failed, falling back to local disk');
        }
      } catch (err: any) {
        logger.warn({ error: err.message }, '[AudioStorage] Supabase error, falling back to local disk');
      }
    }

    // Local disk fallback
    const localFilePath = path.join(this.localStorageDir, `${notebookId}.mp3`);
    await fs.promises.writeFile(localFilePath, audioBuffer);
    logger.info({ notebookId, localFilePath }, '[AudioStorage] Saved podcast MP3 to local disk');

    // Return backend stream endpoint URL
    const backendUrl = process.env.FRONTEND_ORIGIN || 'http://localhost:5000';
    return `${backendUrl}/api/notebooks/${notebookId}/podcast/audio.mp3`;
  }

  /**
   * Deletes existing podcast audio MP3 on refresh / re-generation
   */
  async deletePodcastAudio(notebookId: string): Promise<void> {
    const storagePath = `podcasts/${notebookId}/episode.mp3`;

    // Delete from Supabase Storage
    if (this.supabase) {
      try {
        await this.supabase.storage.from(supabaseConfig.bucketName).remove([storagePath]);
        logger.info({ notebookId }, '[AudioStorage] Deleted previous podcast MP3 from Supabase Storage');
      } catch (err: any) {
        logger.warn({ error: err.message }, '[AudioStorage] Supabase storage delete error');
      }
    }

    // Delete local disk file
    const localFilePath = path.join(this.localStorageDir, `${notebookId}.mp3`);
    if (fs.existsSync(localFilePath)) {
      try {
        await fs.promises.unlink(localFilePath);
        logger.info({ notebookId }, '[AudioStorage] Deleted previous podcast MP3 from local disk');
      } catch (err: any) {
        logger.warn({ error: err.message }, '[AudioStorage] Local disk file delete error');
      }
    }
  }

  /**
   * Gets local file path if audio exists locally
   */
  getLocalAudioPath(notebookId: string): string | null {
    const localFilePath = path.join(this.localStorageDir, `${notebookId}.mp3`);
    return fs.existsSync(localFilePath) ? localFilePath : null;
  }
}

export const audioStorageService = new AudioStorageService();
