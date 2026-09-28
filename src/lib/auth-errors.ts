// Переводит ошибки входа Supabase на русский.
// Коды взяты из Supabase Auth (error.code); текст на английском проверяется как запасной вариант.

type AuthErrorLike = { code?: string; message: string } | null | undefined;

export function authErrorText(error: AuthErrorLike, action: "signin" | "signup"): string {
  const fallback =
    action === "signin"
      ? "Не получилось войти. Проверьте почту и пароль."
      : "Не получилось зарегистрироваться. Попробуйте ещё раз.";
  if (!error) return fallback;

  const wait = /after (\d+) seconds?/i.exec(error.message);
  if (wait) return `Слишком частые попытки. Подождите ${wait[1]} сек. и попробуйте снова.`;

  switch (error.code) {
    case "invalid_credentials":
      return "Неверная почта или пароль.";
    case "email_not_confirmed":
      return "Почта ещё не подтверждена. Откройте письмо от Supabase и перейдите по ссылке.";
    case "user_already_exists":
    case "email_exists":
      return "Аккаунт с этой почтой уже есть. Войдите через форму выше.";
    case "weak_password":
      return "Пароль слишком простой. Возьмите не меньше 8 символов, добавьте цифры.";
    case "email_address_invalid":
      return "Почта указана с ошибкой.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Слишком частые попытки. Подождите минуту и попробуйте снова.";
    case "signup_disabled":
      return "Регистрация сейчас закрыта.";
  }
  return fallback;
}
