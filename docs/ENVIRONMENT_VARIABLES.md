# Environment Variables Guide

This document lists all environment variables required by the Knowledge Engine API, Workers, and Frontend Web application across Development, Staging, and Production environments.

---

## 1. Backend (`rag-engine`) Environment Variables

| Variable Name | Required | Default / Format | Description |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | Yes | `development` \| `staging` \| `production` | Execution environment mode. |
| `PORT` | No | `3000` | HTTP port for API server. |
| `LOG_LEVEL` | No | `info` (`debug`, `warn`, `error`) | Pino logging verbosity level. |
| `DATABASE_URL` | Yes | `postgresql://user:pass@host:5432/dbname?sslmode=require` | Connection string for Neon PostgreSQL. |
| `REDIS_URL` | Yes | `redis://default:pass@host:6379` | Redis connection URL for worker queue & rate limiting. |
| `QDRANT_URL` | Yes | `https://xxxx.qdrant.tech:6333` | Vector store endpoint URL. |
| `QDRANT_API_KEY` | Conditional | String secret | Qdrant Cloud cluster API key. |
| `SUPABASE_URL` | Yes | `https://xxxx.supabase.co` | Supabase project endpoint URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | String secret | Supabase secret key for storage manipulation. |
| `SUPABASE_STORAGE_BUCKET` | No | `notebook-sources` | Target bucket name in Supabase Storage. |
| `MISTRAL_API_KEY` | Yes | String secret | API key for Mistral LLM completions and embeddings. |
| `CLERK_PUBLISHABLE_KEY` | Yes | `pk_test_...` / `pk_live_...` | Clerk authentication publishable key. |
| `CLERK_SECRET_KEY` | Yes | `sk_test_...` / `sk_live_...` | Clerk authentication backend secret key. |
| `FRONTEND_ORIGIN` | No | `https://chaicodeudemy.vercel.app` | Allowed CORS origins (comma-separated or `*`). |

---

## 2. Frontend (`web`) Environment Variables

| Variable Name | Required | Default / Format | Description |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | Yes | `https://api.knowledge-engine.com` | Base REST API URL of `rag-engine`. |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | `pk_test_...` / `pk_live_...` | Client-side Clerk publishable key. |
| `CLERK_SECRET_KEY` | Yes | `sk_test_...` / `sk_live_...` | Server-side Next.js Clerk secret. |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | No | `/sign-in` | Route redirect for auth sign-in. |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | No | `/sign-up` | Route redirect for auth sign-up. |

---

## 3. Secret Management & Security Principles

1. **No Hardcoded Secrets**: Secrets MUST NEVER be committed to Git repositories or written directly into code files.
2. **Platform Injection**: Deploy platforms (Vercel, Render, Railway, AWS Secrets Manager) inject secrets as environment variables during runtime initialization.
3. **Log Masking**: Pino logger sanitizes sensitive authorization headers and secret tokens from all output streams.
