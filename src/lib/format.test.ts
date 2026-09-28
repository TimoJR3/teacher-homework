import { test } from "node:test";
import assert from "node:assert/strict";
import { dueAtFromInput, dueInputValue } from "./format.ts";

test("due date round-trips through the date input", () => {
  const iso = dueAtFromInput("2026-10-05");
  assert.equal(iso, "2026-10-05T23:59:00+03:00");
  assert.equal(dueInputValue(iso), "2026-10-05");
  // Так срок приходит из базы: в UTC.
  assert.equal(dueInputValue("2026-10-05T20:59:00+00:00"), "2026-10-05");
});

test("empty or broken due date means no deadline", () => {
  assert.equal(dueAtFromInput(""), null);
  assert.equal(dueAtFromInput("05.10.2026"), null);
  assert.equal(dueInputValue(null), "");
});
