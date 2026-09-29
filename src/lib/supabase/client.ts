import { createBrowserClient } from "@supabase/ssr";

// Клиент для браузера: файлы загружаются в хранилище напрямую,
// минуя сервер сайта (у Vercel ограничение на размер запроса).
export function createClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
}
