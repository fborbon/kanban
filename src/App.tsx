import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import { AppState, Task, Category, ColumnId, Board } from './types';
import { loadState, saveState, migrateState, GENERAL_BOARD_ID, GENERAL_BOARD } from './store';
import { getToken, clearToken, fetchState, pushState } from './api';
import KanbanBoard from './components/Board';
import Backlog from './components/Backlog';
import CalendarView from './components/CalendarView';
import TaskModal from './components/TaskModal';
import CategoryModal from './components/CategoryModal';
import LoginScreen from './components/LoginScreen';
import BoardSidebar from './components/BoardSidebar';

type SyncStatus = 'idle' | 'syncing' | 'error';
type Tab = 'board' | 'calendar';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function App() {
  const [authed, setAuthed]           = useState(() => !!getToken());
  const [state, setState]             = useState<AppState>(loadState);
  const [syncStatus, setSyncStatus]   = useState<SyncStatus>('idle');
  const [tab, setTab]                 = useState<Tab>('board');
  const [taskModal, setTaskModal]     = useState<{ open: boolean; task?: Task; defaultColumn?: ColumnId }>({ open: false });
  const [catModal, setCatModal]       = useState(false);
  const [selectedBoardId, setSelectedBoardId] = useState(
    () => localStorage.getItem('kanban-board') ?? GENERAL_BOARD_ID
  );
  const [sidebarOpen, setSidebarOpen] = useState(
    () => typeof window !== 'undefined' && window.innerWidth >= 641
  );
  const syncTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstLoad  = useRef(true);

  // Ensure selectedBoard always points to an existing board
  const effectiveBoardId = state.boards.find(b => b.id === selectedBoardId)
    ? selectedBoardId
    : GENERAL_BOARD_ID;

  const currentBoard = state.boards.find(b => b.id === effectiveBoardId) ?? GENERAL_BOARD;

  // Load state from API after login
  useEffect(() => {
    if (!authed) return;
    setSyncStatus('syncing');
    const local = loadState();
    fetchState()
      .then(raw => {
        const remote = migrateState(raw as Partial<AppState>);
        const useRemote = (remote.tasks?.length ?? 0) >= (local.tasks?.length ?? 0)
          && (remote.tasks?.length ?? 0) > 0;
        // Merge boards: union of both, preferring remote values
        const boardMap = new Map<string, Board>();
        (useRemote ? [...local.boards, ...remote.boards] : [...remote.boards, ...local.boards])
          .forEach(b => boardMap.set(b.id, b));
        const merged: AppState = {
          ...(useRemote ? remote : local),
          boards: [...boardMap.values()],
        };
        setState(merged);
        saveState(merged);
        if (!useRemote && local.tasks?.length > 0) pushState(local).catch(() => {});
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
    saveState(state);
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

  const taskCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    state.boards.forEach(b => { counts[b.id] = 0; });
    state.tasks.forEach(t => {
      if (t.boardId in counts) counts[t.boardId] = (counts[t.boardId] ?? 0) + 1;
    });
    return counts;
  }, [state.boards, state.tasks]);

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

      // Scope reordering to the current board so other boards are unaffected
      const srcTasks = tasks
        .filter(t => t.column === srcCol && t.boardId === effectiveBoardId)
        .sort((a, b) => a.order - b.order);
      const dstTasks = srcCol === dstCol
        ? srcTasks
        : tasks
            .filter(t => t.column === dstCol && t.boardId === effectiveBoardId)
            .sort((a, b) => a.order - b.order);

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
  }, [effectiveBoardId]);

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
        order: prev.tasks.filter(t => t.column === data.column && t.boardId === data.boardId).length,
      };
      return { ...prev, tasks: [...prev.tasks, newTask] };
    });
    setTaskModal({ open: false });
  };

  const deleteTask     = (id: string) => setState(prev => ({ ...prev, tasks: prev.tasks.filter(t => t.id !== id) }));
  const saveCategories = (categories: Category[]) => { setState(prev => ({ ...prev, categories })); setCatModal(false); };
  const promoteTask    = (id: string, toCol: ColumnId) => {
    setState(prev => ({
      ...prev,
      tasks: prev.tasks.map(t =>
        t.id === id ? {
          ...t,
          column: toCol,
          order: prev.tasks.filter(x => x.column === toCol && x.boardId === t.boardId).length,
          date: toCol === 'done' && !t.date ? todayStr() : t.date,
        } : t
      ),
    }));
  };

  // ── Board CRUD ──────────────────────────────────────────────────────────────
  const selectBoard = (id: string) => {
    setSelectedBoardId(id);
    localStorage.setItem('kanban-board', id);
  };

  const addBoard = (name: string, color: string) => {
    const id = `board-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setState(prev => ({ ...prev, boards: [...prev.boards, { id, name, color }] }));
    selectBoard(id);
  };

  const renameBoard = (id: string, name: string) => {
    setState(prev => ({ ...prev, boards: prev.boards.map(b => b.id === id ? { ...b, name } : b) }));
  };

  const deleteBoard = (id: string) => {
    const board = state.boards.find(b => b.id === id);
    if (!board) return;
    const count = state.tasks.filter(t => t.boardId === id).length;
    if (
      count > 0 &&
      !window.confirm(`"${board.name}" has ${count} task${count !== 1 ? 's' : ''}. Move them to General and delete this board?`)
    ) return;

    setState(prev => ({
      ...prev,
      tasks: prev.tasks.map(t => t.boardId === id ? { ...t, boardId: GENERAL_BOARD_ID } : t),
      boards: prev.boards.filter(b => b.id !== id),
    }));
    if (effectiveBoardId === id) selectBoard(GENERAL_BOARD_ID);
  };

  // ───────────────────────────────────────────────────────────────────────────
  const handleLogout = () => { clearToken(); setAuthed(false); };
  const SYNC_ICON: Record<SyncStatus, string> = { idle: '☁️', syncing: '🔄', error: '⚠️' };

  if (!authed) return <LoginScreen onLogin={() => { isFirstLoad.current = true; setAuthed(true); }} />;

  const boardTasks = state.tasks.filter(t => t.boardId === effectiveBoardId);

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="app">
        <header className="header">
          <div className="header-left">
            <button
              className="sidebar-toggle-btn"
              onClick={() => setSidebarOpen(o => !o)}
              title="Toggle boards panel"
            >☰</button>
            <span className="header-icon">📋</span>
            <h1 className="header-title">Kanban</h1>
            <span className="header-board-name">{currentBoard.name}</span>
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

        <div className="app-body">
          <BoardSidebar
            boards={state.boards}
            selectedId={effectiveBoardId}
            taskCounts={taskCounts}
            open={sidebarOpen}
            onToggle={() => setSidebarOpen(o => !o)}
            onSelect={selectBoard}
            onAdd={addBoard}
            onRename={renameBoard}
            onDelete={deleteBoard}
          />

          <main className="main">
            {tab === 'board' ? (
              <>
                <KanbanBoard
                  tasks={boardTasks.filter(t => t.column !== 'backlog')}
                  categories={state.categories}
                  onEditTask={openEditTask}
                  onDeleteTask={deleteTask}
                  onAddTask={openCreateTask}
                />
                <Backlog
                  tasks={boardTasks.filter(t => t.column === 'backlog')}
                  categories={state.categories}
                  onEditTask={openEditTask}
                  onDeleteTask={deleteTask}
                  onPromote={promoteTask}
                  onAddTask={() => openCreateTask('backlog')}
                />
              </>
            ) : (
              <CalendarView
                tasks={boardTasks.filter(t => t.date)}
                categories={state.categories}
                onEditTask={openEditTask}
              />
            )}
          </main>
        </div>

        {taskModal.open && (
          <TaskModal
            task={taskModal.task}
            defaultColumn={taskModal.defaultColumn ?? 'todo'}
            defaultBoardId={effectiveBoardId}
            boards={state.boards}
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
