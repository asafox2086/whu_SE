import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("opportunity hall renders paginated cards with numbered page controls", async () => {
  const app = await readFile("src/app.mjs", "utf8");
  const html = await readFile("public/index.html", "utf8");
  const styles = await readFile("public/styles.css", "utf8");
  const readme = await readFile("README.md", "utf8");

  assert.match(html, /data-opportunity-pagination/);
  assert.match(app, /opportunityPageSize = 6/);
  assert.match(app, /selectedOpportunityPage/);
  assert.match(app, /handleOpportunityPageClick/);
  assert.match(app, /data-opportunity-page/);
  assert.match(app, /aria-current="page"/);
  assert.match(app, /\.slice\(/);
  assert.match(app, /Math\.ceil/);
  assert.match(app, /selectedOpportunityPage = 1/);
  assert.match(styles, /\.pagination/);
  assert.match(readme, /每页 6 条/);
});
