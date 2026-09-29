"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { MATERIAL_ACCEPT, MATERIALS_BUCKET, materialPath, materialProblem } from "@/lib/materials";

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
    for (const [i, file] of list.entries()) {
      const problem = materialProblem(file);
      if (problem) {
        problems.push(problem);
        continue;
      }
      setBusy(list.length > 1 ? `Загружаю ${i + 1} из ${list.length}…` : "Загружаю…");
      const path = materialPath(assignmentId, file.type, crypto.randomUUID());
      const { error: upErr } = await supabase.storage
        .from(MATERIALS_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) {
        problems.push(`«${file.name}» не загружен: ${upErr.message}`);
        continue;
      }
      const { error: rowErr } = await supabase
        .from("materials")
        .insert({ assignment_id: assignmentId, path, name: file.name, size: file.size, mime: file.type });
      if (rowErr) {
        await supabase.storage.from(MATERIALS_BUCKET).remove([path]);
        problems.push(`«${file.name}» не сохранён: ${rowErr.message}`);
      }
    }
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
