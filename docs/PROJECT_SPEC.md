# PROJECT_SPEC.md

# Knowledge Engine

**Architecture Status:** **Frozen v1.0**

> This document is the single source of truth for the project architecture.
> Changes should be made through an Architectural Decision Record (ADR).

---

## Vision

Build a modular, provider-agnostic Knowledge Engine that begins with RAG over Udemy course transcripts and evolves to support multiple knowledge sources without architectural changes.

## Guiding Principles

- Interfaces before implementations
- Composition over inheritance
- Single Responsibility Principle
- Thin CLI and REST entry points
- Workflow orchestration separated from business logic
- Configuration over hardcoding
- Provider agnostic
- Strong typing everywhere

## Technology

- Node.js 22+
- TypeScript
- Fastify
- pnpm
- Zod
- Pino
- Vitest
- ESLint
- Prettier
- Mistral (Embeddings + Chat)
- Qdrant Cloud

## High-Level Architecture

```text
CLI / REST API
      │
      ▼
Orchestrators
(Ingestion, Retrieval, Chat, Evaluation)
      │
      ▼
Application Services
      │
      ▼
Core Domain + Contracts
      │
      ▼
Providers
      │
      ▼
External Systems
```

## Project Structure

```text
src/
├── api/
├── cli/
├── config/
├── core/
│   ├── contracts/
│   ├── models/
│   └── value-objects/
├── orchestrators/
├── ingestion/
│   ├── discovery/
│   ├── extraction/
│   ├── manifest/
│   ├── parsing/
│   ├── chunking/
│   └── indexing/
├── retrieval/
├── query/
│   └── strategies/
├── reranking/
├── guardrails/
│   ├── input/
│   └── output/
├── prompts/
├── providers/
│   ├── chat/
│   ├── embeddings/
│   └── vectorstore/
├── evaluation/
├── shared/
├── types/
└── utils/
```

## Layer Responsibilities

### Core
- Models
- Contracts
- Types
- Errors

Never imports providers.

### Providers
Integrate external systems only.

### Services
Perform one responsibility.

### Orchestrators
Coordinate workflows without business logic.

## Pipelines

### Ingestion

Discover → Extract → Manifest → Parse → Chunk → Embed → Index

### Retrieval

Query → Query Transformation → Vector Search → Rerank

### Chat

Input Guardrails → Retrieval → Prompt Builder → Chat Provider → Output Guardrails

### Evaluation

Answer → Evaluate → Retry (optional) → Response

## Query Transformation

Strategies:
- Rewrite
- HyDE
- Step-back
- Query Decomposition

## Guardrails

Input:
- Prompt Injection
- PII Detection
- Policy Enforcement

Output:
- Sensitive Information Masking
- PII Redaction
- Policy Enforcement

## Provider Contracts

- EmbeddingProvider
- ChatProvider
- VectorStore
- QueryTransformationStrategy
- RerankerProvider
- InputGuardrail
- OutputGuardrail
- AnswerEvaluator

## Roadmap

Foundation
- Phase 1
- Phase 2
- Phase 2.5
- Phase 3
- Phase 4
- Phase 4.1
- Phase 4.5

Ingestion
- Phase 5
- Phase 6
- Phase 7
- Phase 8
- Phase 9
- Phase 9.5

Retrieval
- Phase 10
- Phase 11
- Phase 12
- Phase 13

Safety
- Phase 14

Chat
- Phase 15

Evaluation
- Phase 16

## Frozen Rules

- Core never imports Providers.
- Providers never import Orchestrators.
- Services never orchestrate other services.
- Orchestrators contain no business logic.
- Controllers remain thin.
- CLI remains thin.
- Everything behind interfaces.
- Configuration over hardcoding.

## Deferred

- Graph RAG
- Hybrid Search
- Memory
- Agents
- Authentication
- Multi-tenancy
- Streaming
- Background jobs
