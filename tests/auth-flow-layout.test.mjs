import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("app starts with a full login screen and hides it after authentication", async () => {
  const html = await readFile("public/index.html", "utf8");
  const app = await readFile("src/app.mjs", "utf8");
  const styles = await readFile("public/styles.css", "utf8");

  assert.match(html, /data-auth-panel/);
  assert.match(html, /<main class="layout is-auth-screen" data-app-content>/);
  assert.match(html, /data-app-panel/);
  const initiallyVisibleAppPanels = html.match(/<section[^>]*data-app-panel(?![^>]*hidden)[^>]*>/g) ?? [];
  assert.deepEqual(initiallyVisibleAppPanels, []);
  assert.match(html, />退出登录</);

  assert.match(app, /authPanel: document\.querySelector\("\[data-auth-panel\]"\)/);
  assert.match(app, /appContent: document\.querySelector\("\[data-app-content\]"\)/);
  assert.match(app, /appPanels: document\.querySelectorAll\("\[data-app-panel\]"\)/);
  assert.match(app, /selectors\.authPanel\.hidden = Boolean\(session\)/);
  assert.match(app, /selectors\.appContent\.classList\.toggle\("is-auth-screen", !session\)/);
  assert.match(app, /selectors\.appContent\.classList\.toggle\("is-logged-in", Boolean\(session\)\)/);
  assert.match(app, /selectors\.userBadge\.hidden = !session/);
  assert.match(app, /localStorage\.removeItem\(sessionKey\)/);

  assert.match(styles, /\.layout\.is-auth-screen/);
  assert.match(styles, /\.layout\.is-auth-screen\s+\.auth-panel/);
  assert.match(styles, /\.layout\.is-logged-in/);
  assert.match(styles, /\.layout\.is-logged-in\s+\[data-app-panel\]/);
});
