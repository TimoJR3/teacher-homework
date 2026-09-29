import type { SupabaseClient } from "@supabase/supabase-js";
import { deleteMaterial } from "@/app/actions";
import { fileSize, isImage, MATERIALS_BUCKET } from "@/lib/materials";
import type { Material } from "@/lib/types";

export type MaterialLink = Material & { url: string | null };

// Файлы задания со ссылками на час. Хранилище закрытое, ссылка выдаётся только тем, кому видно задание.
export async function loadMaterials(supabase: SupabaseClient, assignmentId: string) {
  const { data, error } = await supabase
    .from("materials")
    .select("*")
    .eq("assignment_id", assignmentId)
    .order("created_at");
  const rows = (data ?? []) as Material[];
  if (!rows.length) return { items: [] as MaterialLink[], failed: !!error };
  const { data: signed } = await supabase.storage.from(MATERIALS_BUCKET).createSignedUrls(
    rows.map((m) => m.path),
    60 * 60,
  );
  const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  return { items: rows.map((m) => ({ ...m, url: urlByPath.get(m.path) ?? null })), failed: false };
}

export function Materials({
  textbook,
  items,
  assignmentId,
  editable = false,
}: {
  textbook: string;
  items: MaterialLink[];
  assignmentId: string;
  editable?: boolean;
}) {
  const images = items.filter((m) => isImage(m.mime));
  const files = items.filter((m) => !isImage(m.mime));
  return (
    <div className="materials">
      {textbook ? (
        <p className="textbook">
          <span className="muted small">Учебник</span>
          {textbook}
        </p>
      ) : null}
      {images.length ? (
        <ul className="pages">
          {images.map((m) => (
            <li key={m.id}>
              {m.url ? (
                <a href={m.url} target="_blank" rel="noreferrer" title="Открыть целиком">
                  {/* eslint-disable-next-line @next/next/no-img-element -- временная ссылка на закрытый файл */}
                  <img src={m.url} alt={m.name} loading="lazy" />
                </a>
              ) : (
                <span className="muted small">файл недоступен</span>
              )}
              <div className="cap">
                <span className="small">{m.name}</span>
                {editable ? <RemoveButton assignmentId={assignmentId} id={m.id} /> : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {files.length ? (
        <ul className="files">
          {files.map((m) => (
            <li key={m.id}>
              <span className="ext">PDF</span>
              {m.url ? (
                <a href={m.url} target="_blank" rel="noreferrer">
                  {m.name}
                </a>
              ) : (
                <span>{m.name}</span>
              )}
              <small className="muted">{fileSize(m.size)}</small>
              {editable ? <RemoveButton assignmentId={assignmentId} id={m.id} /> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function RemoveButton({ assignmentId, id }: { assignmentId: string; id: string }) {
  return (
    <form action={deleteMaterial.bind(null, assignmentId, id)}>
      <button type="submit" className="link-btn small" title="Убрать файл из задания">
        убрать
      </button>
    </form>
  );
}
