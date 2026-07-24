'use client';

import React, { useState, useEffect } from 'react';
import { Search, BookOpen, FileText, MessageSquare, Loader2, X, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GlobalSearchModal({ isOpen, onClose }: GlobalSearchModalProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{
    notebooks: any[];
    sources: any[];
    messages: any[];
    totalResults: number;
  } | null>(null);

  const router = useRouter();

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults(null);
      return;
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setResults(null);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await apiClient.get<any>(`/api/search?q=${encodeURIComponent(query.trim())}`);
        setResults(res);
      } catch (err) {
        logger.error({ err }, 'Search failed');
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  const navigateTo = (path: string) => {
    router.push(path);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
      role="search"
      aria-label="Global Workspace Search"
    >
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-4 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Search Header */}
        <div className="flex items-center space-x-3 border-b border-border pb-3 px-2">
          <Search className="h-5 w-5 text-primary shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notebooks, source titles, message content..."
            className="w-full bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none text-base"
            autoFocus
          />
          {loading ? (
            <Loader2 className="h-5 w-5 text-primary animate-spin shrink-0" />
          ) : (
            query && (
              <button onClick={() => setQuery('')} className="p-1 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            )
          )}
        </div>

        {/* Search Results Body */}
        <div className="mt-3 overflow-y-auto space-y-4 pr-1">
          {!query.trim() && (
            <div className="py-12 text-center text-muted-foreground">
              <p className="text-sm">Type a search term to find notebooks, sources, and chat history.</p>
            </div>
          )}

          {results && results.totalResults === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              <p className="font-medium text-base text-foreground">No results found for "{query}"</p>
              <p className="text-xs text-muted-foreground mt-1">Try refining your query or check spelling.</p>
            </div>
          )}

          {results && results.notebooks.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
                Notebooks ({results.notebooks.length})
              </h4>
              <div className="space-y-1">
                {results.notebooks.map((nb) => (
                  <button
                    key={nb.id}
                    onClick={() => navigateTo(`/notebooks/${nb.id}`)}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-muted text-left transition group"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <BookOpen className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground group-hover:text-primary transition">
                          {nb.title}
                        </p>
                        {nb.snippet && <p className="text-xs text-muted-foreground line-clamp-1">{nb.snippet}</p>}
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {results && results.sources.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
                Sources ({results.sources.length})
              </h4>
              <div className="space-y-1">
                {results.sources.map((src) => (
                  <button
                    key={src.id}
                    onClick={() => navigateTo(`/notebooks/${src.notebookId}`)}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-muted text-left transition group"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground group-hover:text-primary transition">
                          {src.title}
                        </p>
                        <p className="text-xs text-muted-foreground">{src.snippet}</p>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {results && results.messages.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
                Messages ({results.messages.length})
              </h4>
              <div className="space-y-1">
                {results.messages.map((msg) => (
                  <button
                    key={msg.id}
                    onClick={() => navigateTo(`/notebooks/${msg.notebookId}`)}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-muted text-left transition group"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <MessageSquare className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-primary">{msg.title}</p>
                        <p className="text-sm text-foreground line-clamp-1">{msg.snippet}</p>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
