import { VectorStoreCollectionInfo } from '@/core/contracts/vector-store.contract';

/**
 * Summary result of a vector store operation (such as upserting or deleting vectors).
 */
export interface VectorStoreOperationResult {
  readonly operation: 'upsert' | 'delete' | 'create_collection' | 'delete_collection' | 'validate_collection';
  readonly collectionName: string;
  readonly providerName: string;
  readonly count?: number;
  readonly durationMs: number;
  readonly success: boolean;
  readonly errors: readonly string[];
}

/**
 * Result of validating a vector or collection.
 */
export interface VectorValidationResult {
  readonly valid: boolean;
  readonly collectionName?: string;
  readonly expectedDimension?: number;
  readonly actualDimension?: number;
  readonly errors: readonly string[];
}

/**
 * Summary result of checking collection information and status.
 */
export interface CollectionManagementResult {
  readonly collectionName: string;
  readonly exists: boolean;
  readonly info?: VectorStoreCollectionInfo | null;
  readonly validation?: VectorValidationResult;
  readonly durationMs: number;
  readonly success: boolean;
  readonly errors: readonly string[];
}
