import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { metrics } from '../src/infrastructure/metrics/MetricsCollector';

describe('Metrics Collector & /metrics Route', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    metrics.reset();
  });

  it('should record API request metrics accurately', () => {
    metrics.recordApiRequest('/health', 200, 15);
    metrics.recordApiRequest('/health', 200, 25);
    metrics.recordApiRequest('/api/chat', 500, 100);

    const m = metrics.getMetrics();
    expect(m.api.totalRequests).toBe(3);
    expect(m.api.totalErrors).toBe(1);
    expect(m.api.requestsByRoute['/health']).toBe(2);
    expect(m.api.requestsByRoute['/api/chat']).toBe(1);
    expect(m.api.statusCodes['200']).toBe(2);
    expect(m.api.statusCodes['500']).toBe(1);
    expect(m.api.averageLatencyMs).toBe(47); // (15+25+100)/3
  });

  it('should record LLM token usage and completion latency', () => {
    metrics.recordLlmCompletion(100, 50, 500);
    metrics.recordLlmCompletion(200, 100, 700);

    const m = metrics.getMetrics();
    expect(m.llm.promptTokens).toBe(300);
    expect(m.llm.completionTokens).toBe(150);
    expect(m.llm.totalTokens).toBe(450);
    expect(m.llm.totalCompletions).toBe(2);
    expect(m.llm.averageLatencyMs).toBe(600);
  });

  it('should record worker metrics', () => {
    metrics.recordJobQueued();
    metrics.recordJobCompleted(1200);
    metrics.recordJobFailed();
    metrics.recordJobRetried();

    const m = metrics.getMetrics();
    expect(m.worker.jobsQueued).toBe(1);
    expect(m.worker.jobsProcessed).toBe(1);
    expect(m.worker.jobsFailed).toBe(1);
    expect(m.worker.jobsRetried).toBe(1);
    expect(m.worker.averageProcessingTimeMs).toBe(1200);
  });

  it('should return metrics JSON payload on GET /metrics', async () => {
    metrics.recordApiRequest('/health', 200, 10);

    const response = await app.inject({
      method: 'GET',
      url: '/metrics',
    });

    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.payload);
    expect(payload.uptimeSeconds).toBeDefined();
    expect(payload.memoryUsage).toBeDefined();
    expect(payload.api).toBeDefined();
    expect(payload.worker).toBeDefined();
    expect(payload.llm).toBeDefined();
    expect(payload.vector).toBeDefined();
    expect(payload.upload).toBeDefined();
  });
});
