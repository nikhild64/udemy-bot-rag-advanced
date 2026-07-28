import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { chatApi } from '../api/chat.api';
import { Message, Citation } from '@/shared/types';

export function useChat(notebookId: string | null) {
  const queryClient = useQueryClient();
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingCitations, setStreamingCitations] = useState<Citation[]>([]);

  const sendMessage = useCallback(
    async (query: string) => {
      if (!notebookId || !query.trim() || isStreaming) return;

      const userMessageId = `user-${Date.now()}`;
      const assistantMessageId = `assistant-${Date.now()}`;

      const userMsg: Message = {
        id: userMessageId,
        notebookId,
        role: 'user',
        content: query,
        createdAt: new Date().toISOString(),
      };

      // Optimistically add user message to cache
      queryClient.setQueryData<Message[]>(['messages', notebookId], (old = []) => [...old, userMsg]);

      setIsStreaming(true);
      setStreamingContent('');
      setStreamingCitations([]);

      let accumulatedText = '';
      const citations: Citation[] = [];

      try {
        const useStreaming = process.env.NEXT_PUBLIC_USE_STREAMING === 'true';

        if (useStreaming) {
          await chatApi.streamChat(
            notebookId,
            query,
            (token) => {
              accumulatedText += token;
              setStreamingContent(accumulatedText);
            },
            (citation) => {
              citations.push(citation);
              setStreamingCitations([...citations]);
            },
            (_doneData) => {
              const assistantMsg: Message = {
                id: assistantMessageId,
                notebookId,
                role: 'assistant',
                content: accumulatedText,
                citations: citations,
                createdAt: new Date().toISOString(),
              };

              queryClient.setQueryData<Message[]>(['messages', notebookId], (old = []) => [...old, assistantMsg]);
              setIsStreaming(false);
              setStreamingContent('');
              setStreamingCitations([]);
              queryClient.invalidateQueries({ queryKey: ['messages', notebookId] });
              queryClient.invalidateQueries({ queryKey: ['suggestedQuestions', notebookId] });
            },
            (err) => {
              setIsStreaming(false);
              toast.error(err.message || 'Error receiving AI response');
            }
          );
        } else {
          const response = await chatApi.chat(notebookId, query);
          const assistantMsg = {
            ...response.message,
            notebookId,
            role: 'assistant' as const,
            content: response.message?.content || '',
            citations: response.citations || response.message?.citations || [],
          };

          queryClient.setQueryData<Message[]>(['messages', notebookId], (old = []) => [...old, assistantMsg]);
          setIsStreaming(false);
          queryClient.invalidateQueries({ queryKey: ['messages', notebookId] });
          queryClient.invalidateQueries({ queryKey: ['suggestedQuestions', notebookId] });
        }
      } catch (err: any) {
        setIsStreaming(false);
        toast.error(err.message || 'Failed to initiate chat stream');
      }
    },
    [notebookId, isStreaming, queryClient]
  );

  return {
    sendMessage,
    isStreaming,
    streamingContent,
    streamingCitations,
  };
}
