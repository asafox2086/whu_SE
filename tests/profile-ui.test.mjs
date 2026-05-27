import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("student profiles are reachable from the topbar and team recruits", async () => {
  const html = await readFile("public/index.html", "utf8");
  const app = await readFile("src/app.mjs", "utf8");
  const styles = await readFile("public/styles.css", "utf8");

  assert.match(html, /data-profile-link/);
  assert.match(html, /data-profile-panel/);
  assert.match(html, /data-profile-form/);
  assert.match(html, /data-profile-certificates/);
  assert.match(html, /class="support-grid"/);
  assert.match(html, /证书中心[\s\S]*MVP 验证/);

  assert.match(app, /getStudentProfile/);
  assert.match(app, /updateStudentProfile/);
  assert.match(app, /navigateToProfile/);
  assert.match(app, /#\/profiles\/\$\{encodeURIComponent\(studentId\)\}/);
  assert.match(app, /data-profile-student-id/);
  assert.match(app, /publisherProfileId/);
  assert.match(app, /handleProfileSubmit/);

  assert.match(styles, /\.support-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(styles, /\.support-grid > \[data-app-panel\]\s*\{[\s\S]*grid-column:\s*auto/);
  assert.match(styles, /\.profile-panel/);
  assert.match(styles, /\.profile-inline-link/);
  assert.match(styles, /@media \(max-width: 900px\)[\s\S]*\.support-grid[\s\S]*grid-template-columns:\s*1fr/);
});
