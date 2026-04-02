import { Activity } from 'lucide-react';
import styles from './Header.module.css';

export function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <Activity size={18} className={styles.logoIcon} />
        <div className={styles.logo}>
          BizAgentOS<span className={styles.logoSub}>· 管理智能体</span>
        </div>
      </div>
      <div className={styles.right}>
        <span className={styles.tag}>
          <span className={styles.statusDot} />
          系统正常
        </span>
        <span className={styles.tag}>MiniMax</span>
        <span className={styles.tag}>👤 张闯</span>
      </div>
    </header>
  );
}
