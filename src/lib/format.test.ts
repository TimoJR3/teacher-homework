import { test } from "node:test";
import assert from "node:assert/strict";
import { dueAtFromInput, dueInputValue, dueLabel, plural } from "./format.ts";

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

test("russian plural forms", () => {
  assert.equal(plural(1, "день", "дня", "дней"), "день");
  assert.equal(plural(3, "день", "дня", "дней"), "дня");
  assert.equal(plural(11, "день", "дня", "дней"), "дней");
  assert.equal(plural(22, "день", "дня", "дней"), "дня");
  assert.equal(plural(25, "день", "дня", "дней"), "дней");
});

test("days left until the due date, by Moscow calendar days", () => {
  const now = new Date("2026-09-28T22:00:00Z"); // в Москве уже 29 сентября, 01:00
  assert.deepEqual(dueLabel("2026-09-29T20:59:00Z", now), { text: "сегодня", late: false });
  assert.deepEqual(dueLabel("2026-09-30T20:59:00Z", now), { text: "завтра", late: false });
  assert.deepEqual(dueLabel("2026-10-03T20:59:00Z", now), { text: "через 4 дня", late: false });
  assert.deepEqual(dueLabel("2026-09-28T20:59:00Z", now), { text: "срок прошёл", late: true });
});
