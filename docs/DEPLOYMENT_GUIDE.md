# Production Deployment Guide

This guide details the steps required to deploy the Knowledge Engine platform (API, Workers, and Frontend Web Application) into Staging and Production environments.

---

## 1. Deployment Architecture Overview

```
                         User Browser / Client
                                   │
                                   ▼
                            Vercel / CDN
                          (Frontend Next.js)
                                   │
                                   ▼
                         Load Balancer / Ingress
                                   │
                ┌──────────────────┴──────────────────┐
                ▼                                     ▼
      rag-engine API Container             rag-engine API Container
      (Node.js / Fastify)                   (Node.js / Fastify)
                │                                     │
                └──────────────────┬──────────────────┘
                                   ▼
                              Redis Queue
                                   │
                 ┌─────────────────┴─────────────────┐
                 ▼                                   ▼
       rag-worker Container                 rag-worker Container
       (Node.js Worker Node)                (Node.js Worker Node)
                 │                                   │
                 └─────────────────┬─────────────────┘
                                   ▼
                      External Managed Services
          Neon PostgreSQL | Qdrant Cloud | Supabase Storage | Mistral AI
```

Each service is decoupled and deployed independently.

---

## 2. Service Component Matrix

| Service | Technology | Hosting Target | Scaling Model |
| :--- | :--- | :--- | :--- |
| **API Server** | Node.js (Fastify, Prisma) | Render / Railway / AWS ECS | Horizontal (Stateless) |
| **Ingestion Worker** | Node.js (`runWorker.ts`) | Render / Railway / AWS ECS | Horizontal (Redis-backed) |
| **Frontend Web App** | Next.js (TypeScript, React) | Vercel / Netlify | Serverless Edge |
| **Database** | Serverless PostgreSQL | Neon | Managed Auto-Scaling |
| **Vector Store** | Qdrant Cloud | Qdrant Cluster | Managed Distributed |
| **File Storage** | Supabase Storage | Supabase S3 | Object Storage |
| **Task Queue** | Redis | Upstash / Redis Cloud | In-Memory Cluster |

---

## 3. Deployment Steps

### Step 1: Database Migrations
Before deploying new API or Worker versions, run production database migrations:

```bash
cd rag-engine
npx prisma migrate deploy
```

### Step 2: API Deployment
1. Build the Docker container using target `runtime`:
   ```bash
   docker build --target runtime -t rag-engine-api:latest .
   ```
2. Start container with `node dist/server.js`:
   ```bash
   docker run -d \
     -p 3000:3000 \
     --env-file .env.production \
     rag-engine-api:latest
   ```
3. Configure readiness probe target: `GET /ready` (timeout: 5s, interval: 10s).

### Step 3: Worker Deployment
1. Use the same Docker image target `runtime`.
2. Override start command to `node dist/workers/runWorker.js`:
   ```bash
   docker run -d \
     --env-file .env.production \
     rag-engine-api:latest node dist/workers/runWorker.js
   ```
3. Scale horizontally (e.g. 2–10 worker instances) based on Redis queue depth.

### Step 4: Web Application Deployment
1. Connect GitHub repository to Vercel.
2. Set Root Directory to `web`.
3. Configure Environment Variables (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`).
4. Trigger production build (`next build`).

---

## 4. Environment Verification & Health Probes

Verify deployment health using HTTP probes:

```bash
# Liveness Probe (Returns 200 OK)
curl -f https://api.knowledge-engine.com/health

# Readiness Probe (Verifies DB, Redis, Qdrant, Supabase connectivity)
curl -f https://api.knowledge-engine.com/ready

# Operational Metrics Endpoint
curl https://api.knowledge-engine.com/metrics
```
