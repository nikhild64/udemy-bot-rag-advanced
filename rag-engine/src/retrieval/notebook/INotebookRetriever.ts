import { NotebookRetrievalOptions, NotebookRetrievedChunk } from './NotebookRetrievalResult';

export interface INotebookRetriever {
  /**
   * Retrieves candidate chunks for a query strictly filtered to a single notebook.
   */
  retrieve(
    query: string,
    options: NotebookRetrievalOptions,
  ): Promise<NotebookRetrievedChunk[]>;
}
