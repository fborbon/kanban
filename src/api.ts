import { AppState, TaskFile, FileType } from './types';

const BASE = '/api';
const CANONICAL_ORIGIN = 'https://kanban.forwardforecasting.eu';

// Rewrite file URLs from old domains or old /app/ path prefix to canonical form.
export function normalizeFileUrl(url: string): string {
  try {
    const u = new URL(url);
    const OLD_ORIGINS = [
      'scrum.forwardforecasting.eu',
      'dj8fh2qub7vc.cloudfront.net',
    ];

    // Normalise origin
    let pathname = u.pathname;
    if (OLD_ORIGINS.includes(u.hostname)) {
      // fall through — origin rewritten below
    } else if (u.hostname !== 'kanban.forwardforecasting.eu') {
      return url; // unrelated domain — leave untouched
    }

    // Strip legacy /app prefix (app used to be served at /app/)
    if (pathname.startsWith('/app/')) pathname = pathname.slice(4);

    return CANONICAL_ORIGIN + pathname + u.search + u.hash;
  } catch { /* not a URL — return as-is */ }
  return url;
}

// Auth is handled by the central login (Authelia) in front of this app: the browser's session
// cookie travels with every same-origin request. An expired session makes nginx answer with a
// redirect to the login portal; `redirect: 'manual'` turns that into an opaque response, which
// we report as UNAUTHORIZED so the app can reload into the portal.
async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${BASE}${path}`, { ...init, credentials: 'same-origin', redirect: 'manual' });
  if (res.type === 'opaqueredirect' || res.status === 401) throw new Error('UNAUTHORIZED');
  return res;
}

export function goToLogin(): void {
  // Go to the portal explicitly: a plain reload could be answered by the PWA service worker's cache.
  window.location.href = 'https://forwardforecasting.eu/auth/?rd=' + encodeURIComponent(window.location.href);
}

export function logout(): void {
  window.location.href = 'https://forwardforecasting.eu/auth/logout';
}

export async function fetchState(): Promise<AppState> {
  const res = await apiFetch('/state');
  if (!res.ok) throw new Error('Failed to load state');
  return res.json() as Promise<AppState>;
}

async function compressImage(file: File): Promise<{ data: string; mimeType: string; filename: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 1200;
      const ratio = Math.min(1, MAX / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.width  * ratio);
      canvas.height = Math.round(img.height * ratio);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
      resolve({ data: dataUrl.split(',')[1], mimeType: 'image/jpeg', filename: file.name.replace(/\.[^.]+$/, '.jpg') });
    };
    img.onerror = reject;
    img.src = url;
  });
}

export async function uploadImage(file: File): Promise<string> {
  const compressed = await compressImage(file);
  const res = await apiFetch('/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(compressed),
  });
  if (!res.ok) throw new Error('Upload failed');
  const { url } = await res.json() as { url: string };
  return url;
}

function detectFileType(file: File): FileType {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'pdf' || file.type === 'application/pdf') return 'pdf';
  if (ext === 'csv' || file.type === 'text/csv') return 'csv';
  return 'txt';
}

async function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function uploadFile(file: File): Promise<TaskFile> {
  const type = detectFileType(file);
  const mimeMap: Record<FileType, string> = { pdf: 'application/pdf', txt: 'text/plain', csv: 'text/csv' };
  const data = await readAsBase64(file);
  const res = await apiFetch('/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data, mimeType: mimeMap[type], filename: file.name }),
  });
  if (!res.ok) throw new Error('Upload failed');
  const { url } = await res.json() as { url: string };
  return { url, name: file.name, type };
}

export async function pushState(state: AppState): Promise<void> {
  await apiFetch('/state', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state),
  });
}
