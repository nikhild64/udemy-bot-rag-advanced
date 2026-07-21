import { describe, it, expect } from 'vitest';
import { appConfig, loggerConfig, ingestionConfig } from '../src/config';

describe('Configuration Layer', () => {
  it('should load valid appConfig values', () => {
    expect(appConfig).toBeDefined();
    expect(typeof appConfig.port).toBe('number');
    expect(appConfig.port).toBeGreaterThan(0);
    expect(['development', 'production', 'test']).toContain(appConfig.env);
  });

  it('should load valid loggerConfig values', () => {
    expect(loggerConfig).toBeDefined();
    expect(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).toContain(
      loggerConfig.level,
    );
  });

  it('should load valid ingestionConfig values', () => {
    expect(ingestionConfig).toBeDefined();
    expect(typeof ingestionConfig.inputDirectory).toBe('string');
    expect(ingestionConfig.inputDirectory.length).toBeGreaterThan(0);
    expect(typeof ingestionConfig.extractionDirectory).toBe('string');
    expect(ingestionConfig.extractionDirectory.length).toBeGreaterThan(0);
  });
});
