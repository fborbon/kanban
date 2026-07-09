import { AppState, Board } from './types';

const KEY = 'scrum-canva-v1';

const OLD_DEFAULT_IDS = ['cat-feature', 'cat-bug', 'cat-tech', 'cat-research', 'cat-design'];

export const GENERAL_BOARD_ID = 'general';
export const GENERAL_BOARD: Board = { id: GENERAL_BOARD_ID, name: 'General', color: '#6c63ff' };

const DEFAULT_STATE: AppState = {
  tasks: [],
  categories: [],
  boards: [GENERAL_BOARD],
};

export function migrateState(parsed: Partial<AppState>): AppState {
  const boards = parsed.boards?.length ? parsed.boards : [GENERAL_BOARD];
  const categories = (parsed.categories ?? []).filter(c => !OLD_DEFAULT_IDS.includes(c.id));
  const tasks = (parsed.tasks ?? []).map(t =>
    (t as AppState['tasks'][number] & { boardId?: string }).boardId
      ? t as AppState['tasks'][number]
      : { ...t, boardId: GENERAL_BOARD_ID } as AppState['tasks'][number]
  );
  return { tasks, categories, boards };
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_STATE;
    return migrateState(JSON.parse(raw) as Partial<AppState>);
  } catch {
    return DEFAULT_STATE;
  }
}

export function saveState(state: AppState): void {
  localStorage.setItem(KEY, JSON.stringify(state));
}
