import { useState, useEffect, useCallback, useRef } from 'react';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import { AppState, Task, Category, ColumnId } from './types';
import { loadState, saveState } from './store';
import { getToken, clearToken, fetchState, pushState } from './api';
import Board from './components/Board';
import Backlog from './components/Backlog';
import CalendarView from './components/CalendarView';
import TaskModal from './components/TaskModal';
import CategoryModal from './components/CategoryModal';
import LoginScreen from './components/LoginScreen';

type SyncStatus = 'idle' | 'syncing' | 'error';
type Tab = 'board' | 'calendar';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function App() {
  const [authed, setAuthed]       = useState(() => !!getToken());
  const [state, setState]         = useState<AppState>(loadState);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [tab, setTab]             = useState<Tab>('board');
  const [taskModal, setTaskModal] = useState<{ open: boolean; task?: Task; defaultColumn?: ColumnId }>({ open: false });
  const [catModal, setCatModal]   = useState(false);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstLoad = useRef(true);

  // Load state from API after login
  useEffect(() => {
    if (!authed) return;
    setSyncStatus('syncing');
    const local = loadState();
    fetchState()
      .then(remote => {
        // Keep whichever has more tasks; if tied, prefer remote (other device)
        const useRemote = (remote.tasks?.length ?? 0) >= (local.tasks?.length ?? 0)
          && (remote.tasks?.length ?? 0) > 0;
        const merged = useRemote ? remote : local;
        setState(merged);
        saveState(merged);
        // If local had more data, push it up to sync the other device
        if (!useRemote && local.tasks?.length > 0) {
          pushState(local).catch(() => {});
        }
        setSyncStatus('idle');
      })
      .catch(err => {
        if ((err as Error).message === 'UNAUTHORIZED') setAuthed(false);
        setSyncStatus('error');
      });
  }, [authed]);

  // Push to API (debounced 1.5s) whenever state changes
  useEffect(() => {
    if (!authed) return;
    if (isFirstLoad.current) { isFirstLoad.current = false; return; }
    saveState(state); // always write localStorage immediately
    if (syncTimer.current) clearTimeout(syncTimer.current);
    setSyncStatus('syncing');
    syncTimer.current = setTimeout(() => {
      pushState(state)
        .then(() => setSyncStatus('idle'))
        .catch(err => {
          if ((err as Error).message === 'UNAUTHORIZED') setAuthed(false);
          setSyncStatus('error');
        });
    }, 1500);
  }, [state, authed]);

  const onDragEnd = useCallback((result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    setState(prev => {
      const tasks = [...prev.tasks];
      const taskIdx = tasks.findIndex(t => t.id === draggableId);
      if (taskIdx === -1) return prev;

      const task   = { ...tasks[taskIdx] };
      const srcCol = source.droppableId as ColumnId;
      const dstCol = destination.droppableId as ColumnId;

      const srcTasks = tasks.filter(t => t.column === srcCol).sort((a, b) => a.order - b.order);
      const dstTasks = srcCol === dstCol
        ? srcTasks
        : tasks.filter(t => t.column === dstCol).sort((a, b) => a.order - b.order);

      if (srcCol === dstCol) {
        srcTasks.splice(source.index, 1);
        srcTasks.splice(destination.index, 0, task);
        srcTasks.forEach((t, i) => { tasks[tasks.findIndex(x => x.id === t.id)] = { ...t, order: i }; });
      } else {
        srcTasks.splice(source.index, 1);
        srcTasks.forEach((t, i) => { tasks[tasks.findIndex(x => x.id === t.id)] = { ...t, order: i }; });
        task.column = dstCol;
        if (dstCol === 'done' && !task.date) task.date = todayStr();
        dstTasks.splice(destination.index, 0, task);
        dstTasks.forEach((t, i) => {
          const idx = tasks.findIndex(x => x.id === t.id);
          if (idx !== -1) tasks[idx] = { ...t, column: dstCol, order: i };
          else tasks[taskIdx] = { ...task, column: dstCol, order: destination.index };
        });
      }
      return { ...prev, tasks };
    });
  }, []);

  const openCreateTask = (defaultColumn?: ColumnId) => setTaskModal({ open: true, defaultColumn });
  const openEditTask   = (task: Task) => setTaskModal({ open: true, task });

  const saveTask = (data: Omit<Task, 'id' | 'createdAt' | 'order'> & { id?: string }) => {
    if (data.column === 'done' && !data.date) data = { ...data, date: todayStr() };
    setState(prev => {
      if (data.id) {
        return { ...prev, tasks: prev.tasks.map(t => t.id === data.id ? { ...t, ...data } as Task : t) };
      }
      const newTask: Task = {
        ...data,
        id: `task-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        createdAt: new Date().toISOString(),
        order: prev.tasks.filter(t => t.column === data.column).length,
      };
      return { ...prev, tasks: [...prev.tasks, newTask] };
    });
    setTaskModal({ open: false });
  };

  const deleteTask      = (id: string)              => setState(prev => ({ ...prev, tasks: prev.tasks.filter(t => t.id !== id) }));
  const saveCategories  = (categories: Category[])  => { setState(prev => ({ ...prev, categories })); setCatModal(false); };
  const promoteTask     = (id: string, toCol: ColumnId) => {
    setState(prev => ({
      ...prev,
      tasks: prev.tasks.map(t =>
        t.id === id ? {
          ...t,
          column: toCol,
          order: prev.tasks.filter(x => x.column === toCol).length,
          date: toCol === 'done' && !t.date ? todayStr() : t.date,
        } : t
      ),
    }));
  };

  const handleLogout = () => { clearToken(); setAuthed(false); };

  const SYNC_ICON: Record<SyncStatus, string> = { idle: '☁️', syncing: '🔄', error: '⚠️' };

  if (!authed) return <LoginScreen onLogin={() => { isFirstLoad.current = true; setAuthed(true); }} />;

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="app">
        <header className="header">
          <div className="header-left">
            <span className="header-icon">📋</span>
            <h1 className="header-title">Kanban</h1>
            <span className="sync-badge" title={syncStatus}>{SYNC_ICON[syncStatus]}</span>
          </div>
          <div className="header-actions">
            <button className="btn btn-ghost" onClick={() => setCatModal(true)}>🎨 Categories</button>
            <button className="btn btn-ghost" onClick={handleLogout} title="Sign out">🚪</button>
            <button className="btn btn-primary" onClick={() => openCreateTask()}>+ New Task</button>
          </div>
        </header>

        <nav className="tab-bar">
          <button className={`tab-btn${tab === 'board' ? ' active' : ''}`} onClick={() => setTab('board')}>
            🗂️ Board
          </button>
          <button className={`tab-btn${tab === 'calendar' ? ' active' : ''}`} onClick={() => setTab('calendar')}>
            📅 Calendar
          </button>
        </nav>

        <main className="main">
          {tab === 'board' ? (
            <>
              <Board
                tasks={state.tasks.filter(t => t.column !== 'backlog')}
                categories={state.categories}
                onEditTask={openEditTask}
                onDeleteTask={deleteTask}
                onAddTask={openCreateTask}
              />
              <Backlog
                tasks={state.tasks.filter(t => t.column === 'backlog')}
                categories={state.categories}
                onEditTask={openEditTask}
                onDeleteTask={deleteTask}
                onPromote={promoteTask}
                onAddTask={() => openCreateTask('backlog')}
              />
            </>
          ) : (
            <CalendarView
              tasks={state.tasks.filter(t => t.date)}
              categories={state.categories}
              onEditTask={openEditTask}
            />
          )}
        </main>

        {taskModal.open && (
          <TaskModal
            task={taskModal.task}
            defaultColumn={taskModal.defaultColumn ?? 'todo'}
            categories={state.categories}
            onSave={saveTask}
            onClose={() => setTaskModal({ open: false })}
          />
        )}

        {catModal && (
          <CategoryModal
            categories={state.categories}
            onSave={saveCategories}
            onClose={() => setCatModal(false)}
          />
        )}
      </div>
    </DragDropContext>
  );
}

export default App;
