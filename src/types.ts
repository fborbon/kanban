export type Urgency = 'today' | 'this-week' | 'this-month';
export type ColumnId = 'todo' | 'in-progress' | 'done' | 'backlog';

export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface Board {
  id: string;
  name: string;
  color: string;
}

export interface TaskLink {
  url: string;
  label: string;
}

export type FileType = 'pdf' | 'txt' | 'csv';

export interface TaskFile {
  url: string;
  name: string;
  type: FileType;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  categoryId: string | null;
  boardId: string;
  urgency: Urgency;
  column: ColumnId;
  order: number;
  createdAt: string;
  links: TaskLink[];
  images: string[];    // CloudFront URLs
  files: TaskFile[];   // PDF / TXT / CSV attachments
  date: string | null; // YYYY-MM-DD — auto-set on Done, manually settable
  location: string | null; // map URL
  startAt: string | null;  // datetime-local string
  endAt: string | null;
}

export interface AppState {
  tasks: Task[];
  categories: Category[];
  boards: Board[];
}
