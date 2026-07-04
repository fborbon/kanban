import { useState } from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { Task, Category, TaskFile } from '../types';
import FileViewer from './FileViewer';

const URGENCY_LABELS: Record<string, string> = {
  today: '🔥 Today',
  'this-week': '📅 This Week',
  'this-month': '🗓️ This Month',
};

const URGENCY_COLORS: Record<string, string> = {
  today: '#ff4444',
  'this-week': '#ff8c00',
  'this-month': '#1e90ff',
};

function textColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 0.55 ? '#1a1a2e' : '#ffffff';
}

function cleanUrl(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

function fmtDt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}

function fmtRange(start: string | null | undefined, end: string | null | undefined): string | null {
  if (!start && !end) return null;
  if (start && end) {
    const s = new Date(start), e = new Date(end);
    const sameDay = s.toDateString() === e.toDateString();
    const startStr = fmtDt(start);
    const endStr = sameDay
      ? new Date(end).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
      : fmtDt(end);
    return `${startStr} – ${endStr}`;
  }
  return start ? `From ${fmtDt(start)}` : `Until ${fmtDt(end!)}`;
}

interface Props {
  task: Task;
  index: number;
  category: Category | undefined;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
}

export default function TaskCard({ task, index, category, onEdit, onDelete }: Props) {
  const [lightbox, setLightbox]     = useState<string | null>(null);
  const [viewingFile, setViewingFile] = useState<TaskFile | null>(null);

  const bg  = category?.color ?? '#fffde7';
  const fg  = category ? textColor(bg) : '#1a1a2e';
  const fgM = `${fg}99`;

  const links    = task.links  ?? [];
  const images   = task.images ?? [];
  const files    = task.files  ?? [];
  const timeRange = fmtRange(task.startAt, task.endAt);

  const FILE_ICONS: Record<string, string> = { pdf: '📄', txt: '📝', csv: '📊' };

  return (
    <>
      <Draggable draggableId={task.id} index={index}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            className={`task-card${snapshot.isDragging ? ' dragging' : ''}`}
            style={{
              ...provided.draggableProps.style,
              background: bg,
              boxShadow: snapshot.isDragging ? '0 8px 24px rgba(0,0,0,0.25)' : '2px 3px 8px rgba(0,0,0,0.12)',
            }}
          >
            <div className="card-urgency" style={{ color: URGENCY_COLORS[task.urgency] }}>
              {URGENCY_LABELS[task.urgency]}
            </div>

            <div className="card-title" style={{ color: fg }}>{task.title}</div>

            {task.description && (
              <div className="card-desc" style={{ color: fgM }}>{task.description}</div>
            )}

            {/* ── Time range ── */}
            {timeRange && (
              <div className="card-time" style={{ color: fgM }}>
                ⏰ {timeRange}
              </div>
            )}

            {/* ── Location ── */}
            {task.location && (
              <a
                href={task.location}
                target="_blank"
                rel="noopener noreferrer"
                className="card-location"
                style={{ background: `${fg}18`, color: fg, border: `1px solid ${fg}33` }}
                onClick={e => e.stopPropagation()}
              >
                📍 {cleanUrl(task.location)}
              </a>
            )}

            {/* ── Images ── */}
            {images.length > 0 && (
              <div className="card-images">
                {images.map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    className="card-thumb"
                    alt=""
                    onClick={e => { e.stopPropagation(); setLightbox(url); }}
                    draggable={false}
                  />
                ))}
              </div>
            )}

            {/* ── File attachments ── */}
            {files.length > 0 && (
              <div className="card-files">
                {files.map((f, i) => (
                  <button
                    key={i}
                    className="card-file-chip"
                    style={{ background: `${fg}18`, color: fg, border: `1px solid ${fg}33` }}
                    onClick={e => { e.stopPropagation(); setViewingFile(f); }}
                  >
                    {FILE_ICONS[f.type]} {f.name}
                  </button>
                ))}
              </div>
            )}

            {/* ── Links ── */}
            {links.length > 0 && (
              <div className="card-links">
                {links.map((lnk, i) => (
                  <a
                    key={i}
                    href={lnk.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="card-link-chip"
                    style={{ background: `${fg}18`, color: fg, border: `1px solid ${fg}33` }}
                    onClick={e => e.stopPropagation()}
                  >
                    🔗 {lnk.label || cleanUrl(lnk.url)}
                  </a>
                ))}
              </div>
            )}

            <div className="card-footer">
              {category && (
                <span className="card-category" style={{ background: `${fg}22`, color: fg, border: `1px solid ${fg}44` }}>
                  {category.name}
                </span>
              )}
              <div className="card-actions">
                <button className="card-btn" style={{ color: fg }} onClick={() => onEdit(task)} title="Edit">✏️</button>
                <button className="card-btn" style={{ color: fg }} onClick={() => onDelete(task.id)} title="Delete">🗑️</button>
              </div>
            </div>
          </div>
        )}
      </Draggable>

      {/* ── Lightbox ── */}
      {lightbox && (
        <div className="lightbox-overlay" onClick={() => setLightbox(null)}>
          <img src={lightbox} className="lightbox-img" alt="" onClick={e => e.stopPropagation()} />
          <button className="lightbox-close" onClick={() => setLightbox(null)}>✕</button>
        </div>
      )}

      {/* ── File viewer ── */}
      {viewingFile && (
        <FileViewer file={viewingFile} onClose={() => setViewingFile(null)} />
      )}
    </>
  );
}
