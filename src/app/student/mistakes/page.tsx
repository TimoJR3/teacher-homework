import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { formatDate, plural } from "@/lib/format";
import { MISTAKE_SELECT, type MistakeRow } from "@/lib/student";
import type { Assignment, Topic } from "@/lib/types";
import { Header } from "@/components/ui";

// Работа над ошибками: все пометки из проверенных работ, по темам.
export default async function MistakesPage() {
  const { profile, supabase } = await requireRole("student");

  const [{ data: marks }, { data: topics }, { data: assignments }] = await Promise.all([
    supabase
      .from("marks")
      .select(MISTAKE_SELECT)
      .neq("submissions.status", "submitted")
      .order("created_at", { ascending: false }),
    supabase.from("topics").select("*").order("sort_order"),
    supabase.from("assignments").select("id, title"),
  ]);

  const rows = (marks ?? []) as unknown as MistakeRow[];
  const topicById = new Map(((topics ?? []) as Topic[]).map((t) => [t.id, t]));
  const titleById = new Map(((assignments ?? []) as Pick<Assignment, "id" | "title">[]).map((a) => [a.id, a.title]));

  const groups = new Map<string, MistakeRow[]>();
  for (const m of rows) groups.set(m.topic_id, [...(groups.get(m.topic_id) ?? []), m]);
  const ordered = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
  const fixed = rows.filter((m) => m.student_fix).length;

  return (
    <>
      <Header profile={profile} />
      <main className="stack">
        <div className="hello">
          <div>
            <h1>Работа над ошибками</h1>
            <p className="muted">
              Все пометки преподавателя из проверенных работ, сгруппированные по темам. Сначала темы, где ошибок
              больше всего.
            </p>
          </div>
          <dl className="tally">
            <div>
              <dt>{plural(rows.length, "ошибка", "ошибки", "ошибок")}</dt>
              <dd className="num">{rows.length}</dd>
            </div>
            <div>
              <dt>исправлено</dt>
              <dd className="num">{fixed}</dd>
            </div>
            <div>
              <dt>{plural(ordered.length, "тема", "темы", "тем")}</dt>
              <dd className="num">{ordered.length}</dd>
            </div>
          </dl>
        </div>

        {ordered.length ? (
          <div className="mistake-groups">
            {ordered.map(([topicId, list]) => {
              const t = topicById.get(topicId);
              return (
                <section key={topicId} className="mistake-group">
                  <header>
                    <h2>{t?.name ?? "Тема удалена"}</h2>
                    <span className="count num">{list.length}</span>
                  </header>
                  {t?.rule ? <p className="rule">Повторить: {t.rule}</p> : null}
                  <ul>
                    {list.map((m) => (
                      <li key={m.id}>
                        <p className="pair">
                          <del>{m.quote}</del>
                          <span aria-hidden="true">→</span>
                          {m.student_fix ? <ins>{m.student_fix}</ins> : <span className="muted">ещё не исправлено</span>}
                        </p>
                        {m.comment ? <p className="comment">{m.comment}</p> : null}
                        <small className="muted">
                          <Link href={`/student/assignments/${m.submissions.assignment_id}`}>
                            {titleById.get(m.submissions.assignment_id) ?? "Работа"}
                          </Link>{" "}
                          · {formatDate(m.created_at)}
                        </small>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        ) : (
          <div className="notes-empty">
            <p>Ошибок пока нет.</p>
            <p className="muted small">
              Когда преподаватель проверит вашу работу и отметит ошибки, они соберутся здесь по темам, с вашими
              исправлениями.
            </p>
          </div>
        )}
      </main>
    </>
  );
}
