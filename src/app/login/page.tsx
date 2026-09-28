import Link from "next/link";
import { signIn } from "@/app/actions";
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

      <section className="stack">
        <h2>Ещё нет аккаунта?</h2>
        <div className="list">
          <Link href="/signup/student">
            <span>Я ученик</span>
            <small>Сдавать задания и исправлять ошибки</small>
          </Link>
          <Link href="/signup/teacher">
            <span>Я преподаватель</span>
            <small>Давать задания и проверять работы. Нужен код преподавателя</small>
          </Link>
        </div>
      </section>
    </main>
  );
}
