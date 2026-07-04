import { useState, useEffect } from 'react';
import { TaskFile } from '../types';

interface Props {
  file: TaskFile;
  onClose: () => void;
}

function CsvTable({ text }: { text: string }) {
  const rows = text.trim().split('\n').map(r =>
    // handle quoted commas simply
    r.match(/(".*?"|[^,]+|(?<=,)(?=,)|^(?=,)|(?<=,)$)/g)?.map(c => c.replace(/^"|"$/g, '').trim()) ?? [r]
  );
  if (!rows.length) return <p className="fv-empty">Empty file.</p>;
  const [header, ...body] = rows;
  return (
    <div className="fv-table-wrap">
      <table className="fv-table">
        <thead>
          <tr>{header.map((h, i) => <th key={i}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {body.map((row, i) => (
            <tr key={i}>
              {header.map((_, j) => <td key={j}>{row[j] ?? ''}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function FileViewer({ file, onClose }: Props) {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(file.type !== 'pdf');

  useEffect(() => {
    if (file.type === 'txt' || file.type === 'csv') {
      fetch(file.url)
        .then(r => r.text())
        .then(t => { setText(t); setLoading(false); })
        .catch(() => { setText('Could not load file.'); setLoading(false); });
    }
  }, [file]);

  const FILE_ICONS: Record<string, string> = { pdf: '📄', txt: '📝', csv: '📊' };

  return (
    <div className="fv-overlay" onClick={onClose}>
      <div className="fv-modal" onClick={e => e.stopPropagation()}>
        <div className="fv-header">
          <span className="fv-icon">{FILE_ICONS[file.type]}</span>
          <span className="fv-name">{file.name}</span>
          <a
            className="fv-download"
            href={file.url}
            download={file.name}
            onClick={e => e.stopPropagation()}
            title="Download"
          >
            ⬇️
          </a>
          <button className="fv-close" onClick={onClose}>✕</button>
        </div>

        <div className="fv-body">
          {file.type === 'pdf' && (
            <iframe
              src={file.url}
              className="fv-pdf"
              title={file.name}
            />
          )}

          {file.type === 'txt' && (
            loading
              ? <div className="fv-loading">Loading…</div>
              : <pre className="fv-text">{text}</pre>
          )}

          {file.type === 'csv' && (
            loading
              ? <div className="fv-loading">Loading…</div>
              : <CsvTable text={text ?? ''} />
          )}
        </div>
      </div>
    </div>
  );
}
