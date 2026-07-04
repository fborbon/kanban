import { useState } from 'react';
import { Category } from '../types';

const PALETTE = [
  '#f44336', '#e91e63', '#9c27b0', '#673ab7',
  '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4',
  '#009688', '#4caf50', '#8bc34a', '#cddc39',
  '#ffc107', '#ff9800', '#ff5722', '#795548',
  '#607d8b', '#9e9e9e', '#37474f', '#bf360c',
];

interface Props {
  categories: Category[];
  onSave: (cats: Category[]) => void;
  onClose: () => void;
}

export default function CategoryModal({ categories, onSave, onClose }: Props) {
  const [cats, setCats] = useState<Category[]>(categories.map(c => ({ ...c })));
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PALETTE[5]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const addCategory = () => {
    if (!newName.trim()) return;
    const fresh: Category = {
      id: `cat-${Date.now()}`,
      name: newName.trim(),
      color: newColor,
    };
    setCats(prev => [...prev, fresh]);
    setNewName('');
    setNewColor(PALETTE[Math.floor(Math.random() * PALETTE.length)]);
  };

  const removeCategory = (id: string) => {
    setCats(prev => prev.filter(c => c.id !== id));
  };

  const updateCat = (id: string, field: 'name' | 'color', value: string) => {
    setCats(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🎨 Manage Categories</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="cat-list">
          {cats.map(cat => (
            <div key={cat.id} className="cat-row">
              {editingId === cat.id ? (
                <>
                  <input
                    className="cat-name-input"
                    value={cat.name}
                    onChange={e => updateCat(cat.id, 'name', e.target.value)}
                    onBlur={() => setEditingId(null)}
                    autoFocus
                  />
                  <div className="palette-grid">
                    {PALETTE.map(color => (
                      <button
                        key={color}
                        className={`palette-swatch${cat.color === color ? ' active' : ''}`}
                        style={{ background: color }}
                        onClick={() => updateCat(cat.id, 'color', color)}
                        title={color}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <span className="cat-swatch" style={{ background: cat.color }} />
                  <span className="cat-name">{cat.name}</span>
                  <div className="cat-row-actions">
                    <button className="icon-btn" onClick={() => setEditingId(cat.id)}>✏️</button>
                    <button className="icon-btn" onClick={() => removeCategory(cat.id)}>🗑️</button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="cat-add">
          <h3>Add Category</h3>
          <div className="cat-add-row">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Category name"
              onKeyDown={e => e.key === 'Enter' && addCategory()}
            />
            <div className="palette-grid">
              {PALETTE.map(color => (
                <button
                  key={color}
                  className={`palette-swatch${newColor === color ? ' active' : ''}`}
                  style={{ background: color }}
                  onClick={() => setNewColor(color)}
                  title={color}
                />
              ))}
            </div>
            <div className="cat-add-preview" style={{ background: newColor }}>
              {newName || 'Preview'}
            </div>
            <button className="btn btn-primary" onClick={addCategory}>Add</button>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave(cats)}>Save Categories</button>
        </div>
      </div>
    </div>
  );
}
