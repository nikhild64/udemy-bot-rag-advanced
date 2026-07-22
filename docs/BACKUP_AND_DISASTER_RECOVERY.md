# Backup Strategy & Disaster Recovery Runbook

This document defines backup procedures, disaster recovery protocols, and business continuity plans for the Knowledge Engine platform.

---

## 1. Managed Data Store Backup Matrix

| Component | Provider | Backup Mechanism | Frequency | RPO (Recovery Point Objective) | RTO (Recovery Time Objective) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Relational Database** | Neon PostgreSQL | Automated Continuous WAL + Point-In-Time (PITR) | Real-time WAL stream | < 1 minute | < 15 minutes |
| **Vector Store** | Qdrant Cloud | Collection Snapshots to S3 / Cloud Storage | Daily automated snapshot | < 24 hours | < 30 minutes |
| **Object Storage** | Supabase Storage | Versioned Object Storage + Multi-Region Replication | Real-time object versioning | < 5 minutes | < 15 minutes |
| **Task Queue** | Redis | RDB Persistence + AOF (Append Only File) | Every 1 second (AOF) | < 1 second | < 5 minutes |

---

## 2. Data Restoration Procedures

### 2.1 Neon PostgreSQL Restoration
1. Access the Neon Console or CLI.
2. Select target project and navigate to **Branches / Point-in-time Restore**.
3. Specify restoration timestamp (e.g. `2026-07-22T20:00:00Z`).
4. Update `DATABASE_URL` in production deployment settings.
5. Execute migration verification:
   ```bash
   npx prisma migrate status
   ```

### 2.2 Qdrant Collection Snapshot Restore
1. Retrieve latest snapshot name from Qdrant Cloud Console or REST API:
   ```bash
   GET https://xxxx.qdrant.tech:6333/collections/notebook_sources/snapshots
   ```
2. Recover collection from snapshot:
   ```bash
   POST https://xxxx.qdrant.tech:6333/collections/notebook_sources/snapshots/recover
   Content-Type: application/json
   
   {
     "location": "https://storage.provider.com/snapshots/notebook_sources_2026-07-22.snapshot"
   }
   ```

### 2.3 Supabase Storage Recovery
1. In case of bucket corruption, initiate bucket object restore via Supabase CLI or CLI tool:
   ```bash
   supabase storage restore notebook-sources --snapshot-id latest
   ```

---

## 3. Outage Mitigation & Disaster Scenarios

### Scenario A: Redis Queue Failure
- **Symptom**: Ingestion worker jobs cannot be enqueued or popped (`Redis ping failed`).
- **Mitigation**:
  1. API server temporarily rejects background source ingestion requests (`503 Service Unavailable`).
  2. Read and Chat endpoints continue operating using existing database and vector store content.
  3. Spin up fallback Redis instance and update `REDIS_URL`.

### Scenario B: Vector Database Outage
- **Symptom**: `/ready` check fails on `qdrant`; `/api/chat/notebook` fails to retrieve context chunks.
- **Mitigation**:
  1. Chat fallback mechanism notifies users that vector context is degraded.
  2. Ingestion worker pauses chunk vector indexing until Qdrant recovers (`retries with exponential backoff`).

### Scenario C: External LLM Provider Outage
- **Symptom**: Chat completions timeout or fail with HTTP 5xx from Mistral AI.
- **Mitigation**:
  1. Circuit breaker halts failing outbound LLM requests after 5 consecutive failures.
  2. System returns standardized graceful response: *"AI generation is currently experiencing provider delay. Please try again shortly."*
