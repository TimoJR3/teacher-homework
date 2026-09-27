import { signIn, signUp } from "@/app/actions";
import { ErrorBanner } from "@/components/ui";

export default async function LoginPage(props: PageProps<"/login">) {
  const { error } = await props.searchParams;
  return (
    <main className="stack auth">
      <h1>Тетрадь с пометками</h1>
      <p className="muted">Задания, проверка работ и темы, которые стоит повторить.</p>
      <ErrorBanner error={error} />

      <form action={signIn} className="panel">
        <h2>Вход</h2>
        <label>
          Почта
          <input type="email" name="email" id="login-email" required autoComplete="email" />
        </label>
        <label>
          Пароль
          <input type="password" name="password" id="login-password" required autoComplete="current-password" />
        </label>
        <button className="btn primary" type="submit">
          Войти
        </button>
      </form>

      <form action={signUp} className="panel">
        <h2>Регистрация</h2>
        <p className="muted small">Новый аккаунт становится учеником. Преподавателя назначают отдельно.</p>
        <label>
          Имя и фамилия
          <input type="text" name="full_name" id="signup-name" required autoComplete="name" />
        </label>
        <label>
          Почта
          <input type="email" name="email" id="signup-email" required autoComplete="email" />
        </label>
        <label>
          Пароль, не короче 8 символов
          <input type="password" name="password" id="signup-password" required minLength={8} autoComplete="new-password" />
        </label>
        <button className="btn" type="submit">
          Зарегистрироваться
        </button>
      </form>
    </main>
  );
}
