import { useState, useRef } from 'react';
import { Task, TaskLink, TaskFile, Category, ColumnId, Urgency, Board } from '../types';
import { uploadImage, uploadFile } from '../api';

const COLUMNS: { id: ColumnId; label: string }[] = [
  { id: 'backlog', label: '📦 Backlog' },
  { id: 'todo', label: '📝 To Do' },
  { id: 'in-progress', label: '⚡ In Progress' },
  { id: 'done', label: '✅ Done' },
];

const URGENCIES: { id: Urgency; label: string }[] = [
  { id: 'today', label: '🔥 Today' },
  { id: 'this-week', label: '📅 This Week' },
  { id: 'this-month', label: '🗓️ This Month' },
];

interface Props {
  task?: Task;
  defaultColumn: ColumnId;
  defaultBoardId: string;
  boards: Board[];
  categories: Category[];
  onSave: (data: Omit<Task, 'id' | 'createdAt' | 'order'> & { id?: string }) => void;
  onClose: () => void;
}

export default function TaskModal({ task, defaultColumn, defaultBoardId, boards, categories, onSave, onClose }: Props) {
  const [title, setTitle]           = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [categoryId, setCategoryId] = useState<string | null>(task?.categoryId ?? null);
  const [boardId, setBoardId]       = useState(task?.boardId ?? defaultBoardId);
  const [urgency, setUrgency]       = useState<Urgency>(task?.urgency ?? 'this-week');
  const [column, setColumn]         = useState<ColumnId>(task?.column ?? defaultColumn);
  const [date, setDate]             = useState(task?.date ?? '');
  const [location, setLocation]     = useState(task?.location ?? '');
  const [startAt, setStartAt]       = useState(task?.startAt ?? '');
  const [endAt, setEndAt]           = useState(task?.endAt ?? '');
  const [links, setLinks]           = useState<TaskLink[]>(task?.links ?? []);
  const [images, setImages]         = useState<string[]>(task?.images ?? []);
  const [files, setFiles]           = useState<TaskFile[]>(task?.files ?? []);
  const [uploading, setUploading]   = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef    = useRef<HTMLInputElement>(null);
  const attachInputRef  = useRef<HTMLInputElement>(null);

  // link helpers
  const addLink    = () => setLinks(l => [...l, { url: '', label: '' }]);
  const removeLink = (i: number) => setLinks(l => l.filter((_, idx) => idx !== i));
  const updateLink = (i: number, field: keyof TaskLink, val: string) =>
    setLinks(l => l.map((lnk, idx) => idx === i ? { ...lnk, [field]: val } : lnk));

  // image helpers
  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const urls = await Promise.all(Array.from(files).map(uploadImage));
      setImages(prev => [...prev, ...urls]);
    } catch {
      alert('Image upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };
  const removeImage = (i: number) => setImages(imgs => imgs.filter((_, idx) => idx !== i));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const cleanLinks = links.filter(l => l.url.trim());
    onSave({ id: task?.id, title: title.trim(), description: description.trim(), categoryId, boardId, urgency, column, date: date || null, location: location.trim() || null, startAt: startAt || null, endAt: endAt || null, links: cleanLinks, images, files });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{task ? 'Edit Task' : 'New Task'}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <label>
            Title *
            <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="What needs to be done?" required />
          </label>

          <label>
            Description
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional details..." rows={3} />
          </label>

          <label>
            Urgency
            <div className="radio-group">
              {URGENCIES.map(u => (
                <label key={u.id} className={`radio-pill${urgency === u.id ? ' selected' : ''}`}>
                  <input type="radio" name="urgency" value={u.id} checked={urgency === u.id} onChange={() => setUrgency(u.id)} />
                  {u.label}
                </label>
              ))}
            </div>
          </label>

          <label>
            Column
            <select value={column} onChange={e => setColumn(e.target.value as ColumnId)}>
              {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>

          <label>
            Board
            <select value={boardId} onChange={e => setBoardId(e.target.value)}>
              {boards.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>

          <label>
            Category
            <select value={categoryId ?? ''} onChange={e => setCategoryId(e.target.value || null)}>
              <option value="">— None —</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>

          <label>
            Date <span style={{ fontSize: 11, color: '#888', fontWeight: 400 }}>(auto-set when moved to Done)</span>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </label>

          <label>
            📍 Location
            <input
              type="url"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="https://maps.google.com/..."
            />
          </label>

          <div className="dt-row">
            <label style={{ flex: 1 }}>
              🕐 Start
              <input type="datetime-local" value={startAt} onChange={e => setStartAt(e.target.value)} />
            </label>
            <label style={{ flex: 1 }}>
              🕑 End
              <input type="datetime-local" value={endAt} onChange={e => setEndAt(e.target.value)} />
            </label>
          </div>

          {/* ── Links ── */}
          <div className="field-section">
            <div className="field-section-header">
              <span>🔗 Links</span>
              <button type="button" className="btn-add-row" onClick={addLink}>+ Add link</button>
            </div>
            {links.map((lnk, i) => (
              <div key={i} className="link-row">
                <input
                  className="link-url"
                  placeholder="https://..."
                  value={lnk.url}
                  onChange={e => updateLink(i, 'url', e.target.value)}
                  type="url"
                />
                <input
                  className="link-label"
                  placeholder="Label (optional)"
                  value={lnk.label}
                  onChange={e => updateLink(i, 'label', e.target.value)}
                />
                <button type="button" className="btn-remove-row" onClick={() => removeLink(i)}>✕</button>
              </div>
            ))}
          </div>

          {/* ── Images ── */}
          <div className="field-section">
            <div className="field-section-header">
              <span>🖼️ Images</span>
              <button
                type="button"
                className="btn-add-row"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? 'Uploading…' : '+ Add from gallery'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={e => handleFiles(e.target.files)}
              />
            </div>
            {images.length > 0 && (
              <div className="img-preview-grid">
                {images.map((url, i) => (
                  <div key={i} className="img-preview-wrap">
                    <img src={url} className="img-preview" alt="" />
                    <button type="button" className="img-remove" onClick={() => removeImage(i)}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── File attachments ── */}
          <div className="field-section">
            <div className="field-section-header">
              <span>📎 Files</span>
              <button
                type="button"
                className="btn-add-row"
                onClick={() => attachInputRef.current?.click()}
                disabled={uploadingFile}
              >
                {uploadingFile ? 'Uploading…' : '+ Attach PDF / TXT / CSV'}
              </button>
              <input
                ref={attachInputRef}
                type="file"
                accept=".pdf,.txt,.csv,application/pdf,text/plain,text/csv"
                multiple
                style={{ display: 'none' }}
                onChange={async e => {
                  if (!e.target.files?.length) return;
                  setUploadingFile(true);
                  try {
                    const uploaded = await Promise.all(Array.from(e.target.files).map(uploadFile));
                    setFiles(prev => [...prev, ...uploaded]);
                  } catch {
                    alert('File upload failed. Please try again.');
                  } finally {
                    setUploadingFile(false);
                    e.target.value = '';
                  }
                }}
              />
            </div>
            {files.length > 0 && (
              <div className="attach-list">
                {files.map((f, i) => (
                  <div key={i} className="attach-row">
                    <span className="attach-icon">
                      {f.type === 'pdf' ? '📄' : f.type === 'csv' ? '📊' : '📝'}
                    </span>
                    <span className="attach-name">{f.name}</span>
                    <button type="button" className="btn-remove-row" onClick={() => setFiles(fs => fs.filter((_, idx) => idx !== i))}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={uploading}>
              {task ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
