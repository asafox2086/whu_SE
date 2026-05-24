import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("project has a repeatable Tunelo public preview command without tracking the cloned tool", async () => {
  const ignoreRules = await readFile(".gitignore", "utf8");
  const script = await readFile("scripts/expose-tunelo.ps1", "utf8");
  const readme = await readFile("README.md", "utf8");

  assert.match(ignoreRules, /^tools\/tunelo\/$/m);
  assert.match(script, /tunelo/i);
  assert.match(script, /port/);
  assert.match(script, /npm/);
  assert.match(script, /start/);
  assert.match(readme, /Tunelo 公网预览/);
  assert.match(readme, /scripts\/expose-tunelo\.ps1/);
});
