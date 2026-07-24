"use client"

import { useEffect, useRef } from 'react';
import { Message, Citation } from '@/shared/types';
import { MessageItem } from './MessageItem';
import { Bot, Loader2, Sparkles, ArrowUpRight } from 'lucide-react';
import { MarkdownRenderer } from '@/components/markdown-renderer';
import { CitationCard } from './CitationCard';
import { useSuggestedQuestionsQuery } from '../hooks/useSuggestedQuestions';

interface MessageListProps {
  notebookId?: string | null;
  messages: Message[];
  isStreaming: boolean;
  streamingContent: string;
  streamingCitations: Citation[];
  onSendMessage: (query: string) => void;
  onDeleteMessage?: (messageId: string) => void;
}

export function MessageList({
  notebookId = null,
  messages,
  isStreaming,
  streamingContent,
  streamingCitations,
  onSendMessage,
  onDeleteMessage,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: suggestedQuestions = [], isLoading: isLoadingSuggestions } =
    useSuggestedQuestionsQuery(notebookId, messages.length);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent, isStreaming, suggestedQuestions]);

  const defaultPrompts = [
    'Summarize the key themes across my sources',
    'What are the most important insights from this notebook?',
    'Explain the core concepts and definitions mentioned',
    'Synthesize the main arguments and conclusions',
  ];

  const activePrompts = suggestedQuestions.length > 0 ? suggestedQuestions : defaultPrompts;

  if (messages.length === 0 && !isStreaming) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-6 animate-in fade-in duration-500">
        <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-inner">
          <Bot className="w-7 h-7" />
        </div>

        <div className="max-w-md space-y-2">
          <h3 className="text-xl font-bold tracking-tight text-foreground">Ask your AI Notebook</h3>
          <p className="text-sm text-muted-foreground">
            Ask any question about your knowledge sources, documents, or transcripts. Answers will be generated with strict citations.
          </p>
        </div>

        <div className="flex flex-col items-center space-y-3 max-w-xl">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-primary uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Suggested Questions</span>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            {isLoadingSuggestions ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-2 px-4 rounded-full bg-card border border-border/50">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                <span>Generating notebook suggestions...</span>
              </div>
            ) : (
              activePrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => onSendMessage(prompt)}
                  className="group flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-full border border-border/80 bg-card/70 hover:bg-primary/10 hover:border-primary/40 text-muted-foreground hover:text-foreground transition-all cursor-pointer shadow-2xs active:scale-98"
                >
                  <span>{prompt}</span>
                  <ArrowUpRight className="w-3 h-3 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0" />
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5">
      {messages.map((message) => (
        <MessageItem key={message.id} message={message} onDelete={onDeleteMessage} />
      ))}

      {/* Live Streaming Response */}
      {isStreaming && (
        <div className="flex gap-2.5 p-3 sm:p-3.5 rounded-xl bg-card/70 border border-border/70 shadow-2xs animate-in fade-in">
          <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 text-xs font-bold shadow-2xs mt-0.5">
            <Bot className="w-3.5 h-3.5" />
          </div>

          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-foreground">Notebook AI</span>
              <span className="flex items-center gap-1 text-[11px] text-primary">
                <Loader2 className="w-3 h-3 animate-spin" />
                Generating response...
              </span>
            </div>

            <div className="text-sm leading-relaxed text-foreground">
              {streamingContent ? (
                <MarkdownRenderer content={streamingContent} />
              ) : (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-primary animate-ping" />
                  Analyzing notebook sources...
                </div>
              )}
            </div>

            {streamingCitations.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-border/40">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span>Found Citations ({streamingCitations.length})</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {streamingCitations.map((citation, idx) => (
                    <CitationCard key={idx} citation={citation} index={idx} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Suggested Follow-up Questions for Active Chat */}
      {suggestedQuestions && suggestedQuestions.length > 0 && !isStreaming && (
        <div className="pt-4 pb-2 space-y-2.5 border-t border-border/40 animate-in fade-in duration-300">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span>Suggested Follow-ups</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestedQuestions.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => onSendMessage(prompt)}
                className="group flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-full border border-border/80 bg-card/80 hover:bg-primary/10 hover:border-primary/50 text-foreground/90 hover:text-primary transition-all shadow-2xs cursor-pointer active:scale-98"
              >
                <span>{prompt}</span>
                <ArrowUpRight className="w-3 h-3 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
