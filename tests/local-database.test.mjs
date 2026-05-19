import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createInitialState } from "../src/domain.mjs";
import {
  createLocalDatabase,
  readLocalState,
  writeLocalState
} from "../src/local-database.mjs";

test("local database stores MVP state in a readable data folder json file", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "xinggui-data-"));
  const database = createLocalDatabase({
    dataDir,
    fileName: "state.local.json",
    seedState: createInitialState()
  });

  try {
    const initial = await readLocalState(database);
    initial.feedbackEntries.push({
      id: "feedback_1",
      userId: null,
      contact: "demo@example.com",
      painPoint: "需要保存试用数据",
      message: "刷新后仍能看到记录。",
      rating: 5,
      submittedAt: "2026-05-19T00:00:00.000Z"
    });

    await writeLocalState(database, initial);
    const persisted = await readLocalState(database);

    assert.equal(persisted.feedbackEntries.length, 1);
    assert.match(database.filePath, /data|xinggui-data-/);
    assert.equal(persisted.feedbackEntries[0].painPoint, "需要保存试用数据");
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});
