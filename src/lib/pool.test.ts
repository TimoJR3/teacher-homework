import { test } from "node:test";
import assert from "node:assert/strict";
import { mapLimit, withRetry } from "./pool.ts";

test("mapLimit: не больше limit одновременно, порядок сохранён", async () => {
  let now = 0;
  let peak = 0;
  const out = await mapLimit([30, 10, 20, 5, 15], 2, async (ms, i) => {
    peak = Math.max(peak, ++now);
    await new Promise((ok) => setTimeout(ok, ms));
    now--;
    return i;
  });
  assert.deepEqual(out, [0, 1, 2, 3, 4]);
  assert.equal(peak, 2);
  assert.deepEqual(await mapLimit([], 3, async () => 1), []);
});

test("withRetry: повторяет сбой и сдаётся после последней попытки", async () => {
  let calls = 0;
  const ok = await withRetry(async () => {
    if (++calls < 3) throw new Error("сеть");
    return "готово";
  }, 3, 1);
  assert.equal(ok, "готово");
  assert.equal(calls, 3);
  calls = 0;
  await assert.rejects(withRetry(async () => { calls++; throw new Error("нет"); }, 2, 1), /нет/);
  assert.equal(calls, 2);
});
