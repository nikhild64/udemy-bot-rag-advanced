import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const supabaseSchema = z.object({
  SUPABASE_URL: z.string().url().default('https://mock-supabase-project.supabase.co'),
  SUPABASE_ANON_KEY: z.string().default('mock-anon-key'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().default('notebook-sources'),
});

export interface SupabaseConfig {
  readonly url: string;
  readonly anonKey: string;
  readonly serviceRoleKey: string | undefined;
  readonly bucketName: string;
}

function loadSupabaseConfig(): SupabaseConfig {
  const result = supabaseSchema.safeParse(process.env);

  if (!result.success) {
    const errorDetails = result.error.errors
      .map((err) => `${err.path.join('.')}: ${err.message}`)
      .join(', ');
    throw new Error(`Supabase configuration validation failed: ${errorDetails}`);
  }

  return {
    url: result.data.SUPABASE_URL,
    anonKey: result.data.SUPABASE_ANON_KEY,
    serviceRoleKey: result.data.SUPABASE_SERVICE_ROLE_KEY,
    bucketName: result.data.SUPABASE_STORAGE_BUCKET,
  };
}

export const supabaseConfig: SupabaseConfig = loadSupabaseConfig();
