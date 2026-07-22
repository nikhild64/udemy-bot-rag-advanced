"use client"

import { useState } from 'react';
import { Message } from '@/shared/types';
import { MarkdownRenderer } from '@/components/markdown-renderer';
import { CitationCard } from './CitationCard';
import { Bot, User, Copy, Check, RotateCcw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface MessageItemProps {
  message: Message;
  onRetry?: (content: string) => void;
}

export function MessageItem({ message, onRetry }: MessageItemProps) {
  const [copied, setCopied] = useState(false);
  const isAssistant = message.role === 'assistant';

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    toast.success('Response copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={cn(
        'flex gap-3 p-4 rounded-2xl transition-colors',
        isAssistant ? 'bg-card/70 border border-border/70 shadow-2xs' : 'bg-primary/5 ml-8 border border-primary/10'
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold shadow-xs',
          isAssistant ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground border border-border'
        )}
      >
        {isAssistant ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
      </div>

      {/* Message Content */}
      <div className="flex-1 min-w-0 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-foreground">
              {isAssistant ? 'Notebook AI' : 'You'}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {isAssistant && message.content && (
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={handleCopy}
                title="Copy response"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </Button>
              {onRetry && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  onClick={() => onRetry(message.content)}
                  title="Retry response"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Text / Markdown */}
        <div className="text-sm leading-relaxed text-foreground">
          {isAssistant ? (
            <MarkdownRenderer content={message.content} />
          ) : (
            <p className="whitespace-pre-wrap">{message.content}</p>
          )}
        </div>

        {/* Citations Grid */}
        {isAssistant && message.citations && message.citations.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-border/40">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span>Citations ({message.citations.length})</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {message.citations.map((citation, idx) => (
                <CitationCard key={idx} citation={citation} index={idx} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
