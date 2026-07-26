import React, { useState } from 'react';
import { Dashboard } from './components/Dashboard';
import { useNetworkSwitch } from './hooks/useNetworkSwitch';

/**
 * The three network environments the Conduit SDK supports.
 * Kept in sync with `SUPPORTED_NETWORKS` in `src/errors.ts`.
 */
type Network = 'mainnet' | 'testnet' | 'local';

const NETWORKS: Network[] = ['mainnet', 'testnet', 'local'];

/**
 * Root application component.
 *
 * Owns the active network selection and passes it down to child components.
 * `useNetworkSwitch` ensures the Apollo cache is fully evicted and all active
 * queries are re-fetched whenever the user switches networks, so the Network
 * Switcher never shows stale data from the previous network (fixes #156).
 */
function AppContent({ network }: { network: Network }) {
  useNetworkSwitch(network);
  return <Dashboard network={network} />;
}

function App() {
  const [network, setNetwork] = useState<Network>('testnet');

  return (
    <div className="app">
      <AppContent network={network} />
      {/* Network Switcher — exposed at app level so it is always reachable */}
      <div className="network-switcher" aria-label="Network switcher">
        {NETWORKS.map((n) => (
          <button
            key={n}
            onClick={() => setNetwork(n)}
            aria-pressed={network === n}
            className={network === n ? 'network-btn network-btn--active' : 'network-btn'}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

export default App;
