import { test } from "node:test";
import assert from "node:assert/strict";
import { authErrorText } from "./auth-errors.ts";

test("rate limit message keeps the number of seconds", () => {
  const text = authErrorText(
    { code: "over_email_send_rate_limit", message: "For security purposes, you can only request this after 42 seconds." },
    "signup",
  );
  assert.equal(text, "Слишком частые попытки. Подождите 42 сек. и попробуйте снова.");
});

test("known codes are translated", () => {
  assert.equal(
    authErrorText({ code: "email_not_confirmed", message: "Email not confirmed" }, "signin"),
    "Почта ещё не подтверждена. Откройте письмо от Supabase и перейдите по ссылке.",
  );
  assert.match(authErrorText({ code: "user_already_exists", message: "x" }, "signup"), /уже есть/);
});

test("unknown errors fall back to a generic Russian message", () => {
  assert.equal(authErrorText({ message: "Something odd" }, "signin"), "Не получилось войти. Проверьте почту и пароль.");
  assert.match(authErrorText(undefined, "signup"), /^Не получилось зарегистрироваться/);
});
