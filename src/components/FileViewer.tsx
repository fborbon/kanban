import { useState, useEffect, useRef } from 'react';
import { TaskFile } from '../types';
import { normalizeFileUrl } from '../api';

interface Props {
  file: TaskFile;
  onClose: () => void;
}

// ── PDF.js lazy loader (same pattern as Cloud Drive) ──────────────────────────
const PDFJS_VERSION = '3.11.174';
const PDFJS_CDN     = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`;

let _pdfjsLib: any = null;
let _pdfjsLoading: Promise<any> | null = null;

function loadPdfJs(): Promise<any> {
  if (_pdfjsLib) return Promise.resolve(_pdfjsLib);
  if (_pdfjsLoading) return _pdfjsLoading;

  _pdfjsLoading = new Promise<any>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `${PDFJS_CDN}/pdf.min.js`;
    script.onload = () => {
      (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
        `${PDFJS_CDN}/pdf.worker.min.js`;
      _pdfjsLib = (window as any).pdfjsLib;
      resolve(_pdfjsLib);
    };
    script.onerror = () => {
      _pdfjsLoading = null;
      reject(new Error('Failed to load PDF.js'));
    };
    document.head.appendChild(script);
  });

  return _pdfjsLoading;
}

// ── PDF canvas renderer ────────────────────────────────────────────────────────
function PdfViewer({ url }: { url: string }) {
  const wrapRef    = useRef<HTMLDivElement>(null);
  const canvasWrap = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'done' | 'error'>('loading');
  const [errMsg, setErrMsg]  = useState('');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const lib = await loadPdfJs();
        const pdf = await lib.getDocument(url).promise;
        if (cancelled || !canvasWrap.current) return;

        canvasWrap.current.innerHTML = '';

        for (let p = 1; p <= pdf.numPages; p++) {
          if (cancelled || !canvasWrap.current) return;

          const page   = await pdf.getPage(p);
          const baseVp = page.getViewport({ scale: 1 });
          const availW = (wrapRef.current?.clientWidth ?? 840) - 32;
          const scale  = Math.min(availW / baseVp.width, 2.5);
          const vp     = page.getViewport({ scale });

          const canvas   = document.createElement('canvas');
          canvas.width   = vp.width;
          canvas.height  = vp.height;
          canvas.style.cssText =
            'max-width:100%;display:block;border-radius:4px;' +
            'box-shadow:0 2px 12px rgba(0,0,0,.5);flex-shrink:0;';

          canvasWrap.current.appendChild(canvas);
          await page.render({
            canvasContext: canvas.getContext('2d')!,
            viewport: vp,
          }).promise;
        }

        if (!cancelled) setStatus('done');
      } catch (e) {
        if (!cancelled) {
          setStatus('error');
          setErrMsg((e as Error).message);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [url]);

  return (
    <div ref={wrapRef} className="fv-pdf-wrap">
      {status === 'loading' && (
        <div className="fv-pdf-overlay">
          <div className="fv-loading">⏳ Loading PDF…</div>
        </div>
      )}
      {status === 'error' && (
        <div className="fv-pdf-overlay">
          <div className="fv-loading" style={{ color: '#f44336' }}>⚠️ {errMsg}</div>
        </div>
      )}
      <div ref={canvasWrap} className="fv-canvas-stack" />
    </div>
  );
}

// ── CSV table ──────────────────────────────────────────────────────────────────
function CsvTable({ text }: { text: string }) {
  const rows = text.trim().split('\n').map(r =>
    r.match(/(".*?"|[^,]+|(?<=,)(?=,)|^(?=,)|(?<=,)$)/g)
     ?.map(c => c.replace(/^"|"$/g, '').trim()) ?? [r]
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

// ── Main component ─────────────────────────────────────────────────────────────
export default function FileViewer({ file, onClose }: Props) {
  const [text, setText]       = useState<string | null>(null);
  const [loading, setLoading] = useState(file.type === 'txt' || file.type === 'csv');
  const fileUrl = normalizeFileUrl(file.url);

  useEffect(() => {
    if (file.type === 'txt' || file.type === 'csv') {
      fetch(fileUrl)
        .then(r => r.text())
        .then(t => { setText(t); setLoading(false); })
        .catch(() => { setText('Could not load file.'); setLoading(false); });
    }
  }, [file, fileUrl]);

  const FILE_ICONS: Record<string, string> = { pdf: '📄', txt: '📝', csv: '📊' };

  return (
    <div className="fv-overlay" onClick={onClose}>
      <div className="fv-modal" onClick={e => e.stopPropagation()}>
        <div className="fv-header">
          <span className="fv-icon">{FILE_ICONS[file.type]}</span>
          <span className="fv-name">{file.name}</span>
          <a
            className="fv-download"
            href={fileUrl}
            download={file.name}
            onClick={e => e.stopPropagation()}
            title="Download"
          >
            ⬇️
          </a>
          <button className="fv-close" onClick={onClose}>✕</button>
        </div>

        <div className="fv-body">
          {file.type === 'pdf' && <PdfViewer url={fileUrl} />}

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
