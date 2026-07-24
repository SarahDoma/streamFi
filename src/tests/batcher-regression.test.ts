import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConduitBatcher, type BatchOperation } from '../builder.js';

describe('ConduitBatcher Regression — Payload Boundary & Null Guards', () => {
  beforeEach(() => {
    ConduitBatcher.reset();
  });

  it('returns error result for null payload', () => {
    const result = ConduitBatcher.execute(null as unknown as Record<string, unknown>[]);
    expect(result.success).toBe(false);
    expect(result.errors).toContain('Batch payload cannot be null or undefined');
  });

  it('returns error result for undefined payload', () => {
    const result = ConduitBatcher.execute(undefined as unknown as Record<string, unknown>[]);
    expect(result.success).toBe(false);
    expect(result.errors).toContain('Batch payload cannot be null or undefined');
  });

  it('returns error result for non-array payload', () => {
    const result = ConduitBatcher.execute({} as unknown as Record<string, unknown>[]);
    expect(result.success).toBe(false);
    expect(result.errors).toContain('Batch payload must be an array');
  });

  it('returns error result for array containing null items', () => {
    const result = ConduitBatcher.execute([null as unknown as Record<string, unknown>]);
    expect(result.success).toBe(false);
    expect(result.errors![0]).toContain('cannot be null or undefined');
  });

  it('returns error result for array containing non-object items', () => {
    const result = ConduitBatcher.execute(['string' as unknown as Record<string, unknown>]);
    expect(result.success).toBe(false);
    expect(result.errors![0]).toContain('must be an object');
  });

  it('valid empty array returns success with zero operations', () => {
    const result = ConduitBatcher.execute([]);
    expect(result.success).toBe(true);
    expect(result.operations).toBe(0);
  });

  it('valid payload returns success with correct operation count', () => {
    const result = ConduitBatcher.execute([
      { method: 'create', params: { token: 'CD1' } },
      { method: 'withdraw', params: { streamId: 1n } },
    ]);
    expect(result.success).toBe(true);
    expect(result.operations).toBe(2);
  });
});

describe('ConduitBatcher Regression — Async Lifecycle & Cleanup', () => {
  beforeEach(() => {
    ConduitBatcher.reset();
  });

  it('executeAsync resolves successfully with valid operations', async () => {
    const result = await ConduitBatcher.executeAsync([
      { method: 'create', params: { token: 'CD1', amount: 100n } },
    ]);
    expect(result.success).toBe(true);
    expect(result.operations).toBe(1);
  });

  it('executeAsync returns error for null operations', async () => {
    const result = await ConduitBatcher.executeAsync(null as unknown as BatchOperation[]);
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('executeAsync accepts abort signal and cancels', async () => {
    const ac = new AbortController();
    ac.abort();
    const result = await ConduitBatcher.executeAsync(
      [{ method: 'create', params: { token: 'CD1' } }],
      ac.signal,
    );
    expect(result.success).toBe(false);
    expect(result.errors).toContain('Operation aborted');
  });

  it('throws when execute is called after destroy', () => {
    ConduitBatcher.destroy();
    expect(() => ConduitBatcher.execute([{ token: 'CD1' }])).toThrow(
      'ConduitBatcher has been destroyed',
    );
  });

  it('executeAsync rejects after destroy', async () => {
    ConduitBatcher.destroy();
    await expect(ConduitBatcher.executeAsync([
      { method: 'create', params: { token: 'CD1' } },
    ])).rejects.toThrow('ConduitBatcher has been destroyed');
  });

  it('queues multiple executeAsync calls and processes them sequentially', async () => {
    const results = await Promise.all([
      ConduitBatcher.executeAsync([{ method: 'op1', params: { id: 1 } }]),
      ConduitBatcher.executeAsync([{ method: 'op2', params: { id: 2 } }]),
      ConduitBatcher.executeAsync([{ method: 'op3', params: { id: 3 } }]),
    ]);
    expect(results).toHaveLength(3);
    for (const r of results) {
      expect(r.success).toBe(true);
      expect(r.operations).toBe(1);
    }
  });
});

describe('ConduitBatcher Regression — Malformed RPC JSON Payloads', () => {
  beforeEach(() => {
    ConduitBatcher.reset();
  });

  it('handles deeply nested bigint values', () => {
    const result = ConduitBatcher.execute([
      {
        id: 1,
        metadata: { nested: { value: 9007199254740993n } },
      },
    ]);
    expect(result.success).toBe(true);
    expect(result.operations).toBe(1);
  });

  it('handles mixed type arrays gracefully', () => {
    const result = ConduitBatcher.execute([
      { a: 1n, b: 'hello', c: true, d: null, e: { f: 2n } },
    ] as Record<string, unknown>[]);
    expect(result.success).toBe(true);
    expect(result.operations).toBe(1);
  });

  it('rejects completely invalid input types', () => {
    expect(ConduitBatcher.execute(123 as unknown as Record<string, unknown>[]).success).toBe(false);
    expect(ConduitBatcher.execute('bad' as unknown as Record<string, unknown>[]).success).toBe(false);
    expect(ConduitBatcher.execute(true as unknown as Record<string, unknown>[]).success).toBe(false);
  });

  it('handles payload with symbols (will not JSON.stringify cleanly)', () => {
    const sym = Symbol('test');
    const result = ConduitBatcher.execute([
      { key: sym as unknown as string, token: 'CD1' },
    ]);
    expect(result.success).toBe(true);
    expect(result.operations).toBe(1);
  });

  it('handles rapid state changes without error', async () => {
    const promises = [];
    for (let i = 0; i < 50; i++) {
      promises.push(
        ConduitBatcher.executeAsync([{ method: 'rapid', params: { index: i } }]),
      );
    }
    const results = await Promise.all(promises);
    expect(results).toHaveLength(50);
    for (const r of results) {
      expect(r.success).toBe(true);
    }
  });
});