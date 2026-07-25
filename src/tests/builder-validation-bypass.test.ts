import { describe, it, expect } from 'vitest';
import { ConduitBatcher } from '../builder.js';

describe('ConduitBatcher validation', () => {
  beforeEach(() => {
    ConduitBatcher.reset();
  });

  afterEach(() => {
    ConduitBatcher.reset();
  });

  it('should reject null payload', () => {
    const result = ConduitBatcher.execute(null as any);
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors?.some(e => e.includes('null'))).toBe(true);
  });

  it('should reject undefined payload', () => {
    const result = ConduitBatcher.execute(undefined as any);
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors?.some(e => e.includes('undefined'))).toBe(true);
  });

  it('should reject non-array payload', () => {
    const result = ConduitBatcher.execute('not an array' as any);
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors?.some(e => e.includes('array'))).toBe(true);
  });

  it('should reject array with null items', () => {
    const result = ConduitBatcher.execute([null] as any);
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors?.some(e => e.includes('null'))).toBe(true);
  });

  it('should reject array with undefined items', () => {
    const result = ConduitBatcher.execute([undefined] as any);
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors?.some(e => e.includes('undefined'))).toBe(true);
  });

  it('should reject array with non-object items', () => {
    const result = ConduitBatcher.execute(['not an object'] as any);
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors?.some(e => e.includes('must be an object'))).toBe(true);
  });

  it('should accept valid object array and not throw', () => {
    const validPayload = [{ method: 'create', params: { amount: 100 } }];
    const result = ConduitBatcher.execute(validPayload);
    expect(result.success).toBe(true);
    expect(result.operations).toBe(1);
  });

  it('should handle bigint fields safely in payload', () => {
    const payloadWithBigInt = [{ method: 'create', params: { amount: 100n } }];
    const result = ConduitBatcher.execute(payloadWithBigInt);
    expect(result.success).toBe(true);
    expect(result.operations).toBe(1);
  });

  it('should throw when trying to execute after destroy', () => {
    ConduitBatcher.destroy();
    expect(() => ConduitBatcher.execute([])).toThrow(/destroyed/i);
  });
});
