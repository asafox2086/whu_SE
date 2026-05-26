import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("opportunity view action navigates to a dedicated detail page", async () => {
  const html = await readFile("public/index.html", "utf8");
  const app = await readFile("src/app.mjs", "utf8");
  const styles = await readFile("public/styles.css", "utf8");

  assert.match(html, /data-page-panel="home"/);
  assert.match(html, /data-page-panel="opportunity-detail"/);
  assert.match(app, /selectedOpportunityId/);
  assert.match(app, /selectedOpportunityType/);
  assert.match(app, /window\.addEventListener\("hashchange", handleRouteChange\)/);
  assert.match(app, /navigateToOpportunityDetail/);
  assert.match(app, /#\/opportunities\/\$\{type\}\/\$\{encodeURIComponent\(id\)\}/);
  assert.doesNotMatch(app, /正在查看/);
  assert.match(app, /renderDetailStudentActions/);
  assert.match(app, /data-detail-recruit-form/);
  assert.match(app, /data-detail-research-apply-form/);
  assert.match(app, /focusOpportunityDetail/);
  assert.match(app, /scrollIntoView/);
  assert.match(app, /focus\(\{ preventScroll: true \}\)/);
  assert.match(app, /tabindex/);

  assert.match(styles, /\.layout\.is-detail-page/);
  assert.match(styles, /\.detail-action-grid/);
  assert.match(styles, /\.item-card:focus-within/);
});
