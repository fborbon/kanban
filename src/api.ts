import { AppState, TaskFile, FileType } from './types';

const BASE = '/api';
const TOKEN_KEY = 'scrum-jwt';
const CANONICAL_ORIGIN = 'https://kanban.forwardforecasting.eu';

// Rewrite file URLs that still point to the old scrum domain or raw CloudFront.
export function normalizeFileUrl(url: string): string {
  try {
    const u = new URL(url);
    const OLD_ORIGINS = [
      'scrum.forwardforecasting.eu',
      'dj8fh2qub7vc.cloudfront.net',
    ];
    if (OLD_ORIGINS.includes(u.hostname)) {
      return CANONICAL_ORIGIN + u.pathname + u.search + u.hash;
    }
  } catch { /* not a URL — return as-is */ }
  return url;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export async function login(username: string, password: string): Promise<void> {
  const res = await fetch(`${BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error('Invalid credentials');
  const { token } = await res.json() as { token: string };
  localStorage.setItem(TOKEN_KEY, token);
}

export async function fetchState(): Promise<AppState> {
  const token = getToken();
  const res = await fetch(`${BASE}/state`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) { clearToken(); throw new Error('UNAUTHORIZED'); }
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
  const token = getToken();
  const res = await fetch(`${BASE}/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(compressed),
  });
  if (res.status === 401) { clearToken(); throw new Error('UNAUTHORIZED'); }
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
  const token = getToken();
  const res = await fetch(`${BASE}/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ data, mimeType: mimeMap[type], filename: file.name }),
  });
  if (res.status === 401) { clearToken(); throw new Error('UNAUTHORIZED'); }
  if (!res.ok) throw new Error('Upload failed');
  const { url } = await res.json() as { url: string };
  return { url, name: file.name, type };
}

export async function pushState(state: AppState): Promise<void> {
  const token = getToken();
  const res = await fetch(`${BASE}/state`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(state),
  });
  if (res.status === 401) { clearToken(); throw new Error('UNAUTHORIZED'); }
}
