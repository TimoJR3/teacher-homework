// Параллельная загрузка: несколько файлов в сети одновременно и повтор при сетевом сбое.

// Повторяет fn, если она бросила ошибку: tries попыток, пауза растёт с каждой.
export async function withRetry<T>(fn: () => Promise<T>, tries = 3, pauseMs = 1000): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt >= tries) throw e;
      await new Promise((ok) => setTimeout(ok, pauseMs * attempt));
    }
  }
}

// Как items.map(fn), но одновременно выполняется не больше limit вызовов. Порядок результатов сохраняется.
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}
