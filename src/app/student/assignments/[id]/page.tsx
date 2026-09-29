import Link from "next/link";
import { notFound } from "next/navigation";
import { sendFixes, submitWork } from "@/app/actions";
import { requireRole } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import type { Assignment, Mark, Submission, Topic } from "@/lib/types";
import { ErrorBanner, Header, MarkList, MarkedText, StatusPill } from "@/components/ui";
import { loadMaterials, Materials } from "@/components/materials";

const STATUS_HINT = {
  submitted: "Работа отправлена и ждёт проверки.",
  fixed: "Исправления отправлены, преподаватель посмотрит их.",
  accepted: "Работа принята.",
} as const;

export default async function AssignmentPage(props: PageProps<"/student/assignments/[id]">) {
  const { id } = await props.params;
  const { error } = await props.searchParams;
  const { profile, supabase } = await requireRole("student");

  const { data: assignment } = await supabase.from("assignments").select("*").eq("id", id).maybeSingle();
  if (!assignment) notFound();
  const a = assignment as Assignment;

  const { data: submission } = await supabase
    .from("submissions")
    .select("*")
    .eq("assignment_id", id)
    .eq("student_id", profile.id)
    .maybeSingle();
  const sub = submission as Submission | null;

  const [{ data: marks }, { data: topics }, materials] = await Promise.all([
    sub
      ? supabase.from("marks").select("*").eq("submission_id", sub.id).order("start_offset")
      : Promise.resolve({ data: [] }),
    supabase.from("topics").select("*").order("sort_order"),
    loadMaterials(supabase, id),
  ]);
  const ms = (marks ?? []) as Mark[];
  const ts = (topics ?? []) as Topic[];
  // Пока работа не проверена, пометки ученику не показываем: преподаватель мог их ещё не закончить.
  const showMarks = sub !== null && sub.status !== "submitted";

  return (
    <>
      <Header profile={profile} />
      <ErrorBanner error={error} />
      <main className="stack">
        <Link href="/student" className="small">
          ← Мои задания
        </Link>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="stack" style={{ gap: 4 }}>
            <p className="eyebrow">срок {formatDate(a.due_at)}</p>
            <h1>{a.title}</h1>
          </div>
          <StatusPill status={sub?.status ?? null} />
        </div>
        {a.description ? <p style={{ whiteSpace: "pre-wrap" }}>{a.description}</p> : null}
        {a.textbook || materials.items.length || materials.bookPages.length ? (
          <section className="stack material-box">
            <h2>Материалы</h2>
            <Materials
              textbook={a.textbook}
              items={materials.items}
              bookPages={materials.bookPages}
              assignmentId={a.id}
            />
          </section>
        ) : null}

        {!sub ? (
          <form action={submitWork.bind(null, a.id)} className="panel">
            <label>
              Ваш ответ
              <textarea name="body" id="submission-body" className="long" required />
            </label>
            <p className="muted small">После отправки текст изменить нельзя, исправления пишутся к пометкам.</p>
            <button className="btn primary" type="submit">
              Сдать работу
            </button>
          </form>
        ) : (
          <>
            <MarkedText body={sub.body} marks={showMarks ? ms : []} showFixed />
            {sub.status === "returned" ? (
              <form action={sendFixes.bind(null, a.id, sub.id)} className="stack">
                <h2>Замечания</h2>
                <MarkList
                  marks={ms}
                  topics={ts}
                  renderExtra={(m) => (
                    <label>
                      Как правильно
                      <input type="text" name={`fix_${m.id}`} id={`fix_${m.id}`} defaultValue={m.student_fix} required />
                    </label>
                  )}
                />
                <div>
                  <button className="btn primary" type="submit">
                    Отправить исправления
                  </button>
                </div>
              </form>
            ) : (
              <>
                <p className="muted">{STATUS_HINT[sub.status]}</p>
                {showMarks && ms.length ? (
                  <>
                    <h2>Замечания</h2>
                    <MarkList
                      marks={ms}
                      topics={ts}
                      renderExtra={(m) =>
                        m.student_fix ? <span className="fix-given">Ваше исправление: {m.student_fix}</span> : null
                      }
                    />
                  </>
                ) : null}
              </>
            )}
          </>
        )}
      </main>
    </>
  );
}
