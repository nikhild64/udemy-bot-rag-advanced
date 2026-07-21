# Architectural Documentation — RAG Knowledge Engine Foundation

## 1. Project Purpose

The `rag-engine` backend is engineered to serve as the core service for ingesting structured/unstructured document corpora and answering complex user queries via Retrieval-Augmented Generation (RAG).

Phase 1 establishes a rock-solid, enterprise-grade backend foundation using **Node.js 22+**, **TypeScript (Strict Mode)**, and **Fastify**. It focuses exclusively on setting up architectural boundaries, fail-fast configuration validation, structured logging, centralized HTTP error handling, and automated verification—ensuring clean, decoupled extensibility for future implementation phases without introducing premature or ad-hoc business logic.

---

## 2. High-Level Architecture

The system adheres strictly to **Clean Architecture** and **Dependency Inversion** principles. Dependencies flow inward toward the core domain layers. Outer layers (HTTP APIs, external providers, database clients) depend on inner domain interfaces rather than concrete implementations.

```
+-----------------------------------------------------------------------+
|                       Presentation Layer (API)                        |
|  [Routes] ----> [Controllers] ----> [Middlewares / Plugins / Errors]  |
+-----------------------------------------------------------------------+
                                   |
                                   v
+-----------------------------------------------------------------------+
|                    Application & Service Layers                       |
|         [Ingestion Pipeline]             [Retrieval Engine]           |
+-----------------------------------------------------------------------+
                                   |
                                   v
+-----------------------------------------------------------------------+
|                         Domain Core Layer                             |
|               [Entities, Domain Interfaces, Base Abstractions]         |
+-----------------------------------------------------------------------+
                                   ^
                                   | (Implements / Adapts)
+-----------------------------------------------------------------------+
|                      Infrastructure Layer (Providers)                 |
|            [LLM Clients, Vector Stores, Document Parsers]            |
+-----------------------------------------------------------------------+
```

### Application Lifecycle & Decoupling

- **`server.ts` (Entry Point & Process Orchestrator)**: Responsible solely for process-level concerns: bootstrapping the application, binding to the network socket (`0.0.0.0`), capturing OS signals (`SIGINT`, `SIGTERM`), catching unhandled rejections/uncaught exceptions, and orchestrating graceful shutdown.
- **`app.ts` (Application Factory)**: Encapsulates the Fastify instance creation (`buildApp`), configuring the Pino logger instance, attaching the global error handler (`setErrorHandler`), and orchestrating centralized route and plugin registration.

---

## 3. Layer Responsibilities

### Presentation Layer (`src/api/`)

- Intercepts incoming HTTP traffic, parses requests, and formats standard responses.
- Enforces centralized route and plugin registration (`src/api/routes/index.ts`, `src/api/plugins/index.ts`).
- Isolates route definitions from controller logic so controllers remain small, focused, and testable functions.
- Manages global error intercepts (`src/api/middlewares/error.handler.ts`) to ensure uniform JSON responses while suppressing stack traces in production.

### Configuration Layer (`src/config/`)

- Reads raw environment variables via `dotenv` upon application startup.
- Uses **Zod** to strictly validate variables (`app.ts` and `logger.ts`) and fails fast with descriptive errors if any configuration value is missing or malformed.
- Exports immutable (`readonly`), strongly typed configuration objects (`config`), preventing any hardcoded magic values across codebases.

### Domain Core Layer (`src/core/`)

- Contains foundational entities (`BaseEntity`) and domain-level interfaces (`src/core/interfaces/base.interface.ts`).
- Completely agnostic of HTTP frameworks, database schemas, and third-party AI SDKs.

### Infrastructure & Pipeline Layers (`src/providers/`, `src/ingestion/`, `src/retrieval/`, `src/prompts/`)

- **Providers**: Acts as the adapter layer where concrete implementations of external services (LLM APIs, embedding endpoints, vector databases) will reside behind core domain interfaces.
- **Ingestion**: Orchestrates document extraction, file parsing, chunking, and embedding generation workflows.
- **Retrieval**: Houses vector search ranking strategies and context retrieval logic for generation prompts.
- **Prompts**: Manages prompt engineering templates and context injection frameworks.

