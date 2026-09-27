import { test } from "node:test";
import assert from "node:assert/strict";
import { assignedCount, isAssignedTo, recipientsByAssignment } from "./assignments.ts";

const rows = [
  { assignment_id: "a1", student_id: "s1" },
  { assignment_id: "a1", student_id: "s2" },
  { assignment_id: "a2", student_id: "s2" },
];

test("assignment without rows is for everyone", () => {
  const r = recipientsByAssignment(rows);
  assert.equal(isAssignedTo(r, "a3", "s1"), true);
  assert.equal(assignedCount(r, "a3", 5), 5);
});

test("assignment with rows is only for listed students", () => {
  const r = recipientsByAssignment(rows);
  assert.equal(isAssignedTo(r, "a2", "s1"), false);
  assert.equal(isAssignedTo(r, "a2", "s2"), true);
  assert.equal(assignedCount(r, "a1", 5), 2);
});
