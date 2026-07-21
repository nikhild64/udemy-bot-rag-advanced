import { config } from '@/config';
import { RetrievalService } from '@/retrieval';
import { EmbeddingProviderFactory } from '@/providers/embeddings/EmbeddingProviderFactory';
import { VectorStoreFactory } from '@/providers/vectorstore/VectorStoreFactory';
import { QueryTransformationFactory, QueryTransformationService } from '@/query';
import { RerankerProviderFactory, RerankingService } from '@/reranking';
import { PromptBuilderService } from '@/prompts';

export async function runPrompt(queryArg?: string): Promise<void> {
  const query = queryArg || process.argv.slice(2).join(' ');

  if (!query || query.trim() === '') {
    console.error('Error: Please provide a search query.');
    console.log('\nUsage: pnpm prompt "Your query here"');
    process.exit(1);
  }

  console.log('Building prompt...\n');

  try {
    // 1. Query Transformation
    const queryTransformationStrategy = QueryTransformationFactory.create();
    const queryTransformationService = new QueryTransformationService(queryTransformationStrategy);
    const transformationResult = await queryTransformationService.transform(query.trim());

    // 2. Retrieval
    const embeddingProvider = EmbeddingProviderFactory.create();
    const vectorStore = VectorStoreFactory.create();
    const retrievalService = new RetrievalService(embeddingProvider, vectorStore);
    
    const result = await retrievalService.search({
      query: transformationResult.transformedQuery,
    });

    // 3. Reranking
    const rerankerProvider = RerankerProviderFactory.create();
    const rerankingService = new RerankingService(rerankerProvider);
    const rerankResult = await rerankingService.rerank(
      transformationResult.transformedQuery,
      result.retrievedChunks
    );

    // 4. Prompt Building
    const promptBuilderService = new PromptBuilderService();
    const promptResult = promptBuilderService.buildPrompt({
      query: transformationResult.originalQuery, // Using original query in prompt
      chunks: rerankResult.chunks
    });

    console.log('========================================================================');
    console.log('                            PROMPT OUTPUT');
    console.log('========================================================================\n');

    console.log('--- SYSTEM PROMPT ---');
    console.log(promptResult.systemPrompt);
    console.log('\n----------------------\n');

    console.log('--- USER PROMPT ---');
    console.log(promptResult.userPrompt);
    console.log('\n----------------------\n');

    console.log('--- PROMPT STATISTICS ---');
    console.log(`Context Chunks:     ${promptResult.contextChunks}`);
    console.log(`Context Characters: ${promptResult.contextCharacters}`);
    console.log(`Total Length:       ${promptResult.combinedPrompt.length}`);
    console.log();

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Prompt building failed:\n\nReason:\n${errorMessage}`);

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
    (process.argv[1].endsWith('prompt.ts') || process.argv[1].endsWith('prompt.js')));

if (isMainModule) {
  void runPrompt();
}
