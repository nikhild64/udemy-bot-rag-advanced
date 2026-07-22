export interface ApiMetrics {
  totalRequests: number;
  totalErrors: number;
  requestsByRoute: Record<string, number>;
  statusCodes: Record<string, number>;
  averageLatencyMs: number;
}

export interface WorkerMetrics {
  jobsQueued: number;
  jobsProcessed: number;
  jobsFailed: number;
  jobsRetried: number;
  averageProcessingTimeMs: number;
}

export interface LlmMetrics {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  totalCompletions: number;
  averageLatencyMs: number;
}

export interface VectorMetrics {
  totalSearches: number;
  averageRetrievalLatencyMs: number;
  totalVectorsWritten: number;
}

export interface UploadMetrics {
  totalUploads: number;
  failedUploads: number;
  totalBytesUploaded: number;
  averageUploadDurationMs: number;
}

export interface CragMetricsSummary {
  totalEvaluations: number;
  acceptedCount: number;
  correctedCount: number;
  rejectedCount: number;
  totalRetries: number;
  averageConfidenceScore: number;
}

export interface SystemMetrics {
  uptimeSeconds: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
  api: ApiMetrics;
  worker: WorkerMetrics;
  llm: LlmMetrics;
  vector: VectorMetrics;
  upload: UploadMetrics;
  crag: CragMetricsSummary;
}

export class MetricsCollector {
  private static instance: MetricsCollector;
  private readonly startTime: number = Date.now();

  private apiMetrics: ApiMetrics = {
    totalRequests: 0,
    totalErrors: 0,
    requestsByRoute: {},
    statusCodes: {},
    averageLatencyMs: 0,
  };
  private totalApiLatencyMs: number = 0;

  private workerMetrics: WorkerMetrics = {
    jobsQueued: 0,
    jobsProcessed: 0,
    jobsFailed: 0,
    jobsRetried: 0,
    averageProcessingTimeMs: 0,
  };
  private totalWorkerTimeMs: number = 0;

