import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("opportunity view action gives visible feedback and moves focus to detail", async () => {
  const app = await readFile("src/app.mjs", "utf8");
  const styles = await readFile("public/styles.css", "utf8");

  assert.match(app, /selectedOpportunityId/);
  assert.match(app, /selectedOpportunityType/);
  assert.match(app, /aria-current/);
  assert.match(app, /正在查看/);
  assert.match(app, /focusOpportunityDetail/);
  assert.match(app, /scrollIntoView/);
  assert.match(app, /focus\(\{ preventScroll: true \}\)/);
  assert.match(app, /tabindex/);

  assert.match(styles, /\.item-card\.is-selected/);
  assert.match(styles, /\.item-card:focus-within/);
});
