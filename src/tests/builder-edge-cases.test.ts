import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConduitBatcher } from '../builder.js';

describe('ConduitBatcher edge cases', () => {
  beforeEach(() => {
    ConduitBatcher.reset();
  });

  afterEach(() => {
    ConduitBatcher.reset();
  });

  describe('empty array handling', () => {
    it('should handle empty array payload', () => {
      const result = ConduitBatcher.execute([]);
      expect(result.success).toBe(true);
      expect(result.operations).toBe(0);
    });
  });

  describe('large payload handling', () => {
    it('should process large batch without truncation', () => {
      const largePayload = Array(100).fill(null).map((_, i) => ({
        method: 'create',
        params: { id: i, amount: 1000n },
      }));
      const result = ConduitBatcher.execute(largePayload);
      expect(result.success).toBe(true);
      expect(result.operations).toBe(100);
    });
  });

  describe('mixed type payloads', () => {
    it('should handle mixed numeric types in params', () => {
      const payload = [
        { method: 'create', params: { amountNum: 1000, amountBig: 1000n } },
      ];
      const result = ConduitBatcher.execute(payload);
      expect(result.success).toBe(true);
      expect(result.operations).toBe(1);
    });

    it('should handle nested objects in params', () => {
      const payload = [
        { method: 'create', params: { config: { nested: { value: 100n } } } },
      ];
      const result = ConduitBatcher.execute(payload);
      expect(result.success).toBe(true);
    });
  });

  describe('state management', () => {
    it('should reset state after destroy', () => {
      ConduitBatcher.destroy();
      ConduitBatcher.reset();
      const result = ConduitBatcher.execute([{ method: 'create', params: {} }]);
      expect(result.success).toBe(true);
    });

    it('should prevent execution during destroyed state', () => {
      ConduitBatcher.destroy();
      expect(() => {
        ConduitBatcher.execute([]);
      }).toThrow(/destroyed/i);
    });
  });
});

describe('ConduitBatcher async execution', () => {
  beforeEach(() => {
    ConduitBatcher.reset();
  });

  afterEach(() => {
    ConduitBatcher.reset();
  });

  it('should validate operations in async context', async () => {
    const result = await ConduitBatcher.executeAsync([
      { method: 'create', params: { amount: 100 } },
    ]);
    expect(result.success).toBe(true);
    expect(result.operations).toBe(1);
  });

  it('should respect abort signal during async execution', async () => {
    const controller = new AbortController();
    controller.abort();
    const result = await ConduitBatcher.executeAsync(
      [{ method: 'create', params: { amount: 100 } }],
      controller.signal
    );
    expect(result.success).toBe(false);
    expect(result.errors?.some(e => e.includes('aborted'))).toBe(true);
  });

  it('should handle validation errors in async context', async () => {
    const result = await ConduitBatcher.executeAsync(null as any);
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
  });
});
