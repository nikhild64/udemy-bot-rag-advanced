# Project Specification

> **Status:** Draft v0.1
>
> This document serves as the single source of truth for the project's architecture, engineering decisions, coding standards, and roadmap.
>
> Every contributor (human or AI) should read this document before making architectural or implementation changes.

---

# Table of Contents

1. Project Overview
2. Vision
3. Goals
4. Scope
5. Guiding Principles
6. Technology Stack
7. High-Level Architecture
8. Domain Model
9. Project Structure
10. Design Principles
11. Provider Architecture
12. Coding Standards
13. Error Handling
14. Logging
15. Configuration
16. Development Workflow
17. Roadmap
18. Future Enhancements
19. Architectural Decision Records (ADR)
20. Contribution Guidelines
21. Project Glossary

---

# 1. Project Overview

## Purpose

This project is a modular Retrieval-Augmented Generation (RAG) backend that ingests structured and unstructured knowledge sources, indexes them into a vector database, and enables AI-powered question answering.

The initial implementation focuses on importing Udemy course transcripts, but the architecture is intentionally designed to support multiple content sources in the future.

The primary objective is to build a reusable knowledge platform rather than a chatbot.

---

# 2. Vision

The system should evolve into a provider-agnostic knowledge engine that can:

- Ingest knowledge from multiple sources
- Build searchable semantic indexes
- Retrieve relevant context
- Generate grounded AI responses
- Remain independent of any specific LLM or vector database

Chat is only one possible consumer of this system.

Future consumers may include:

- REST APIs
- Browser Extensions
- Mobile Apps
- Slack Bots
- VS Code Extensions
- CLI Applications

---

# 3. Goals

## Current Goals

- Learn modern RAG architecture by building it incrementally.
- Build production-quality code.
- Keep the system modular.
- Minimize infrastructure complexity.
- Prefer cloud-managed services over self-hosting.

## Non Goals

The project is **not** intended to:

- Become a monolithic application.
- Depend on a single AI provider.
- Optimize prematurely.
- Support every document type from day one.

---

# 4. Scope

## Current Scope

Input Source

- Udemy ZIP archives

Supported Transcript Format

- VTT

Output

- AI-powered question answering

---

## Planned Sources

Future support may include:

- PDF
- DOCX
- Markdown
- HTML
- Websites
- GitHub
- Notion
- Confluence
- Local folders
- S3-compatible storage

The architecture should make adding new sources straightforward.

---

# 5. Guiding Principles

The following principles should influence every architectural decision.

## Simplicity First

Build only what is currently required.

Avoid unnecessary abstractions.

---

## Provider Independence

External services should be replaceable without affecting business logic.

---

## Modularity

Each module should have a single responsibility.

---

## Testability

Core logic should be testable without requiring external services.

---

## Extensibility

Adding a new document source or AI provider should require minimal changes.

---

## Incremental Development

Features should be introduced in small, independently verifiable phases.

---

# 6. Technology Stack

| Layer           | Technology        |
| --------------- | ----------------- |
| Runtime         | Node.js           |
| Language        | TypeScript        |
| Framework       | Fastify           |
| Validation      | Zod               |
| Logging         | Pino              |
| Testing         | Vitest            |
| Formatting      | Prettier          |
| Linting         | ESLint            |
| LLM             | Mistral (Current) |
| Embeddings      | Mistral (Current) |
| Vector Database | Qdrant Cloud      |

These choices may evolve, but the architecture should prevent vendor lock-in.

---

# 7. High-Level Architecture

```
                Client
                   │
                   ▼
             Fastify API
                   │
                   ▼
          Application Layer
                   │
                   ▼
              Core Domain
                   │
         ┌─────────┴─────────┐
         ▼                   ▼
    Provider Layer      Shared Utilities
         │
         ▼
External Services
```

The application layer coordinates workflows.

The core contains business logic.

Providers integrate external systems.

---

# 8. Domain Model

Current hierarchy:

```
Course
    └── Module
          └── Lesson
                └── Transcript
                        └── Chunk
```

## Course

Represents one imported learning resource.

Example:

A single Udemy ZIP archive.

---

## Module

Logical grouping of lessons.

---

## Lesson

Represents an individual lecture.

---

## Transcript

Parsed subtitle file.

Currently VTT.

---

## Chunk

Small semantic portion of a transcript used for embedding and retrieval.

Each chunk contains metadata describing its origin.

---

# 9. Project Structure

```
src/

api/
config/
core/
providers/
ingestion/
retrieval/
prompts/
shared/
types/
utils/
```

## Responsibilities

### api

HTTP routes and request handling.

---

### config

Configuration loading and validation.

---

### core

Business logic.

Must never depend directly on external providers.

---

### providers

External integrations.

Examples:

- LLM
- Embeddings
- Vector Database

