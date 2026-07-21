import { RetrievalResult } from './RetrievalResult';

/**
 * The final response model returned to the caller of the RetrievalEngine.
 * Currently maps 1:1 to RetrievalResult, but provides a boundary for future modifications.
 */
export type SearchResponse = RetrievalResult;
