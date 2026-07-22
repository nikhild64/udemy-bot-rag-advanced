# Operational Runbook & Alert Response Guide

This runbook provides step-by-step instructions for site reliability engineers (SREs) and platform developers responding to system alerts and operational issues.

---

## 1. Operational Health Verification

### Quick Diagnostic Checks
```bash
# 1. Test process health
curl -s http://localhost:3000/health | jq .

# 2. Test system readiness & infrastructure connectivity
curl -s http://localhost:3000/ready | jq .

# 3. View live metrics
curl -s http://localhost:3000/metrics | jq .
```

---

## 2. Alert Playbooks

### Playbook 1: High API Error Rate (> 5% of requests failing)
1. **Inspect Metrics**:
   Query `GET /metrics` -> inspect `api.statusCodes` and `api.totalErrors`.
2. **Examine Logs**:
   Filter Pino logs for `level >= 50` (error/fatal):
   ```bash
   docker logs rag-api | grep '"level":50'
   ```
3. **Common Causes**:
   - Authentication token validation failures (`401`).
   - Downstream vector database timeout (`503`).
   - Database connection pool exhaustion (`500`).
4. **Resolution Steps**:
   - Check Neon DB connection pool limits.
   - Restart API containers if unhandled process leaks are observed.

---

### Playbook 2: Worker Queue Backlog Growing (> 100 queued jobs)
1. **Inspect Metrics**:
   Check `worker.jobsQueued` vs `worker.jobsProcessed`.
2. **Verify Worker Containers**:
   Check running worker process instances:
   ```bash
   docker ps --filter "name=rag-worker"
   ```
3. **Resolution Steps**:
   - Scale worker deployment horizontally:
     ```bash
     docker compose up -d --scale rag-worker=4
     ```
   - Check if large PDF files are choking parsing memory.

---

### Playbook 3: High Retrieval or Vector Search Latency (> 2000ms)
1. **Inspect Metrics**:
   Check `vector.averageRetrievalLatencyMs` in `GET /metrics`.
2. **Verification Steps**:
   - Check Qdrant Cloud cluster CPU and Memory usage dashboard.
   - Verify index optimization and payload index status.
3. **Resolution Steps**:
   - Scale Qdrant Cloud cluster memory tier.
   - Ensure payload index on `notebookId` is active in Qdrant collections.

---

## 3. Graceful Shutdown & Maintenance Mode

To perform infrastructure upgrades without dropping client traffic:
1. Update Load Balancer target pool to direct traffic away from target instance.
2. Send `SIGTERM` to API container (initiates 30-second graceful teardown draining active connections).
3. Drain worker queue before terminating worker containers.
