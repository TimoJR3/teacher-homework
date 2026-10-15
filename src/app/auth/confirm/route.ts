import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Сюда ведёт ссылка из письма «подтвердите почту». Если письмо открыто в том же браузере,
// где проходила регистрация, человек сразу входит; иначе почта всё равно подтверждена и он входит сам.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const to = request.nextUrl.clone();
  to.search = "";
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      to.pathname = "/";
      return NextResponse.redirect(to);
    }
  }
  to.pathname = "/login";
  if (request.nextUrl.searchParams.has("error")) {
    to.searchParams.set("error", "Ссылка из письма устарела или уже использована. Попробуйте войти; если не выйдет, зарегистрируйтесь ещё раз.");
  } else {
    to.searchParams.set("confirmed", "1");
  }
  return NextResponse.redirect(to);
}
