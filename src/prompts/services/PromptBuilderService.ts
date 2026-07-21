import { PromptBuildRequest, PromptBuildResult } from '../../core/models';
import {
  SYSTEM_PROMPT_TEMPLATE,
  formatContextChunks,
  formatUserQuestion,
} from '../templates';

export class PromptBuilderService {
  /**
   * Constructs a grounded prompt from the given request.
   */
  public buildPrompt(request: PromptBuildRequest): PromptBuildResult {
    const { query, chunks } = request;

    const systemPrompt = SYSTEM_PROMPT_TEMPLATE;
    
    // Inject retrieved chunks
    const contextPrompt = formatContextChunks(chunks);
    
    // Construct user prompt
    const userPrompt = formatUserQuestion(query);

    // Combine everything
    // Format: System Prompt -> Context -> User Question
    const combinedPrompt = `${systemPrompt}\n\n${contextPrompt}\n\n${userPrompt}`;

    // Collect statistics
    const contextChunks = chunks ? chunks.length : 0;
    const contextCharacters = contextPrompt.length;

    return {
      systemPrompt,
      userPrompt,
      combinedPrompt,
      contextChunks,
      contextCharacters,
    };
  }
}
