import { AppState } from './types';

const KEY = 'scrum-canva-v1';

const OLD_DEFAULT_IDS = ['cat-feature', 'cat-bug', 'cat-tech', 'cat-research', 'cat-design'];

const DEFAULT_STATE: AppState = {
  tasks: [],
  categories: [],
};

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as AppState;
    parsed.categories = (parsed.categories ?? []).filter(
      c => !OLD_DEFAULT_IDS.includes(c.id)
    );
    return parsed;
  } catch {
    return DEFAULT_STATE;
  }
}

export function saveState(state: AppState): void {
  localStorage.setItem(KEY, JSON.stringify(state));
}
