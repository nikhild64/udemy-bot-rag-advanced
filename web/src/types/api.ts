export interface Citation {
  chunkId: string;
  courseId: string;
  courseName: string;
  moduleId: string;
  moduleTitle: string;
  lessonId: string;
  lessonTitle: string;
  transcriptFile: string;
  startTime: number;
  endTime: number;
  similarityScore: number;
}

export interface SourceReference {
  courseName: string;
  moduleTitle: string;
  lessonTitle: string;
  transcriptFile: string;
  startTime: number;
  endTime: number;
}

export interface RetrievedChunk {
  chunkId: string;
  score: number;
  text: string;
  metadata: Record<string, unknown>;
  startTime?: number;
  endTime?: number;
  sourceReference: SourceReference;
  citation: Citation;
}

export interface ChatRequest {
  query: string;
  topK?: number;
}

export interface ChatResponse {
  answer: string;
  citations?: Citation[];
  retrievedChunks?: RetrievedChunk[];
  metadata?: {
    totalResults?: number;
    elapsedTime?: number;
    pipelineProgress?: string[];
  };
}
