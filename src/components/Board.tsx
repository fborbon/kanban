import { Task, Category, ColumnId } from '../types';
import Column from './Column';

const COLUMNS: ColumnId[] = ['todo', 'in-progress', 'done'];

interface Props {
  tasks: Task[];
  categories: Category[];
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: string) => void;
  onAddTask: (col: ColumnId) => void;
}

export default function Board({ tasks, categories, onEditTask, onDeleteTask, onAddTask }: Props) {
  return (
    <div className="board">
      {COLUMNS.map(col => (
        <Column
          key={col}
          id={col}
          tasks={tasks.filter(t => t.column === col)}
          categories={categories}
          onEditTask={onEditTask}
          onDeleteTask={onDeleteTask}
          onAdd={() => onAddTask(col)}
        />
      ))}
    </div>
  );
}
