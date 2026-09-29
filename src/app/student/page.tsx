import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { addDays, dueLabel, formatDate, greeting, moscowDay, todayLabel } from "@/lib/format";
import { bucketAssignments, MISTAKE_SELECT, upcoming, type MistakeRow } from "@/lib/student";
import { isNoteKind, type Assignment, type Note, type Submission, type Topic } from "@/lib/types";
import { ErrorBanner, Header, StatusPill, TopicStats } from "@/components/ui";
import { Notebook } from "@/components/notebook";
import { Streak } from "@/components/streak";

export default async function StudentHome(props: PageProps<"/student">) {
  const { error, kind } = await props.searchParams;
  const { profile, supabase } = await requireRole("student");

  const today = moscowDay();
  const [{ data: assignments }, { data: submissions }, { data: marks }, { data: topics }, notesRes, daysRes] = await Promise.all([
    supabase.from("assignments").select("*").order("created_at", { ascending: false }),
    supabase.from("submissions").select("*").eq("student_id", profile.id),
    // RLS отдаёт ученику только пометки к его собственным работам.
    // Работы, которые ещё проверяются, не учитываем.
    supabase
      .from("marks")
      .select(MISTAKE_SELECT)
      .neq("submissions.status", "submitted")
      .order("created_at", { ascending: false }),
    supabase.from("topics").select("*").order("sort_order"),
    supabase.from("notes").select("*").order("created_at", { ascending: false }),
    supabase.from("study_days").select("day").gte("day", addDays(today, -400)),
  ]);

  const subByAssignment = new Map(((submissions ?? []) as Submission[]).map((s) => [s.assignment_id, s]));
  const list = (assignments ?? []) as Assignment[];
  const titleById = new Map(list.map((a) => [a.id, a.title]));
  const b = bucketAssignments(list, subByAssignment);
  const returned = b.todo.filter((a) => subByAssignment.get(a.id)?.status === "returned").length;
  const mistakes = (marks ?? []) as unknown as MistakeRow[];
  const notes = (notesRes.data ?? []) as Note[];
  const kindFilter = typeof kind === "string" && isNoteKind(kind) ? kind : null;
  const deadlines = upcoming(b.todo).slice(0, 5);

  const tally = [
    { n: b.todo.length - returned, label: "нужно сдать" },
    { n: returned, label: "на исправлении" },
    { n: b.waiting.length, label: "ждут проверки" },
    { n: b.done.length, label: "принято" },
  ];

  const card = (a: Assignment) => {
    const s = subByAssignment.get(a.id);
    return (
      <Link key={a.id} href={`/student/assignments/${a.id}`}>
        <span>{a.title}</span>
        <StatusPill status={s?.status ?? null} />
        <small>срок: {formatDate(a.due_at)}</small>
      </Link>
    );
  };

  return (
    <>
      <Header profile={profile} />
      <ErrorBanner error={error} />

      <section className="hello">
        <div>
          <h1>{greeting()}!</h1>
          <p className="muted">{todayLabel()}</p>
        </div>
        {daysRes.error ? null : <Streak days={(daysRes.data ?? []).map((d) => d.day as string)} today={today} />}
        <dl className="tally">
          {tally.map((t) => (
            <div key={t.label}>
              <dt>{t.label}</dt>
              <dd className="num">{t.n}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="dash">
        <main className="stack">
          {list.length === 0 ? (
            <section className="stack">
              <h2>Заданий пока нет</h2>
              <p className="muted">Когда преподаватель задаст работу, она появится здесь. Дальше всё идёт так:</p>
              <ol className="howto">
                <li>
                  <b>Задание</b>
                  <span>Преподаватель задаёт тему и срок.</span>
                </li>
                <li>
                  <b>Ответ</b>
                  <span>Вы пишете текст прямо на сайте и сдаёте работу.</span>
                </li>
                <li>
                  <b>Проверка</b>
                  <span>Ошибки обводят и подписывают тему и комментарий.</span>
                </li>
                <li>
                  <b>Исправление</b>
                  <span>Вы исправляете ошибки, а темы попадают в список для повторения.</span>
                </li>
              </ol>
            </section>
          ) : null}
          {b.todo.length ? (
            <section className="stack">
              <h2>Нужно сделать</h2>
              <div className="list">{b.todo.map(card)}</div>
            </section>
          ) : null}
          {b.waiting.length ? (
            <section className="stack">
              <h2>Ждут проверки</h2>
              <div className="list">{b.waiting.map(card)}</div>
            </section>
          ) : null}
          {b.done.length ? (
            <section className="stack">
              <h2>Принятые</h2>
              <div className="list">{b.done.map(card)}</div>
            </section>
          ) : null}
        </main>

        <aside className="side">
          <section className="stack">
            <h3>Ближайшие сроки</h3>
            {deadlines.length ? (
              <ul className="deadlines">
                {deadlines.map((a) => {
                  const d = dueLabel(a.due_at);
                  return (
                    <li key={a.id}>
                      <Link href={`/student/assignments/${a.id}`}>{a.title}</Link>
                      <span className={d.late ? "late" : undefined}>{d.text}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="muted small">Сроков нет, можно выдохнуть.</p>
            )}
          </section>

          <section className="stack">
            <h3>Мои темы для повторения</h3>
            <TopicStats marks={mistakes} topics={(topics ?? []) as Topic[]} />
          </section>

          <section className="stack">
            <h3>Последние ошибки</h3>
            {mistakes.length ? (
              <>
                <ul className="recent">
                  {mistakes.slice(0, 3).map((m) => (
                    <li key={m.id}>
                      <del>{m.quote}</del>
                      {m.student_fix ? <ins>{m.student_fix}</ins> : <span className="muted small"> ещё не исправлено</span>}
                      <small className="muted">{titleById.get(m.submissions.assignment_id)}</small>
                    </li>
                  ))}
                </ul>
                <Link href="/student/mistakes" className="small">
                  Все ошибки: {mistakes.length} →
                </Link>
              </>
            ) : (
              <p className="muted small">Здесь появятся ошибки из проверенных работ.</p>
            )}
          </section>
        </aside>
      </div>

      <Notebook notes={notes} filter={kindFilter} unavailable={!!notesRes.error} />
    </>
  );
}
