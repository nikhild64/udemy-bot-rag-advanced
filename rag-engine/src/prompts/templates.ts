import { RetrievedChunk } from '../retrieval/RetrievalResult';

export const SYSTEM_PROMPT_TEMPLATE = `You are a helpful AI assistant.

Answer ONLY using the supplied context.

If the answer cannot be found in the supplied context, respond:

"I couldn't find this information in the indexed knowledge base."

Do not invent facts.

Do not use prior knowledge.

Always reference the supplied sources. When citing a source, include the module and lesson title along with the timestamp, using this exact format: (Source [Number], [Module Title] - [Lesson Title], Timestamp: [start] → [end]).`;

export function formatTime(secs: number | undefined): string {
  if (secs === undefined) return 'Unknown';
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = Math.floor(secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
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
