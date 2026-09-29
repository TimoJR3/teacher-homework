// Ограничения длины текстов. Те же пределы стоят в базе (миграция 0012_hardening.sql),
// здесь они нужны, чтобы показать понятную ошибку до запроса.
export const LIMITS = {
  fullName: 100,
  title: 200,
  description: 5000,
  submission: 20000,
  comment: 1000,
  fix: 1000,
  topicName: 100,
  topicRule: 500,
} as const;

// Текст ошибки приходит в адресе страницы (?error=...), поэтому его может подставить кто угодно
// в ссылке. Показываем только короткий текст без ссылок, чтобы на сайте нельзя было
// вывести поддельное сообщение вроде «сайт переехал, войдите на ...».
const LINKISH = /(https?:|www\.|\/\/|[a-z0-9-]+\.(?:ru|com|net|org|io|app|site|xyz|info|me|link|online|рф)\b)/i;

export function safeMessage(msg: string | undefined): string | null {
  if (!msg) return null;
  const text = msg.trim();
  if (!text || text.length > 300 || LINKISH.test(text)) return null;
  return text;
}
