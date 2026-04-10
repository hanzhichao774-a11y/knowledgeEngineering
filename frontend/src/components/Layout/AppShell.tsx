import type { ReactNode } from 'react';
import { Header } from './Header';
import { Footer } from './Footer';
import { ParticleBackground } from '../ParticleBackground';
import styles from './AppShell.module.css';

interface AppShellProps {
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
}

export function AppShell({ left, center, right }: AppShellProps) {
  return (
    <div className={styles.app}>
      <ParticleBackground />
      <Header />
      <div className={styles.main}>
        <div className={styles.leftPanel}>{left}</div>
        <div className={styles.centerPanel}>{center}</div>
        <div className={styles.rightPanel}>{right}</div>
      </div>
      <Footer />
    </div>
  );
}
