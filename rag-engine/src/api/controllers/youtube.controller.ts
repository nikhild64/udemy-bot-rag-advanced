import { FastifyReply, FastifyRequest } from 'fastify';
import { ValidationError } from '@/shared/errors';

export async function getYouTubeMetadataController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { url } = request.query as { url?: string };
  if (!url) {
    throw new ValidationError('URL parameter is required');
  }

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36' },
    });
    
    if (!response.ok) {
      await reply.status(400).send({ error: 'Failed to fetch YouTube page' });
      return;
    }

    const html = await response.text();
    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    let title = 'YouTube Video';
    
    if (titleMatch && titleMatch[1]) {
      title = titleMatch[1].replace('- YouTube', '').trim();
    }

    await reply.status(200).send({ title });
  } catch (err: any) {
    await reply.status(500).send({ error: 'Internal error fetching YouTube metadata' });
  }
}
