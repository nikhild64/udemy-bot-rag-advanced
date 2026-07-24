import { FastifyReply, FastifyRequest } from 'fastify';
import { ChatProviderFactory } from '@/providers/chat/ChatProviderFactory';
import { ChatRole } from '@/types';
import { NotebookService } from '@/services/NotebookService';
import { SourceService } from '@/services/SourceService';
import { UnauthorizedError, ValidationError } from '@/shared/errors';
import { logger } from '@/shared/logger';

// ─────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────

async function buildNotebookSourceContext(notebookId: string, userId: string): Promise<string> {
  const sourceService = new SourceService();
  const sources = await sourceService.listSources(notebookId, userId);

  const sourceList = Array.isArray(sources) ? sources : (sources as any).data ?? [];
  const readySources = sourceList.filter(
    (s: any) => s.status === 'Ready' || s.status === 'Indexed',
  );

  if (readySources.length === 0) {
    return 'No indexed sources available.';
  }

  return readySources
    .map(
      (s: any, i: number) =>
        `Source ${i + 1}: "${s.displayName || s.title}" (Type: ${s.type})`,
    )
    .join('\n');
}

// ─────────────────────────────────────────────
// Get Notebook Artifacts
// ─────────────────────────────────────────────

export async function getNotebookArtifactsController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const userId = request.auth?.userId || (request as any).userId;
  if (!userId) throw new UnauthorizedError('Unauthorized');

  const { notebookId } = request.params as { notebookId: string };
  if (!notebookId) throw new ValidationError('Notebook ID is required');

  const notebookService = new NotebookService();
  const notebook = await notebookService.getNotebook(notebookId, userId);

  const settings = (notebook.settings as Record<string, any>) || {};
  const podcast = settings.podcast || { status: 'IDLE', data: null, error: null };
  const learningPath = settings.learningPath || { status: 'IDLE', data: null, error: null };

  return reply.status(200).send({
    podcast,
    learningPath,
  });
}

// ─────────────────────────────────────────────
// Podcast Script Generator (Async Background Queue)
// ─────────────────────────────────────────────

const PODCAST_SYSTEM_PROMPT = `You are a world-class technical educator and podcast producer.

Your task is to create a captivating, highly informative, two-person podcast episode based strictly on the provided notebook sources (books, documents, video transcripts).

Hosts:
- **Alex** (male voice) — Engaging co-host who opens with intriguing hooks, grounds discussions in real-life examples, and asks intuitive questions.
- **Jamie** (female voice) — Principal domain expert who delivers clear, authoritative explanations, architectural breakdowns, and technical insights.

Episode Structure & Flow:
1. **Engaging Hook & Real-World Framing (Opening)**:
   - Start with a warm, inviting welcome ("Hey, welcome! Did you know...") paired immediately with a mind-boggling fact, surprising stat, or relatable real-life scenario from the material.
   - Establish *why* the listener should care using a concrete real-world problem before jumping into technical definitions.
2. **Progressive Difficulty Curve (Step-by-Step Escalation)**:
   - **Phase 1 (Foundation)**: Start with intuitive concepts, high-level intuition ("Do you know what this actually means under the hood?"), and practical analogies.
   - **Phase 2 (Core Mechanics)**: Dive deeper into specific components, step-by-step technical workflows, and core source concepts.
   - **Phase 3 (Advanced Nuances & Edge Cases)**: Escalate difficulty to cover advanced architectural patterns, optimization tricks, trade-offs, and key source insights.
   - **Phase 4 (Takeaway & Conclusion)**: Summarize the big picture and leave the listener with an actionable perspective.
3. **Natural Collaborative Energy (Not a Stiff Interrogation)**:
   - The hosts engage in authentic, enthusiastic dialogue — connecting dots together naturally rather than conducting a mechanical Q&A or self-interrogating quiz.
4. **Comprehensive Source Coverage**:
   - Touch upon all major concepts and themes across ALL uploaded sources rather than hyper-fixating on a single introductory term.
5. **Length & Output Format**:
   - Produce 20–32 dialogue turns. Return ONLY valid JSON without markdown code fences or extra text.

Output JSON Schema:
{
  "title": "Engaging, informative episode title",
  "synopsis": "Concentrated 1–2 sentence summary of the episode's progressive journey",
  "lines": [
    { "speaker": "Alex", "text": "..." },
    { "speaker": "Jamie", "text": "..." }
  ]
}`;

