import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("team recruit cards expose end/resume actions and confirm deletion", async () => {
  const app = await readFile("src/app.mjs", "utf8");
  const styles = await readFile("public/styles.css", "utf8");
  const readme = await readFile("README.md", "utf8");

  assert.match(app, /resumeTeamRecruit/);
  assert.match(app, /data-team-recruit-action="resume"/);
  assert.match(app, /结束招募/);
  assert.match(app, /继续招募/);
  assert.match(app, /name="introduction"/);
  assert.match(app, /介绍一下目前的进度吧/);
  assert.match(app, /data-team-recruit-edit-form/);
  assert.match(app, /updateTeamRecruit/);
  assert.match(app, /保存修改/);
  assert.match(app, /confirm\(/);
  assert.match(app, /确认删除这条组队招募/);
  assert.match(app, /recruit-card/);
  assert.match(app, /recruit-tags/);
  assert.match(app, /recruit-meta/);
  assert.match(app, /recruit-introduction/);

  assert.match(styles, /\.recruit-card/);
  assert.match(styles, /\.recruit-body/);
  assert.match(styles, /\.recruit-tags/);
  assert.match(styles, /\.recruit-edit-form/);
  assert.match(styles, /\.status-pill/);
  assert.match(readme, /结束招募/);
  assert.match(readme, /重新招募/);
  assert.match(readme, /二次确认/);
});
