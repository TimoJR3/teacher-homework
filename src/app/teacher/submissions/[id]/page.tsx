import Link from "next/link";
import { notFound } from "next/navigation";
import { addMark, deleteMark, reviewSubmission } from "@/app/actions";
import { requireRole } from "@/lib/auth";
import { displayName, formatDate } from "@/lib/format";
import type { Assignment, Mark, Profile, Submission, Topic } from "@/lib/types";
import { Annotator } from "@/components/annotator";
import { ErrorBanner, Header, MarkList, MarkedText, StatusPill, TopicStats } from "@/components/ui";

export default async function ReviewPage(props: PageProps<"/teacher/submissions/[id]">) {
  const { id } = await props.params;
  const { error } = await props.searchParams;
  const { profile, supabase } = await requireRole("teacher");

  const { data: submission } = await supabase.from("submissions").select("*").eq("id", id).maybeSingle();
  if (!submission) notFound();
  const sub = submission as Submission;

  const [{ data: assignment }, { data: student }, { data: marks }, { data: topics }, { data: studentMarks }] =
    await Promise.all([
      supabase.from("assignments").select("*").eq("id", sub.assignment_id).single(),
      supabase.from("profiles").select("id, email, full_name, role").eq("id", sub.student_id).single(),
      supabase.from("marks").select("*").eq("submission_id", id).order("start_offset"),
      supabase.from("topics").select("*").order("sort_order"),
      supabase.from("marks").select("topic_id, submissions!inner(student_id)").eq("submissions.student_id", sub.student_id),
    ]);

  const a = assignment as Assignment;
  const ms = (marks ?? []) as Mark[];
  const ts = (topics ?? []) as Topic[];
  const editable = sub.status === "submitted" || sub.status === "fixed";

  return (
    <>
      <Header profile={profile} />
      <ErrorBanner error={error} />
      <div className="cols">
        <main className="stack">
          <Link href="/teacher" className="small">
            ← Все работы
          </Link>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div className="stack" style={{ gap: 4 }}>
              <p className="eyebrow">
                {displayName(student as Profile)} · сдано {formatDate(sub.submitted_at)} · срок {formatDate(a.due_at)}
              </p>
              <h1>{a.title}</h1>
            </div>
            <StatusPill status={sub.status} />
          </div>
          {a.description ? <p className="muted">{a.description}</p> : null}

          {editable ? (
            <Annotator
              key={ms.length}
              body={sub.body}
              marks={ms}
              topics={ts}
              action={addMark.bind(null, sub.id)}
            />
          ) : (
            <MarkedText body={sub.body} marks={ms} showFixed />
          )}

          <h2>Пометки</h2>
          <MarkList
            marks={ms}
            topics={ts}
            renderExtra={(m) => (
              <>
                {m.student_fix ? <span className="fix-given">Исправление ученика: {m.student_fix}</span> : null}
                {editable ? (
                  <form action={deleteMark.bind(null, sub.id, m.id)}>
                    <button className="btn danger small" type="submit">
                      Удалить пометку
                    </button>
                  </form>
                ) : null}
              </>
            )}
          />

          {editable ? (
            <div className="row">
              <form action={reviewSubmission.bind(null, sub.id, "returned")}>
                <button className="btn" type="submit" disabled={!ms.length}>
                  Вернуть на исправление
                </button>
              </form>
              <form action={reviewSubmission.bind(null, sub.id, "accepted")}>
                <button className="btn primary" type="submit">
                  Принять
                </button>
              </form>
            </div>
          ) : (
            <p className="muted small">
              {sub.status === "returned"
                ? "Работа у ученика на исправлении."
                : "Работа принята."}
            </p>
          )}
        </main>

        <aside className="stack">
          <h3>Темы ученика по всем работам</h3>
          <TopicStats marks={(studentMarks ?? []) as Pick<Mark, "topic_id">[]} topics={ts} />
        </aside>
      </div>
    </>
  );
}
