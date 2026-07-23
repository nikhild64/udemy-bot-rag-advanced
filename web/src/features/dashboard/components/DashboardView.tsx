'use client';

import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  FileText,
  HardDrive,
  Activity,
  AlertCircle,
  PlusCircle,
  Search,
  Settings,
  Trash2,
  RefreshCw,
  Star,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';
import { apiClient } from '@/shared/api/client';
import { DashboardSkeleton } from '@/shared/components/Skeletons';
import { EmptyState } from '@/shared/components/EmptyState';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/shared/lib/i18n-context';
import { toast } from 'sonner';
import { useAuth } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';

export function DashboardView({
  onOpenSearch,
  onOpenSettings,
  onCreateNotebook,
}: {
  onOpenSearch: () => void;
  onOpenSettings: () => void;
  onCreateNotebook: () => void;
}) {
  const { isLoaded, isSignedIn } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cleanupModalOpen, setCleanupModalOpen] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  const router = useRouter();
  const { t } = useTranslation();

  const fetchSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<any>('/api/dashboard/summary');
      setData(res);
    } catch (err: any) {
      console.error('Failed to load dashboard summary', err);
      setError(err?.message || 'Unable to connect to the backend server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      fetchSummary();
    } else if (isLoaded && !isSignedIn) {
      setLoading(false);
    }
  }, [isLoaded, isSignedIn]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const handleCleanup = async (opts: { deleteFailedSources?: boolean; clearPendingUploads?: boolean; retryFailedJobs?: boolean }) => {
    setCleaning(true);
    try {
      const res = await apiClient.post<any>('/api/cleanup', opts);
      toast.success(
        `Cleanup complete: ${res.deletedSourcesCount} sources deleted, ${res.retriedJobsCount} jobs retried`,
      );
      setCleanupModalOpen(false);
      fetchSummary();
    } catch (err) {
      toast.error('Cleanup operation failed');
    } finally {
      setCleaning(false);
    }
  };

  if (!isLoaded || loading) return <DashboardSkeleton />;

  if (!isSignedIn) {
    return (
      <div className="p-8 max-w-md mx-auto my-16 text-center bg-card border border-border rounded-2xl shadow-xl space-y-4">
        <div className="p-3 bg-primary/10 text-primary rounded-xl inline-block">
          <BookOpen className="h-8 w-8" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">Sign In Required</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Please sign in to access your notebooks, sources, and workspace dashboard.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-lg mx-auto my-12 text-center bg-card border border-border rounded-2xl shadow-xl space-y-4">
        <div className="p-3 bg-destructive/10 text-destructive rounded-xl inline-block">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">Dashboard Connection Issue</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">{error}</p>
        <Button
          onClick={fetchSummary}
          className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-xs rounded-xl transition inline-flex items-center gap-2"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Retry Connection</span>
        </Button>
      </div>
    );
  }

  const stats = data?.stats || {
    totalNotebooks: 0,
    totalSources: 0,
    totalStorageBytes: 0,
    activeJobsCount: 0,
    failedJobsCount: 0,
  };

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto h-full w-full overflow-y-auto animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <span>{t('dashboard.welcome', 'Notebook Platform Home')}</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your knowledge workspaces, sources, AI ingestion, and search.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenSearch}
            className="h-9 px-3.5 text-xs gap-2 border-border bg-card hover:bg-muted text-foreground"
          >
            <Search className="h-4 w-4 text-primary" />
            <span>Search (Ctrl+K)</span>
          </Button>
          <Button
            size="sm"
            onClick={onCreateNotebook}
            className="h-9 px-4 text-xs gap-2 font-semibold shadow-xs"
          >
            <PlusCircle className="h-4 w-4" />
            <span>New Notebook</span>
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCleanupModalOpen(true)}
            className="h-9 w-9 border-border bg-card hover:bg-muted text-foreground"
            title="Platform Resource Cleanup"
          >
            <RefreshCw className="h-4 w-4 text-primary" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={onOpenSettings}
            className="h-9 w-9 border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground"
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-card border border-border shadow-xs relative overflow-hidden group hover:border-primary/40 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">{t('dashboard.stats.notebooks', 'Notebooks')}</span>
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <BookOpen className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-foreground">{stats.totalNotebooks}</span>
            <span className="text-xs text-muted-foreground ml-2">({stats.favoriteNotebooks} favorited)</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-card border border-border shadow-xs relative overflow-hidden group hover:border-primary/40 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">{t('dashboard.stats.sources', 'Sources')}</span>
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <FileText className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-foreground">{stats.totalSources}</span>
            <span className="text-xs text-muted-foreground ml-2">documents</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-card border border-border shadow-xs relative overflow-hidden group hover:border-primary/40 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">{t('dashboard.stats.storage', 'Storage Used')}</span>
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <HardDrive className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-foreground">{formatSize(stats.totalStorageBytes)}</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-card border border-border shadow-xs relative overflow-hidden group hover:border-primary/40 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Processing Jobs</span>
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Activity className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div>
              <span className="text-2xl font-bold text-foreground">{stats.activeJobsCount}</span>
              <span className="text-xs text-muted-foreground ml-1.5">active</span>
            </div>
            {stats.failedJobsCount > 0 && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-destructive/20 text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {stats.failedJobsCount} failed
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Notebooks Section (Col Span 2) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              <span>Recently Opened Notebooks</span>
            </h2>
          </div>

          {!data?.recentNotebooks || data.recentNotebooks.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title={t('notebooks.empty_title', 'No Notebooks Yet')}
              description={t('notebooks.empty_desc', 'Create your first notebook to get started.')}
              actionLabel="Create Notebook"
              onAction={onCreateNotebook}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {data.recentNotebooks.map((nb: any) => (
                <div
                  key={nb.id}
                  onClick={() => router.push(`/notebooks/${nb.id}`)}
                  className="p-5 rounded-2xl bg-card border border-border hover:border-primary/50 hover:bg-muted/50 transition cursor-pointer group shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition truncate">
                        {nb.title}
                      </h3>
                      {nb.isFavorite && <Star className="h-4 w-4 text-amber-400 fill-amber-400" />}
                    </div>
                    {nb.description && (
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2 leading-relaxed">{nb.description}</p>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                    <span>{nb._count?.sources || 0} sources • {nb._count?.messages || 0} chats</span>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity & System Health Column */}
        <div className="space-y-6">
          {/* Recently Uploaded Sources */}
          <div className="p-5 rounded-2xl bg-card border border-border space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <span>Recent Uploads</span>
            </h3>

            {!data?.recentSources || data.recentSources.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No sources uploaded yet.</p>
            ) : (
              <div className="space-y-3">
                {data.recentSources.map((src: any) => (
                  <div key={src.id} className="p-3 rounded-xl bg-background border border-border flex items-center justify-between">
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-medium text-foreground truncate">{src.displayName || src.title}</p>
                      <p className="text-[11px] text-muted-foreground">{src.notebook?.title || 'Notebook'}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-muted text-[10px] font-mono text-primary shrink-0">
                      {src.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Platform Actions Widget */}
          <div className="p-5 rounded-2xl bg-primary/5 border border-primary/20 space-y-3">
            <h4 className="text-xs font-semibold text-primary uppercase tracking-wider">Platform Operations</h4>
            <button
              onClick={() => setCleanupModalOpen(true)}
              className="w-full p-3 rounded-xl bg-card hover:bg-muted border border-border text-left transition flex items-center justify-between text-xs text-foreground"
            >
              <span className="flex items-center gap-2">
                <Trash2 className="h-4 w-4 text-primary" /> Resource Cleanup
              </span>
              <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>

      {/* Resource Cleanup Modal */}
      {cleanupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-primary" /> Platform Resource Cleanup
              </h3>
              <button onClick={() => setCleanupModalOpen(false)} className="p-1 text-muted-foreground hover:text-foreground">
                ✕
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Clean up failed ingestion jobs, unlinked sources, and retry pending processing.
            </p>
            <div className="space-y-3">
              <button
                disabled={cleaning}
                onClick={() => handleCleanup({ deleteFailedSources: true, retryFailedJobs: true })}
                className="w-full p-3 rounded-xl bg-background hover:bg-muted border border-border text-left text-xs font-medium text-foreground transition"
              >
                Delete Failed Sources & Retry Jobs
              </button>
              <button
                disabled={cleaning}
                onClick={() => handleCleanup({ clearPendingUploads: true })}
                className="w-full p-3 rounded-xl bg-background hover:bg-muted border border-border text-left text-xs font-medium text-foreground transition"
              >
                Clear Orphaned Upload Stubs
              </button>
            </div>
            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={() => setCleanupModalOpen(false)}
                className="px-4 py-2 text-xs font-medium"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
