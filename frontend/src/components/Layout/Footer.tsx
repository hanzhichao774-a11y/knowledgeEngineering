import styles from './Footer.module.css';

export function Footer() {
  return (
    <footer className={styles.footer}>
      BizAgentOS v0.1.0 · Powered by{' '}
      <a href="#" className={styles.link}>KodaX</a>
      {' '}· 知识工程工作线
    </footer>
  );
}
