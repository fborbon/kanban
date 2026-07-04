import { useState } from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { Task, Category, ColumnId } from '../types';

const URGENCY_COLORS: Record<string, string> = {
  today: '#ff4444',
  'this-week': '#ff8c00',
  'this-month': '#1e90ff',
};

const URGENCY_LABELS: Record<string, string> = {
  today: '🔥 Today',
  'this-week': '📅 This Week',
  'this-month': '🗓️ This Month',
};

interface Props {
  tasks: Task[];
  categories: Category[];
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: string) => void;
  onPromote: (id: string, col: ColumnId) => void;
  onAddTask: () => void;
}

export default function Backlog({ tasks, categories, onEditTask, onDeleteTask, onPromote, onAddTask }: Props) {
  const [open, setOpen] = useState(true);
  const [promoteMenu, setPromoteMenu] = useState<string | null>(null);

  const sorted = [...tasks].sort((a, b) => a.order - b.order);

  return (
    <div className="backlog">
      <div className="backlog-header" onClick={() => setOpen(o => !o)}>
        <span className="backlog-toggle">{open ? '▼' : '▶'}</span>
        <span className="backlog-title">📦 Backlog</span>
        <span className="backlog-count">{tasks.length} tasks</span>
        <button
          className="btn btn-ghost btn-sm"
          onClick={e => { e.stopPropagation(); onAddTask(); }}
        >
          + Add
        </button>
      </div>

      {open && (
        <Droppable droppableId="backlog" direction="horizontal">
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`backlog-cards${snapshot.isDraggingOver ? ' drag-over' : ''}`}
            >
              {sorted.map((task, i) => {
                const cat = categories.find(c => c.id === task.categoryId);
                return (
                  <Draggable key={task.id} draggableId={task.id} index={i}>
                    {(dragProvided, dragSnapshot) => (
                      <div
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        {...dragProvided.dragHandleProps}
                        className={`task-card backlog-card${dragSnapshot.isDragging ? ' dragging' : ''}`}
                        style={{
                          ...dragProvided.draggableProps.style,
                          borderTop: `4px solid ${URGENCY_COLORS[task.urgency]}`,
                        }}
                      >
                        <div className="card-urgency" style={{ color: URGENCY_COLORS[task.urgency] }}>
                          {URGENCY_LABELS[task.urgency]}
                        </div>
                        <div className="card-title">{task.title}</div>
                        {task.description && <div className="card-desc">{task.description}</div>}
                        <div className="card-footer">
                          {cat && (
                            <span className="card-category" style={{ background: cat.color }}>
                              {cat.name}
                            </span>
                          )}
                          <div className="card-actions">
                            <div className="promote-wrap">
                              <button
                                className="card-btn promote-btn"
                                title="Promote to board"
                                onClick={() => setPromoteMenu(promoteMenu === task.id ? null : task.id)}
                              >
                                🚀
                              </button>
                              {promoteMenu === task.id && (
                                <div className="promote-menu">
                                  <button onClick={() => { onPromote(task.id, 'todo'); setPromoteMenu(null); }}>📝 To Do</button>
                                  <button onClick={() => { onPromote(task.id, 'in-progress'); setPromoteMenu(null); }}>⚡ In Progress</button>
                                  <button onClick={() => { onPromote(task.id, 'done'); setPromoteMenu(null); }}>✅ Done</button>
                                </div>
                              )}
                            </div>
                            <button className="card-btn" onClick={() => onEditTask(task)}>✏️</button>
                            <button className="card-btn" onClick={() => onDeleteTask(task.id)}>🗑️</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
              {tasks.length === 0 && (
                <div className="backlog-empty">Drop tasks here or click + Add</div>
              )}
            </div>
          )}
        </Droppable>
      )}
    </div>
  );
}
