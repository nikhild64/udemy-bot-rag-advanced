import { describe, it, expect } from 'vitest';
import { appConfig, loggerConfig } from '../src/config';

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
});
