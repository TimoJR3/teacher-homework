"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { MATERIAL_ACCEPT, MATERIALS_BUCKET, isImage, materialPath, materialProblem } from "@/lib/materials";
import { mapLimit, withRetry } from "@/lib/pool";

// Сколько файлов отправляется одновременно.
const PARALLEL_UPLOADS = 3;
// Фото с телефона весят 3–10 МБ, а для чтения страницы хватает 2400 точек по длинной стороне.
const PHOTO_MAX_SIDE = 2400;
const PHOTO_SHRINK_FROM = 1.5 * 1024 * 1024;

// Уменьшает большое фото перед отправкой. Если не вышло или файл не стал меньше, возвращает исходный.
async function shrinkPhoto(file: File): Promise<File> {
  if (!isImage(file.type) || file.size < PHOTO_SHRINK_FROM) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    // У PNG бывает прозрачный фон, в JPEG он стал бы чёрным.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

// Загрузка страниц учебника к заданию. Файлы идут из браузера прямо в хранилище Supabase.
export function MaterialUpload({ assignmentId }: { assignmentId: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const supabase = createClient();
    const problems: string[] = [];
    const list = [...files];
    let done = 0;
    const progress = () => setBusy(list.length > 1 ? `Загружено ${done} из ${list.length}…` : "Загружаю…");
    progress();
    await mapLimit(list, PARALLEL_UPLOADS, async (original) => {
      const file = await shrinkPhoto(original);
      const problem = materialProblem(file);
      if (problem) {
        problems.push(problem);
      } else {
        const path = materialPath(assignmentId, file.type, crypto.randomUUID());
        const { error: upErr } = await withRetry(() =>
          supabase.storage
            .from(MATERIALS_BUCKET)
            .upload(path, file, { contentType: file.type, upsert: false })
            .then((r) => {
              // «Уже есть» после повтора значит, что первая попытка всё-таки дошла.
              if (r.error && /exists|duplicate/i.test(r.error.message)) return { error: null };
              if (r.error) throw r.error;
              return r;
            }),
        ).catch((error: Error) => ({ error }));
        if (upErr) {
          problems.push(`«${original.name}» не загружен: ${upErr.message}`);
        } else {
          const { error: rowErr } = await supabase
            .from("materials")
            .insert({ assignment_id: assignmentId, path, name: file.name, size: file.size, mime: file.type });
          if (rowErr) {
            await supabase.storage.from(MATERIALS_BUCKET).remove([path]);
            problems.push(`«${original.name}» не сохранён: ${rowErr.message}`);
          }
        }
      }
      done++;
      progress();
    });
    setBusy(null);
    setErrors(problems);
    if (input.current) input.current.value = "";
    router.refresh();
  }

  return (
    <div className="upload">
      <label className={`btn${busy ? " disabled" : ""}`}>
        <input
          ref={input}
          type="file"
          id={`materials-${assignmentId}`}
          accept={MATERIAL_ACCEPT}
          multiple
          disabled={!!busy}
          onChange={(e) => upload(e.target.files)}
        />
        {busy ?? "Прикрепить файлы"}
      </label>
      <small className="muted">PDF или фото страниц, до 20 МБ каждый.</small>
      {errors.map((e) => (
        <p key={e} className="upload-error small">
          {e}
        </p>
      ))}
    </div>
  );
}
