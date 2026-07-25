import { FastifyReply, FastifyRequest } from 'fastify';
import { ChatProviderFactory } from '@/providers/chat/ChatProviderFactory';
import { ChatRole } from '@/types';
import { NotebookService } from '@/services/NotebookService';
import { SourceService } from '@/services/SourceService';
import { audioStorageService } from '@/services/audio-storage.service';
import { TTSServiceFactory } from '@/services/tts.service';
import { DenseNotebookRetriever } from '@/retrieval/notebook/DenseNotebookRetriever';
import { PrismaUserRepository } from '@/repositories/PrismaUserRepository';
import { UnauthorizedError, ValidationError, ForbiddenError } from '@/shared/errors';
import { logger } from '@/shared/logger';
import fs from 'fs';

// ─────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────

function parseLlmJsonResponse<T = any>(raw: string): T {
  if (!raw || typeof raw !== 'string') {
    throw new Error('Empty or invalid response from AI model');
  }

  let cleaned = raw.trim();

  // Find outermost JSON brackets
  const firstBrace = cleaned.search(/[\{\[]/);
  const lastBrace = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));

  if (firstBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  } else {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  }

  // Attempt 1: Standard JSON parse
  try {
    return JSON.parse(cleaned);
  } catch (err1: any) {
    logger.warn({ error: err1.message }, '[Generate] Initial JSON.parse failed, attempting auto-repair...');

    // Attempt 2: Strip trailing commas before closing braces/brackets and invalid control chars
    let repaired = cleaned
      .replace(/,\s*([\}\]])/g, '$1')
      .replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, '');

    try {
      return JSON.parse(repaired);
    } catch (err2: any) {
      // Attempt 3: Escape raw unescaped linebreaks inside string values
      const stringSanitized = repaired.replace(/(?<="[^"]*)\n(?=[^"]*")/g, '\\n');
      try {
        return JSON.parse(stringSanitized);
      } catch (err3: any) {
        // Attempt 4: Truncation Repair for truncated JSON array of objects (e.g. Flashcards / Podcast / Learning Path steps)
        // 4a. Strip the incomplete trailing object element from an array
        let truncatedFixed = stringSanitized.replace(/,\s*\{[^\}]*$/g, '').replace(/,\s*"[^"]*"?:?\s*"?[^"]*$/g, '');

        // 4b. Balance unclosed braces & brackets
        let openBraces = (truncatedFixed.match(/\{/g) || []).length - (truncatedFixed.match(/\}/g) || []).length;
        let openBrackets = (truncatedFixed.match(/\[/g) || []).length - (truncatedFixed.match(/\]/g) || []).length;

        while (openBrackets > 0) {
          truncatedFixed += ']';
          openBrackets--;
        }
        while (openBraces > 0) {
          truncatedFixed += '}';
          openBraces--;
        }

        try {
          const parsed = JSON.parse(truncatedFixed);
          logger.info('[Generate] Successfully auto-repaired truncated JSON response by trimming incomplete element');
          return parsed;
        } catch (err4: any) {
          // 4c. Fallback: Close string quote if truncated inside string value
          let quoteFixed = stringSanitized;
          if ((quoteFixed.match(/"/g) || []).length % 2 !== 0) {
            quoteFixed += '"';
          }
          openBraces = (quoteFixed.match(/\{/g) || []).length - (quoteFixed.match(/\}/g) || []).length;
          openBrackets = (quoteFixed.match(/\[/g) || []).length - (quoteFixed.match(/\]/g) || []).length;

          while (openBrackets > 0) {
            quoteFixed += ']';
            openBrackets--;
          }
          while (openBraces > 0) {
            quoteFixed += '}';
            openBraces--;
          }

          try {
            return JSON.parse(quoteFixed);
          } catch (err5: any) {
            logger.error({ raw: raw.slice(0, 500), error: err5.message }, '[Generate] All JSON repair attempts failed');
            throw err1;
          }
        }
      }
    }
  }
}

async function buildNotebookSourceContext(
  notebookId: string,
  userId: string,
  notebookTitle: string = '',
  customInstructions?: string,
): Promise<string> {
  const sourceService = new SourceService();
  const sources = await sourceService.listSources(notebookId, userId);

  const sourceList = Array.isArray(sources) ? sources : (sources as any).data ?? [];
  const readySources = sourceList.filter(
    (s: any) => s.status === 'Ready' || s.status === 'Indexed',
  );

  if (readySources.length === 0) {
    return 'No indexed sources available.';
  }

  // Combine notebook title and source display titles for context-rich vector queries
  const sourceTitles = readySources
    .map((s: any) => s.displayName || s.title)
    .filter(Boolean)
    .join(' ');
  const baseContextQuery = `${notebookTitle} ${sourceTitles}`.trim();

  // Multi-query parallel retrieval targeting complementary semantic perspectives
  const query1 = `${baseContextQuery} key concepts core definitions overview summary main ideas`.trim();
  const query2 = `${baseContextQuery} technical details architecture workflow step by step mechanics`.trim();
  const query3 = `${baseContextQuery} important takeaways trade-offs edge cases examples insights`.trim();

  try {
    const retriever = new DenseNotebookRetriever();
    const retrievalPromises: Promise<any[]>[] = [
      retriever.retrieve(query1, { notebookId, userId, query: query1, candidateLimit: 12 }),
      retriever.retrieve(query2, { notebookId, userId, query: query2, candidateLimit: 12 }),
      retriever.retrieve(query3, { notebookId, userId, query: query3, candidateLimit: 12 }),
    ];

    if (customInstructions) {
      retrievalPromises.push(
        retriever.retrieve(customInstructions, { notebookId, userId, query: customInstructions, candidateLimit: 15 })
      );
    }

    const queryResults = await Promise.all(retrievalPromises);

    // Merge and deduplicate by chunkId
    const chunkMap = new Map<string, any>();
    queryResults.flat().forEach((chunk) => {
      if (chunk && chunk.chunkId && !chunkMap.has(chunk.chunkId)) {
        chunkMap.set(chunk.chunkId, chunk);
      }
    });

    const uniqueChunks = Array.from(chunkMap.values());

    if (uniqueChunks.length > 0) {
      logger.info(
        { notebookId, totalDeduplicatedChunks: uniqueChunks.length, targetedSearch: !!customInstructions },
        '[Generate] Multi-query vector retrieval completed successfully',
      );

      const sourceIdMap = new Map<string, string>();
      readySources.forEach((s: any) => {
        const dTitle = s.displayName || s.title || 'Knowledge Source';
        if (s.id) sourceIdMap.set(s.id, dTitle);
      });

      return uniqueChunks
        .map((chunk, i) => {
          const matchedTitle = chunk.sourceId ? sourceIdMap.get(chunk.sourceId) : undefined;
          const rawTitle = (chunk.metadata?.sourceTitle || chunk.sourceName || chunk.metadata?.title) as string;
          const title = (matchedTitle && matchedTitle !== 'Web Source' && matchedTitle !== 'Source Chunk') ? matchedTitle : (rawTitle && rawTitle !== 'Web Source' ? rawTitle : 'Knowledge Source');
          const srcIdStr = chunk.sourceId ? ` (Source ID: "${chunk.sourceId}")` : '';
          const location = chunk.page ? ` (Page ${chunk.page})` : chunk.metadata?.pageNumber ? ` (Page ${chunk.metadata.pageNumber})` : '';
          return `[Excerpt ${i + 1}] Source: "${title}"${srcIdStr}${location}\nContent: ${chunk.text}`;
        })
        .join('\n\n');
    }
  } catch (err: any) {
    logger.warn(
      { err: err.message, notebookId },
      '[Generate] Multi-query vector retrieval failed — falling back to source metadata',
    );
  }

  // Metadata Fallback
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
  const flashcards = settings.flashcards || { status: 'IDLE', data: null, error: null };
  const ttsProvider = (process.env.TTS_PROVIDER || 'web_speech').toLowerCase();

  return reply.status(200).send({
    ttsProvider,
    podcast,
    learningPath,
    flashcards,
  });
}

// ─────────────────────────────────────────────
// Stream Stored Local Podcast Audio MP3
// ─────────────────────────────────────────────

export async function getPodcastAudioStreamController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { notebookId } = request.params as { notebookId: string };
  if (!notebookId) throw new ValidationError('Notebook ID is required');

  const localAudioPath = audioStorageService.getLocalAudioPath(notebookId);
  if (!localAudioPath || !fs.existsSync(localAudioPath)) {
    return reply.status(404).send({ error: 'Audio file not found' });
  }

  const stat = fs.statSync(localAudioPath);
  const stream = fs.createReadStream(localAudioPath);

  reply
    .header('Content-Type', 'audio/mpeg')
    .header('Content-Length', stat.size)
    .header('Accept-Ranges', 'bytes')
    .send(stream);
}

