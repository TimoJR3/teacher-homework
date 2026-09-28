import Link from "next/link";
import { signUp } from "@/app/actions";
import { ErrorBanner } from "@/components/ui";
import type { Role } from "@/lib/types";

// Регистрация ученика и преподавателя: одна форма, у преподавателя есть поле для кода.
export function SignupForm({ role, error }: { role: Role; error?: string | string[] }) {
  const teacher = role === "teacher";
  return (
    <main className="stack auth">
      <Link href="/login" className="small">
        ← Вход
      </Link>
      <h1>{teacher ? "Регистрация преподавателя" : "Регистрация ученика"}</h1>
      <p className="muted">
        {teacher
          ? "Код преподавателя выдаёт тот, кто ведёт сайт. Без кода зарегистрироваться преподавателем нельзя."
          : "После регистрации вы увидите задания, которые выдал преподаватель."}
      </p>
      <ErrorBanner error={error} />

      <form action={signUp} className="panel">
        <input type="hidden" name="role" value={role} />
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
        {teacher ? (
          <label>
            Код преподавателя
            <input type="text" name="teacher_code" id="signup-teacher-code" required autoComplete="off" />
          </label>
        ) : null}
        <button className="btn primary" type="submit">
          Зарегистрироваться
        </button>
      </form>

      <p className="muted small">
        {teacher ? (
          <>
            Вы ученик? <Link href="/signup/student">Регистрация ученика</Link>
          </>
        ) : (
          <>
            Вы преподаватель? <Link href="/signup/teacher">Регистрация преподавателя</Link>
          </>
        )}
      </p>
    </main>
  );
}
