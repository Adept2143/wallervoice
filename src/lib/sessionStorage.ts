export interface Session {
  id: number;
  type: 'voice' | 'story' | 'delivery';
  score: number;
  date: string;
  durationSeconds: number;
}

const SESSIONS_KEY = 'wallervoice_sessions';
const COMPLETED_KEY = 'wallervoice_completed_exercises';

export function getSessions(): Session[] {
  try {
    return JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]');
  } catch {
    return [];
  }
}

export function addSession(session: Session): void {
  const sessions = getSessions();
  sessions.push(session);
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  window.dispatchEvent(new Event('wallervoice:session-saved'));
}

export function getCompletedExercises(): number[] {
  try {
    return JSON.parse(localStorage.getItem(COMPLETED_KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveCompletedExercises(ids: number[]): void {
  localStorage.setItem(COMPLETED_KEY, JSON.stringify(ids));
}

export function getTotalRecordings(): number {
  return getSessions().length;
}

export function getTotalStories(): number {
  return getSessions().filter(s => s.type === 'story').length;
}

export function getThisWeekSessionCount(): number {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  return getSessions().filter(s => new Date(s.date) >= startOfWeek).length;
}

export function getStreak(): number {
  const sessions = getSessions();
  if (sessions.length === 0) return 0;

  const daySet = new Set<string>();
  sessions.forEach(s => {
    const d = new Date(s.date);
    daySet.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
  });

  const today = new Date();
  let streak = 0;
  let check = new Date(today);

  // Check if today has a session; if not, start from yesterday
  const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
  if (!daySet.has(todayKey)) {
    check.setDate(check.getDate() - 1);
    const yKey = `${check.getFullYear()}-${check.getMonth()}-${check.getDate()}`;
    if (!daySet.has(yKey)) return 0;
  }

  while (true) {
    const key = `${check.getFullYear()}-${check.getMonth()}-${check.getDate()}`;
    if (daySet.has(key)) {
      streak++;
      check.setDate(check.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

export function getWeeklyScores(): { day: string; score: number }[] {
  const sessions = getSessions();
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const result: { day: string; score: number }[] = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const daySessions = sessions.filter(s => {
      const sd = new Date(s.date);
      return `${sd.getFullYear()}-${sd.getMonth()}-${sd.getDate()}` === key;
    });
    const avg = daySessions.length > 0
      ? Math.round(daySessions.reduce((sum, s) => sum + s.score, 0) / daySessions.length)
      : 0;
    result.push({ day: days[d.getDay()], score: avg });
  }

  return result;
}

export function getRecentActivity(limit = 5): Session[] {
  return getSessions().sort((a, b) => b.id - a.id).slice(0, limit);
}

export function formatSessionDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();

  if (isToday) return `Today ${time}`;
  if (isYesterday) return `Yesterday ${time}`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + time;
}
