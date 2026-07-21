import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const authSchema = z.object({
  CLERK_PUBLISHABLE_KEY: z.string().min(1, 'Clerk publishable key is required'),
  CLERK_SECRET_KEY: z.string().min(1, 'Clerk secret key is required'),
});

export interface AuthConfig {
  readonly publishableKey: string;
  readonly secretKey: string;
}

function loadAuthConfig(): AuthConfig {
  const result = authSchema.safeParse(process.env);

  if (!result.success) {
    const errorDetails = result.error.errors
      .map((err) => `${err.path.join('.')}: ${err.message}`)
      .join(', ');
    throw new Error(`Auth configuration validation failed: ${errorDetails}`);
  }

  return {
    publishableKey: result.data.CLERK_PUBLISHABLE_KEY,
    secretKey: result.data.CLERK_SECRET_KEY,
  };
}

export const authConfig: AuthConfig = loadAuthConfig();
