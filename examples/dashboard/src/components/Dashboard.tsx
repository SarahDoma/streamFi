import React from 'react';
import styles from './Dashboard.module.css';

interface DashboardProps {
  className?: string;
}

export const Dashboard: React.FC<DashboardProps> = ({ className }) => {
  return (
    <div className={`${styles.dashboard} ${className || ''}`}>
      <header className={styles.header}>
        <h1 className={styles.title}>StreamFi Dashboard</h1>
        <div className={styles.headerActions}>
          <button className={styles.button}>New Stream</button>
          <button className={styles.buttonSecondary}>Settings</button>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.statsSection}>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Active Streams</span>
            <span className={styles.statValue}>12</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Total Volume</span>
            <span className={styles.statValue}>$45,230</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Pending</span>
            <span className={styles.statValue}>3</span>
          </div>
        </section>

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
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>#001</td>
                    <td>addr1...xyz</td>
                    <td>10 XLM/hr</td>
                    <td><span className={styles.badgeActive}>Active</span></td>
                  </tr>
                  <tr>
                    <td>#002</td>
                    <td>addr2...abc</td>
                    <td>5 XLM/hr</td>
                    <td><span className={styles.badgePaused}>Paused</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <aside className={styles.sidebar}>
            <div className={styles.sidebarCard}>
              <h3>Quick Actions</h3>
              <button className={styles.button}>Create Stream</button>
              <button className={styles.button}>Withdraw</button>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
};
