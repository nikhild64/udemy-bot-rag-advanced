import { describe, it, expect } from 'vitest';
import { appConfig, loggerConfig, ingestionConfig } from '../src/config';
import { appSchema } from '../src/config/app';

describe('Configuration Layer', () => {
  it('should load valid appConfig values', () => {
    expect(appConfig).toBeDefined();
    expect(typeof appConfig.port).toBe('number');
    expect(appConfig.port).toBeGreaterThan(0);
    expect(['development', 'production', 'test']).toContain(appConfig.env);
  });

  it('should fallback to default PORT and NODE_ENV when environment variables are undefined or empty', () => {
    const resultUndefined = appSchema.safeParse({});
    expect(resultUndefined.success).toBe(true);
    if (resultUndefined.success) {
      expect(resultUndefined.data.PORT).toBe(3000);
      expect(resultUndefined.data.NODE_ENV).toBe('development');
    }

    const resultEmpty = appSchema.safeParse({ PORT: '', NODE_ENV: '' });
    expect(resultEmpty.success).toBe(true);
    if (resultEmpty.success) {
      expect(resultEmpty.data.PORT).toBe(3000);
      expect(resultEmpty.data.NODE_ENV).toBe('development');
    }
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
