"use client"

import React, { useState } from 'react';
import {
  useAdminLogsQuery,
  useAdminStatsQuery,
  useAdminStatusQuery,
  useDeleteAllLogsMutation,
} from '@/features/admin/hooks/useAdminLogs';
import { LogLevel, SystemLogItem } from '@/features/admin/api/admin.api';
import { LogDetailsModal } from '@/features/admin/components/LogDetailsModal';
import { AppLayout } from '@/shared/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import {
  ShieldAlert,
  Terminal,
  RefreshCw,
  Trash2,
  Search,
  AlertOctagon,
  AlertTriangle,
  Info,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Lock,
} from 'lucide-react';
import Link from 'next/link';

export default function AdminLogsPage() {
  const [selectedLevel, setSelectedLevel] = useState<LogLevel | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [autoPoll, setAutoPoll] = useState(true);
  const [selectedLog, setSelectedLog] = useState<SystemLogItem | null>(null);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  // Queries
  const { data: adminStatus, isLoading: statusLoading } = useAdminStatusQuery();
  const pollInterval = autoPoll ? 3000 : false;
  
  const {
    data: logsData,
    isLoading: logsLoading,
    refetch: refetchLogs,
  } = useAdminLogsQuery(
    {
      level: selectedLevel,
      search: searchQuery || undefined,
      page,
      limit: 25,
    },
    pollInterval
  );

  const { data: statsData } = useAdminStatsQuery(pollInterval);
  const deleteAllMutation = useDeleteAllLogsMutation();

  const handleClearAllLogs = async () => {
    try {
      await deleteAllMutation.mutateAsync();
      setConfirmClearOpen(false);
      refetchLogs();
    } catch (e) {
      console.error('Failed to clear logs', e);
    }
  };

  if (statusLoading) {
    return (
      <AppLayout hideSidebar hideSources>
        <div className="flex-1 flex items-center justify-center p-8 text-muted-foreground">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />
          <span>Verifying admin permissions...</span>
        </div>
      </AppLayout>
    );
  }

  if (adminStatus && !adminStatus.data.isAdmin) {
    return (
      <AppLayout hideSidebar hideSources>
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-4">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-1">Access Restricted</h2>
          <p className="text-sm text-muted-foreground max-w-md mb-6">
            You require Administrator privileges to access system logs. Please contact your system owner to grant access.
          </p>
          <Link href="/">
            <Button variant="outline" size="sm">
              Return to Dashboard
            </Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  const logs = logsData?.data || [];
  const pagination = logsData?.pagination || { page: 1, limit: 25, total: 0, totalPages: 1 };
  const stats = statsData?.data || { total: 0, errorCount: 0, warnCount: 0, infoCount: 0, debugCount: 0 };

  return (
    <AppLayout hideSidebar hideSources>
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
        {/* Header Bar */}
        <header className="h-16 border-b border-border bg-card/40 backdrop-blur-md px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground leading-tight">System Logs</h1>
              <p className="text-xs text-muted-foreground">Real-time application audit trail and error logs</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Auto-poll toggle */}
            <Button
              size="sm"
              variant={autoPoll ? 'secondary' : 'outline'}
              className="h-8 text-xs gap-1.5"
              onClick={() => setAutoPoll(!autoPoll)}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${autoPoll ? 'animate-spin text-primary' : ''}`} />
              <span>{autoPoll ? 'Live (3s)' : 'Paused'}</span>
            </Button>

            {/* Clear all logs trigger button */}
            <Button
              size="sm"
              variant="destructive"
              className="h-8 text-xs gap-1.5"
              onClick={() => setConfirmClearOpen(true)}
              disabled={deleteAllMutation.isPending || stats.total === 0}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear All Logs</span>
            </Button>
          </div>
        </header>

        {/* Dashboard Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden p-6 gap-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 shrink-0">
            <div className="p-4 rounded-xl bg-card border border-border flex items-center justify-between shadow-sm">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Logs</p>
                <p className="text-2xl font-extrabold text-foreground mt-0.5">{stats.total.toLocaleString()}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground">
                <Terminal className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-card border border-border flex items-center justify-between shadow-sm">
              <div>
                <p className="text-xs text-destructive font-medium uppercase tracking-wider">Errors</p>
                <p className="text-2xl font-extrabold text-destructive mt-0.5">{stats.errorCount.toLocaleString()}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center">
                <AlertOctagon className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-card border border-border flex items-center justify-between shadow-sm">
              <div>
                <p className="text-xs text-amber-500 font-medium uppercase tracking-wider">Warnings</p>
                <p className="text-2xl font-extrabold text-amber-500 mt-0.5">{stats.warnCount.toLocaleString()}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-card border border-border flex items-center justify-between shadow-sm">
              <div>
                <p className="text-xs text-blue-500 font-medium uppercase tracking-wider">Info & Debug</p>
                <p className="text-2xl font-extrabold text-blue-500 mt-0.5">{(stats.infoCount + stats.debugCount).toLocaleString()}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
                <Info className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 shrink-0 bg-card p-3 rounded-xl border border-border">
            {/* Level Filter Tabs */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {(['ALL', 'ERROR', 'WARN', 'INFO', 'DEBUG'] as const).map((lvl) => (
                <Button
                  key={lvl}
                  size="sm"
                  variant={selectedLevel === lvl ? 'default' : 'ghost'}
                  className="h-8 text-xs font-semibold px-3"
                  onClick={() => {
                    setSelectedLevel(lvl);
                    setPage(1);
                  }}
                >
                  {lvl}
                </Button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search log messages..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="pl-9 h-9 text-xs"
              />
            </div>
          </div>

          {/* Log Table Container */}
          <div className="flex-1 border border-border rounded-xl bg-card overflow-hidden flex flex-col shadow-sm">
            <div className="flex-1 overflow-y-auto">
              {logsLoading ? (
                <div className="flex items-center justify-center h-full p-8 text-muted-foreground text-xs">
                  <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                  Loading log records...
                </div>
              ) : logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                  <Terminal className="w-10 h-10 text-muted-foreground/40 mb-3" />
                  <p className="text-sm font-semibold text-foreground">No logs found</p>
                  <p className="text-xs text-muted-foreground max-w-sm mt-1">
                    No system log events match your current filter parameters.
                  </p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-muted/50 sticky top-0 border-b border-border z-10 text-muted-foreground font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-4 w-28">Severity</th>
                      <th className="py-2.5 px-4 w-44">Timestamp</th>
                      <th className="py-2.5 px-4 w-36">Context</th>
                      <th className="py-2.5 px-4">Message</th>
                      <th className="py-2.5 px-4 w-16 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {logs.map((log) => {
                      const isError = log.level === 'ERROR';
                      const isWarn = log.level === 'WARN';

                      return (
                        <tr
                          key={log.id}
                          onClick={() => setSelectedLog(log)}
                          className="hover:bg-muted/30 transition cursor-pointer group"
                        >
                          <td className="py-3 px-4">
                            <Badge
                              variant={isError ? 'destructive' : isWarn ? 'outline' : 'secondary'}
                              className={`text-[10px] uppercase font-bold ${isWarn ? 'text-amber-500 border-amber-500/30 bg-amber-500/10' : ''}`}
                            >
                              {log.level}
                            </Badge>
                          </td>

                          <td className="py-3 px-4 font-mono text-muted-foreground whitespace-nowrap">
                            {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </td>
                          <td className="py-3 px-4 font-medium text-foreground truncate max-w-[140px]">
                            {log.context || 'System'}
                          </td>
                          <td className="py-3 px-4 font-mono text-foreground/90 truncate max-w-md">
                            {log.message}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground group-hover:text-foreground opacity-70 group-hover:opacity-100"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedLog(log);
                              }}
                            >
                              <Maximize2 className="w-3.5 h-3.5" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination Footer */}
            <div className="h-12 px-4 border-t border-border bg-card/60 flex items-center justify-between shrink-0 text-xs">
              <span className="text-muted-foreground">
                Showing {logs.length > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} entries
              </span>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  disabled={pagination.page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </Button>
                <span className="text-muted-foreground px-2">
                  Page {pagination.page} of {pagination.totalPages || 1}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Modal: Log Item Details */}
        <LogDetailsModal
          log={selectedLog}
          open={!!selectedLog}
          onOpenChange={(open) => !open && setSelectedLog(null)}
        />

        {/* Confirmation Modal: Delete All Logs */}
        <Dialog open={confirmClearOpen} onOpenChange={setConfirmClearOpen} contentClassName="max-w-md">
          <DialogHeader>
            <div className="w-10 h-10 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-2">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <DialogTitle className="text-base font-bold">Clear All System Logs?</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-normal mt-1">
              This action will permanently delete all {stats.total.toLocaleString()} log records from the database audit log. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmClearOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleClearAllLogs}
              disabled={deleteAllMutation.isPending}
            >
              {deleteAllMutation.isPending ? 'Clearing...' : 'Yes, Delete All Logs'}
            </Button>
          </DialogFooter>
        </Dialog>

      </div>
    </AppLayout>
  );
}
