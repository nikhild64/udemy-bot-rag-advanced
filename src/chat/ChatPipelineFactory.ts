import { config } from '../config';
import { ChatPipelineService } from './ChatPipelineService';
import { InputGuardService } from '../guardrails/input/InputGuardService';
import { QueryTransformationFactory } from '../query';
import { EmbeddingProviderFactory } from '../providers/embeddings/EmbeddingProviderFactory';
import { VectorStoreFactory } from '../providers/vectorstore/VectorStoreFactory';
import { RetrievalService } from '../retrieval';
import { RerankerProviderFactory } from '../reranking';
import { PromptBuilderService } from '../prompts';
import { ChatProviderFactory } from '../providers/chat/ChatProviderFactory';
import { OutputGuardService } from '../guardrails/output/OutputGuardService';

export class ChatPipelineFactory {
  /**
   * Creates a fully configured instance of ChatPipelineService
   * along with all its dependencies.
   */
  public static create(): ChatPipelineService {
    // 1. Initialize Input Guardrails
    const inputGuardService = new InputGuardService(config.guardrails);

    // 2. Initialize Query Transformation
    const queryTransformationStrategy = QueryTransformationFactory.create();

    // 3. Initialize Retrieval Service
    const embeddingProvider = EmbeddingProviderFactory.create();
    const vectorStore = VectorStoreFactory.create();
    const retrievalService = new RetrievalService(embeddingProvider, vectorStore);

    // 4. Initialize Reranking Provider
    const rerankerProvider = RerankerProviderFactory.create();

    // 5. Initialize Prompt Builder
    const promptBuilderService = new PromptBuilderService();

    // 6. Initialize Chat Provider
    const chatProvider = ChatProviderFactory.create();

    // 7. Initialize Output Guardrails
    const outputGuardService = new OutputGuardService(config.guardrails);

    // Construct and return the pipeline
    return new ChatPipelineService(
      inputGuardService,
      queryTransformationStrategy,
      retrievalService,
      rerankerProvider,
      promptBuilderService,
      chatProvider,
      outputGuardService
    );
  }
}
