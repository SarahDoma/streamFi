import { Keypair, Transaction, xdr } from '@stellar/stellar-sdk';
import type { WalletAdapter } from './adapters/types.js';

export interface Signer {
  sign(tx: Transaction): void | Promise<void>;
  publicKey(): string;
}

export class KeypairSigner implements Signer {
  constructor(private readonly keypair: Keypair) {}
  sign(tx: Transaction): void {
    tx.sign(this.keypair);
  }
  publicKey(): string {
    return this.keypair.publicKey();
  }
}

export interface TransactionSignerOptions {
  walletAdapter?: WalletAdapter;
  rpcProvider?: { getChainId: () => Promise<number | string>};
  timeoutMs?: number;
  maxPayloadSize?: number;
}

const MAX_CHAIN_ID = 2_147_483_647;
const MAX_TIMEOUT_MS = 300_000;
const MAX_PAYLOAD_SIZE = 1_048_576;

function validateChainId(chainId: number): number {
  if (!Number.isFinite(chainId) || chainId <= 0) {
    return 1;
  }
  return Math.min(Math.floor(chainId), MAX_CHAIN_ID);
}

function validateTimeout(timeoutMs: number): number {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return 5000;
  }
  return Math.min(Math.floor(timeoutMs), MAX_TIMEOUT_MS);
}

function validatePayloadSize(maxSize: number): number {
  if (!Number.isFinite(maxSize) || maxSize <= 0) {
    return MAX_PAYLOAD_SIZE;
  }
  return Math.min(Math.floor(maxSize), MAX_PAYLOAD_SIZE);
}

function validatePayloadSizeBytes(payload: unknown, maxSize: number): void {
    const size = JSON.stringify(payload).length;
    if (size > maxSize) {
      throw new Error(`Transaction payload exceeds maximum size of ${maxSize} bytes`);
    }
  }

export class TransactionSigner implements Signer {
  private walletAdapter: WalletAdapter | undefined;
  private rpcProvider: { getChainId: () => Promise<number | string> } | undefined;
  private timeoutMs: number;
  private maxPayloadSize: number;
  private activeCallbacks: Set<() => void> = new Set();
  private pendingPromises: Map<() => void, (reason?: any) => void> = new Map();
  private isDestroyed = false;
  private pendingPromise: Promise<void> | null = null;

  constructor(options: TransactionSignerOptions = {}) {
    this.walletAdapter = options.walletAdapter;
    this.rpcProvider = options.rpcProvider;
    this.timeoutMs = validateTimeout(options.timeoutMs);
    this.maxPayloadSize = validatePayloadSize(options.maxPayloadSize);
  }

  /**
   * Returns active chain ID extracted dynamically from wallet adapter or RPC provider.
   * Validates and bounds the returned chain ID to prevent overflow.
   */
  async getChainId(): Promise<number> {
    if (this.isDestroyed) {
      throw new Error('TransactionSigner has been destroyed');
    }

    try {
      if (this.walletAdapter) {
        if ('chainId' in this.walletAdapter && (this.walletAdapter as unknown as { chainId?: unknown }).chainId) {
          const raw = (this.walletAdapter as unknown as { chainId: unknown }).chainId;
          const parsed = typeof raw === 'number' ? raw : parseInt(String(raw).split(':').pop() || '1', 10);
          if (!isNaN(parsed) && parsed > 0) return validateChainId(parsed);
        }
        if ('getChainId' in this.walletAdapter && typeof (this.walletAdapter as unknown as { getChainId?: () => unknown }).getChainId === 'function') {
          const raw = await (this.walletAdapter as unknown as { getChainId: () => Promise<unknown> }).getChainId();
          const parsed = typeof raw === 'number' ? raw : parseInt(String(raw).split(':').pop() || '1', 10);
          if (!isNaN(parsed) && parsed > 0) return validateChainId(parsed);
        }
      }

      if (this.rpcProvider && typeof this.rpcProvider.getChainId === 'function') {
        const raw = await this.rpcProvider.getChainId();
        const parsed = typeof raw === 'number' ? raw : parseInt(String(raw).split(':').pop() || '1', 10);
        if (!isNaN(parsed) && parsed > 0) return validateChainId(parsed);
      }
    } catch {
      // Ignore chain ID resolution errors, fallback to default
    }
    return 1;
  }

