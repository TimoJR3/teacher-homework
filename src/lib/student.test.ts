import { test } from "node:test";
import assert from "node:assert/strict";
import { bucketAssignments, lastWeek, splitWord, streak, upcoming } from "./student.ts";
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

test("streak counts consecutive days and survives until the end of today", () => {
  const days = ["2026-09-25", "2026-09-27", "2026-09-28", "2026-09-29"];
  assert.deepEqual(streak(days, "2026-09-29"), { count: 3, today: true });
  // Сегодня ещё не занимался: серия по вчерашний день.
  assert.deepEqual(streak(days, "2026-09-30"), { count: 3, today: false });
  // Пропущен целый день: серия прервалась.
  assert.deepEqual(streak(days, "2026-10-01"), { count: 0, today: false });
  // Через границу месяца.
  assert.deepEqual(streak(["2026-09-30", "2026-10-01"], "2026-10-01"), { count: 2, today: true });
});

test("last week ends today", () => {
  const w = lastWeek(["2026-09-29", "2026-09-23"], "2026-09-29");
  assert.equal(w.length, 7);
  assert.deepEqual(w[0], { day: "2026-09-23", done: true });
  assert.deepEqual(w[6], { day: "2026-09-29", done: true });
  assert.equal(w.filter((d) => d.done).length, 2);
});

test("a word note splits into the word and its translation", () => {
  assert.deepEqual(splitWord("borrow — брать взаймы"), ["borrow", "брать взаймы"]);
  assert.deepEqual(splitWord("look after - присматривать"), ["look after", "присматривать"]);
  assert.deepEqual(splitWord("well-known – известный"), ["well-known", "известный"]);
  assert.equal(splitWord("просто слово"), null);
});
