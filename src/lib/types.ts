export type Role = "teacher" | "student";
export type Status = "submitted" | "returned" | "fixed" | "accepted";

export type Profile = { id: string; email: string; full_name: string; role: Role };
export type Topic = { id: string; name: string; rule: string; sort_order: number };
export type Assignment = {
  id: string;
  title: string;
  description: string;
  due_at: string | null;
  created_at: string;
};
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
