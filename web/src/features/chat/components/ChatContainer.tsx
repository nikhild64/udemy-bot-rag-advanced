"use client"

import { useState, useRef, KeyboardEvent } from 'react';
import { useUIStore } from '@/shared/lib/store';
import { useMessagesQuery } from '../hooks/useMessages';
import { useChat } from '../hooks/useChat';
import { MessageList } from './MessageList';
import { Send, CornerDownLeft, Sparkles, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ChatContainer() {
  const activeNotebookId = useUIStore((s) => s.activeNotebookId);
  const [inputQuery, setInputQuery] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: messages = [] } = useMessagesQuery(activeNotebookId);
  const { sendMessage, isStreaming, streamingContent, streamingCitations } = useChat(activeNotebookId);

  const handleSend = () => {
    if (!inputQuery.trim() || isStreaming) return;
    const q = inputQuery;
    setInputQuery('');
    sendMessage(q);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!activeNotebookId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4 bg-card/20">
        <BookOpen className="w-12 h-12 text-muted-foreground/40 stroke-1" />
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-foreground">No Notebook Selected</h3>
          <p className="text-xs text-muted-foreground max-w-sm">
            Select a notebook from the sidebar or create a new one to begin asking questions.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-background relative overflow-hidden">
      {/* Message List */}
      <MessageList
        messages={messages}
        isStreaming={isStreaming}
        streamingContent={streamingContent}
        streamingCitations={streamingCitations}
        onSendMessage={sendMessage}
      />

      {/* Input Form Footer */}
      <div className="p-4 border-t border-border bg-card/40 backdrop-blur-md">
        <div className="max-w-3xl mx-auto space-y-2">
          <div className="relative border border-border rounded-2xl bg-background/80 focus-within:border-primary/60 focus-within:ring-1 focus-within:ring-primary/20 shadow-xs transition-all">
            <textarea
              ref={textareaRef}
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about your notebook sources..."
              rows={2}
              className="w-full resize-none bg-transparent p-3 pr-12 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none min-h-[50px] max-h-[160px]"
            />

            <Button
              size="icon"
              className="absolute right-2.5 bottom-2.5 h-8 w-8 rounded-xl shadow-xs"
              onClick={handleSend}
              disabled={!inputQuery.trim() || isStreaming}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-primary" />
              <span>Grounded strictly on uploaded knowledge sources</span>
            </span>
            <span className="hidden sm:inline">Press Enter to send, Shift+Enter for new line</span>
          </div>
        </div>
      </div>
    </div>
  );
}
