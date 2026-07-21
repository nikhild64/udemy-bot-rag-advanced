import { ChunkingStrategy } from './ChunkingStrategy';
import { SemanticChunkingStrategy } from './SemanticChunkingStrategy';

export interface IChunkingStrategyFactory {
  getStrategy(strategyName?: string): ChunkingStrategy;
}

/**
 * Factory providing strategy implementations for transcript semantic chunking.
 */
export class ChunkingStrategyFactory implements IChunkingStrategyFactory {
  private readonly strategies: Map<string, ChunkingStrategy>;

  constructor(customStrategies?: readonly ChunkingStrategy[]) {
    this.strategies = new Map();
    const defaultStrategy = new SemanticChunkingStrategy();
    this.strategies.set(defaultStrategy.name.toLowerCase(), defaultStrategy);
    this.strategies.set('semantic', defaultStrategy);
    this.strategies.set('semanticchunkingstrategy', defaultStrategy);
    this.strategies.set('default', defaultStrategy);

    if (customStrategies) {
      for (const st of customStrategies) {
        this.strategies.set(st.name.toLowerCase(), st);
      }
    }
  }

  getStrategy(strategyName = 'semantic'): ChunkingStrategy {
    const key = strategyName.toLowerCase();
    const strategy = this.strategies.get(key);
    if (!strategy) {
      throw new Error(
        `Unknown chunking strategy: "${strategyName}". Available strategies: ${Array.from(this.strategies.keys()).join(', ')}`,
      );
    }
    return strategy;
  }
}
