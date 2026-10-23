import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

test("deployment versions all code assets and resolves transitive module imports", async () => {
  await promisify(execFile)(process.execPath, ["scripts/build.mjs"]);
  const html = await readFile("dist/index.html", "utf8");
  const { assets } = JSON.parse(await readFile("dist/build.json", "utf8"));
  assert.ok(!html.includes('src="./app.js"'));
  for (const [name, file] of Object.entries(assets)) {
    assert.match(file, new RegExp(`^${name}\\.[a-f0-9]{12}\\.(js|css)$`));
    await access("dist/" + file);
  }
  assert.ok(html.includes("./" + assets.app));
  assert.ok(html.includes("./" + assets.style));
  const app = await readFile("dist/" + assets.app, "utf8");
  assert.ok(app.includes("./" + assets.engine));
  assert.ok(app.includes("./" + assets.icons));
  assert.ok(!app.includes('"./engine.js"'));
  assert.equal(await readFile("dist/404.html", "utf8"), html);
});
