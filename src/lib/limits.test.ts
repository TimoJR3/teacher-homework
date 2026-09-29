import { test } from "node:test";
import assert from "node:assert/strict";
import { safeMessage } from "./limits.ts";

test("safeMessage: обычные ошибки показываются", () => {
  assert.equal(safeMessage("Неверная почта или пароль."), "Неверная почта или пароль.");
  assert.equal(safeMessage("Пометка не сохранена: new row violates row-level security policy"),
    "Пометка не сохранена: new row violates row-level security policy");
  assert.equal(safeMessage(""), null);
  assert.equal(safeMessage(undefined), null);
});

test("safeMessage: подставные сообщения со ссылками и длинные не показываются", () => {
  assert.equal(safeMessage("Сайт переехал, войдите на https://evil.example"), null);
  assert.equal(safeMessage("Сайт переехал: teacher-homework-login.ru"), null);
  assert.equal(safeMessage("зайдите на www.evil"), null);
  assert.equal(safeMessage("x".repeat(301)), null);
});
