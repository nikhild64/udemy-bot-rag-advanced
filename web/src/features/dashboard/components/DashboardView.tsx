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
      <div className="p-8 max-w-md mx-auto my-16 text-center bg-[#1A1A1A] border border-[#2B2B2B] rounded-2xl shadow-xl space-y-4 text-white">
        <div className="p-3 bg-[#F2A23A]/10 text-[#F2A23A] rounded-xl inline-block">
          <BookOpen className="h-8 w-8" />
        </div>
        <h3 className="text-lg font-semibold">Sign In Required</h3>
        <p className="text-xs text-[#A9A9A9] leading-relaxed">
          Please sign in to access your notebooks, sources, and workspace dashboard.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-lg mx-auto my-12 text-center bg-[#1A1A1A] border border-[#2B2B2B] rounded-2xl shadow-xl space-y-4 text-white">
        <div className="p-3 bg-red-500/10 text-red-400 rounded-xl inline-block">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h3 className="text-lg font-semibold">Dashboard Connection Issue</h3>
        <p className="text-xs text-[#A9A9A9] leading-relaxed">{error}</p>
        <button
          onClick={fetchSummary}
          className="px-4 py-2 bg-[#F2A23A] hover:bg-[#e09229] text-[#121212] font-semibold text-xs rounded-full transition inline-flex items-center gap-2 cursor-pointer border-none"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Retry Connection</span>
        </button>
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
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        /* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */
        .dash-view {
          background: #121212;
          color: #FFFFFF;
          font-family: var(--font-sans);
        }
        .dash-card {
          background: #1A1A1A;
          border: 1px solid #2B2B2B;
          border-radius: 12px;
          transition: border-color 220ms cubic-bezier(0.16, 1, 0.3, 1), transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .dash-card:hover {
          border-color: color-mix(in oklch, #2B2B2B 50%, #F2A23A);
        }
        .dash-btn-primary {
          background: #F2A23A;
          color: #121212;
          font-weight: 600;
          border-radius: 999px;
          transition: transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
          border: none;
          cursor: pointer;
        }
        .dash-btn-primary:hover {
          transform: translateY(-1px);
        }
        .dash-btn-outline {
          background: transparent;
          border: 1px solid #2B2B2B;
          color: #FFFFFF;
          border-radius: 999px;
          transition: background 220ms cubic-bezier(0.16, 1, 0.3, 1);
          cursor: pointer;
        }
        .dash-btn-outline:hover {
          background: #1A1A1A;
        }
        .dash-icon-box {
          background: #232323;
          border: 1px solid #2B2B2B;
          color: #F2A23A;
          border-radius: 8px;
        }
      `}} />
      <div className="dash-view p-6 space-y-8 max-w-7xl mx-auto h-full w-full overflow-y-auto">
        {/* Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#2B2B2B] pb-6">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <Sparkles className="h-6 w-6 text-[#F2A23A]" />
              <span>{t('dashboard.welcome', 'Notebook Platform Home')}</span>
            </h1>
            <p className="text-xs text-[#A9A9A9] mt-1">
              Manage your knowledge workspaces, sources, AI ingestion, and search.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onOpenSearch}
              className="dash-btn-outline px-3.5 py-2 text-xs flex items-center gap-2"
            >
              <Search className="h-3.5 w-3.5 text-[#F2A23A]" />
              <span>Search (Ctrl+K)</span>
            </button>
            <button
              onClick={onCreateNotebook}
              className="dash-btn-primary px-4 py-2 text-xs flex items-center gap-2"
            >
              <PlusCircle className="h-4 w-4" />
              <span>New Notebook</span>
            </button>
          </div>
        </div>

        {/* Metrics Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="dash-card p-5 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#A9A9A9]">{t('dashboard.stats.notebooks', 'Notebooks')}</span>
              <div className="dash-icon-box p-2">
                <BookOpen className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold text-white">{stats.totalNotebooks}</span>
              <span className="text-xs text-[#A9A9A9] ml-2">({stats.favoriteNotebooks || 0} favorited)</span>
            </div>
          </div>

          <div className="dash-card p-5 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#A9A9A9]">{t('dashboard.stats.sources', 'Sources')}</span>
              <div className="dash-icon-box p-2">
                <FileText className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold text-white">{stats.totalSources}</span>
              <span className="text-xs text-[#A9A9A9] ml-2">documents</span>
            </div>
          </div>

          <div className="dash-card p-5 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#A9A9A9]">{t('dashboard.stats.storage', 'Storage Used')}</span>
              <div className="dash-icon-box p-2">
                <HardDrive className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold text-white">{formatSize(stats.totalStorageBytes)}</span>
            </div>
          </div>

          <div className="dash-card p-5 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#A9A9A9]">Processing Jobs</span>
              <div className="dash-icon-box p-2">
                <Activity className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <div>
                <span className="text-2xl font-bold text-white">{stats.activeJobsCount}</span>
                <span className="text-xs text-[#A9A9A9] ml-1.5">active</span>
              </div>
              {stats.failedJobsCount > 0 && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 flex items-center gap-1">
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
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-[#F2A23A]" />
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
                    className="dash-card p-5 hover:bg-[#232323]/50 transition cursor-pointer group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-white group-hover:text-[#F2A23A] transition truncate">
                          {nb.title}
                        </h3>
                        {nb.isFavorite && <Star className="h-4 w-4 text-[#F2A23A] fill-[#F2A23A]" />}
                      </div>
                      {nb.description && (
                        <p className="text-xs text-[#A9A9A9] mt-2 line-clamp-2 leading-relaxed">{nb.description}</p>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#2B2B2B] flex items-center justify-between text-xs text-[#A9A9A9]">
                      <span>{nb._count?.sources || 0} sources • {nb._count?.messages || 0} chats</span>
                      <ArrowUpRight className="h-4 w-4 text-[#A9A9A9] group-hover:text-[#F2A23A] transition" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Activity & System Health Column */}
          <div className="space-y-6">
            {/* Recently Uploaded Sources */}
            <div className="dash-card p-5 space-y-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <FileText className="h-4 w-4 text-[#F2A23A]" />
                <span>Recent Uploads</span>
              </h3>

              {!data?.recentSources || data.recentSources.length === 0 ? (
                <p className="text-xs text-[#A9A9A9] text-center py-6">No sources uploaded yet.</p>
              ) : (
                <div className="space-y-3">
                  {data.recentSources.map((src: any) => (
                    <div key={src.id} className="p-3 rounded-xl bg-[#121212] border border-[#2B2B2B] flex items-center justify-between">
                      <div className="min-w-0 pr-2">
                        <p className="text-xs font-medium text-white truncate">{src.displayName || src.title}</p>
                        <p className="text-[11px] text-[#A9A9A9]">{src.notebook?.title || 'Notebook'}</p>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-[#232323] text-[10px] font-mono text-[#F2A23A] shrink-0">
                        {src.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Platform Actions Widget */}
            <div className="dash-card p-5 space-y-3 border-[#F2A23A]/30">
              <h4 className="text-xs font-semibold text-[#F2A23A] uppercase tracking-wider">Platform Operations</h4>
              <button
                onClick={() => setCleanupModalOpen(true)}
                className="w-full p-3 rounded-xl bg-[#121212] hover:bg-[#232323] border border-[#2B2B2B] text-left transition flex items-center justify-between text-xs text-white cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Trash2 className="h-4 w-4 text-[#F2A23A]" /> Resource Cleanup
                </span>
                <RefreshCw className="h-3.5 w-3.5 text-[#A9A9A9]" />
              </button>
            </div>
          </div>
        </div>

        {/* Resource Cleanup Modal */}
        {cleanupModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
            <div className="w-full max-w-md rounded-2xl border border-[#2B2B2B] bg-[#1A1A1A] p-6 shadow-2xl space-y-5 text-white">
              <div className="flex items-center justify-between border-b border-[#2B2B2B] pb-3">
                <h3 className="text-base font-semibold text-[#FFFFFF] flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-[#F2A23A]" /> Platform Resource Cleanup
                </h3>
                <button onClick={() => setCleanupModalOpen(false)} className="p-1 text-[#A9A9A9] hover:text-white border-none bg-transparent cursor-pointer">
                  ✕
                </button>
              </div>
              <p className="text-xs text-[#A9A9A9]">
                Clean up failed ingestion jobs, unlinked sources, and retry pending processing.
              </p>
              <div className="space-y-3">
                <button
                  disabled={cleaning}
                  onClick={() => handleCleanup({ deleteFailedSources: true, retryFailedJobs: true })}
                  className="w-full p-3 rounded-xl bg-[#121212] hover:bg-[#232323] border border-[#2B2B2B] text-left text-xs font-medium text-white transition cursor-pointer"
                >
                  Delete Failed Sources & Retry Jobs
                </button>
                <button
                  disabled={cleaning}
                  onClick={() => handleCleanup({ clearPendingUploads: true })}
                  className="w-full p-3 rounded-xl bg-[#121212] hover:bg-[#232323] border border-[#2B2B2B] text-left text-xs font-medium text-white transition cursor-pointer"
                >
                  Clear Orphaned Upload Stubs
                </button>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => setCleanupModalOpen(false)}
                  className="dash-btn-outline px-4 py-2 text-xs font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
