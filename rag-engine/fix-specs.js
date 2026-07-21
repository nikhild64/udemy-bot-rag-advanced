const fs = require('fs');

function fixFile(file, replaceFn) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf-8');
    const newContent = replaceFn(content);
    if (newContent !== content) {
      fs.writeFileSync(file, newContent);
      console.log('Fixed', file);
    }
  }
}

// Fix missing streamResponse in ChatProvider mocks
const mockFix = (content) => {
  return content.replace(/\{ generateResponse: vi\.fn\(\) \}/g, "{ generateResponse: vi.fn(), streamResponse: vi.fn() }")
                .replace(/\{ generateResponse: vi\.fn\(\) as any \}/g, "{ generateResponse: vi.fn() as any, streamResponse: vi.fn() as any }");
};

fixFile('src/providers/query-transformation/llm-strategy.spec.ts', mockFix);
fixFile('src/providers/reranker/llm/LLMRerankerProvider.spec.ts', mockFix);

// Fix unused AppError
fixFile('src/chat/ChatPipelineService.ts', c => c.replace("import { AppError } from '../shared/errors';\n", ""));
fixFile('src/api/middlewares/error.handler.ts', c => c.replace("import { AppError } from '../../shared/errors';\n", ""));

// Fix unused in chat.routes.spec.ts
fixFile('src/api/routes/chat.routes.spec.ts', c => c.replace("import { jsonSchemaTransform } from 'fastify-type-provider-zod';\n", ""));

// Fix unused vi in health.routes.spec.ts
fixFile('src/api/routes/health.routes.spec.ts', c => c.replace("import { describe, it, expect, vi } from 'vitest';", "import { describe, it, expect } from 'vitest';"));

// Fix type error in health.routes.spec.ts
// pp.decorate('chatPipelineService', {});
fixFile('src/api/routes/health.routes.spec.ts', c => c.replace("app.decorate('chatPipelineService', {});", "app.decorate('chatPipelineService', {} as any);"));

