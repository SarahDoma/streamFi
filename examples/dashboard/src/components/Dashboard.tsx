import React from 'react';
import styles from './Dashboard.module.css';
import {
  useDashboardStats,
  useRecentStreams,
  useWithdrawStream,
} from '../hooks/useDashboardData';

interface DashboardProps {
  className?: string;
  walletAddress?: string;
  /** Currently active network. Changes to this prop trigger a full Apollo
   *  cache reset via useNetworkSwitch (fixes #156). */
  network?: string;
}

export const Dashboard: React.FC<DashboardProps> = ({ className, walletAddress = '', network: _network }) => {
  const { data: statsData, loading: statsLoading, error: statsError } = useDashboardStats(walletAddress);
  const { data: streamsData, loading: streamsLoading, error: streamsError, refetch } = useRecentStreams(walletAddress);
  const { withdraw, loading: withdrawLoading } = useWithdrawStream(walletAddress);

  const stats = statsData?.dashboardStats;
  const streams = streamsData?.streams ?? [];

  const handleWithdraw = async (streamId: string) => {
    try {
      await withdraw({ variables: { streamId } });
    } catch {
      // Error handled by Apollo error state; refetch ensures cache stays fresh
    }
  };

  const handleRefresh = () => {
    refetch();
  };

  return (
    <div className={`${styles.dashboard} ${className || ''}`}>
      <header className={styles.header}>
        <h1 className={styles.title}>StreamFi Dashboard</h1>
        <div className={styles.headerActions}>
          <button className={styles.buttonSecondary} onClick={handleRefresh} disabled={streamsLoading}>
            {streamsLoading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button className={styles.button}>New Stream</button>
          <button className={styles.buttonSecondary}>Settings</button>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.statsSection}>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Active Streams</span>
            <span className={styles.statValue}>
              {statsLoading ? '...' : statsError ? '--' : stats?.activeStreams ?? 0}
            </span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Total Volume</span>
            <span className={styles.statValue}>
              {statsLoading ? '...' : statsError ? '--' : `$${stats?.totalVolume ?? '0'}`}
            </span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Pending</span>
            <span className={styles.statValue}>
              {statsLoading ? '...' : statsError ? '--' : stats?.pendingStreams ?? 0}
            </span>
          </div>
        </section>

        {(statsError || streamsError) && (
          <div className={styles.errorBanner}>
            Failed to load data.{' '}
            <button onClick={handleRefresh} className={styles.retryButton}>
              Retry
            </button>
          </div>
        )}

        <section className={styles.contentSection}>
          <div className={styles.tableContainer}>
            <h2 className={styles.sectionTitle}>Recent Streams</h2>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Stream ID</th>
                    <th>Recipient</th>
                    <th>Rate</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {streamsLoading ? (
                    <tr>
                      <td colSpan={5} className={styles.loadingCell}>Loading streams...</td>
                    </tr>
                  ) : streams.length === 0 ? (
                    <tr>
                      <td colSpan={5} className={styles.loadingCell}>No streams found</td>
                    </tr>
                  ) : (
                    streams.map((stream) => (
                      <tr key={stream.id}>
                        <td>#{stream.streamId}</td>
                        <td>{stream.recipient.length > 12
                          ? `${stream.recipient.slice(0, 6)}...${stream.recipient.slice(-4)}`
                          : stream.recipient}
                        </td>
                        <td>{stream.ratePerSecond} stroops/s</td>
                        <td>
                          <span className={
                            stream.status === 'ACTIVE' ? styles.badgeActive : styles.badgePaused
                          }>
                            {stream.status}
                          </span>
                        </td>
                        <td>
                          <button
                            className={styles.buttonSmall}
                            onClick={() => handleWithdraw(stream.id)}
                            disabled={withdrawLoading}
                          >
                            Withdraw
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <aside className={styles.sidebar}>
            <div className={styles.sidebarCard}>
              <h3>Quick Actions</h3>
              <button className={styles.button}>Create Stream</button>
              <button className={styles.button} onClick={handleRefresh} disabled={streamsLoading}>
                Withdraw
              </button>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
};
