import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { createClerkClient } from '@clerk/fastify';
import { config } from '../../config';

const PUBLIC_PREFIXES = ['/health', '/status', '/ready', '/docs', '/metrics', '/favicon.ico'];

function isPublicRoute(url: string | undefined): boolean {
  if (!url) return true;
  const path = (url || '').split('?')[0] || '';
  return PUBLIC_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix + '/'));
}

export const clerkAuthPlugin = fp(
  async (app: FastifyInstance): Promise<void> => {
    app.decorateRequest('auth', null as any);
    app.decorateRequest('clerk', null as any);

    const clerkClient = createClerkClient({
      publishableKey: config.auth.publishableKey,
      secretKey: config.auth.secretKey,
    });

    app.addHook('preHandler', async (fastifyRequest: FastifyRequest, reply: FastifyReply) => {
      // Attach clerk client reference to every request
      (fastifyRequest as any).clerk = clerkClient;

      // Skip Clerk authentication & handshake redirects for health check and public endpoints
      if (isPublicRoute(fastifyRequest.url)) {
        return;
      }

      // Convert Fastify request to Fetch Request for Clerk request authentication
      const headers = new Headers();
      for (const [key, value] of Object.entries(fastifyRequest.headers)) {
        if (value) {
          headers.set(key, Array.isArray(value) ? value.join(', ') : value);
        }
      }

      const host = (fastifyRequest.headers['x-forwarded-host'] as string) || fastifyRequest.hostname || 'localhost';
      const protocol = (fastifyRequest.headers['x-forwarded-proto'] as string) || fastifyRequest.protocol || 'http';
      const requestUrl = new URL(fastifyRequest.url || '', `${protocol}://${host}`);

      const req = new Request(requestUrl.toString(), {
        method: fastifyRequest.method,
        headers,
      });

      try {
        const requestState = await clerkClient.authenticateRequest(req, {
          publishableKey: config.auth.publishableKey,
          secretKey: config.auth.secretKey,
          acceptsToken: 'any',
        });

        // Copy non-location response headers from Clerk if any
        requestState.headers.forEach((val: string, key: string) => {
          if (key.toLowerCase() !== 'location') {
            reply.header(key, val);
          }
        });

        (fastifyRequest as any).auth = requestState.toAuth();
      } catch {
        // Silently capture auth errors so requireAuth middleware can issue structured JSON 401
      }
    });
  },
  {
    name: 'clerk-auth-plugin',
    fastify: '5.x',
  },
);