---

### ingestion

Document discovery and parsing.

---

### retrieval

Search pipeline.

---

### prompts

Prompt templates.

---

### shared

Shared utilities and reusable abstractions.

---

### utils

Small generic helper functions.

---

### types

Shared TypeScript types.

---

# 10. Design Principles

## Interfaces Before Implementations

Core code should depend on interfaces.

Never concrete providers.

---

## Small Modules

Prefer many focused modules over large service classes.

---

## Dependency Injection

Dependencies should be injected instead of created internally.

---

## Configuration Driven

Behavior should come from configuration rather than hardcoded values.

---

## Composition Over Inheritance

Favor composition whenever possible.

---

# 11. Provider Architecture

Every external dependency should be abstracted.

Example:

```ts
interface ChatProvider {}

interface EmbeddingProvider {}

interface VectorStore {}

interface TranscriptParser {}
```

Concrete implementations should live inside the providers folder.

Examples:

- MistralChatProvider
- MistralEmbeddingProvider
- QdrantVectorStore
- VttTranscriptParser

The application should never reference provider-specific SDKs directly.

---

# 12. Coding Standards

- Strict TypeScript
- No `any`
- No `@ts-ignore`
- Explicit return types on exported functions
- Prefer immutable data
- Small focused functions
- Small focused files
- Single Responsibility Principle
- SOLID where appropriate

Avoid:

- God classes
- Deep nesting
- Duplicate logic
- Business logic inside route handlers

---

# 13. Error Handling

Errors should be:

- Centralized
- Structured
- Logged
- Consistent

API responses should expose user-friendly messages while hiding internal implementation details.

---

# 14. Logging

The application should use structured logging.

Logging should:

- Support multiple log levels
- Avoid sensitive information
- Be machine readable in production
- Be human readable during development

---

# 15. Configuration

Configuration should:

- Come from environment variables
- Be validated at startup
- Fail fast if invalid
- Be strongly typed

No hardcoded secrets.

---

# 16. Development Workflow

The project will be developed incrementally.

Each phase should:

- Have a clearly defined scope.
- Be independently testable.
- Avoid implementing future features prematurely.

Future implementation prompts should reference this specification rather than redefining the architecture.

---

# 17. Roadmap

## Phase 1

Project Foundation

## Phase 2

Configuration & Provider Interfaces

## Phase 3

ZIP Discovery & Extraction

## Phase 4

Transcript Parsing

## Phase 5

Chunking Engine

## Phase 6

Embedding Pipeline

## Phase 7

Vector Store Integration

## Phase 8

Indexing Pipeline

## Phase 9

Semantic Search

## Phase 10

Chat Pipeline

Future phases will introduce guardrails, reranking, query rewriting, evaluation, and additional document sources.

---

# 18. Future Enhancements

Potential future capabilities include:

- Conversation memory
- Query rewriting
- HyDE
- Reranking
- Prompt injection detection
- PII detection
- Multi-provider routing
- Evaluation framework
- Background ingestion workers
- Multi-tenancy

These features are intentionally postponed until the core pipeline is complete.

---

# 19. Architectural Decision Records (ADR)

## ADR-001

Use Fastify.

Reason:

Lightweight, performant, and TypeScript-friendly.

---

## ADR-002

Use Qdrant Cloud.

Reason:

Managed infrastructure reduces local setup complexity and allows focusing on application development.

---

## ADR-003

Prefer VTT transcripts.

Reason:

VTT preserves timestamps and additional metadata useful for future features.

---

## ADR-004

Use Provider Interfaces.

Reason:

Avoid vendor lock-in and simplify future provider replacement.

---

# 20. Contribution Guidelines

Before making changes:

- Read this document.
- Follow the existing architecture.
- Do not introduce new dependencies without justification.
- Keep modules independent.
- Prefer composition over inheritance.
- Document significant architectural decisions.

Architecture changes should update this specification.

---

# 21. Project Glossary

| Term             | Description                                                         |
| ---------------- | ------------------------------------------------------------------- |
| Course           | A top-level imported learning resource (e.g., a Udemy ZIP archive). |
| Module           | A logical section within a course.                                  |
| Lesson           | An individual lecture or video.                                     |
| Transcript       | Parsed subtitle content.                                            |
| Chunk            | A semantic portion of transcript indexed into the vector database.  |
| Embedding        | Numeric representation of text used for semantic search.            |
| Provider         | Abstraction over an external service.                               |
| Vector Store     | Database used for similarity search.                                |
| Retrieval        | Process of finding relevant chunks for a query.                     |
| Knowledge Source | Any supported input that can be ingested by the system.             |

---

# Revision History

| Version | Date          | Notes                          |
| ------- | ------------- | ------------------------------ |
| 0.1     | Initial Draft | Initial project specification. |