// ─────────────────────────────────────────────
// Podcast Script Generator (Async Background Queue)
// ─────────────────────────────────────────────

const PODCAST_SYSTEM_PROMPT = `You are a world-class technical educator and podcast producer.

Your task is to create a captivating, highly informative, two-person podcast episode based strictly on the provided notebook sources (books, documents, video transcripts). Do NOT hallucinate information outside the provided sources.

Hosts:
- **Alex** (male voice) — Engaging co-host who opens with intriguing hooks, grounds discussions in real-life examples, and asks intuitive questions.
- **Jamie** (female voice) — Principal domain expert who delivers clear, authoritative explanations, architectural breakdowns, and technical insights.

Episode Structure & Flow:
1. **Engaging Hook & Real-World Framing (Opening)**:
   - Start with a warm, inviting welcome from Alex: "Welcome to today's Podcast! I'm Alex, and with me is Jamie..."
   - Alex should follow up by asking an engaging question like: "So Jamie, what are we diving into today?" or "What's in this notebook?" (Make the copy natural and exciting).
   - Jamie introduces the core topic with a mind-boggling fact, surprising stat, or relatable real-life scenario from the material.
2. **Progressive Difficulty Curve (Step-by-Step Escalation)**:
   - **Phase 1 (Foundation)**: Start small with intuitive concepts and high-level intuition. Use real-world analogies to make it relatable, but do not overuse them.
   - **Phase 2 (Core Mechanics)**: Dive deeper into specific components, step-by-step technical workflows, and core source concepts.
   - **Phase 3 (Advanced Nuances & Edge Cases)**: Escalate difficulty to cover advanced architectural patterns, optimization tricks, trade-offs, and key insights.
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

  const body = (request.body as { force?: boolean; podcastLength?: 'short' | 'medium' | 'long'; instructions?: string }) || {};
  const force = !!body.force;
  const podcastLength = body.podcastLength || 'medium';
  const instructions = body.instructions?.trim();

  // Non-Pro entitlement check for forced re-creation
  if (force) {
    const userRepository = new PrismaUserRepository();
    const user = await userRepository.findById(userId);
    if (!user?.isPro) {
      throw new ForbiddenError('Re-creating AI artifacts (Podcast & Learning Path) requires a PRO account.');
    }
  }

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

  // If force=true (Refresh), delete old podcast MP3 file from storage
  if (force) {
    await audioStorageService.deletePodcastAudio(notebookId);
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
      logger.info({ notebookId, userId, podcastLength, hasInstructions: !!instructions }, '[Generate] Background podcast generation started');
      const sourceContext = await buildNotebookSourceContext(notebookId, userId, notebook.title, instructions);

      let turnCountGuidance = 'Produce 20–32 dialogue turns.';
      if (podcastLength === 'short') {
        turnCountGuidance = 'Produce 10–15 dialogue turns (concise, snappy overview).';
      } else if (podcastLength === 'long') {
        turnCountGuidance = 'Produce 40–50 dialogue turns (deep dive with detailed technical explorations).';
      }

      const customReq = instructions ? `\n\nSpecific User Request / Target Focus Area:\n"${instructions}"\nEnsure the conversation specifically addresses and prioritizes this user request.` : '';

      const userPrompt = `Notebook: "${notebook.title}"\n\nSource Knowledge Base:\n${sourceContext}${customReq}\n\nInstructions:\nCreate a captivating podcast episode that starts with a warm welcome and an intriguing real-life scenario or fact. Progressively increase the difficulty from foundational concepts to advanced technical nuances. Ensure a natural collaborative conversation between Alex and Jamie that covers key takeaways from the sources.\nLength Requirement: ${turnCountGuidance}`;

      const chatProvider = ChatProviderFactory.create();
      const response = await chatProvider.generateResponse(
        [
          { role: ChatRole.SYSTEM, content: PODCAST_SYSTEM_PROMPT },
          { role: ChatRole.USER, content: userPrompt },
        ],
        { task: 'chat', maxTokens: podcastLength === 'long' ? 5000 : 3500 },
      );

      const raw = response.message.content.trim();
      const podcastData = parseLlmJsonResponse(raw);

      // Synthesize audio MP3 if cloud TTS provider is configured — wait for completion before READY
      const ttsProvider = (process.env.TTS_PROVIDER || 'web_speech').toLowerCase();
      if (ttsProvider !== 'web_speech') {
        try {
          const ttsService = TTSServiceFactory.create();
          logger.info({ notebookId, ttsProvider }, '[Generate] Starting audio synthesis — READY will be set after MP3 is complete');
          const ttsResult = await ttsService.generateFullPodcastAudio(podcastData.lines);
          if (ttsResult) {
            const audioUrl = await audioStorageService.uploadPodcastAudio(notebookId, ttsResult.audioBuffer);
            podcastData.audioUrl = audioUrl;
            podcastData.lines = ttsResult.lines;
            logger.info(
              { notebookId, audioUrl, lineCount: ttsResult.lines.length },
              '[Generate] Audio synthesis complete — MP3 & line timestamps stored',
            );
          } else {
            logger.warn({ notebookId }, '[Generate] TTS returned null buffer — no audioUrl set, Web Speech fallback will be used');
          }
        } catch (ttsErr: any) {
          logger.warn({ error: ttsErr.message }, '[Generate] Audio synthesis failed — READY saved without audioUrl, Web Speech fallback');
        }
      }

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
      logger.info({ notebookId, hasAudio: !!podcastData.audioUrl }, '[Generate] Podcast saved as READY');
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
1. Order topics from foundational → advanced.
2. Each step must be actionable and specific — not vague.
3. Attach the relevant source(s) to each step. For each source attached, include:
   - "title": exact source title matching one of the available sources
   - "sourceId": exact Source ID string matching the excerpt's Source ID
   - "excerpt": 1-2 sentence verbatim passage directly copied from the source content that supports this step
   - "timestamp": specific excerpt location, page number, section header, or timestamp range (e.g. "Page 4–8", "Section 2.1", "05:12–14:30", "Chapter 3"). NEVER output generic phrases like "Full Video" or "Full Document". Always cite specific page numbers, section headers, or timestamp ranges from the source excerpts.
4. Calculate realistic, practical study hours per step based on actual material depth. For a multi-day timeframe (e.g. 3 days or 7 days), divide time practically across days (e.g. 1.5–3 focused study hours per day proportional to content complexity). Do NOT unrealistically assign 8+ hours a day to small or introductory concepts.
5. The path should have 4–8 steps total.
6. ONLY return valid JSON — no markdown fences, no extra text. Ensure all quotes inside JSON property values are properly escaped.

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
          "sourceId": "Source ID string",
          "excerpt": "Verbatim quote snippet from source",
          "timestamp": "Page 4–8"
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

  const body = (request.body as { force?: boolean; timelineDays?: string; instructions?: string }) || {};
  const force = !!body.force;
  const timelineDays = body.timelineDays || '7 days';
  const instructions = body.instructions?.trim();

  // Non-Pro entitlement check for forced re-creation
  if (force) {
    const userRepository = new PrismaUserRepository();
    const user = await userRepository.findById(userId);
    if (!user?.isPro) {
      throw new ForbiddenError('Re-creating AI artifacts (Podcast & Learning Path) requires a PRO account.');
    }
  }

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
      logger.info({ notebookId, userId, timelineDays, hasInstructions: !!instructions }, '[Generate] Background learning path generation started');
      const sourceContext = await buildNotebookSourceContext(notebookId, userId, notebook.title, instructions);

      const customReq = instructions ? `\n\nSpecific User Target Focus Area:\n"${instructions}"\nPrioritize topics matching this request.` : '';

      const userPrompt = `Notebook: "${notebook.title}"\n\nAvailable Sources:\n${sourceContext}${customReq}\n\nPreparation Timeframe Constraint:\nThe user has ${timelineDays} to prepare. Create a practical, realistic learning path formatted for a ${timelineDays} timeframe. Divide total learning hours realistically and proportionally across the available material scope (e.g. 1.5–3 focused study hours per day rather than arbitrary 8-hour blocks). Ensure every step links to specific page numbers, section headers, or timestamp ranges from the sources.`;

      const chatProvider = ChatProviderFactory.create();
      const response = await chatProvider.generateResponse(
        [
          { role: ChatRole.SYSTEM, content: LEARNING_PATH_SYSTEM_PROMPT },
          { role: ChatRole.USER, content: userPrompt },
        ],
        { task: 'chat', maxTokens: 3000 },
      );

      const raw = response.message.content.trim();
      const learningPathData = parseLlmJsonResponse(raw);

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

// ─────────────────────────────────────────────
// Flashcards Generator (Async Background Queue)
// ─────────────────────────────────────────────

const FLASHCARDS_SYSTEM_PROMPT = `You are a master educator specializing in effective learning techniques like spaced repetition and active recall.

