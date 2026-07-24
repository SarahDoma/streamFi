export class FeeEstimator {
  private baseFee: number;
  private isEstimating: boolean = false;
  private currentPromise: Promise<number> | null = null;
  
  constructor(initialFee: number = 100) {
    this.baseFee = initialFee;
  }

  /**
   * Safely estimates the fee by fetching it asynchronously.
   * Utilizes an atomic state transition / locking mechanism to prevent race conditions 
   * when multiple async hooks fire simultaneously.
   */
  async estimateFee(networkFetcher: () => Promise<number>): Promise<number> {
    if (this.currentPromise) {
      return this.currentPromise;
    }

    this.currentPromise = (async () => {
      try {
        this.isEstimating = true;
        const rawFee = await networkFetcher();
        
        // Ensure floating point math precision and error-boundary handler
        if (typeof rawFee !== 'number' || !Number.isFinite(rawFee) || rawFee < 0) {
            throw new Error("Invalid network fee response");
        }
        
        // Round to 7 decimal places for precision handling
        this.baseFee = Math.round(rawFee * 10000000) / 10000000;
        return this.baseFee;
      } catch (error) {
        // Fallback sequence: return the last known base fee
        return this.baseFee;
      } finally {
        this.isEstimating = false;
        this.currentPromise = null;
      }
    })();

    return this.currentPromise;
  }

  // Exposed for testing internal state
  get _isEstimating(): boolean {
    return this.isEstimating;
  }

  getBaseFee(): number {
    return this.baseFee;
  }
}
