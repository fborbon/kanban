import { Droppable } from '@hello-pangea/dnd';
import { Task, Category, ColumnId } from '../types';
import TaskCard from './TaskCard';

const COLUMN_META: Record<ColumnId, { label: string; emoji: string; accent: string }> = {
  todo: { label: 'To Do', emoji: '📝', accent: '#6c63ff' },
  'in-progress': { label: 'In Progress', emoji: '⚡', accent: '#f59e0b' },
  done: { label: 'Done', emoji: '✅', accent: '#10b981' },
  backlog: { label: 'Backlog', emoji: '📦', accent: '#64748b' },
};

interface Props {
  id: ColumnId;
  tasks: Task[];
  categories: Category[];
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: string) => void;
  onAdd: () => void;
}

export default function Column({ id, tasks, categories, onEditTask, onDeleteTask, onAdd }: Props) {
  const meta = COLUMN_META[id];
  const sorted = [...tasks].sort((a, b) => a.order - b.order);

  return (
    <div className="column">
      <div className="column-header" style={{ borderBottom: `3px solid ${meta.accent}` }}>
        <span className="column-emoji">{meta.emoji}</span>
        <span className="column-label">{meta.label}</span>
        <span className="column-count" style={{ background: meta.accent }}>{tasks.length}</span>
      </div>

      <Droppable droppableId={id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`column-drop${snapshot.isDraggingOver ? ' drag-over' : ''}`}
          >
            {sorted.map((task, i) => (
              <TaskCard
                key={task.id}
                task={task}
                index={i}
                category={categories.find(c => c.id === task.categoryId)}
                onEdit={onEditTask}
                onDelete={onDeleteTask}
              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      <button className="column-add-btn" onClick={onAdd}>+ Add task</button>
    </div>
  );
}
