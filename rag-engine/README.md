# RAG Knowledge Engine Backend (Phase 1 Foundation)

A clean, production-ready, modular TypeScript backend foundation built on Fastify, Zod, and Pino following Clean Architecture and SOLID principles.

---

## Project Overview

This repository provides the high-performance backend foundation for a modular Retrieval-Augmented Generation (RAG) Knowledge Engine. In future phases, this engine will ingest various document formats (starting with Udemy course transcripts in ZIP archives) and provide AI-powered question answering across multiple external AI providers and vector stores.

Phase 1 focuses exclusively on establishing a robust, maintainable, and strictly typed backend architecture that guarantees clean separation of concerns, fail-fast configuration validation, structured logging, and centralized error handling.

---

## Tech Stack

- **Runtime**: Node.js 22+
- **Language**: TypeScript (Strict Mode)
- **Package Manager**: pnpm
- **Framework**: Fastify v5
- **Validation**: Zod
- **Logging**: Pino (JSON in production, `pino-pretty` in development)
- **Environment Management**: dotenv
- **Testing**: Vitest
- **Linting**: ESLint v9 (Flat Config with `@typescript-eslint`)
- **Formatting**: Prettier
- **Development Runtime**: tsx

---

## Installation

Ensure you have **Node.js 22+** and **pnpm** installed on your system.

```bash
# Clone the repository and navigate to the project directory
cd rag-engine

# Install dependencies using pnpm
pnpm install
```

---

## Running the Application

Before running the server, ensure your local `.env` file is set up (or copy `.env.example`):

```bash
cp .env.example .env
```

### Development Mode (with hot reload)

```bash
pnpm dev
```

### Production Build & Execution

```bash
# Compile TypeScript to dist/
pnpm build

# Start the compiled server
pnpm start
```

---

## Available Scripts

| Script        | Command                                   | Description                                              |
| :------------ | :---------------------------------------- | :------------------------------------------------------- |
| `pnpm dev`    | `tsx watch src/server.ts`                 | Starts the development server with live reload           |
| `pnpm build`  | `tsc`                                     | Compiles TypeScript source files into the `dist/` folder |
| `pnpm start`  | `node dist/server.js`                     | Runs the compiled production build                       |
| `pnpm lint`   | `eslint .`                                | Runs ESLint type-aware linting across all files          |
| `pnpm test`   | `vitest run`                              | Executes unit and integration test suite using Vitest    |
| `pnpm format` | `prettier --write "**/*.{ts,js,json,md}"` | Formats codebase according to Prettier configuration     |

---

## Folder Structure

```
rag-engine/
├── docs/                 # Architectural and technical documentation
├── src/
│   ├── api/              # HTTP layer (routes, controllers, middlewares, plugins)
│   ├── config/           # Centralized configuration management with Zod validation
│   ├── core/             # Domain layer entities, base abstractions, and business rules
│   ├── providers/        # Infrastructure adapters and external AI/Vector integrations
│   ├── ingestion/        # Document extraction, processing, and embedding pipelines
│   ├── retrieval/        # Vector search interfaces and retrieval strategies
│   ├── prompts/          # Prompt templates and construction utilities
│   ├── shared/           # Cross-cutting concerns (structured logger, global constants)
│   ├── utils/            # Pure, stateless helper utilities
│   ├── types/            # Global application definitions and custom types
│   ├── app.ts            # Fastify application bootstrap and orchestration
│   └── server.ts         # Process entry point, listening, and graceful shutdown
├── tests/                # Automated Vitest test suites
├── scripts/              # Maintenance, operational, and migration scripts
├── .env.example          # Template for required environment variables
├── package.json          # Project dependencies and script definitions
├── tsconfig.json         # TypeScript strict compilation configuration
├── eslint.config.js      # Modern ESLint v9 flat configuration
└── prettier.config.js    # Prettier code formatting rules
```

---

## API Endpoint

### Health Check

Returns the operational status, service identifier, and semantic version of the backend engine.

- **URL**: `/health`
- **Method**: `GET`
- **Response Status**: `200 OK`

#### Response Payload

```json
{
  "status": "ok",
  "service": "rag-engine",
  "version": "0.1.0"
}
```
