export interface MemoryItem {
  id: string;
  memory: string;
  score?: number;
  createdAt?: string;
  metadata?: Record<string, unknown>;
}

export interface MemorySearchOptions {
  query: string;
  userId: string;
  topK?: number;
}

export interface MemoryAddOptions {
  messages: Array<{ role: string; content: string }>;
  userId: string;
}

export interface MemoryProvider {
  /**
   * Search user memories relevant to the given query.
   */
  search(options: MemorySearchOptions): Promise<MemoryItem[]>;

  /**
   * Add a conversation exchange (messages) to extract & consolidate memories.
   */
  add(options: MemoryAddOptions): Promise<MemoryItem[]>;

  /**
   * Retrieve all memories for a user.
   */
  getAll(userId: string): Promise<MemoryItem[]>;

  /**
   * Delete a memory item by ID.
   */
  delete(memoryId: string): Promise<void>;

  /**
   * Delete all memories for a user.
   */
  deleteAll(userId: string): Promise<void>;
}
