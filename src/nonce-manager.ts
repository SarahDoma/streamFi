export class NonceManager {
  private currentNonce: number;
  private updateQueue: Promise<void> = Promise.resolve();
  
  constructor(initialNonce: number = 0) {
    this.currentNonce = initialNonce;
  }

  /**
   * Safely fetches and manages the next nonce asynchronously.
   * Utilizes an atomic state transition / strict locking mechanism to prevent race conditions 
   * and unhandled promise rejections under poor network conditions.
   */
  async getNextNonce(networkFetcher: () => Promise<number>): Promise<number> {
    return new Promise((resolve) => {
      this.updateQueue = this.updateQueue.then(async () => {
        try {
          const rawResponse = await networkFetcher();
          
          // Proper error-boundary handling
          if (typeof rawResponse !== 'number' || !Number.isFinite(rawResponse) || rawResponse < 0) {
              throw new Error("Invalid network response");
          }
          
          // Proper floating-point precision handling
          const validatedNonce = Math.round(rawResponse * 100000) / 100000;
          const intNonce = Math.floor(validatedNonce);
          
          if (intNonce > this.currentNonce) {
            this.currentNonce = intNonce;
          } else {
            this.currentNonce++;
          }
          
          resolve(this.currentNonce);
        } catch (error) {
          // Fallback sequence: execute graceful degradation by incrementing local nonce
          this.currentNonce++;
          resolve(this.currentNonce);
        }
      });
    });
  }

  getCurrentNonce(): number {
    return this.currentNonce;
  }
}
