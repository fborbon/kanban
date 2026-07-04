import { useState } from 'react';
import { Task, Category } from '../types';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const COL_LABELS: Record<string, string> = {
  todo: 'To Do', 'in-progress': 'In Progress', done: 'Done', backlog: 'Backlog',
};
const COL_DOT: Record<string, string> = {
  todo: '#6c63ff', 'in-progress': '#f59e0b', done: '#10b981', backlog: '#94a3b8',
};

function textColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 0.55 ? '#1a1a2e' : '#ffffff';
}

interface Props {
  tasks: Task[];
  categories: Category[];
  onEditTask: (task: Task) => void;
}

export default function CalendarView({ tasks, categories, onEditTask }: Props) {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed

  const todayStr = now.toISOString().slice(0, 10);

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };
  const goToday   = () => { setYear(now.getFullYear()); setMonth(now.getMonth()); };

  // Build grid: 6 weeks × 7 days
  const firstDay = new Date(year, month, 1);
  // Monday-first: getDay() returns 0=Sun; shift so Mon=0
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev  = new Date(year, month, 0).getDate();

  const cells: { dateStr: string; day: number; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const offset = i - startOffset;
    let day: number;
    let inMonth: boolean;
    let d: Date;
    if (offset < 0) {
      day = daysInPrev + offset + 1;
      inMonth = false;
      d = new Date(year, month - 1, day);
    } else if (offset >= daysInMonth) {
      day = offset - daysInMonth + 1;
      inMonth = false;
      d = new Date(year, month + 1, day);
    } else {
      day = offset + 1;
      inMonth = true;
      d = new Date(year, month, day);
    }
    const dateStr = d.toISOString().slice(0, 10);
    cells.push({ dateStr, day, inMonth });
  }

  // Map tasks by date
  const byDate = new Map<string, Task[]>();
  for (const t of tasks) {
    if (!t.date) continue;
    if (!byDate.has(t.date)) byDate.set(t.date, []);
    byDate.get(t.date)!.push(t);
  }

  // Count tasks with dates this month for summary
  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
  const monthTasks = tasks.filter(t => t.date?.startsWith(monthStr));

  return (
    <div className="cal-wrap">
      {/* ── Nav ── */}
      <div className="cal-nav">
        <button className="cal-arrow" onClick={prevMonth}>‹</button>
        <div className="cal-month-title">
          {MONTHS[month]} {year}
          <span className="cal-count">{monthTasks.length} task{monthTasks.length !== 1 ? 's' : ''}</span>
        </div>
        <button className="cal-today-btn" onClick={goToday}>Today</button>
        <button className="cal-arrow" onClick={nextMonth}>›</button>
      </div>

      {/* ── Weekday headers ── */}
      <div className="cal-grid">
        {WEEKDAYS.map(d => (
          <div key={d} className="cal-weekday">{d}</div>
        ))}

        {/* ── Day cells ── */}
        {cells.map(({ dateStr, day, inMonth }) => {
          const cellTasks = byDate.get(dateStr) ?? [];
          const isToday = dateStr === todayStr;
          return (
            <div
              key={dateStr}
              className={`cal-cell${inMonth ? '' : ' cal-cell-out'}${isToday ? ' cal-cell-today' : ''}`}
            >
              <div className={`cal-day-num${isToday ? ' cal-day-today' : ''}`}>{day}</div>
              <div className="cal-cell-tasks">
                {cellTasks.map(task => {
                  const cat = categories.find(c => c.id === task.categoryId);
                  const bg  = cat?.color ?? '#fffde7';
                  const fg  = cat ? textColor(bg) : '#1a1a2e';
                  return (
                    <button
                      key={task.id}
                      className="cal-task-pill"
                      style={{ background: bg, color: fg }}
                      onClick={() => onEditTask(task)}
                      title={task.title}
                    >
                      <span
                        className="cal-task-dot"
                        style={{ background: COL_DOT[task.column] ?? '#aaa' }}
                      />
                      <span className="cal-task-title">{task.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Legend ── */}
      <div className="cal-legend">
        {Object.entries(COL_DOT).map(([col, color]) => (
          <span key={col} className="cal-legend-item">
            <span className="cal-legend-dot" style={{ background: color }} />
            {COL_LABELS[col]}
          </span>
        ))}
      </div>
    </div>
  );
}