Your task is to generate a set of high-quality study flashcards based strictly on the provided notebook sources.

Rules:
1. Generate clear, concise, and engaging flashcards (keep 'front' prompts direct [1 sentence] and 'back' explanations clear and focused [1–3 sentences maximum]).
2. Each flashcard must have a "front" (Question / Prompt / Concept) and a "back" (Clear, complete Answer / Explanation).
3. Attach a category/tag to each card (e.g. "Concept", "Definition", "Architecture", "Best Practice").
4. Provide an optional brief "hint" for cards where helpful.
5. Generate the exact number of flashcards requested by the user prompt.
6. ONLY return valid JSON — no markdown code fences, no extra text. Ensure all quotes within JSON string values are properly escaped.

Output JSON Schema:
{
  "title": "Flashcard Set Title",
  "description": "Short description of what key knowledge this deck tests",
  "cards": [
    {
      "id": 1,
      "front": "Clear question or core prompt",
      "back": "Comprehensive yet concise answer explaining the concept",
      "category": "Concept",
      "hint": "Optional clue or intuition hint"
    }
  ]
}`;

export async function generateFlashcardsController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const userId = request.auth?.userId || (request as any).userId;
  if (!userId) throw new UnauthorizedError('Unauthorized');

  const { notebookId } = request.params as { notebookId: string };
  if (!notebookId) throw new ValidationError('Notebook ID is required');

  const body = (request.body as { force?: boolean; count?: number; instructions?: string }) || {};
  const force = !!body.force;
  const count = body.count && body.count > 0 ? body.count : 15;
  const instructions = body.instructions?.trim();

  // Non-Pro entitlement check for forced re-creation
  if (force) {
    const userRepository = new PrismaUserRepository();
    const user = await userRepository.findById(userId);
    if (!user?.isPro) {
      throw new ForbiddenError('Re-creating AI artifacts requires a PRO account.');
    }
  }

  const notebookService = new NotebookService();
  const notebook = await notebookService.getNotebook(notebookId, userId);

  const settings = (notebook.settings as Record<string, any>) || {};
  const currentCards = settings.flashcards;

  // Return existing result if READY and not forced
  if (currentCards?.status === 'READY' && currentCards?.data && !force) {
    return reply.status(200).send({ status: 'READY', result: currentCards.data });
  }

  // Return GENERATING if already in progress and not forced
  if (currentCards?.status === 'GENERATING' && !force) {
    return reply.status(200).send({ status: 'GENERATING' });
  }

  // Update DB status to GENERATING
  const updatedSettings = {
    ...settings,
    flashcards: {
      status: 'GENERATING',
      data: currentCards?.data || null,
      error: null,
      updatedAt: new Date().toISOString(),
    },
  };
  await notebookService.updateNotebook(notebookId, userId, { settings: updatedSettings });

  // Spawn background generation
  (async () => {
    try {
      logger.info({ notebookId, userId, count, hasInstructions: !!instructions }, '[Generate] Background flashcards generation started');
      const sourceContext = await buildNotebookSourceContext(notebookId, userId, notebook.title, instructions);

      const customReq = instructions ? `\n\nSpecific User Target Focus Area:\n"${instructions}"\nEnsure generated flashcards prioritize and test knowledge around this request.` : '';

      const userPrompt = `Notebook: "${notebook.title}"\n\nAvailable Knowledge Base Sources:\n${sourceContext}${customReq}\n\nGenerate exactly ${count} interactive study flashcards covering key definitions, core concepts, edge cases, and insights from these sources. Keep 'back' answers concise (1-3 sentences maximum).`;

      const chatProvider = ChatProviderFactory.create();
      const response = await chatProvider.generateResponse(
        [
          { role: ChatRole.SYSTEM, content: FLASHCARDS_SYSTEM_PROMPT },
          { role: ChatRole.USER, content: userPrompt },
        ],
        { task: 'chat', maxTokens: count > 15 ? 7000 : 5000 },
      );

      const raw = response.message.content.trim();
      const flashcardData = parseLlmJsonResponse(raw);

      const latestNotebook = await notebookService.getNotebook(notebookId, userId);
      const latestSettings = (latestNotebook.settings as Record<string, any>) || {};
      await notebookService.updateNotebook(notebookId, userId, {
        settings: {
          ...latestSettings,
          flashcards: {
            status: 'READY',
            data: flashcardData,
            error: null,
            updatedAt: new Date().toISOString(),
          },
        },
      });
      logger.info({ notebookId, cardCount: flashcardData?.cards?.length }, '[Generate] Background flashcards generation completed successfully');
    } catch (err: any) {
      logger.error({ err, notebookId }, '[Generate] Background flashcards generation failed');
      try {
        const latestNotebook = await notebookService.getNotebook(notebookId, userId);
        const latestSettings = (latestNotebook.settings as Record<string, any>) || {};
        await notebookService.updateNotebook(notebookId, userId, {
          settings: {
            ...latestSettings,
            flashcards: {
              status: 'FAILED',
              data: null,
              error: err.message || 'Generation failed',
              updatedAt: new Date().toISOString(),
            },
          },
        });
      } catch (updateErr) {
        logger.error({ updateErr, notebookId }, '[Generate] Failed to update flashcards FAILED status');
      }
    }
  })();

  return reply.status(200).send({ status: 'GENERATING' });
}
