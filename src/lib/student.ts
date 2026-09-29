import type { Assignment, Mark, Status, Submission } from "@/lib/types";

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
