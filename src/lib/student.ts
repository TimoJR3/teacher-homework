import { addDays } from "./format.ts";
import type { Assignment, Mark, Status, Submission } from "./types.ts";

// Пометка вместе со статусом работы, к которой она относится.
export type MistakeRow = Pick<Mark, "id" | "quote" | "comment" | "student_fix" | "topic_id" | "created_at"> & {
  submissions: { status: Status; assignment_id: string };
};

export const MISTAKE_SELECT =
  "id, quote, comment, student_fix, topic_id, created_at, submissions!inner(status, assignment_id)";

export type Buckets = {
  todo: Assignment[]; // не сдано или вернули на исправление
  waiting: Assignment[]; // ждёт проверки
  done: Assignment[]; // принято
};

export function bucketAssignments(assignments: Assignment[], subByAssignment: Map<string, Submission>): Buckets {
  const b: Buckets = { todo: [], waiting: [], done: [] };
  for (const a of assignments) {
    const status = subByAssignment.get(a.id)?.status;
    if (!status || status === "returned") b.todo.push(a);
    else if (status === "accepted") b.done.push(a);
    else b.waiting.push(a);
  }
  return b;
}

// Ближайшие сроки: только то, что ещё нужно сделать, по возрастанию даты.
export function upcoming(todo: Assignment[]): (Assignment & { due_at: string })[] {
  return todo
    .filter((a): a is Assignment & { due_at: string } => a.due_at !== null)
    .sort((x, y) => x.due_at.localeCompare(y.due_at));
}

// Сколько дней подряд ученик занимается. Если сегодня ещё не занимался,
// серия не прервана, пока есть вчерашний день.
export function streak(days: string[], today: string): { count: number; today: boolean } {
  const set = new Set(days);
  const doneToday = set.has(today);
  let day = doneToday ? today : addDays(today, -1);
  let count = 0;
  while (set.has(day)) {
    count++;
    day = addDays(day, -1);
  }
  return { count, today: doneToday };
}

// Последние 7 дней, заканчивая сегодняшним.
export function lastWeek(days: string[], today: string): { day: string; done: boolean }[] {
  const set = new Set(days);
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(today, i - 6);
    return { day, done: set.has(day) };
  });
}

// «borrow — брать взаймы»: слово отдельно, перевод отдельно.
export function splitWord(body: string): [string, string] | null {
  const m = /^(.+?)\s+[—–-]\s+([\s\S]+)$/.exec(body.trim());
  return m ? [m[1].trim(), m[2].trim()] : null;
}

export function shuffle<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
