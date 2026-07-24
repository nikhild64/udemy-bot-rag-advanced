'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { useUIStore } from '@/shared/lib/store';
import { useMessagesQuery, useDeleteMessageMutation } from '../hooks/useMessages';
import { useChat } from '../hooks/useChat';
import { useSourcesQuery, useSourceStatusQuery } from '@/features/sources/hooks/useSources';
import { SourceStatus } from '@/shared/types';
import { MessageList } from './MessageList';
import { Send, Sparkles, BookOpen, Upload, Loader2, Lock } from 'lucide-react';

export function ChatContainer() {
  const activeNotebookId = useUIStore((s) => s.activeNotebookId);
  const setUploadModalOpen = useUIStore((s) => s.setUploadModalOpen);

  const [inputQuery, setInputQuery] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: messages = [] } = useMessagesQuery(activeNotebookId);
  const deleteMutation = useDeleteMessageMutation(activeNotebookId);
  const { data: sources = [], isLoading: isLoadingSources } = useSourcesQuery(activeNotebookId);
  const { sendMessage, isStreaming, streamingContent, streamingCitations } = useChat(activeNotebookId);

  const hasSources = sources.length > 0;

  const NON_READY_STATUSES = [
    'PendingUpload', 'Uploading', 'Uploaded', 'Queued',
    'Downloading', 'Extracting', 'Normalizing', 'Chunking',
    'Embedding', 'Indexing', 'Pending', 'Processing',
  ] as const;

  // Block chat if ANY source is still being processed
  const processingSource = sources.find((s) =>
    NON_READY_STATUSES.includes(s.status as any)
  );
  const isIndexingSources = !!processingSource;

  // Chat is only available when there are sources AND none are still processing
  const allSourcesReady = hasSources && !isIndexingSources;
  const hasReadySources = allSourcesReady && sources.some((s) => s.status === 'Ready' || (s.status as string) === 'Indexed');

  const { data: liveStatus } = useSourceStatusQuery(
    processingSource?.id || '',
    (processingSource?.status as SourceStatus) || 'Queued'
  );

  const currentStatus = liveStatus?.status || processingSource?.status || 'Processing';
  const progress = liveStatus?.progress ?? 0;

  const statusLabel =
    progress > 0 && progress < 100
      ? `${currentStatus} (${progress}%)`
      : currentStatus !== 'Ready' && currentStatus !== 'Indexed'
      ? `${currentStatus} in progress...`
      : 'Processing & Indexing...';

  const handleSend = () => {
    if (!inputQuery.trim() || isStreaming || !hasReadySources) return;
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
        {/* Main Content Area */}
        {!hasSources && !isLoadingSources ? (
          /* Empty State: No Sources Added */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#121212]">
            <div className="max-w-md w-full p-8 rounded-2xl bg-[#1A1A1A] border border-[#2B2B2B] shadow-2xl flex flex-col items-center text-center space-y-4 animate-in fade-in zoom-in-95 duration-300">
              <div className="p-4 rounded-2xl bg-[#F2A23A]/10 text-[#F2A23A] border border-[#F2A23A]/20">
                <BookOpen className="w-8 h-8" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-semibold text-white">No Knowledge Sources Added</h3>
                <p className="text-xs text-[#A9A9A9] leading-relaxed">
                  Upload PDFs, Markdown documents, audio/video files, or website links as knowledge sources to train your AI and start asking questions.
                </p>
              </div>
              <button
                onClick={() => setUploadModalOpen(true)}
                className="px-4 py-2.5 text-xs font-semibold rounded-xl bg-[#F2A23A] text-[#121212] hover:bg-[#F2A23A]/90 transition-all flex items-center gap-2 shadow-md cursor-pointer active:scale-95"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Knowledge Source</span>
              </button>
            </div>
          </div>
        ) : isIndexingSources ? (
          /* Indexing State: At least one source is still processing */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#121212]">
            <div className="max-w-md w-full p-8 rounded-2xl bg-[#1A1A1A] border border-[#2B2B2B] shadow-2xl flex flex-col items-center text-center space-y-4 animate-in fade-in zoom-in-95 duration-300">
              <div className="p-4 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-semibold text-white">
                  {processingSource ? `Processing ${processingSource.displayName || processingSource.title}` : 'Processing & Indexing Sources'}
                </h3>
                <p className="text-xs text-[#A9A9A9] leading-relaxed">
                  {sources.filter(s => NON_READY_STATUSES.includes(s.status as any)).length > 1
                    ? `${sources.filter(s => NON_READY_STATUSES.includes(s.status as any)).length} sources are still being processed. Chat will unlock once all sources are ready.`
                    : 'Your knowledge source is being extracted, chunked, and embedded into vector storage. Chat will unlock automatically once ingestion completes.'}
                </p>
              </div>
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs font-medium text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span>{statusLabel}</span>
              </div>
            </div>
          </div>
        ) : (
          /* Active Chat Message List */
          <MessageList
            messages={messages}
            isStreaming={isStreaming}
            streamingContent={streamingContent}
            streamingCitations={streamingCitations}
            onSendMessage={sendMessage}
            onDeleteMessage={(id) => deleteMutation.mutate(id)}
          />
        )}

        {/* Input Form Footer */}
        <div className="p-4 border-t border-[#2B2B2B] bg-[#1A1A1A]/80 backdrop-blur-md">
          <div className="max-w-3xl mx-auto space-y-2">
            <div className={`relative chat-input-box p-1 ${!hasReadySources ? 'opacity-60 cursor-not-allowed bg-[#141414]' : ''}`}>
              <textarea
                ref={textareaRef}
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={!hasReadySources || isStreaming}
                placeholder={
                  !hasSources
                    ? 'Upload at least one knowledge source to enable chat...'
                    : isIndexingSources
                    ? 'Processing sources... Chat will be enabled when indexing completes.'
                    : 'Ask a question about your notebook sources...'
                }
                rows={2}
                className="w-full resize-none bg-transparent p-3 pr-12 text-sm text-white placeholder-[#A9A9A9] focus:outline-none min-h-[50px] max-h-[160px] disabled:cursor-not-allowed"
              />

              <button
                className="chat-send-btn absolute right-3 bottom-3 h-8 w-8 flex items-center justify-center disabled:opacity-40"
                onClick={handleSend}
                disabled={!inputQuery.trim() || isStreaming || !hasReadySources}
                title={!hasReadySources ? 'Knowledge sources required' : 'Send Message'}
              >
                {!hasReadySources ? <Lock className="w-3.5 h-3.5" /> : <Send className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex items-center justify-between text-[11px] text-[#A9A9A9] px-1">
              <span className="flex items-center gap-1.5">
                {!hasReadySources ? (
                  <>
                    <Lock className="w-3.5 h-3.5 text-amber-500/70" />
                    <span>
                      {!hasSources
                        ? 'Chat disabled — No knowledge sources uploaded'
                        : 'Chat disabled — Knowledge sources indexing'}
                    </span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-[#F2A23A]" />
                    <span>Grounded strictly on uploaded knowledge sources</span>
                  </>
                )}
              </span>
              {hasReadySources && <span className="hidden sm:inline">Press Enter to send, Shift+Enter for new line</span>}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