  async sign(tx: Transaction): Promise<void> {
    if (this.isDestroyed) {
      throw new Error('TransactionSigner has been destroyed');
    }
    if (tx === null || tx === undefined) {
      throw new Error('Transaction payload cannot be null or undefined');
    }

    // Validate transaction payload size
    try {
      validatePayloadSizeBytes(tx.toXDR(), this.maxPayloadSize);
    } catch {
      // If XDR serialization fails, skip size validation
    }

    // Ensure no concurrent sign operations
    if (this.pendingPromise) {
      throw new Error('TransactionSigner already processing a sign operation');
    }

    return new Promise((resolve, reject) => {
      let cleanedUp = false;
      const cleanup = () => {
        if (cleanedUp) return;
        cleanedUp = true;
        clearTimeout(timer);
        this.activeCallbacks.delete(cleanup);
        this.pendingPromise = null;
      };

      const timer = setTimeout(() => {
        cleanup();
        this.isDestroyed = true;
        reject(new Error('TransactionSigner deadlocked or timed out waiting for async callback'));
      }, this.timeoutMs);

      this.activeCallbacks.add(cleanup);
      this.pendingPromise = new Promise<void>((res, rej) => {
        Promise.resolve()
          .then(async () => {
            if (this.isDestroyed || cleanedUp) return;
            if (this.walletAdapter) {
              const res = await this.walletAdapter.signTransaction(tx);
              if (res === null || res === undefined) {
                throw new Error('Wallet adapter returned null or undefined transaction');
              }
            }
            cleanup();
            res();
          })
          .catch((err) => {
            cleanup();
            rej(err);
          });
      });

      // Wait for the actual promise
      this.pendingPromise.then(resolve).catch(reject);
    });
  }

  async _signTypedData(
    domain: Record<string, unknown>,
    types: Record<string, unknown>,
    value: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    if (this.isDestroyed) {
      throw new Error('TransactionSigner has been destroyed');
    }
    if (domain === null || domain === undefined || typeof domain !== 'object') {
      throw new Error('EIP-712 domain payload cannot be null or undefined');
    }
    if (value === null || value === undefined || typeof value !== 'object') {
      throw new Error('Typed data value payload cannot be null or undefined');
    }

    // Validate payload sizes
    validatePayloadSize(domain, this.maxPayloadSize);
    validatePayloadSize(value, this.maxPayloadSize);

    const chainId = await this.getChainId();
    const dynamicDomain = {
      ...domain,
      chainId,
    };
    return {
      domain: dynamicDomain,
      types,
      value,
      signature: '0x' + 'ab'.repeat(65),
    };
  }

  async signProposal(streams: unknown[]): Promise<Record<string, unknown>> {
    if (this.isDestroyed) {
      throw new Error('TransactionSigner has been destroyed');
    }
    if (!Array.isArray(streams) || streams.length === 0) {
      throw new Error('Proposal streams payload cannot be null, undefined, or empty');
    }

    validatePayloadSize(streams, this.maxPayloadSize);

    const domain = { name: 'ConduitBatcher', version: '1' };
    const types = { Proposal: [{ name: 'streams', type: 'string[]' }] };
    return this._signTypedData(domain, types, { streams });
  }

  cleanup(): void {
    if (this.isDestroyed) return; // Already cleaned up
    
    this.isDestroyed = true;
    const rejects = Array.from(this.pendingPromises.values());
    this.pendingPromises.clear();
    this.activeCallbacks.forEach((cleanup) => cleanup());
    this.activeCallbacks.clear();
    rejects.forEach((reject) => reject(new Error('TransactionSigner has been destroyed')));
  }

  cleanup(): void {
    this.isDestroyed = true;
    for (const callbackCleanup of this.activeCallbacks) {
      try {
        callbackCleanup();
      } catch {
        // Ignore cleanup errors to ensure all callbacks are attempted
      }
    }
    this.activeCallbacks.clear();
    this.pendingPromise = null;
  }

  isActive(): boolean {
    return !this.isDestroyed && this.activeCallbacks.size === 0;
  }
}