export async function generatePodcastController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const userId = request.auth?.userId || (request as any).userId;
  if (!userId) throw new UnauthorizedError('Unauthorized');

  const { notebookId } = request.params as { notebookId: string };
  if (!notebookId) throw new ValidationError('Notebook ID is required');

  const body = (request.body as { force?: boolean }) || {};
  const force = !!body.force;

  const notebookService = new NotebookService();
  const notebook = await notebookService.getNotebook(notebookId, userId);

  const settings = (notebook.settings as Record<string, any>) || {};
  const currentPodcast = settings.podcast;

  // Return existing result if READY and not forced
  if (currentPodcast?.status === 'READY' && currentPodcast?.data && !force) {
    return reply.status(200).send({ status: 'READY', result: currentPodcast.data });
  }

  // Return GENERATING if already in progress and not forced
  if (currentPodcast?.status === 'GENERATING' && !force) {
    return reply.status(200).send({ status: 'GENERATING' });
  }

  // Update DB status to GENERATING
  const updatedSettings = {
    ...settings,
    podcast: {
      status: 'GENERATING',
      data: currentPodcast?.data || null,
      error: null,
      updatedAt: new Date().toISOString(),
    },
  };
  await notebookService.updateNotebook(notebookId, userId, { settings: updatedSettings });

  // Spawn background generation
  (async () => {
    try {
      logger.info({ notebookId, userId }, '[Generate] Background podcast generation started');
      const sourceContext = await buildNotebookSourceContext(notebookId, userId);
      const userPrompt = `Notebook: "${notebook.title}"\n\nSource Knowledge Base:\n${sourceContext}\n\nInstructions:\nCreate a captivating podcast episode that starts with a warm welcome and an intriguing real-life scenario or fact. Progressively increase the difficulty from foundational concepts to advanced technical nuances. Ensure a natural collaborative conversation between Alex and Jamie that covers all key takeaways from the sources.`;

      const chatProvider = ChatProviderFactory.create();
      const response = await chatProvider.generateResponse(
        [
          { role: ChatRole.SYSTEM, content: PODCAST_SYSTEM_PROMPT },
          { role: ChatRole.USER, content: userPrompt },
        ],
        { task: 'chat', maxTokens: 3500 },
      );

      const raw = response.message.content.trim();
      const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      const podcastData = JSON.parse(cleaned);

      const latestNotebook = await notebookService.getNotebook(notebookId, userId);
      const latestSettings = (latestNotebook.settings as Record<string, any>) || {};
      await notebookService.updateNotebook(notebookId, userId, {
        settings: {
          ...latestSettings,
          podcast: {
            status: 'READY',
            data: podcastData,
            error: null,
            updatedAt: new Date().toISOString(),
          },
        },
      });
      logger.info({ notebookId }, '[Generate] Background podcast script generation completed successfully');
    } catch (err: any) {
      logger.error({ err, notebookId }, '[Generate] Background podcast script generation failed');
      try {
        const latestNotebook = await notebookService.getNotebook(notebookId, userId);
        const latestSettings = (latestNotebook.settings as Record<string, any>) || {};
        await notebookService.updateNotebook(notebookId, userId, {
          settings: {
            ...latestSettings,
            podcast: {
              status: 'FAILED',
              data: null,
              error: err.message || 'Generation failed',
              updatedAt: new Date().toISOString(),
            },
          },
        });
      } catch (updateErr) {
        logger.error({ updateErr, notebookId }, '[Generate] Failed to update podcast FAILED status');
      }
    }
  })();

  return reply.status(200).send({ status: 'GENERATING' });
}

// ─────────────────────────────────────────────
// Learning Path Generator (Async Background Queue)
// ─────────────────────────────────────────────

