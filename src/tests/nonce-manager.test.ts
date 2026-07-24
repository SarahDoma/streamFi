import { describe, it, expect } from 'vitest';
import { NonceManager } from '../nonce-manager.js';

describe('NonceManager - Race condition and edge cases', () => {
  it('should gracefully handle 100+ rapid simultaneous requests without race conditions', async () => {
    const manager = new NonceManager(0);
    
    // Simulate poor network conditions with latency and arbitrary nonces
    const fetcher = async () => {
      return new Promise<number>((resolve) => {
        setTimeout(() => resolve(0), 10); // always returns 0 to force local increment
      });
    };

    // Trigger 150 rapid requests simultaneously
    const promises = [];
    for (let i = 0; i < 150; i++) {
      promises.push(manager.getNextNonce(fetcher));
    }

    const results = await Promise.all(promises);

    // Assert that each returned nonce is unique and sequentially ordered due to the locking mechanism
    const uniqueNonces = new Set(results);
    expect(uniqueNonces.size).toBe(150);
    
    // Nonces should go from 1 to 150
    expect(Math.max(...results)).toBe(150);
    expect(manager.getCurrentNonce()).toBe(150);
  });

  it('should execute the fallback sequence when network fails with unhandled promise rejection', async () => {
    const manager = new NonceManager(10);
    
    const failingFetcher = async () => {
      throw new Error('Network timeout');
    };

    const nonce = await manager.getNextNonce(failingFetcher);
    
    // Fallback should increment the last known base nonce
    expect(nonce).toBe(11);
  });
  
  it('should handle floating-point precision properly with invalid math', async () => {
    const manager = new NonceManager(5);
    
    const badMathFetcher = async () => {
      return NaN; 
    };

    const nonce = await manager.getNextNonce(badMathFetcher);
    // Boundary checks should catch this and fallback to 6
    expect(nonce).toBe(6);
  });

  it('should successfully pick up a higher network nonce', async () => {
    const manager = new NonceManager(10);
    
    const fetcher1 = async () => 20.99999;

    const nonce1 = await manager.getNextNonce(fetcher1);
    expect(nonce1).toBe(20);
    
    // Fallback or increment if the next fetcher returns something smaller
    const fetcher2 = async () => 10;
    const nonce2 = await manager.getNextNonce(fetcher2);
    expect(nonce2).toBe(21);
  });
});
