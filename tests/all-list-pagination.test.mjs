import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("all growing lists render through shared pagination controls", async () => {
  const html = await readFile("public/index.html", "utf8");
  const app = await readFile("src/app.mjs", "utf8");

  for (const hook of [
    "student-recruits-pagination",
    "student-applications-pagination",
    "certificate-list-pagination",
    "certificate-collection-pagination",
    "admin-users-pagination",
    "admin-database-pagination",
    "mentor-projects-pagination",
    "mentor-applications-pagination",
    "feedback-list-pagination"
  ]) {
    assert.match(html, new RegExp(`data-${hook}`));
  }

  assert.match(app, /const listPageSize = 5/);
  assert.match(app, /listPages = \{/);
  assert.match(app, /handleListPageClick/);
  assert.match(app, /data-list-page-key/);
  assert.match(app, /paginateItems/);
  assert.match(app, /renderPagination/);
  assert.match(app, /resetListPage/);

  for (const key of [
    "studentRecruits",
    "studentApplications",
    "certificateList",
    "certificateCollection",
    "adminUsers",
    "adminDatabase",
    "mentorProjects",
    "mentorApplications",
    "feedbackList"
  ]) {
    assert.match(app, new RegExp(`paginateItems\\([^\\n]+${key}`));
  }
});
