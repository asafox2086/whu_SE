import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("student recruit and research application actions sit side by side", async () => {
  const html = await readFile("public/index.html", "utf8");
  const styles = await readFile("public/styles.css", "utf8");
  const app = await readFile("src/app.mjs", "utf8");

  assert.match(html, /class="student-action-grid"/);
  assert.match(html, /data-role-panel="student" data-app-panel data-page-panel="home" hidden/);
  assert.match(html, /data-recruit-form/);
  assert.match(html, /data-research-apply-form/);
  assert.match(html, /name="targetKey"/);

  assert.match(styles, /\.student-action-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(styles, /@media \(max-width: 900px\)[\s\S]*\.student-action-grid[\s\S]*grid-template-columns:\s*1fr/);
  assert.match(app, /renderOpportunityTargetOptions/);
  assert.match(app, /parseOpportunityTargetKey/);
});
