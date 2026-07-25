import { describe, it, expect } from 'vitest';
import { GraphSyncAgent } from '../graph-sync-agent.js';

describe('GraphSyncAgent - Race condition and fractional rounding', () => {
  it('should gracefully handle 100+ rapid simultaneous requests without race conditions', async () => {
    const agent = new GraphSyncAgent(0);
    
    // Simulate poor network conditions with latency and fractional updates
    // 0.1 added 150 times should be exactly 15.0 (without floating point errors)
    const fetcher = async () => {
      return new Promise<number>((resolve) => {
        setTimeout(() => resolve(0.1), 10);
      });
    };

    // Trigger 150 rapid requests simultaneously
    const promises = [];
    for (let i = 0; i < 150; i++) {
      promises.push(agent.syncState(fetcher));
    }

    const results = await Promise.all(promises);

    // Assert that each returned state is sequentially updated due to the locking mechanism
    const uniqueStates = new Set(results);
    expect(uniqueStates.size).toBe(150);
    
    // The final state should be exactly 15 without the usual JS floating point errors
    expect(agent.getCurrentState()).toBe(15);
  });

  it('should accurately account for fractional decimal rounding (e.g. 0.1 + 0.2 = 0.3)', async () => {
    const agent = new GraphSyncAgent(0.1);
    const fetcher = async () => 0.2;
    const result = await agent.syncState(fetcher);
    
    expect(result).toBe(0.3); // Normal JS math yields 0.30000000000000004 without proper rounding
  });

  it('should execute the fallback sequence when network fails with unhandled promise rejection', async () => {
    const agent = new GraphSyncAgent(10);
    
    const failingFetcher = async () => {
      throw new Error('Network timeout');
    };

    const state = await agent.syncState(failingFetcher);
    
    // Fallback should leave the state unchanged
    expect(state).toBe(10);
  });
  
  it('should handle invalid math gracefully', async () => {
    const agent = new GraphSyncAgent(5);
    
    const badMathFetcher = async () => {
      return NaN; 
    };

    const state = await agent.syncState(badMathFetcher);
    // Boundary checks should catch this and fallback to 5
    expect(state).toBe(5);
  });
});
