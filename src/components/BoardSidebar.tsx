import { useState, useRef, useEffect } from 'react';
import { Board } from '../types';
import { GENERAL_BOARD_ID } from '../store';

export const BOARD_COLORS = [
  '#6c63ff', '#f59e0b', '#10b981', '#3b82f6', '#ef4444',
  '#8b5cf6', '#f97316', '#06b6d4', '#84cc16', '#ec4899',
];

interface Props {
  boards: Board[];
  selectedId: string;
  taskCounts: Record<string, number>;
  open: boolean;
  onToggle: () => void;
  onSelect: (id: string) => void;
  onAdd: (name: string, color: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

export default function BoardSidebar({
  boards, selectedId, taskCounts, open, onToggle,
  onSelect, onAdd, onRename, onDelete,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName]   = useState('');
  const [adding, setAdding]       = useState(false);
  const [newName, setNewName]     = useState('');
  const [newColor, setNewColor]   = useState(BOARD_COLORS[1]);
  const editRef = useRef<HTMLInputElement>(null);
  const addRef  = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editingId && editRef.current) editRef.current.focus(); }, [editingId]);
  useEffect(() => { if (adding && addRef.current) addRef.current.focus(); }, [adding]);

  const startEdit = (b: Board, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(b.id);
    setEditName(b.name);
  };

  const commitEdit = () => {
    if (editingId && editName.trim()) onRename(editingId, editName.trim());
    setEditingId(null);
  };

  const commitAdd = () => {
    if (newName.trim()) {
      onAdd(newName.trim(), newColor);
      setNewName('');
      const usedColors = new Set(boards.map(b => b.color));
      const next = BOARD_COLORS.find(c => !usedColors.has(c)) ?? BOARD_COLORS[boards.length % BOARD_COLORS.length];
      setNewColor(next);
    }
    setAdding(false);
  };

  const handleSelect = (id: string) => {
    onSelect(id);
    if (window.innerWidth <= 640) onToggle();
  };

  return (
    <>
      {open && <div className="sidebar-backdrop" onClick={onToggle} />}
      <aside className={`board-sidebar${open ? ' open' : ''}`}>
        <div className="sidebar-head">
          <span className="sidebar-title">Boards</span>
          <button className="sidebar-close" onClick={onToggle} title="Close sidebar">✕</button>
        </div>

        <ul className="sidebar-list">
          {boards.map(b => (
            <li key={b.id} className={`sidebar-item${b.id === selectedId ? ' active' : ''}`}>
              {editingId === b.id ? (
                <input
                  ref={editRef}
                  className="sidebar-edit-input"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                />
              ) : (
                <button className="sidebar-item-btn" onClick={() => handleSelect(b.id)}>
                  <span className="sidebar-dot" style={{ background: b.color }} />
                  <span className="sidebar-name">{b.name}</span>
                  <span className="sidebar-count">{taskCounts[b.id] ?? 0}</span>
                </button>
              )}
              {editingId !== b.id && (
                <span className="sidebar-item-acts">
                  <button className="sidebar-act-btn" onClick={e => startEdit(b, e)} title="Rename">✏️</button>
                  {b.id !== GENERAL_BOARD_ID && (
                    <button
                      className="sidebar-act-btn"
                      title="Delete"
                      onClick={e => { e.stopPropagation(); onDelete(b.id); }}
                    >🗑️</button>
                  )}
                </span>
              )}
            </li>
          ))}
        </ul>

        {adding ? (
          <div className="sidebar-add-form">
            <input
              ref={addRef}
              className="sidebar-edit-input"
              value={newName}
              placeholder="Board name…"
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); commitAdd(); }
                if (e.key === 'Escape') setAdding(false);
              }}
            />
            <div className="sidebar-colors">
              {BOARD_COLORS.map(c => (
                <button
                  key={c}
                  className={`sidebar-color-dot${newColor === c ? ' active' : ''}`}
                  style={{ background: c }}
                  onClick={() => setNewColor(c)}
                  title={c}
                />
              ))}
            </div>
            <div className="sidebar-add-btns">
              <button className="btn btn-sm btn-outline" onClick={() => setAdding(false)}>Cancel</button>
              <button className="btn btn-sm btn-primary" onClick={commitAdd} disabled={!newName.trim()}>Create</button>
            </div>
          </div>
        ) : (
          <button className="sidebar-new-btn" onClick={() => setAdding(true)}>
            + New Board
          </button>
        )}
      </aside>
    </>
  );
}