### Shared & Utility Layers (`src/shared/`, `src/utils/`, `src/types/`)

- **Shared**: Houses cross-cutting infrastructure components needed across layers (e.g., centralized **Pino** structured logger).
- **Utils**: Contains pure, stateless helper functions (e.g., string manipulation, cryptographic hashing helpers).
- **Types**: Stores cross-layer TypeScript custom type definitions and shared contracts.

---

## 4. Folder Responsibilities

| Directory        | Exact Responsibility                                                                                   |
| :--------------- | :----------------------------------------------------------------------------------------------------- |
| `docs/`          | Architecture documentation, system diagrams, and technical specifications.                             |
| `src/api/`       | HTTP transport layer containing controllers, route definitions, error middleware, and Fastify plugins. |
| `src/config/`    | Environment variable ingestion, Zod schema validation, and typed configuration exports.                |
| `src/core/`      | Domain entities, core interfaces, and business invariants.                                             |
| `src/providers/` | Infrastructure adapters connecting external AI models and storage systems to domain interfaces.        |
| `src/ingestion/` | Document processing pipelines (extraction, parsing, chunking, vectorization).                          |
| `src/retrieval/` | Vector query execution, context ranking, and retrieval interfaces.                                     |
| `src/prompts/`   | Prompt templates, system instructions, and dynamic context building.                                   |
| `src/shared/`    | Shared infrastructure components such as the centralized Pino logging instance.                        |
| `src/utils/`     | Pure, stateless utility functions and general helpers.                                                 |
| `src/types/`     | Global TypeScript type declarations and application-wide type definitions.                             |
| `tests/`         | Vitest automated test suites ensuring structural, configuration, and API reliability.                  |
| `scripts/`       | Operational scripts, database migration tools, and maintenance utilities.                              |

---

## 5. Coding Principles

1. **SOLID Principles & Clean Architecture**:
   - **Single Responsibility Principle (SRP)**: Every module, class, and function has one clear, well-defined responsibility. Route handlers register paths; controllers handle HTTP payloads; services execute domain workflows.
   - **Open/Closed Principle (OCP)**: Layers are designed for extension (e.g., registering new providers or plugins) without modifying core orchestration logic.
   - **Dependency Inversion Principle (DIP)**: Outer transport and infrastructure layers depend on abstractions established inside the core domain layer.

2. **Strict TypeScript & Type Safety**:
   - `strict: true` is enforced in `tsconfig.json`.
   - Explicit return types (`Promise<void>`, `FastifyInstance`, `AppConfig`) are required across all functions.
   - `any` and `@ts-ignore` are strictly disallowed via ESLint rules (`@typescript-eslint/no-explicit-any`).
   - Domain objects and configuration properties use `readonly` modifiers (`@typescript-eslint/prefer-readonly`) to guarantee immutability.

3. **Small, Focused Functions & Classes**:
   - Code is structured into small, highly cohesive units.
   - God classes, utility dumping grounds (`utils.ts` containing unrelated methods), and deep nesting (`> 3` levels) are avoided.

4. **Structured Logging (`Pino`)**:
   - `console.log()` is strictly prohibited outside the `src/shared/logger.ts` instantiation wrapper.
   - All logs use structured JSON format in production with contextual metadata (request IDs, HTTP methods, error traces).
   - In development mode (`NODE_ENV=development`), `pino-pretty` formats output for human readability.

5. **Centralized & Safe Error Handling**:
   - Errors escaping route handlers are intercepted globally by `globalErrorHandler`.
   - Consistent JSON payloads `{ success: false, error: { message: "..." } }` are guaranteed for all error states.
   - In production (`NODE_ENV=production`), server-side exceptions (`>= 500`) automatically mask internal details and stack traces, returning `"Internal Server Error"` while logging the full exception stack via `logger.error`.
