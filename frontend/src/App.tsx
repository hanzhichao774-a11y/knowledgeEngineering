import { useEffect } from 'react';
import { AppShell } from './components/Layout/AppShell';
import { LeftPanel } from './components/LeftPanel';
import { CenterPanel } from './components/CenterPanel';
import { RightPanel } from './components/RightPanel';
import { useMockFlow } from './hooks/useMockFlow';
import './styles/global.css';

export default function App() {
  const { initialize } = useMockFlow();

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <AppShell
      left={<LeftPanel />}
      center={<CenterPanel />}
      right={<RightPanel />}
    />
  );
}
