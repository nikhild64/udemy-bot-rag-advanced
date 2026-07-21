import { describe, it, expect } from 'vitest';
import {
  Course,
  Module,
  Lesson,
  Transcript,
  TranscriptCue,
  Chunk,
  ChunkMetadata,
  SearchResult,
  ChatMessage,
  ChatResponse,
} from '@/core/models';
import {
  EmbeddingProvider,
  ChatProvider,
  VectorStore,
  TranscriptParser,
} from '@/core/contracts';
import {
  SUPPORTED_TRANSCRIPT_FORMATS,
  DEFAULT_CHUNK_SIZE,
  DEFAULT_CHUNK_OVERLAP,
} from '@/shared/constants';
import { TranscriptFormat, ChatRole, ProviderType } from '@/types';

describe('Domain Language and Barrel Exports (@/*)', () => {
  it('should export valid shared types and enums from @/types', () => {
    expect(TranscriptFormat.VTT).toBe('vtt');
    expect(ChatRole.SYSTEM).toBe('system');
    expect(ChatRole.USER).toBe('user');
    expect(ChatRole.ASSISTANT).toBe('assistant');
    expect(ProviderType.EMBEDDING).toBe('embedding');
    expect(ProviderType.CHAT).toBe('chat');
    expect(ProviderType.VECTOR_STORE).toBe('vector_store');
    expect(ProviderType.TRANSCRIPT_PARSER).toBe('transcript_parser');
  });

  it('should export valid shared constants from @/shared/constants', () => {
    expect(SUPPORTED_TRANSCRIPT_FORMATS).toContain(TranscriptFormat.VTT);
    expect(DEFAULT_CHUNK_SIZE).toBe(512);
    expect(DEFAULT_CHUNK_OVERLAP).toBe(64);
  });

  it('should allow constructing domain model objects matching contracts via @/core/models', () => {
    const cue: TranscriptCue = {
      id: 'cue-1',
      startTime: 0.0,
      endTime: 5.2,
      text: 'Welcome to the course.',
    };

    const transcript: Transcript = {
      id: 'ts-1',
      lessonId: 'less-1',
      format: TranscriptFormat.VTT,
      cues: [cue],
    };

    const lesson: Lesson = {
      id: 'less-1',
      moduleId: 'mod-1',
      title: 'Introduction',
      transcript,
    };

    const moduleObj: Module = {
      id: 'mod-1',
      courseId: 'course-1',
      title: 'Getting Started',
      lessons: [lesson],
    };

    const course: Course = {
      id: 'course-1',
      title: 'RAG Architecture Course',
      modules: [moduleObj],
    };

    const chunkMeta: ChunkMetadata = {
      courseId: course.id,
      moduleId: moduleObj.id,
      lessonId: lesson.id,
      transcriptId: transcript.id,
      startTime: cue.startTime,
      endTime: cue.endTime,
    };

    const chunk: Chunk = {
      id: 'chk-1',
      text: cue.text,
      metadata: chunkMeta,
    };

    const searchResult: SearchResult = {
      chunk,
      score: 0.95,
    };

    const message: ChatMessage = {
      role: ChatRole.USER,
      content: 'What is this course about?',
    };

    const response: ChatResponse = {
      message: {
        role: ChatRole.ASSISTANT,
        content: 'This course is about RAG architecture.',
      },
      sources: [searchResult],
    };

    expect(course.modules[0]?.lessons[0]?.title).toBe('Introduction');
    expect(message.content).toBe('What is this course about?');
    expect(response.sources?.[0]?.score).toBe(0.95);
  });

  it('should verify that provider contracts exist as type definitions and can be mocked or implemented', async () => {
    const mockEmbeddingProvider: EmbeddingProvider = {
      embed: async (texts: string[]) => texts.map(() => [0.1, 0.2, 0.3]),
    };

    const mockTranscriptParser: TranscriptParser = {
      parse: async (rawContent: string) => [
        { id: '1', startTime: 0, endTime: 1, text: rawContent },
      ],
    };

    const mockVectorStore: VectorStore = {
      upsert: async () => {},
      search: async () => [],
    };

    const mockChatProvider: ChatProvider = {
      generateResponse: async (messages: ChatMessage[]) => ({
        message: {
          role: ChatRole.ASSISTANT,
          content: `Reply to ${messages.length} messages`,
        },
      }),
    };

    const embeddings = await mockEmbeddingProvider.embed(['hello']);
    expect(embeddings).toEqual([[0.1, 0.2, 0.3]]);

    const cues = await mockTranscriptParser.parse('hello world');
    expect(cues[0]?.text).toBe('hello world');

    const response = await mockChatProvider.generateResponse([
      { role: ChatRole.USER, content: 'Hi' },
    ]);
    expect(response.message.content).toBe('Reply to 1 messages');

    await expect(mockVectorStore.search([0.1, 0.2, 0.3])).resolves.toEqual([]);
  });
});