const LEARNING_PATH_SYSTEM_PROMPT = `You are an expert curriculum designer and educator.

Your task is to generate a structured, progressive learning path based on the provided notebook sources.

Rules:
1. Order topics from foundational → advanced
2. Each step must be actionable and specific — not vague
3. Attach the relevant source(s) to each step. For each source attached, include:
   - "title": exact source title matching one of the available sources
   - "timestamp": time range (e.g. "05:12 - 14:30") or "Full Video" / "Full Document" if the whole source applies.
4. Include realistic time estimates per step
5. The path should have 4–8 steps total
6. ONLY return valid JSON — no markdown fences, no extra text

Output format (strict JSON):
{
  "title": "Learning path title",
  "description": "One-paragraph overview of what the learner will achieve",
  "estimatedTotalDuration": "e.g. 8–12 hours",
  "steps": [
    {
      "order": 1,
      "title": "Step title",
      "description": "What to learn and why it matters",
      "estimatedDuration": "e.g. 1–2 hours",
      "sources": [
        {
          "title": "Source title here",
          "timestamp": "05:12 - 14:30"
        }
      ],
      "keyOutcomes": ["Outcome 1", "Outcome 2"]
    }
  ]
}`;

export async function generateLearningPathController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const userId = request.auth?.userId || (request as any).userId;
  if (!userId) throw new UnauthorizedError('Unauthorized');

  const { notebookId } = request.params as { notebookId: string };
  if (!notebookId) throw new ValidationError('Notebook ID is required');

  const body = (request.body as { force?: boolean }) || {};
  const force = !!body.force;

  const notebookService = new NotebookService();
  const notebook = await notebookService.getNotebook(notebookId, userId);

  const settings = (notebook.settings as Record<string, any>) || {};
  const currentPath = settings.learningPath;

  // Return existing result if READY and not forced
  if (currentPath?.status === 'READY' && currentPath?.data && !force) {
    return reply.status(200).send({ status: 'READY', result: currentPath.data });
  }

  // Return GENERATING if already in progress and not forced
  if (currentPath?.status === 'GENERATING' && !force) {
    return reply.status(200).send({ status: 'GENERATING' });
  }

  // Update DB status to GENERATING
  const updatedSettings = {
    ...settings,
    learningPath: {
      status: 'GENERATING',
      data: currentPath?.data || null,
      error: null,
      updatedAt: new Date().toISOString(),
    },
  };
  await notebookService.updateNotebook(notebookId, userId, { settings: updatedSettings });

  // Spawn background generation
  (async () => {
    try {
      logger.info({ notebookId, userId }, '[Generate] Background learning path generation started');
      const sourceContext = await buildNotebookSourceContext(notebookId, userId);
      const userPrompt = `Notebook: "${notebook.title}"\n\nAvailable Sources:\n${sourceContext}\n\nGenerate a progressive learning path that guides someone from beginner to confident in the topics covered by these sources.`;

      const chatProvider = ChatProviderFactory.create();
      const response = await chatProvider.generateResponse(
        [
          { role: ChatRole.SYSTEM, content: LEARNING_PATH_SYSTEM_PROMPT },
          { role: ChatRole.USER, content: userPrompt },
        ],
        { task: 'chat', maxTokens: 3000 },
      );

      const raw = response.message.content.trim();
      const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      const learningPathData = JSON.parse(cleaned);

      const latestNotebook = await notebookService.getNotebook(notebookId, userId);
      const latestSettings = (latestNotebook.settings as Record<string, any>) || {};
      await notebookService.updateNotebook(notebookId, userId, {
        settings: {
          ...latestSettings,
          learningPath: {
            status: 'READY',
            data: learningPathData,
            error: null,
            updatedAt: new Date().toISOString(),
          },
        },
      });
      logger.info({ notebookId }, '[Generate] Background learning path generation completed successfully');
    } catch (err: any) {
      logger.error({ err, notebookId }, '[Generate] Background learning path generation failed');
      try {
        const latestNotebook = await notebookService.getNotebook(notebookId, userId);
        const latestSettings = (latestNotebook.settings as Record<string, any>) || {};
        await notebookService.updateNotebook(notebookId, userId, {
          settings: {
            ...latestSettings,
            learningPath: {
              status: 'FAILED',
              data: null,
              error: err.message || 'Generation failed',
              updatedAt: new Date().toISOString(),
            },
          },
        });
      } catch (updateErr) {
        logger.error({ updateErr, notebookId }, '[Generate] Failed to update learningPath FAILED status');
      }
    }
  })();

  return reply.status(200).send({ status: 'GENERATING' });
}
