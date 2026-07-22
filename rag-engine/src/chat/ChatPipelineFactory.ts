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
import { 
  CRAGEvaluatorFactory, 
  CRAGRetryPolicy, 
  CorrectiveRetrievalService, 
  ContextFilterService, 
  CRAGService 
} from '../crag';

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

    // 8. Initialize CRAG (Corrective Retrieval-Augmented Generation) Service
    const evaluator = CRAGEvaluatorFactory.create(config.crag.strategy, chatProvider);
    const retryPolicy = new CRAGRetryPolicy(config.crag);
    const correctiveRetrievalService = new CorrectiveRetrievalService(
      retrievalService,
      queryTransformationStrategy,
      retryPolicy
    );
    const contextFilterService = new ContextFilterService(config.crag.minChunkConfidence);
    const cragService = new CRAGService(
      evaluator,
      correctiveRetrievalService,
      contextFilterService,
      retryPolicy
    );

    // Construct and return the pipeline
    return new ChatPipelineService(
      inputGuardService,
      queryTransformationStrategy,
      retrievalService,
      rerankerProvider,
      promptBuilderService,
      chatProvider,
      outputGuardService,
      cragService
    );
  }
}
