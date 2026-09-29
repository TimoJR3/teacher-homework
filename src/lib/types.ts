export type Role = "teacher" | "student";
export type Status = "submitted" | "returned" | "fixed" | "accepted";

export type Profile = { id: string; email: string; full_name: string; role: Role };
export type Topic = { id: string; name: string; rule: string; sort_order: number };
export type Assignment = {
  id: string;
  title: string;
  description: string;
  due_at: string | null;
  // Страницы учебника, например «English File Pre-Intermediate, Unit 3B, с. 24–25».
  textbook: string;
  created_at: string;
};
export type Material = {
  id: string;
  assignment_id: string;
  path: string;
  name: string;
  size: number;
  mime: string;
  created_at: string;
};
export type AssignmentStudent = { assignment_id: string; student_id: string };
export type Submission = {
  id: string;
  assignment_id: string;
  student_id: string;
  body: string;
  status: Status;
  submitted_at: string;
  updated_at: string;
};
export type Mark = {
  id: string;
  submission_id: string;
  start_offset: number;
  end_offset: number;
  quote: string;
  topic_id: string;
  comment: string;
  student_fix: string;
  created_at: string;
};

export const STATUS_LABEL: Record<Status, string> = {
  submitted: "Сдано",
  returned: "На исправлении",
  fixed: "Исправлено",
  accepted: "Принято",
};
export type NoteKind = "rule" | "word" | "note";
export type Note = { id: string; student_id: string; kind: NoteKind; body: string; created_at: string; updated_at: string };

export const NOTE_KINDS: { kind: NoteKind; label: string; many: string }[] = [
  { kind: "rule", label: "Правило", many: "Правила" },
  { kind: "word", label: "Слово", many: "Слова" },
  { kind: "note", label: "Заметка", many: "Заметки" },
];

export function isNoteKind(v: string): v is NoteKind {
  return NOTE_KINDS.some((k) => k.kind === v);
}
