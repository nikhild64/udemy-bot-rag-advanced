import { RetrievedChunk } from '../retrieval/RetrievalResult';
import { MemoryItem } from '../core/contracts/memory-provider.contract';

export const SYSTEM_PROMPT_TEMPLATE = `You are a helpful, intelligent AI assistant.

Answer the user's question directly, clearly, and conversationally using the supplied context.

Rules for response generation:
1. Speak naturally, warmly, and helpfully. Answer the user's question immediately.
2. CRITICAL: Do NOT start your responses with robotic meta-disclaimers such as "Based on the provided context...", "According to the supplied sources...", or "Based on the notebook context...". Provide direct, engaging, and factual answers.
3. If the answer cannot be found in the supplied context, politely respond: "I couldn't find this information in your knowledge base."
4. Do not invent facts or use unverified external knowledge.
5. Always reference the supplied sources when citing. When citing a source, include the module and lesson title along with the timestamp, using this exact format: (Source [Number], [Module Title] - [Lesson Title], Timestamp: [start] → [end]).`;

export function formatTime(secs: number | undefined): string {
  if (secs === undefined) return 'Unknown';
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = Math.floor(secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function formatUserMemories(memories?: readonly MemoryItem[]): string {
  if (!memories || memories.length === 0) {
    return '';
  }
  const memoryLines = memories.map((m) => `- ${m.memory}`).join('\n');
  return `\n\n[USER PERSONAL CONTEXT & MEMORIES]\nThe following remembered preferences and context apply to this user:\n${memoryLines}`;
}

export function formatContextChunks(chunks: readonly RetrievedChunk[]): string {
  if (!chunks || chunks.length === 0) {
    return 'No context available.';
  }

  return chunks.map((chunk, index) => {
    const citation = chunk.citation;
    const course = citation?.courseName || 'Unknown Course';
    const module = citation?.moduleTitle || 'Unknown Module';
    const lesson = citation?.lessonTitle || 'Unknown Lesson';
    
    const start = formatTime(citation?.startTime ?? chunk.startTime);
    const end = formatTime(citation?.endTime ?? chunk.endTime);
    
    return `Source ${index + 1}

Course:
${course}

Module:
${module}

Lesson:
${lesson}

Timestamp:
${start} → ${end}

Content:
${chunk.text}`;
  }).join('\n\n----------------------------\n\n');
}

export function formatUserQuestion(query: string): string {
  return `Question\n\n${query}`;
}
