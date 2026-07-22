# Cost Monitoring & Infrastructure Efficiency

This document outlines strategies for tracking, estimating, and optimizing resource costs across the Knowledge Engine infrastructure.

---

## 1. Primary Cost Drivers

```
                            Infrastructure Cost Breakdown
                    ┌──────────────────────────────────────────┐
                    │  Mistral AI LLM Tokens       ~ 45%       │
                    │  Qdrant Vector Cloud         ~ 25%       │
                    │  Neon PostgreSQL             ~ 15%       │
                    │  Supabase Storage / egress   ~ 10%       │
                    │  Compute (Vercel / Render)   ~ 5%        │
                    └──────────────────────────────────────────┘
```

---

## 2. Tracking Metrics via `GET /metrics`

The system exposes operational metrics that map directly to billing parameters:

```json
{
  "llm": {
    "promptTokens": 145200,
    "completionTokens": 38400,
    "totalTokens": 183600,
    "totalCompletions": 240,
    "averageLatencyMs": 850
  },
  "vector": {
    "totalSearches": 310,
    "averageRetrievalLatencyMs": 42,
    "totalVectorsWritten": 1540
  },
  "upload": {
    "totalUploads": 48,
    "totalBytesUploaded": 858993459
  }
}
```

### Key Metrics to Monitor
1. **`llm.totalTokens`**: Tracks cumulative token volume billed by Mistral AI.
2. **`vector.totalVectorsWritten`**: Tracks vector storage growth in Qdrant Cloud.
3. **`upload.totalBytesUploaded`**: Tracks storage footprint in Supabase Storage.

---

## 3. Optimization Strategies

1. **Token Cost Reduction**:
   - Limit chat window size (e.g. top 5 relevant document chunks).
   - Use `mistral-small` for query expansion / transformation while reserving `mistral-medium` for final answer synthesis.
2. **Vector Index Efficiency**:
   - Compress embedding vectors (e.g. 1024 dimension normalized float32 vectors).
   - Prune orphaned vectors when notebooks or sources are deleted (cascade deletion).
3. **Storage Bandwidth Protection**:
   - Enforce 50MB file size limit per upload.
   - Restrict allowed upload MIME types to prevent video/audio bulk uploads unless enabled.
