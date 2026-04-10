import { TaskList } from './TaskList';
import { StepProgress } from './StepProgress';

export function LeftPanel() {
  return (
    <>
      <TaskList />
      <StepProgress />
    </>
  );
}
