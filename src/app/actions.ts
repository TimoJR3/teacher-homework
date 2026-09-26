"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isValidRange, overlaps } from "@/lib/text";

function str(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

// ---------------------------------------------------------------------------
// Вход
// ---------------------------------------------------------------------------

export async function signIn(form: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: str(form, "email"),
    password: str(form, "password"),
  });
  if (error) fail("/login", "Не получилось войти. Проверьте почту и пароль.");
  redirect("/");
}

export async function signUp(form: FormData) {
  const supabase = await createClient();
  const password = str(form, "password");
  if (password.length < 8) fail("/login", "Пароль должен быть не короче 8 символов.");
  const { data, error } = await supabase.auth.signUp({
    email: str(form, "email"),
    password,
    options: { data: { full_name: str(form, "full_name") } },
  });
  if (error) fail("/login", `Не получилось зарегистрироваться: ${error.message}`);
  if (!data.session) {
    fail("/login", "Проверьте почту и подтвердите адрес, затем войдите.");
  }
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// ---------------------------------------------------------------------------
// Преподаватель
// ---------------------------------------------------------------------------

export async function createAssignment(form: FormData) {
  const { supabase } = await requireRole("teacher");
  const title = str(form, "title");
  const due = str(form, "due");
  if (!title) fail("/teacher", "Укажите название задания.");
  // Срок хранится как конец выбранного дня по московскому времени.
  const due_at = /^\d{4}-\d{2}-\d{2}$/.test(due) ? `${due}T23:59:00+03:00` : null;

  const { error } = await supabase
    .from("assignments")
    .insert({ title, description: str(form, "description"), due_at });
  if (error) fail("/teacher", `Задание не сохранено: ${error.message}`);
  revalidatePath("/teacher");
  revalidatePath("/student");
  redirect("/teacher");
}

export async function addMark(submissionId: string, form: FormData) {
  const { supabase } = await requireRole("teacher");
  const path = `/teacher/submissions/${submissionId}`;
  const start = Number(str(form, "start"));
  const end = Number(str(form, "end"));
  const topicId = str(form, "topic_id");
  if (!topicId) fail(path, "Выберите тему ошибки.");

  const { data: sub } = await supabase
    .from("submissions")
    .select("body")
    .eq("id", submissionId)
    .single();
  if (!sub) fail(path, "Работа не найдена.");
  if (!isValidRange(sub.body, { start, end })) fail(path, "Выделите фрагмент текста заново.");

  const { data: existing } = await supabase
    .from("marks")
    .select("start_offset, end_offset")
    .eq("submission_id", submissionId);
  const clash = (existing ?? []).some((m) =>
    overlaps({ start, end }, { start: m.start_offset, end: m.end_offset }),
  );
  if (clash) fail(path, "Этот фрагмент пересекается с уже поставленной пометкой.");

  const { error } = await supabase.from("marks").insert({
    submission_id: submissionId,
    start_offset: start,
    end_offset: end,
    quote: sub.body.slice(start, end),
    topic_id: topicId,
    comment: str(form, "comment"),
  });
  if (error) fail(path, `Пометка не сохранена: ${error.message}`);
  revalidatePath(path);
  redirect(path);
}

export async function deleteMark(submissionId: string, markId: string) {
  const { supabase } = await requireRole("teacher");
  const path = `/teacher/submissions/${submissionId}`;
  const { error } = await supabase.from("marks").delete().eq("id", markId);
  if (error) fail(path, `Пометка не удалена: ${error.message}`);
  revalidatePath(path);
  redirect(path);
}

export async function reviewSubmission(submissionId: string, decision: "returned" | "accepted") {
  const { supabase } = await requireRole("teacher");
  const path = `/teacher/submissions/${submissionId}`;

  if (decision === "returned") {
    const { count } = await supabase
      .from("marks")
      .select("id", { count: "exact", head: true })
      .eq("submission_id", submissionId);
    if (!count) fail(path, "Чтобы вернуть работу, поставьте хотя бы одну пометку.");
  }

  const { error } = await supabase
    .from("submissions")
    .update({ status: decision })
    .eq("id", submissionId);
  if (error) fail(path, `Статус не изменён: ${error.message}`);
  revalidatePath("/teacher");
  revalidatePath(path);
  redirect(path);
}

// ---------------------------------------------------------------------------
// Ученик
// ---------------------------------------------------------------------------

export async function submitWork(assignmentId: string, form: FormData) {
  const { supabase, profile } = await requireRole("student");
  const path = `/student/assignments/${assignmentId}`;
  const body = str(form, "body");
  if (!body) fail(path, "Текст работы пустой.");

  const { error } = await supabase
    .from("submissions")
    .insert({ assignment_id: assignmentId, student_id: profile.id, body });
  if (error) fail(path, `Работа не отправлена: ${error.message}`);
  revalidatePath(path);
  revalidatePath("/student");
  redirect(path);
}

export async function sendFixes(assignmentId: string, submissionId: string, form: FormData) {
  const { supabase } = await requireRole("student");
  const path = `/student/assignments/${assignmentId}`;

  const { data: marks } = await supabase
    .from("marks")
    .select("id")
    .eq("submission_id", submissionId);
  const fixes = (marks ?? []).map((m) => ({ id: m.id, fix: str(form, `fix_${m.id}`) }));
  if (fixes.some((f) => !f.fix)) fail(path, "Напишите исправление к каждой пометке.");

  for (const f of fixes) {
    const { error } = await supabase.from("marks").update({ student_fix: f.fix }).eq("id", f.id);
    if (error) fail(path, `Исправление не сохранено: ${error.message}`);
  }
  const { error } = await supabase
    .from("submissions")
    .update({ status: "fixed" })
    .eq("id", submissionId);
  if (error) fail(path, `Работа не отправлена: ${error.message}`);
  revalidatePath(path);
  revalidatePath("/student");
  redirect(path);
}
