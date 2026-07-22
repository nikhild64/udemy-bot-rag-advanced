import { RetrievalEvaluator } from '../../core/contracts/crag-evaluator.contract';
import { ChatProvider } from '../../core/contracts/chat-provider.contract';
import { CRAGEvaluationResult, CRAGDecision } from '../../core/models/crag.model';
import { RetrievedChunk } from '../../retrieval/RetrievalResult';
import { ChatMessage } from '../../core/models/chat.model';
import { ChatRole } from '@/types';
import { SimilarityScoreEvaluator } from './SimilarityScoreEvaluator';
import { logger } from '../../shared/logger';

export class LLMEvaluator implements RetrievalEvaluator {
  private readonly fallbackEvaluator: SimilarityScoreEvaluator;

  constructor(
    private readonly chatProvider: ChatProvider,
    similarityThreshold: number = 0.7,
    minChunkConfidence: number = 0.5
  ) {
    this.fallbackEvaluator = new SimilarityScoreEvaluator(similarityThreshold, minChunkConfidence);
  }

  public async evaluate(query: string, chunks: RetrievedChunk[]): Promise<CRAGEvaluationResult> {
    const documentsEvaluated = chunks.length;
    if (documentsEvaluated === 0) {
      return this.fallbackEvaluator.evaluate(query, chunks);
    }

    const scores = chunks.map(c => c.score);
    const averageSimilarity = scores.reduce((acc, val) => acc + val, 0) / documentsEvaluated;
    const maxSimilarity = Math.max(...scores);

    const contextText = chunks.map((c, i) => `[Doc ${i + 1}]: ${c.text}`).join('\n\n');

    const prompt = `You are a CRAG (Corrective Retrieval-Augmented Generation) evaluator.
Your job is to evaluate if the provided retrieved documents contain sufficient, relevant, and accurate information to answer the user query.

User Query: "${query}"

Retrieved Context:
${contextText}

Analyze the query against the context and decide one of the following decisions:
- "accept": The context contains direct, comprehensive evidence to answer the query accurately.
- "correct": The context contains partial or weak evidence, but query rewriting or expanding retrieval might find better context.
- "reject": The context is irrelevant, unhelpful, or completely insufficient to answer the query.

Respond ONLY with valid JSON in the following format (no markdown code fences, no extra text):
{
  "decision": "accept" | "correct" | "reject",
  "confidence": <number between 0 and 1>,
  "reasoning": "<brief summary>"
}`;

    const messages: ChatMessage[] = [
      { role: ChatRole.SYSTEM, content: 'You are a precise document retrieval evaluator. Respond only with structured JSON.' },
      { role: ChatRole.USER, content: prompt },
    ];

    try {
      const response = await this.chatProvider.generateResponse(messages, { task: 'crag-evaluation' });
      const rawContent = response.message.content.trim();

      // Clean up markdown fences if LLM includes them
      const jsonStr = rawContent.replace(/^```(json)?\s*/i, '').replace(/\s*```$/, '');
      const parsed = JSON.parse(jsonStr) as { decision: string; confidence?: number; reasoning?: string };

      const validDecisions: CRAGDecision[] = ['accept', 'correct', 'reject'];
      const decision: CRAGDecision = validDecisions.includes(parsed.decision as CRAGDecision)
        ? (parsed.decision as CRAGDecision)
        : 'correct';

      const score = typeof parsed.confidence === 'number' ? Math.min(1, Math.max(0, parsed.confidence)) : averageSimilarity;
      const reasoning = parsed.reasoning || `LLM evaluated retrieval quality as '${decision}'.`;

      logger.debug({ decision, score, reasoning, documentsEvaluated }, 'LLMEvaluator completed');

      return {
        decision,
        score,
        averageSimilarity,
        maxSimilarity,
        reasoning,
        documentsEvaluated,
      };
    } catch (error) {
      logger.warn({ err: error }, 'LLMEvaluator failed to parse or generate structured response, falling back to SimilarityScoreEvaluator');
      return this.fallbackEvaluator.evaluate(query, chunks);
    }
  }
}
