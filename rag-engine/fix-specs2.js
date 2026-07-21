const fs = require('fs');

function fix(file, fn) {
  if (fs.existsSync(file)) {
    const orig = fs.readFileSync(file, 'utf-8');
    const changed = fn(orig);
    if (orig !== changed) {
      fs.writeFileSync(file, changed);
      console.log('Fixed', file);
    }
  }
}

fix('src/providers/query-transformation/llm-strategy.spec.ts', c => {
  return c.replace('mockChatProvider = { generateResponse: vi.fn() } as unknown as ChatProvider;', 'mockChatProvider = { generateResponse: vi.fn(), streamResponse: vi.fn() } as unknown as ChatProvider;')
          .replace(/callArgs/g, 'callArgs!')
          .replace(/mockChatProvider\.generateResponse\.mock\.calls\[0\]/g, 'mockChatProvider.generateResponse.mock.calls[0]!');
});

fix('src/providers/reranker/llm/LLMRerankerProvider.spec.ts', c => {
  return c.replace('mockChatProvider = { generateResponse: vi.fn() } as unknown as ChatProvider;', 'mockChatProvider = { generateResponse: vi.fn(), streamResponse: vi.fn() } as unknown as ChatProvider;')
          .replace(/mockChatProvider\.generateResponse\.mock\.calls\[0\]/g, 'mockChatProvider.generateResponse.mock.calls[0]!');
});

fix('src/providers/chat/mistral/MistralChatProvider.spec.ts', c => {
  return c.replace(/fetchCall\[/g, 'fetchCall![');
});

fix('src/api/routes/chat.routes.spec.ts', c => {
  return c.replace("import { jsonSchemaTransform } from 'fastify-type-provider-zod';\n", "");
});

fix('src/chat/ChatPipelineService.spec.ts', c => {
  return c.replace("import { GuardRequest, GuardDecision } from '../core/models/guard.model';\n", "")
          .replace("import { ChatResponse as AIChatResponse, ChatRequest, ChatResponse, ChatMessage } from '../core/models';\n", "import { ChatRequest, ChatPipelineResponse, ChatMessage } from '../core/models';\n")
          .replace("import { AppError } from '../shared/errors';\n", "");
});
