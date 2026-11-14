import test from "node:test";
import assert from "node:assert/strict";
import { KEY, readStore, writeStore, recoverStore } from "./storage.js";
function fixture() {
  const values = new Map();
  return {
    storage: {
      getItem: (k) => values.get(k) ?? null,
      setItem: (k, v) => values.set(k, v),
    },
    locks: { request: async (_, fn) => fn() },
  };
}
const item = {id: "one", title: "Docs", url: "https://example.com/", collection: "Work", tags: [], notes: ""};

test("stale drafts cannot overwrite newer saved revisions", async () => {
  const env = fixture();
  await writeStore(0, (current) => ({ ...current, bookmarks: [item] }), env);
  await assert.rejects(
    writeStore(0, () => ({ version: 1, bookmarks: [] }), env),
    /another tab/,
  );
  assert.equal(readStore(env.storage).bookmarks.length, 1);
});
test("quota failure does not mutate previous library", async () => {
  const env = fixture();
  await writeStore(0, (current) => ({ ...current, bookmarks: [item] }), env);
  env.storage.setItem = () => {
    throw Error("Quota exceeded");
  };
  await assert.rejects(
    writeStore(1, () => ({ version: 1, bookmarks: [] }), env),
    /Quota/,
  );
  assert.equal(readStore(env.storage).bookmarks.length, 1);
});
test("corrupt storage requires explicit recovery and exact raw comparison", async () => {
  const env = fixture();
  env.storage.setItem(KEY, "broken");
  await assert.rejects(
    writeStore(0, () => ({ version: 1, bookmarks: [] }), env),
  );
  await assert.rejects(
    recoverStore("different", { version: 1, bookmarks: [] }, env),
    /changed/,
  );
  await recoverStore("broken", { version: 1, bookmarks: [item] }, env);
  assert.equal(readStore(env.storage).bookmarks.length, 1);
});
test("unsupported locking refuses unsafe writes", async () => {
  await assert.rejects(
    writeStore(0, () => ({ version: 1, bookmarks: [] }), {
      storage: fixture().storage,
      locks: null,
    }),
    /locking/,
  );
});
