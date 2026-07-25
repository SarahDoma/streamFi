export class GraphSyncAgent {
  private currentState: number;
  private updateQueue: Promise<void> = Promise.resolve();
  
  constructor(initialState: number = 0) {
    this.currentState = initialState;
  }

  /**
   * Safely synchronizes state with fractional updates from the network.
   * Utilizes an atomic state transition / strict locking mechanism to prevent race conditions 
   * and unhandled promise rejections under poor network conditions.
   */
  async syncState(networkFetcher: () => Promise<number>): Promise<number> {
    return new Promise((resolve) => {
      this.updateQueue = this.updateQueue.then(async () => {
        try {
          const rawDelta = await networkFetcher();
          
          // Proper error-boundary handling
          if (typeof rawDelta !== 'number' || !Number.isFinite(rawDelta)) {
              throw new Error("Invalid network delta response");
          }
          
          // Proper fractional decimal rounding to handle floating point impurities (e.g. 0.1 + 0.2 = 0.30000000000000004)
          // Scale to 8 decimal places to safely add fractional amounts
          const scale = 100000000;
          const scaledState = Math.round(this.currentState * scale);
          const scaledDelta = Math.round(rawDelta * scale);
          
          this.currentState = (scaledState + scaledDelta) / scale;
          
          resolve(this.currentState);
        } catch (error) {
          // Fallback sequence: execute graceful degradation by returning the unmodified state
          resolve(this.currentState);
        }
      });
    });
  }

  getCurrentState(): number {
    return this.currentState;
  }
}
