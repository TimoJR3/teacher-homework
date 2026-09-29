import { test } from "node:test";
import assert from "node:assert/strict";
import { bucketAssignments, upcoming } from "./student.ts";
import type { Assignment, Submission } from "./types.ts";

const a = (id: string, due_at: string | null = null): Assignment => ({ id, title: id, description: "", due_at, created_at: "" });
const s = (assignment_id: string, status: Submission["status"]): Submission => ({
  id: `s-${assignment_id}`, assignment_id, student_id: "me", body: "x", status, submitted_at: "", updated_at: "",
});

test("assignments are split by what the student has to do", () => {
  const subs = new Map([s("b", "returned"), s("c", "submitted"), s("d", "fixed"), s("e", "accepted")].map((x) => [x.assignment_id, x]));
  const b = bucketAssignments([a("a"), a("b"), a("c"), a("d"), a("e")], subs);
  assert.deepEqual(b.todo.map((x) => x.id), ["a", "b"]);
  assert.deepEqual(b.waiting.map((x) => x.id), ["c", "d"]);
  assert.deepEqual(b.done.map((x) => x.id), ["e"]);
});

test("upcoming deadlines skip undated work and go soonest first", () => {
  const list = upcoming([a("late", "2026-10-09"), a("none"), a("soon", "2026-10-01")]);
  assert.deepEqual(list.map((x) => x.id), ["soon", "late"]);
});
