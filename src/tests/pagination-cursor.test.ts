import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ConduitConfig } from '../types/index.js';

const mockStreamsBySender = vi.fn();
const mockStreamCount = vi.fn();
const mockStreamAddress = vi.fn().mockResolvedValue('CCWAMYJME27OHTPKVSV252YRPXEO4BSKBHVLQ7ML3OWYNMB5RQEVHSM');
const mockSimulate = vi.fn();

vi.mock('../factory.js', () => ({
  FactoryModule: class {
    streamAddress      = mockStreamAddress;
    streamsBySender    = mockStreamsBySender;
    streamsByRecipient = vi.fn();
    streamCount        = mockStreamCount;
  },
}));

vi.mock('@stellar/stellar-sdk', async () => {
  const actual = await vi.importActual<typeof import('@stellar/stellar-sdk')>('@stellar/stellar-sdk');
  return {
    ...actual,
    SorobanRpc: {
      ...actual.SorobanRpc,
      Server: class { simulateTransaction = mockSimulate; },
    },
  };
});

vi.mock('../soroban.js', async () => {
  const actual = await vi.importActual<typeof import('../soroban.js')>('../soroban.js');
  return { ...actual, buildContractCallTx: vi.fn().mockResolvedValue({ _stub: 'tx' }) };
});

function makeConfig(): ConduitConfig {
  return { network: 'testnet', factoryAddress: 'CCWAMYJME27OHTPKVSV252YRPXEO4BSKBHVLQ7ML3OWYNMB5RQEVHSM' };
}

describe('StreamsModule.list — cursor pagination', () => {
  beforeEach(async () => {
    mockStreamsBySender.mockReset().mockResolvedValue([]);
    mockStreamCount.mockReset().mockResolvedValue(0n);
    const { xdr } = await import('@stellar/stellar-sdk');
    mockSimulate.mockReset().mockResolvedValue({
      result: { retval: xdr.ScVal.scvMap([]) },
    });
  });

  it('decodes a cursor into the correct offset instead of ignoring it', async () => {
    const { StreamsModule } = await import('../streams.js');
    const sdk = new StreamsModule(makeConfig());

    const cursor = Buffer.from('40', 'utf8').toString('base64');

    await sdk.list({ sender: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN', cursor, limit: 20 });

    expect(mockStreamsBySender).toHaveBeenCalledWith(
      'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN', 40, 20,
    );
  });

  it('returns a nextCursor when there are more results', async () => {
    mockStreamsBySender.mockResolvedValue([1n, 2n, 3n]);
    mockStreamCount.mockResolvedValue(100n);

    const { StreamsModule } = await import('../streams.js');
    const sdk = new StreamsModule(makeConfig());

    const result = await sdk.list({ sender: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN', limit: 20 });

    expect(result.hasNextPage).toBe(true);
    expect(result.nextCursor).toBeDefined();
    expect(Buffer.from(result.nextCursor!, 'base64').toString('utf8')).toBe('20');
  });

  it('omits nextCursor on the last page', async () => {
    mockStreamsBySender.mockResolvedValue([1n]);
    mockStreamCount.mockResolvedValue(1n);

    const { StreamsModule } = await import('../streams.js');
    const sdk = new StreamsModule(makeConfig());

    const result = await sdk.list({ sender: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN' });

    expect(result.hasNextPage).toBe(false);
    expect(result.nextCursor).toBeUndefined();
  });

  it('cursor takes precedence over an explicit offset if both are somehow given', async () => {
    const { StreamsModule } = await import('../streams.js');
    const sdk = new StreamsModule(makeConfig());
    const cursor = Buffer.from('40', 'utf8').toString('base64');

    await sdk.list({ sender: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN', cursor, offset: 999 });

    expect(mockStreamsBySender).toHaveBeenCalledWith(
      'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN', 40, 20,
    );
  });

  it('throws a clear error for a malformed cursor instead of silently defaulting to page 1', async () => {
    const { StreamsModule } = await import('../streams.js');
    const sdk = new StreamsModule(makeConfig());

    await expect(
      sdk.list({ sender: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN', cursor: 'not-a-valid-cursor!!' })
    ).rejects.toThrow(/invalid cursor/i);
  });
});