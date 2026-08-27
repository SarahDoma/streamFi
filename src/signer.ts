import { Keypair, Transaction } from '@stellar/stellar-sdk';

export interface Signer {
  /**
   * Sign a transaction. Implementations may either mutate `tx` in place and
   * return void, or return a new signed Transaction (the immutable-friendly
   * pattern). _signTx honours the return value when it is a Transaction
   * instance, falling back to the original `tx` for void/null returns.
   */
  sign(tx: Transaction): Transaction | void | Promise<Transaction | void>;
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

