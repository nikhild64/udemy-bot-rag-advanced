import { config } from '@/config';
import { RetrievalService } from '@/retrieval';
import { EmbeddingProviderFactory } from '@/providers/embeddings/EmbeddingProviderFactory';
import { VectorStoreFactory } from '@/providers/vectorstore/VectorStoreFactory';

export async function runSearch(queryArg?: string): Promise<void> {
  const query = queryArg || process.argv.slice(2).join(' ');

  if (!query || query.trim() === '') {
    console.error('Error: Please provide a search query.');
    console.log('\nUsage: pnpm search "Your query here"');
    process.exit(1);
  }

  console.log('Searching...\n');

  try {
    const embeddingProvider = EmbeddingProviderFactory.create();
    const vectorStore = VectorStoreFactory.create();
    
    const retrievalService = new RetrievalService(embeddingProvider, vectorStore);

    const result = await retrievalService.search({
      query: query.trim(),
    });

    console.log('Query');
    console.log(result.query);
    console.log();
    
    console.log('Results');
    console.log(result.totalResults);
    console.log();

    if (result.totalResults > 0) {
      result.retrievedChunks.forEach((match) => {
        const citation = match.citation;
        
        console.log('────────────────────────────\n');
        
        console.log('Course');
        console.log(citation.courseName);
        console.log();
        
        console.log('Module');
        console.log(citation.moduleTitle);
        console.log();
        
        console.log('Lesson');
        console.log(citation.lessonTitle);
        console.log();
        
        console.log('Timestamp');
        const formatTime = (secs: number) => {
          const m = Math.floor(secs / 60).toString().padStart(2, '0');
          const s = Math.floor(secs % 60).toString().padStart(2, '0');
          return `${m}:${s}`;
        };
        console.log(`${formatTime(citation.startTime)} → ${formatTime(citation.endTime)}`);
        console.log();
        
        console.log('Similarity');
        console.log(citation.similarityScore.toFixed(2));
        console.log();
        
        console.log('Preview');
        const previewText = match.text.length > 200 ? match.text.substring(0, 200) + '...' : match.text;
        console.log(previewText);
        console.log();
      });
    }

    console.log('Retrieval completed successfully.');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Search failed:\n\nReason:\n${errorMessage}`);

    if (config.app.env === 'development' && error instanceof Error && error.stack) {
      console.error(`\n${error.stack}`);
    }

    process.exit(1);
  }
}

const isMainModule =
  (typeof require !== 'undefined' && require.main === module) ||
  (typeof process !== 'undefined' &&
    process.argv[1] !== undefined &&
    (process.argv[1].endsWith('search.ts') || process.argv[1].endsWith('search.js')));

if (isMainModule) {
  void runSearch();
}
