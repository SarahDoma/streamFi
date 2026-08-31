/**
 * Unit tests for parseStreamInfo (exercised via StreamsModule.get()).
 *
 * parseStreamInfo is private; we drive it through get() by controlling the
 * simulated ScVal map returned for the 'info' contract call.
 *
 * Regression coverage for #521: stream.paused must be true when the contract
 * returns scvBool(true) for the 'paused' key — not silently collapsed to false
 * by a missing key-presence guard.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Address, Keypair, StrKey, xdr } from '@stellar/stellar-sdk';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const { mockStreamAddress, mockSimulate } = vi.hoisted(() => ({
  mockStreamAddress: vi.fn(),
  mockSimulate:      vi.fn(),
}));

vi.mock('../factory.js', () => ({
  FactoryModule: class {
    streamAddress = mockStreamAddress;
  },
}));

vi.mock('../soroban.js', async () => {
  const actual = await vi.importActual<typeof import('../soroban.js')>('../soroban.js');
  return {
    ...actual,
    buildContractCallTx: vi.fn().mockResolvedValue({ _stub: 'tx' }),
    catchNetworkError:   <T>(_label: string, promise: Promise<T>) => promise,
  };
});

vi.mock('@stellar/stellar-sdk', async () => {
  const actual = await vi.importActual<typeof import('@stellar/stellar-sdk')>('@stellar/stellar-sdk');
  return {
    ...actual,
    SorobanRpc: {
      ...actual.SorobanRpc,
      Server: class {
        simulateTransaction = mockSimulate;
      },
      assembleTransaction: vi.fn(),
    },
  };
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const FACTORY_ADDR = StrKey.encodeContract(Buffer.alloc(32, 1));
const STREAM_ADDR  = StrKey.encodeContract(Buffer.alloc(32, 2));
const TOKEN_ADDR   = StrKey.encodeContract(Buffer.alloc(32, 3));
const SENDER       = Keypair.random().publicKey();
const RECIPIENT    = Keypair.random().publicKey();

/** Build an xdr.ScVal scvMap from a plain object of key → ScVal. */
function scvMap(entries: Record<string, xdr.ScVal>): xdr.ScVal {
  return xdr.ScVal.scvMap(
    Object.entries(entries).map(
      ([k, v]) => new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol(k), val: v }),
    ),
  );
}

function u64Scv(n: bigint): xdr.ScVal {
  return xdr.ScVal.scvU64(xdr.Uint64.fromString(n.toString()));
}

function i128Scv(n: bigint): xdr.ScVal {
  const lo = n & 0xffffffffffffffffn;
  const hi = n >> 64n;
  return xdr.ScVal.scvI128(
    new xdr.Int128Parts({
      hi: xdr.Int64.fromString(hi.toString()),
      lo: xdr.Uint64.fromString(lo.toString()),
    }),
  );
}

function simSuccess(retval: xdr.ScVal) {
  return { result: { retval }, transactionData: {} };
}

/** Minimal valid stream map with all required fields. Extra fields can be spread in. */
function baseStreamMap(extra: Record<string, xdr.ScVal> = {}): xdr.ScVal {
  return scvMap({
    sender:           new Address(SENDER).toScVal(),
    recipient:        new Address(RECIPIENT).toScVal(),
    token:            new Address(TOKEN_ADDR).toScVal(),
    rate_per_second:  i128Scv(100n),
    start_time:       u64Scv(1_000_000n),
    end_time:         u64Scv(1_004_000n),
    withdrawn:        i128Scv(0n),
    paused:           xdr.ScVal.scvBool(false),
    paused_at:        u64Scv(0n),
    cancelled:        xdr.ScVal.scvBool(false),
    clawback_enabled: xdr.ScVal.scvBool(false),
    ...extra,
  });
}

beforeEach(() => {
  mockStreamAddress.mockReset().mockResolvedValue(STREAM_ADDR);
  mockSimulate.mockReset();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('parseStreamInfo — paused flag (#521)', () => {
  it('sets paused=false when contract returns scvBool(false)', async () => {
    mockSimulate.mockResolvedValue(simSuccess(baseStreamMap({ paused: xdr.ScVal.scvBool(false) })));
    const { StreamsModule } = await import('../streams.js');
    const sdk = new StreamsModule({ network: 'testnet', factoryAddress: FACTORY_ADDR, keypair: Keypair.random() });

    const info = await sdk.get(1n);
    expect(info.paused).toBe(false);
  });

  it('sets paused=true when contract returns scvBool(true) (#521)', async () => {
    const pausedAt = 1_002_000n;
    mockSimulate.mockResolvedValue(simSuccess(baseStreamMap({
      paused:    xdr.ScVal.scvBool(true),
      paused_at: u64Scv(pausedAt),
    })));
    const { StreamsModule } = await import('../streams.js');
    const sdk = new StreamsModule({ network: 'testnet', factoryAddress: FACTORY_ADDR, keypair: Keypair.random() });

    const info = await sdk.get(1n);
    expect(info.paused).toBe(true);
    expect(info.pausedAt).toBe(Number(pausedAt));
  });

  it('defaults paused=false when key is absent from map', async () => {
    // Build a map without the 'paused' key at all
    const { paused: _omit, ...rest } = {
      sender:           new Address(SENDER).toScVal(),
      recipient:        new Address(RECIPIENT).toScVal(),
      token:            new Address(TOKEN_ADDR).toScVal(),
      rate_per_second:  i128Scv(100n),
      start_time:       u64Scv(1_000_000n),
      end_time:         u64Scv(1_004_000n),
      withdrawn:        i128Scv(0n),
      paused:           xdr.ScVal.scvBool(false), // will be omitted
      paused_at:        u64Scv(0n),
      cancelled:        xdr.ScVal.scvBool(false),
      clawback_enabled: xdr.ScVal.scvBool(false),
    };
    mockSimulate.mockResolvedValue(simSuccess(scvMap(rest)));
    const { StreamsModule } = await import('../streams.js');
    const sdk = new StreamsModule({ network: 'testnet', factoryAddress: FACTORY_ADDR, keypair: Keypair.random() });

    const info = await sdk.get(1n);
    expect(info.paused).toBe(false);
  });

  it('sets cancelled=true when contract returns scvBool(true)', async () => {
    mockSimulate.mockResolvedValue(simSuccess(baseStreamMap({ cancelled: xdr.ScVal.scvBool(true) })));
    const { StreamsModule } = await import('../streams.js');
    const sdk = new StreamsModule({ network: 'testnet', factoryAddress: FACTORY_ADDR, keypair: Keypair.random() });

    const info = await sdk.get(1n);
    expect(info.cancelled).toBe(true);
  });

  it('sets clawbackEnabled=true when contract returns scvBool(true)', async () => {
    mockSimulate.mockResolvedValue(simSuccess(baseStreamMap({ clawback_enabled: xdr.ScVal.scvBool(true) })));
    const { StreamsModule } = await import('../streams.js');
    const sdk = new StreamsModule({ network: 'testnet', factoryAddress: FACTORY_ADDR, keypair: Keypair.random() });

    const info = await sdk.get(1n);
    expect(info.clawbackEnabled).toBe(true);
  });
});
