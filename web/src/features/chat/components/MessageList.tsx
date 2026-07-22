"use client"

import { useEffect, useRef } from 'react';
import { Message, Citation } from '@/shared/types';
import { MessageItem } from './MessageItem';
import { Bot, Loader2, Sparkles } from 'lucide-react';
import { MarkdownRenderer } from '@/components/markdown-renderer';
import { CitationCard } from './CitationCard';

interface MessageListProps {
  messages: Message[];
  isStreaming: boolean;
  streamingContent: string;
  streamingCitations: Citation[];
  onSendMessage: (query: string) => void;
}

export function MessageList({
  messages,
  isStreaming,
  streamingContent,
  streamingCitations,
  onSendMessage,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent, isStreaming]);

  if (messages.length === 0 && !isStreaming) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-6 animate-in fade-in duration-500">
        <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-inner">
          <Bot className="w-7 h-7" />
        </div>

        <div className="max-w-md space-y-2">
          <h3 className="text-xl font-bold tracking-tight text-foreground">Ask your AI Notebook</h3>
          <p className="text-sm text-muted-foreground">
            Ask any question about your uploaded documents, videos, lectures, or transcripts. Answers will be generated with strict citations.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-2 max-w-lg">
          {[
            'Summarize the core concepts in my notebook',
            'What are the key takeaways from the latest upload?',
            'Explain step-by-step instructions mentioned in the sources',
            'Compare key arguments across documents',
          ].map((prompt) => (
            <button
              key={prompt}
              onClick={() => onSendMessage(prompt)}
              className="text-xs px-3 py-2 rounded-full border border-border bg-card/60 hover:bg-accent hover:border-primary/40 text-muted-foreground hover:text-foreground transition-all"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((message) => (
        <MessageItem key={message.id} message={message} />
      ))}

      {/* Live Streaming Response */}
      {isStreaming && (
        <div className="flex gap-3 p-4 rounded-2xl bg-card/70 border border-border/70 shadow-2xs animate-in fade-in">
          <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 text-xs font-bold shadow-xs">
            <Bot className="w-4 h-4" />
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

      <div ref={bottomRef} />
    </div>
  );
}
