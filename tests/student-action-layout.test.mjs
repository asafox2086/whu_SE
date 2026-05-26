import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("student home shows records while create actions live only in detail views", async () => {
  const html = await readFile("public/index.html", "utf8");
  const styles = await readFile("public/styles.css", "utf8");
  const app = await readFile("src/app.mjs", "utf8");

  assert.match(html, /class="student-record-grid"/);
  assert.match(html, /data-student-recruits/);
  assert.match(html, /data-student-applications/);
  assert.doesNotMatch(html, /data-recruit-form/);
  assert.doesNotMatch(html, /data-research-apply-form/);

  assert.match(styles, /\.student-record-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(styles, /@media \(max-width: 900px\)[\s\S]*\.student-record-grid[\s\S]*grid-template-columns:\s*1fr/);
  assert.match(app, /data-detail-recruit-form/);
  assert.match(app, /data-detail-research-apply-form/);
  assert.match(app, /renderDetailStudentActions\("research", id\)/);
  assert.match(app, /getResearchDetail\(state, id\)/);
  assert.doesNotMatch(app, /renderOpportunityTargetOptions/);
});
