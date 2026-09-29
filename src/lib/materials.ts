// Файлы к заданию: какие принимаем и как называем в хранилище.
// Ограничения совпадают с настройками хранилища в миграции 0009_materials.sql.

export const MATERIALS_BUCKET = "materials";
export const MAX_MATERIAL_BYTES = 20 * 1024 * 1024;
export const MATERIAL_MIME = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
export const MATERIAL_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp";

const EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// Причина, по которой файл не подходит, или null.
export function materialProblem(file: { name: string; size: number; type: string }): string | null {
  if (!MATERIAL_MIME.includes(file.type)) return `«${file.name}»: подходят только PDF и фото (JPG, PNG, WebP).`;
  if (file.size > MAX_MATERIAL_BYTES) return `«${file.name}»: файл больше 20 МБ.`;
  if (file.size === 0) return `«${file.name}»: файл пустой.`;
  return null;
}

// Путь в хранилище: папка задания и случайное имя латиницей.
// Русские буквы и пробелы хранилище в путях не принимает, настоящее имя лежит в таблице.
export function materialPath(assignmentId: string, mime: string, id: string): string {
  return `${assignmentId}/${id}.${EXT[mime] ?? "bin"}`;
}

export function isImage(mime: string): boolean {
  return mime.startsWith("image/");
}

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} МБ`;
}
