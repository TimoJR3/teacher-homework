import type { AssignmentStudent } from "./types.ts";

// Кому выдано задание: список учеников или null, если всем.
export function recipientsByAssignment(rows: AssignmentStudent[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const r of rows) {
    const list = map.get(r.assignment_id);
    if (list) list.push(r.student_id);
    else map.set(r.assignment_id, [r.student_id]);
  }
  return map;
}

export function isAssignedTo(
  recipients: Map<string, string[]>,
  assignmentId: string,
  studentId: string,
): boolean {
  const list = recipients.get(assignmentId);
  return !list || list.includes(studentId);
}

export function assignedCount(
  recipients: Map<string, string[]>,
  assignmentId: string,
  totalStudents: number,
): number {
  return recipients.get(assignmentId)?.length ?? totalStudents;
}
