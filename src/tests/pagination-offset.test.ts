import { describe, it, expect, vi } from 'vitest';
import { Keypair, Account, StrKey } from '@stellar/stellar-sdk';

const mockGetAccount = vi.fn();
const mockSimulate    = vi.fn();

vi.mock('@stellar/stellar-sdk', async () => {
  const actual = await vi.importActual<typeof import('@stellar/stellar-sdk')>('@stellar/stellar-sdk');
  return {
    ...actual,
    SorobanRpc: {
      ...actual.SorobanRpc,
      Server: vi.fn().mockImplementation(function MockServer() {
        return {
          getAccount: mockGetAccount,
          simulateTransaction: mockSimulate,
        };
      }),
    },
  };
});

import { FactoryModule } from '../factory.js';

describe('FactoryModule.streamsBySender — real buildContractCallTx integration', () => {
  it('bakes the given nonzero offset into the actual built transaction, not 0', async () => {
    const kp = Keypair.random();
    mockGetAccount.mockResolvedValue(new Account(kp.publicKey(), '100'));

    // Capture the transaction passed to simulateTransaction so we can
    // inspect exactly what FactoryModule + buildContractCallTx produced.
    let capturedTx: any;
    mockSimulate.mockImplementation(async (tx: any) => {
      capturedTx = tx;
      const { xdr } = await import('@stellar/stellar-sdk');
      return { result: { retval: xdr.ScVal.scvVec([]) } };
    });

    const contractId = StrKey.encodeContract(Buffer.alloc(32, 1));
    const factory = new FactoryModule({
      network: 'testnet',
      factoryAddress: contractId,
      keypair: kp,
    });

    await factory.streamsBySender(kp.publicKey(), 40, 20);

    const op = capturedTx.operations[0];
    const hostFnArgs = op.func.invokeContract().args();

    // args are [Address, offset, limit] per factory.ts
    const encodedOffset = hostFnArgs[1].u32();
    const encodedLimit  = hostFnArgs[2].u32();

    expect(encodedOffset).toBe(40);
    expect(encodedLimit).toBe(20);
  });
});