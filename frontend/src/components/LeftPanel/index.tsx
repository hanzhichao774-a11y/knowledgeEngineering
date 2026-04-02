import { TaskList } from './TaskList';
import { StepProgress } from './StepProgress';
import { CostPanel } from './CostPanel';

export function LeftPanel() {
  return (
    <>
      <TaskList />
      <StepProgress />
      <CostPanel />
    </>
  );
}
