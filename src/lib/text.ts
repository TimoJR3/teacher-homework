// Разбор текста работы на слова и наложение пометок преподавателя.
// Позиции везде в символах (UTF-16, как String.prototype.slice).

export type Token = { text: string; start: number; end: number; isWord: boolean };

export function tokenize(body: string): Token[] {
  const tokens: Token[] = [];
  const re = /\S+|\s+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    tokens.push({
      text: m[0],
      start: m.index,
      end: m.index + m[0].length,
      isWord: !/^\s/.test(m[0]),
    });
  }
  return tokens;
}

export type Range = { start: number; end: number };

export function overlaps(a: Range, b: Range): boolean {
  return a.start < b.end && b.start < a.end;
}

export function isValidRange(body: string, r: Range): boolean {
  return (
    Number.isInteger(r.start) &&
    Number.isInteger(r.end) &&
    r.start >= 0 &&
    r.end <= body.length &&
    r.start < r.end &&
    body.slice(r.start, r.end).trim().length > 0
  );
}

export type Segment<M> =
  | { kind: "text"; text: string; start: number; end: number }
  | { kind: "mark"; text: string; start: number; end: number; mark: M; index: number };

// Делит текст на куски: обычный текст и отмеченные фрагменты.
// Пометки, которые пересекаются с предыдущими или выходят за текст, пропускаются.
export function segment<M extends Range>(body: string, marks: M[]): Segment<M>[] {
  const sorted = marks
    .map((mark, index) => ({ mark, index }))
    .filter(({ mark }) => isValidRange(body, mark))
    .sort((a, b) => a.mark.start - b.mark.start);

  const out: Segment<M>[] = [];
  let pos = 0;
  for (const { mark, index } of sorted) {
    if (mark.start < pos) continue;
    if (mark.start > pos) {
      out.push({ kind: "text", text: body.slice(pos, mark.start), start: pos, end: mark.start });
    }
    out.push({
      kind: "mark",
      text: body.slice(mark.start, mark.end),
      start: mark.start,
      end: mark.end,
      mark,
      index,
    });
    pos = mark.end;
  }
  if (pos < body.length) {
    out.push({ kind: "text", text: body.slice(pos), start: pos, end: body.length });
  }
  return out;
}

export type TopicCount = { topicId: string; count: number };

export function countTopics(marks: { topic_id: string }[]): TopicCount[] {
  const counts = new Map<string, number>();
  for (const m of marks) counts.set(m.topic_id, (counts.get(m.topic_id) ?? 0) + 1);
  return [...counts.entries()]
    .map(([topicId, count]) => ({ topicId, count }))
    .sort((a, b) => b.count - a.count);
}
