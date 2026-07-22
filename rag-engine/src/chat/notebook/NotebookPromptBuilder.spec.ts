import { describe, it, expect } from 'vitest';
import { NotebookPromptBuilder } from './NotebookPromptBuilder';
import { MessageRole } from '@prisma/client';
import { ChatRole } from '@/types';

describe('NotebookPromptBuilder', () => {
  const builder = new NotebookPromptBuilder();

  it('should build messages with system prompt, context, and query when no history', () => {
    const messages = builder.buildPrompt({
      query: 'What is deep learning?',
      context: 'Context about deep learning models.',
      notebookTitle: 'AI Research Notebook',
    });

    expect(messages).toHaveLength(2);
    expect(messages[0]!.role).toBe(ChatRole.SYSTEM);
    expect(messages[0]!.content).toContain('AI Research Notebook');
    expect(messages[1]!.role).toBe(ChatRole.USER);
    expect(messages[1]!.content).toContain('Retrieved Notebook Context:');
    expect(messages[1]!.content).toContain('Context about deep learning models.');
    expect(messages[1]!.content).toContain('What is deep learning?');
  });

  it('should include recent conversation history in prompt messages', () => {
    const history = [
      {
        id: '1',
        notebookId: 'nb_1',
        role: MessageRole.USER,
        content: 'Previous question',
        citations: [],
        metadata: {},
        createdAt: new Date(),
      },
      {
        id: '2',
        notebookId: 'nb_1',
        role: MessageRole.ASSISTANT,
        content: 'Previous answer',
        citations: [],
        metadata: {},
        createdAt: new Date(),
      },
    ];

    const messages = builder.buildPrompt({
      query: 'Followup question',
      context: 'Some context',
      history,
    });

    expect(messages).toHaveLength(4);
    expect(messages[0]!.role).toBe(ChatRole.SYSTEM);
    expect(messages[1]!.role).toBe(ChatRole.USER);
    expect(messages[1]!.content).toBe('Previous question');
    expect(messages[2]!.role).toBe(ChatRole.ASSISTANT);
    expect(messages[2]!.content).toBe('Previous answer');
    expect(messages[3]!.role).toBe(ChatRole.USER);
    expect(messages[3]!.content).toContain('Followup question');
  });
});