  private llmMetrics: LlmMetrics = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    totalCompletions: 0,
    averageLatencyMs: 0,
  };
  private totalLlmLatencyMs: number = 0;

  private vectorMetrics: VectorMetrics = {
    totalSearches: 0,
    averageRetrievalLatencyMs: 0,
    totalVectorsWritten: 0,
  };
  private totalVectorLatencyMs: number = 0;

  private uploadMetrics: UploadMetrics = {
    totalUploads: 0,
    failedUploads: 0,
    totalBytesUploaded: 0,
    averageUploadDurationMs: 0,
  };
  private totalUploadDurationMs: number = 0;

  private cragMetrics: CragMetricsSummary = {
    totalEvaluations: 0,
    acceptedCount: 0,
    correctedCount: 0,
    rejectedCount: 0,
    totalRetries: 0,
    averageConfidenceScore: 0,
  };
  private totalCragConfidenceSum: number = 0;

  private constructor() {}

  public static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  /**
   * Reset all collected metrics (useful for testing).
   */
  public reset(): void {
    this.apiMetrics = {
      totalRequests: 0,
      totalErrors: 0,
      requestsByRoute: {},
      statusCodes: {},
      averageLatencyMs: 0,
    };
    this.totalApiLatencyMs = 0;

    this.workerMetrics = {
      jobsQueued: 0,
      jobsProcessed: 0,
      jobsFailed: 0,
      jobsRetried: 0,
      averageProcessingTimeMs: 0,
    };
    this.totalWorkerTimeMs = 0;

    this.llmMetrics = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      totalCompletions: 0,
      averageLatencyMs: 0,
    };
    this.totalLlmLatencyMs = 0;

    this.vectorMetrics = {
      totalSearches: 0,
      averageRetrievalLatencyMs: 0,
      totalVectorsWritten: 0,
    };
    this.totalVectorLatencyMs = 0;

    this.uploadMetrics = {
      totalUploads: 0,
      failedUploads: 0,
      totalBytesUploaded: 0,
      averageUploadDurationMs: 0,
    };
    this.totalUploadDurationMs = 0;

    this.cragMetrics = {
      totalEvaluations: 0,
      acceptedCount: 0,
      correctedCount: 0,
      rejectedCount: 0,
      totalRetries: 0,
      averageConfidenceScore: 0,
    };
    this.totalCragConfidenceSum = 0;
  }

  // --- API Request Metrics ---
  public recordApiRequest(route: string, statusCode: number, latencyMs: number): void {
    this.apiMetrics.totalRequests += 1;
    if (statusCode >= 400) {
      this.apiMetrics.totalErrors += 1;
    }

    const routeKey = route || 'unknown';
    this.apiMetrics.requestsByRoute[routeKey] =
      (this.apiMetrics.requestsByRoute[routeKey] || 0) + 1;

    const statusKey = statusCode.toString();
    this.apiMetrics.statusCodes[statusKey] = (this.apiMetrics.statusCodes[statusKey] || 0) + 1;

    this.totalApiLatencyMs += latencyMs;
    this.apiMetrics.averageLatencyMs = Math.round(
      this.totalApiLatencyMs / this.apiMetrics.totalRequests,
    );
  }

  // --- Worker Metrics ---
  public recordJobQueued(): void {
    this.workerMetrics.jobsQueued += 1;
  }

  public recordJobCompleted(durationMs: number): void {
    this.workerMetrics.jobsProcessed += 1;
    this.totalWorkerTimeMs += durationMs;
    this.workerMetrics.averageProcessingTimeMs = Math.round(
      this.totalWorkerTimeMs / this.workerMetrics.jobsProcessed,
    );
  }

  public recordJobFailed(): void {
    this.workerMetrics.jobsFailed += 1;
  }

  public recordJobRetried(): void {
    this.workerMetrics.jobsRetried += 1;
  }

  // --- LLM Metrics ---
  public recordLlmCompletion(
    promptTokens: number,
    completionTokens: number,
    latencyMs: number,
  ): void {
    this.llmMetrics.promptTokens += promptTokens;
    this.llmMetrics.completionTokens += completionTokens;
    this.llmMetrics.totalTokens += promptTokens + completionTokens;
    this.llmMetrics.totalCompletions += 1;
    this.totalLlmLatencyMs += latencyMs;
    this.llmMetrics.averageLatencyMs = Math.round(
      this.totalLlmLatencyMs / this.llmMetrics.totalCompletions,
    );
  }

  // --- Vector Metrics ---
  public recordVectorSearch(latencyMs: number): void {
    this.vectorMetrics.totalSearches += 1;
    this.totalVectorLatencyMs += latencyMs;
    this.vectorMetrics.averageRetrievalLatencyMs = Math.round(
      this.totalVectorLatencyMs / this.vectorMetrics.totalSearches,
    );
  }

  public recordVectorsWritten(count: number): void {
    this.vectorMetrics.totalVectorsWritten += count;
  }

  // --- Upload Metrics ---
  public recordUpload(success: boolean, bytes: number, durationMs: number): void {
    this.uploadMetrics.totalUploads += 1;
    if (!success) {
      this.uploadMetrics.failedUploads += 1;
    }
    this.uploadMetrics.totalBytesUploaded += bytes;
    this.totalUploadDurationMs += durationMs;
    this.uploadMetrics.averageUploadDurationMs = Math.round(
      this.totalUploadDurationMs / this.uploadMetrics.totalUploads,
    );
  }

  // --- CRAG Metrics ---
  public recordCragEvaluation(decision: string, confidenceScore: number, retries: number): void {
    this.cragMetrics.totalEvaluations += 1;
    if (decision === 'accept') this.cragMetrics.acceptedCount += 1;
    else if (decision === 'correct') this.cragMetrics.correctedCount += 1;
    else if (decision === 'reject') this.cragMetrics.rejectedCount += 1;

    this.cragMetrics.totalRetries += retries;
    this.totalCragConfidenceSum += confidenceScore;
    this.cragMetrics.averageConfidenceScore =
      Math.round((this.totalCragConfidenceSum / this.cragMetrics.totalEvaluations) * 1000) / 1000;
  }

  // --- System Metrics Export ---
  public getMetrics(): SystemMetrics {
    return {
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      api: { ...this.apiMetrics },
      worker: { ...this.workerMetrics },
      llm: { ...this.llmMetrics },
      vector: { ...this.vectorMetrics },
      upload: { ...this.uploadMetrics },
      crag: { ...this.cragMetrics },
    };
  }
}

export const metrics = MetricsCollector.getInstance();
