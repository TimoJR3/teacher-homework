"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { authErrorText } from "@/lib/auth-errors";
import { dueAtFromInput } from "@/lib/format";
import { isValidRange, overlaps } from "@/lib/text";
import { isNoteKind } from "@/lib/types";
import { MATERIALS_BUCKET } from "@/lib/materials";

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
  if (error) fail("/login", authErrorText(error, "signin"));
  redirect("/");
}

export async function signUp(form: FormData) {
  const role = str(form, "role") === "teacher" ? "teacher" : "student";
  const page = `/signup/${role}`;
  const supabase = await createClient();
  const password = str(form, "password");
  if (password.length < 8) fail(page, "Пароль должен быть не короче 8 символов.");

  const data: Record<string, string> = { full_name: str(form, "full_name") };
  if (role === "teacher") {
    const code = str(form, "teacher_code");
    // Та же проверка есть в базе при создании аккаунта; здесь она нужна, чтобы показать понятную ошибку.
    const { data: ok } = await supabase.rpc("teacher_code_ok", { p_code: code });
    if (!code || ok !== true) fail(page, "Неверный код преподавателя. Уточните его у того, кто ведёт сайт.");
    data.teacher_code = code;
  }

  const { data: result, error } = await supabase.auth.signUp({
    email: str(form, "email"),
    password,
    options: { data },
  });
  if (error) fail(page, authErrorText(error, "signup"));
  if (!result.session) {
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

function assignmentFields(form: FormData) {
  return {
    p_title: str(form, "title"),
    p_description: str(form, "description"),
    p_due_at: dueAtFromInput(str(form, "due")),
    // Никто не отмечен — задание для всех учеников.
    p_student_ids: form.getAll("student_ids").filter((v): v is string => typeof v === "string" && v !== ""),
  };
}

export async function createAssignment(form: FormData) {
  const { supabase } = await requireRole("teacher");
  const fields = assignmentFields(form);
  if (!fields.p_title) fail("/teacher", "Укажите название задания.");

  // Задание и список учеников создаются в базе одной операцией.
  const { data: id, error } = await supabase.rpc("create_assignment", fields);
  if (error || !id) fail("/teacher", `Задание не сохранено: ${error?.message ?? "нет ответа"}`);
  const textbook = str(form, "textbook");
  if (textbook) {
    const { error: tbErr } = await supabase.from("assignments").update({ textbook }).eq("id", id);
    if (tbErr) fail(`/teacher/assignments/${id}`, `Задание создано, но страницы учебника не сохранены: ${tbErr.message}`);
  }
  revalidatePath("/teacher");
  revalidatePath("/student");
  redirect(`/teacher/assignments/${id}`);
}

export async function updateAssignment(assignmentId: string, form: FormData) {
  const { supabase } = await requireRole("teacher");
  const path = `/teacher/assignments/${assignmentId}`;
  const fields = assignmentFields(form);
  if (!fields.p_title) fail(path, "Укажите название задания.");

  const { error } = await supabase.rpc("update_assignment", { p_id: assignmentId, ...fields });
  if (error) fail(path, `Изменения не сохранены: ${error.message}`);
  const { error: tbErr } = await supabase
    .from("assignments")
    .update({ textbook: str(form, "textbook") })
    .eq("id", assignmentId);
  if (tbErr) fail(path, `Страницы учебника не сохранены: ${tbErr.message}`);
  revalidatePath("/teacher");
  revalidatePath("/student");
  revalidatePath(path);
  redirect(path);
}

export async function deleteAssignment(assignmentId: string) {
  const { supabase } = await requireRole("teacher");
  const path = `/teacher/assignments/${assignmentId}`;
  const { data: files } = await supabase.from("materials").select("path").eq("assignment_id", assignmentId);
  const { error } = await supabase.from("assignments").delete().eq("id", assignmentId);
  if (error?.code === "23503") fail(path, "Это задание уже сдали, поэтому удалить его нельзя.");
  if (error) fail(path, `Задание не удалено: ${error.message}`);
  // Описания файлов удалились вместе с заданием, сами файлы убираем из хранилища.
  if (files?.length) await supabase.storage.from(MATERIALS_BUCKET).remove(files.map((f) => f.path as string));
  revalidatePath("/teacher");
  revalidatePath("/student");
  redirect("/teacher");
}

export async function deleteMaterial(assignmentId: string, materialId: string) {
  const { supabase } = await requireRole("teacher");
  const path = `/teacher/assignments/${assignmentId}`;
  const { data: m } = await supabase.from("materials").select("path").eq("id", materialId).maybeSingle();
  if (!m) fail(path, "Файл не найден.");
  const { error } = await supabase.from("materials").delete().eq("id", materialId);
  if (error) fail(path, `Файл не убран: ${error.message}`);
  await supabase.storage.from(MATERIALS_BUCKET).remove([m.path as string]);
  revalidatePath(path);
  revalidatePath(`/student/assignments/${assignmentId}`);
  redirect(path);
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
// Темы ошибок
// ---------------------------------------------------------------------------

function topicFields(form: FormData) {
  const order = Number(str(form, "sort_order"));
  return {
    name: str(form, "name"),
    rule: str(form, "rule"),
    sort_order: Number.isFinite(order) ? Math.round(order) : 0,
  };
}

export async function addTopic(form: FormData) {
  const { supabase } = await requireRole("teacher");
  const fields = topicFields(form);
  if (!fields.name) fail("/teacher/topics", "Укажите название темы.");
  const { error } = await supabase.from("topics").insert(fields);
  if (error) fail("/teacher/topics", topicError(error.code, error.message));
  revalidatePath("/teacher/topics");
  redirect("/teacher/topics");
}

export async function saveTopic(topicId: string, form: FormData) {
  const { supabase } = await requireRole("teacher");
  const fields = topicFields(form);
  if (!fields.name) fail("/teacher/topics", "Название темы не может быть пустым.");
  const { error } = await supabase.from("topics").update(fields).eq("id", topicId);
  if (error) fail("/teacher/topics", topicError(error.code, error.message));
  revalidatePath("/teacher/topics");
  redirect("/teacher/topics");
}

export async function deleteTopic(topicId: string) {
  const { supabase } = await requireRole("teacher");
  const { error } = await supabase.from("topics").delete().eq("id", topicId);
  if (error) fail("/teacher/topics", topicError(error.code, error.message));
  revalidatePath("/teacher/topics");
  redirect("/teacher/topics");
}

function topicError(code: string | undefined, message: string): string {
  if (code === "23505") return "Тема с таким названием уже есть.";
  if (code === "23503") return "Эта тема уже стоит в пометках, поэтому удалить её нельзя. Можно переименовать.";
  return `Не получилось сохранить тему: ${message}`;
}

// ---------------------------------------------------------------------------
// Ученик
// ---------------------------------------------------------------------------

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Отмечает сегодняшний день занятий. Ошибка здесь не должна мешать основному действию.
async function touchStudyDay(supabase: Supabase) {
  await supabase.rpc("mark_study_day");
}

// Вызывается из тренировки карточек.
export async function markStudyDay() {
  const { supabase } = await requireRole("student");
  await touchStudyDay(supabase);
  revalidatePath("/student");
}

export async function submitWork(assignmentId: string, form: FormData) {
  const { supabase, profile } = await requireRole("student");
  const path = `/student/assignments/${assignmentId}`;
  const body = str(form, "body");
  if (!body) fail(path, "Текст работы пустой.");

  const { error } = await supabase
    .from("submissions")
    .insert({ assignment_id: assignmentId, student_id: profile.id, body });
  if (error) fail(path, `Работа не отправлена: ${error.message}`);
  await touchStudyDay(supabase);
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
  await touchStudyDay(supabase);
  revalidatePath(path);
  revalidatePath("/student");
  redirect(path);
}

// ---------------------------------------------------------------------------
// Блокнот ученика
// ---------------------------------------------------------------------------

const NOTE_MAX = 5000;

function noteFields(form: FormData) {
  const body = str(form, "body");
  if (!body) fail("/student", "Запись пустая.");
  if (body.length > NOTE_MAX) fail("/student", `Запись длиннее ${NOTE_MAX} символов, разбейте её на несколько.`);
  const kind = str(form, "kind");
  return { body, kind: isNoteKind(kind) ? kind : "note" };
}

export async function addNote(form: FormData) {
  const { supabase } = await requireRole("student");
  const { error } = await supabase.from("notes").insert(noteFields(form));
  if (error) fail("/student", `Запись не сохранена: ${error.message}`);
  await touchStudyDay(supabase);
  revalidatePath("/student");
  redirect("/student#notebook");
}

export async function updateNote(noteId: string, form: FormData) {
  const { supabase } = await requireRole("student");
  const { error } = await supabase.from("notes").update(noteFields(form)).eq("id", noteId);
  if (error) fail("/student", `Запись не сохранена: ${error.message}`);
  await touchStudyDay(supabase);
  revalidatePath("/student");
  redirect("/student#notebook");
}

export async function deleteNote(noteId: string) {
  const { supabase } = await requireRole("student");
  const { error } = await supabase.from("notes").delete().eq("id", noteId);
  if (error) fail("/student", `Запись не удалена: ${error.message}`);
  revalidatePath("/student");
  redirect("/student#notebook");
}
