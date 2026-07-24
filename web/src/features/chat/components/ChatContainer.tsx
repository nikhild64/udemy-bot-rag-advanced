'use client';

import { useState, useRef, KeyboardEvent } from 'react';
import { useUIStore } from '@/shared/lib/store';
import { useMessagesQuery } from '../hooks/useMessages';
import { useChat } from '../hooks/useChat';
import { MessageList } from './MessageList';
import { Send, Sparkles, BookOpen } from 'lucide-react';

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
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4 bg-[#121212]">
        <div className="p-4 rounded-2xl bg-[#1A1A1A] border border-[#2B2B2B] text-[#F2A23A]">
          <BookOpen className="w-10 h-10" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-white">No Notebook Selected</h3>
          <p className="text-xs text-[#A9A9A9] max-w-sm">
            Select a notebook from the sidebar or create a new one to begin asking questions.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        /* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */
        .chat-input-box {
          background: #1A1A1A;
          border: 1px solid #2B2B2B;
          border-radius: 16px;
          transition: border-color 220ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 220ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .chat-input-box:focus-within {
          border-color: #F2A23A;
          box-shadow: 0 0 0 1px #F2A23A;
        }
        .chat-send-btn {
          background: #F2A23A;
          color: #121212;
          border: none;
          border-radius: 12px;
          transition: transform 180ms ease-out, opacity 180ms ease-out;
          cursor: pointer;
        }
        .chat-send-btn:hover:not(:disabled) {
          transform: translateY(-1px);
        }
        .chat-send-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
      `}} />
      <div className="flex-1 flex flex-col h-full bg-[#121212] relative overflow-hidden text-white">
        {/* Message List */}
        <MessageList
          messages={messages}
          isStreaming={isStreaming}
          streamingContent={streamingContent}
          streamingCitations={streamingCitations}
          onSendMessage={sendMessage}
        />

        {/* Input Form Footer */}
        <div className="p-4 border-t border-[#2B2B2B] bg-[#1A1A1A]/80 backdrop-blur-md">
          <div className="max-w-3xl mx-auto space-y-2">
            <div className="relative chat-input-box p-1">
              <textarea
                ref={textareaRef}
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question about your notebook sources..."
                rows={2}
                className="w-full resize-none bg-transparent p-3 pr-12 text-sm text-white placeholder-[#A9A9A9] focus:outline-none min-h-[50px] max-h-[160px]"
              />

              <button
                className="chat-send-btn absolute right-3 bottom-3 h-8 w-8 flex items-center justify-center"
                onClick={handleSend}
                disabled={!inputQuery.trim() || isStreaming}
                title="Send Message"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between text-[11px] text-[#A9A9A9] px-1">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#F2A23A]" />
                <span>Grounded strictly on uploaded knowledge sources</span>
              </span>
              <span className="hidden sm:inline">Press Enter to send, Shift+Enter for new line</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
