import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotebookService } from '@/services/NotebookService';
import { SourceService } from '@/services/SourceService';
import { SearchService } from '@/services/SearchService';
import { DashboardService } from '@/services/DashboardService';
import { UserPreferenceService } from '@/services/UserPreferenceService';
import { CleanupService } from '@/services/CleanupService';
import { SourceStatus } from '@prisma/client';

describe('Phase K — Platform Maturity & UX Services', () => {
  let notebookService: NotebookService;
  let sourceService: SourceService;
  let searchService: SearchService;
  let dashboardService: DashboardService;
  let preferenceService: UserPreferenceService;
  let cleanupService: CleanupService;

  let mockNotebookRepo: any;
  let mockUserRepo: any;
  let mockSourceRepo: any;
  let mockPrefRepo: any;
  let mockPrisma: any;

  beforeEach(() => {
    mockNotebookRepo = {
      create: vi.fn().mockImplementation((data) => Promise.resolve({ id: 'nb-123', isArchived: false, isFavorite: false, ...data })),
      findById: vi.fn().mockImplementation((id) => Promise.resolve({ id, title: 'Sample Notebook', userId: 'user-1', description: 'Desc', settings: {}, isFavorite: false, isArchived: false })),
      findMany: vi.fn().mockResolvedValue({ data: [{ id: 'nb-123', title: 'Sample Notebook', userId: 'user-1', isFavorite: false, isArchived: false }], pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } }),
      update: vi.fn().mockImplementation((id, userId, data) => Promise.resolve({ id, userId, title: 'Sample Notebook', ...data })),
      delete: vi.fn().mockResolvedValue(true),
    };

    mockUserRepo = {
      findOrCreate: vi.fn().mockResolvedValue({ id: 'user-1' }),
    };

    mockSourceRepo = {
      create: vi.fn().mockImplementation((data) => Promise.resolve({ id: 'src-123', status: SourceStatus.PendingUpload, ...data })),
      findById: vi.fn().mockImplementation((id) => Promise.resolve({ id, notebookId: 'nb-123', title: 'Test PDF', displayName: 'Test PDF', type: 'PDF', status: SourceStatus.Indexed, metadata: {} })),
      findMany: vi.fn().mockResolvedValue({ data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } }),
      update: vi.fn().mockImplementation((id, userId, data) => Promise.resolve({ id, ...data })),
      updateStatus: vi.fn().mockImplementation((id, status) => Promise.resolve({ id, status })),
      delete: vi.fn().mockResolvedValue(true),
    };

    mockPrefRepo = {
      findByUserId: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockImplementation((userId, data) => Promise.resolve({ id: 'pref-1', userId, theme: 'dark', language: 'en', ...data })),
    };

    mockPrisma = {
      notebook: {
        findMany: vi.fn().mockResolvedValue([{ id: 'nb-123', title: 'Sample Notebook', userId: 'user-1', description: 'Desc', createdAt: new Date() }]),
        count: vi.fn().mockResolvedValue(1),
      },
      source: {
        findMany: vi.fn().mockResolvedValue([{ id: 'src-123', title: 'Doc', displayName: 'Doc', type: 'PDF', status: 'Indexed', size: 1024, notebookId: 'nb-123', notebook: { title: 'NB' }, createdAt: new Date() }]),
        groupBy: vi.fn().mockResolvedValue([{ status: 'Indexed', _count: { status: 1 } }]),
        deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      message: {
        findMany: vi.fn().mockResolvedValue([{ id: 'msg-1', role: 'USER', content: 'Hello query', notebookId: 'nb-123', createdAt: new Date() }]),
        count: vi.fn().mockResolvedValue(1),
      },
    };

    notebookService = new NotebookService(mockNotebookRepo, mockUserRepo);
    sourceService = new SourceService(mockSourceRepo, mockNotebookRepo);
    searchService = new SearchService(mockPrisma as any);
    dashboardService = new DashboardService(mockPrisma as any);
    preferenceService = new UserPreferenceService(mockPrefRepo);
    cleanupService = new CleanupService(mockPrisma as any);
  });

  it('duplicates a notebook correctly', async () => {
    const dup = await notebookService.duplicateNotebook('nb-123', 'user-1');
    expect(dup.title).toBe('Copy of Sample Notebook');
  });

  it('toggles notebook favorite state', async () => {
    const res = await notebookService.toggleFavorite('nb-123', 'user-1', true);
    expect(res.isFavorite).toBe(true);
  });

  it('archives a notebook', async () => {
    const res = await notebookService.archiveNotebook('nb-123', 'user-1', true);
    expect(res.isArchived).toBe(true);
  });

  it('reindexes a source', async () => {
    const res = await sourceService.reindexSource('src-123', 'user-1');
    expect(res.status).toBe(SourceStatus.Queued);
  });

  it('executes workspace search across notebooks, sources, and messages', async () => {
    const results = await searchService.searchUserWorkspace('user-1', 'Sample');
    expect(results.query).toBe('Sample');
    expect(results.notebooks.length).toBe(1);
    expect(results.totalResults).toBeGreaterThan(0);
  });

  it('aggregates dashboard summary metrics', async () => {
    const summary = await dashboardService.getDashboardSummary('user-1');
    expect(summary.stats.totalNotebooks).toBe(1);
    expect(summary.stats.totalStorageBytes).toBe(1024);
  });

  it('manages user preferences', async () => {
    const pref = await preferenceService.updateUserPreferences('user-1', { theme: 'dark', language: 'es' });
    expect(pref.theme).toBe('dark');
    expect(pref.language).toBe('es');
  });

  it('runs resource cleanup operations', async () => {
    const res = await cleanupService.runResourceCleanup('user-1', { deleteFailedSources: true, retryFailedJobs: true });
    expect(res.deletedSourcesCount).toBe(2);
    expect(res.retriedJobsCount).toBe(1);
  });
});
