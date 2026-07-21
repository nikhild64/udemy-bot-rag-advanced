/**
 * Ingestion layer
 * Responsible for processing documents (ZIP discovery, extraction, parsing, chunking, and embedding generation).
 * Future implementation phases will add document pipelines here.
 */
export * from './discovery';
export * from './extraction';
export * from './orchestrator';
