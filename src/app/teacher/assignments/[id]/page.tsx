import Link from "next/link";
import { notFound } from "next/navigation";
import { addBookPages, deleteAssignment, updateAssignment } from "@/app/actions";
import { requireRole } from "@/lib/auth";
import { displayName, formatDate } from "@/lib/format";
import type { Assignment, Profile, Submission } from "@/lib/types";
import { ErrorBanner, Header, StatusPill } from "@/components/ui";
import { AssignmentForm } from "@/components/assignment-form";
import { BookPagesForm, loadMaterials, Materials } from "@/components/materials";
import { MaterialUpload } from "@/components/material-upload";

export default async function AssignmentPage(props: PageProps<"/teacher/assignments/[id]">) {
  const { id } = await props.params;
  const { error } = await props.searchParams;
  const { profile, supabase } = await requireRole("teacher");

  const { data: assignment } = await supabase.from("assignments").select("*").eq("id", id).maybeSingle();
  if (!assignment) notFound();
  const a = assignment as Assignment;

  const [{ data: students }, { data: recipientRows }, { data: submissions }, materials] = await Promise.all([
    supabase.from("profiles").select("id, email, full_name, role").eq("role", "student").order("full_name"),
    supabase.from("assignment_students").select("student_id").eq("assignment_id", id),
    supabase.from("submissions").select("*").eq("assignment_id", id),
    loadMaterials(supabase, id),
  ]);

  const allStudents = (students ?? []) as Profile[];
  const selected = (recipientRows ?? []).map((r) => r.student_id as string);
  const subs = (submissions ?? []) as Submission[];
  const subByStudent = new Map(subs.map((s) => [s.student_id, s]));
  const assigned = selected.length ? allStudents.filter((s) => selected.includes(s.id)) : allStudents;

  return (
    <>
      <Header profile={profile} />
      <ErrorBanner error={error} />
      <div className="cols">
        <main className="stack">
          <Link href="/teacher" className="small">
            ← Все работы
          </Link>
          <div className="stack" style={{ gap: 4 }}>
            <p className="eyebrow">
              срок: {formatDate(a.due_at)} · для: {selected.length ? "выбранных учеников" : "всех учеников"}
            </p>
            <h1>{a.title}</h1>
          </div>
          {a.description ? <p style={{ whiteSpace: "pre-wrap" }}>{a.description}</p> : null}

          <section className="stack material-box">
            <h2>Материалы</h2>
            {a.textbook || materials.items.length || materials.bookPages.length ? (
              <Materials
                textbook={a.textbook}
                items={materials.items}
                bookPages={materials.bookPages}
                assignmentId={a.id}
                editable
              />
            ) : (
              <p className="muted small">
                Добавьте страницы из учебника или прикрепите свои файлы. Ученик увидит их на странице задания.
              </p>
            )}
            {materials.failed ? <p className="upload-error small">Не удалось загрузить список материалов.</p> : null}
            <BookPagesForm books={materials.books} assignmentId={a.id} action={addBookPages.bind(null, a.id)} />
            <MaterialUpload assignmentId={a.id} />
          </section>

          <h2>
            Сдали {subs.length} из {assigned.length}
          </h2>
          {assigned.length ? (
            <div className="list">
              {assigned.map((s) => {
                const sub = subByStudent.get(s.id);
                const content = (
                  <>
                    <span>{displayName(s)}</span>
                    <StatusPill status={sub?.status ?? null} />
                    <small>{sub ? `сдано ${formatDate(sub.submitted_at)}` : "ещё не сдано"}</small>
                  </>
                );
                return sub ? (
                  <Link key={s.id} href={`/teacher/submissions/${sub.id}`}>
                    {content}
                  </Link>
                ) : (
                  <div className="li" key={s.id}>
                    {content}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="muted">Учеников пока нет.</p>
          )}
        </main>

        <aside className="stack">
          <AssignmentForm
            action={updateAssignment.bind(null, a.id)}
            students={allStudents}
            assignment={a}
            selected={selected}
            locked={subs.map((s) => s.student_id)}
          />
          {subs.length ? (
            <p className="muted small">Задание уже сдавали, поэтому удалить его нельзя: работы учеников пропали бы.</p>
          ) : (
            <form action={deleteAssignment.bind(null, a.id)} className="row">
              <label className="check small">
                <input type="checkbox" name="confirm" id="confirm-delete" required />
                точно удалить
              </label>
              <button className="btn danger" type="submit">
                Удалить задание
              </button>
            </form>
          )}
        </aside>
      </div>
    </>
  );
}
