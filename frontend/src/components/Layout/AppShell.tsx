import type { ReactNode } from 'react';
import { Header } from './Header';
import { Footer } from './Footer';
import { ParticleBackground } from '../ParticleBackground';
import { useChatStore } from '../../store/chatStore';
import { useTaskStore } from '../../store/taskStore';
import styles from './AppShell.module.css';

interface AppShellProps {
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
}

export function AppShell({ left, center, right }: AppShellProps) {
  const hasMessages = useChatStore((s) => s.messages.length > 0);
  const hasRunning = useTaskStore((s) => s.tasks.some((t) => t.status === 'running'));
  const taskActive = hasMessages || hasRunning;

  return (
    <div className={styles.app}>
      <ParticleBackground />
      <Header />
      <div className={`${styles.main} ${taskActive ? styles.mainTaskActive : ''}`}>
        <div className={styles.leftPanel}>{left}</div>
        <div className={styles.centerPanel}>{center}</div>
        <div className={styles.rightPanel}>{right}</div>
      </div>
      <Footer />
    </div>
  );
}
