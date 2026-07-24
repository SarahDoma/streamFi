import { describe, it, expect } from 'vitest';
import { FeeEstimator } from '../fee-estimator.js';

describe('FeeEstimator - Race condition and edge cases', () => {
  it('should gracefully handle 100+ rapid simultaneous requests without race conditions', async () => {
    const estimator = new FeeEstimator(100);
    
    // Simulate network latency and a fetcher
    let fetchCount = 0;
    const fetcher = async () => {
      fetchCount++;
      return new Promise<number>((resolve) => {
        setTimeout(() => resolve(150.123456789), 50); // Artificially introduce network latency
      });
    };

    // Trigger 150 rapid requests simultaneously
    const promises = [];
    for (let i = 0; i < 150; i++) {
      promises.push(estimator.estimateFee(fetcher));
    }

    const results = await Promise.all(promises);

    // Assert that the network fetch was only performed once due to the locking mechanism
    expect(fetchCount).toBe(1);

    // Assert that all returned values correctly parsed precision and floating math
    results.forEach(res => {
      expect(res).toBe(150.1234568); // rounded to 7 places
    });
    
    expect(estimator.getBaseFee()).toBe(150.1234568);
  });

  it('should execute the fallback sequence when network fails', async () => {
    const estimator = new FeeEstimator(100);
    
    const failingFetcher = async () => {
      throw new Error('Network error');
    };

    const fee = await estimator.estimateFee(failingFetcher);
    
    // Fallback should return the original base fee
    expect(fee).toBe(100);
  });
  
  it('should handle floating-point precision properly with invalid math', async () => {
    const estimator = new FeeEstimator(100);
    
    const badMathFetcher = async () => {
      return NaN; 
    };

    const fee = await estimator.estimateFee(badMathFetcher);
    // Boundary checks should catch this and fallback
    expect(fee).toBe(100);
  });

  it('should handle multiple sequential requests successfully', async () => {
    const estimator = new FeeEstimator(100);
    
    const fetcher1 = async () => 120.5;
    const fetcher2 = async () => 130.5;

    const fee1 = await estimator.estimateFee(fetcher1);
    expect(fee1).toBe(120.5);
    
    const fee2 = await estimator.estimateFee(fetcher2);
    expect(fee2).toBe(130.5);
  });
});
