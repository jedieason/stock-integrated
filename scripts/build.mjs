import { mkdir, copyFile, cp, rm, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const digest = (text) =>
  createHash("sha256").update(text).digest("hex").slice(0, 12);
await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
const assets = {};
for (const file of ["engine.js", "icons.js", "style.css"]) {
  const text = await readFile(file, "utf8");
  const [name, ext] = file.split(".");
  assets[name] = `${name}.${digest(text)}.${ext}`;
  await writeFile(`dist/${assets[name]}`, text);
}
let application = await readFile("app.js", "utf8");
for (const module of ["engine", "icons"]) {
  application = application.replaceAll(`./${module}.js`, `./${assets[module]}`);
}
assets.app = `app.${digest(application)}.js`;
await writeFile(`dist/${assets.app}`, application);
const html = (await readFile("index.html", "utf8"))
  .replaceAll("./app.js", `./${assets.app}`)
  .replaceAll("./style.css", `./${assets.style}`);
await writeFile("dist/index.html", html);
await writeFile("dist/404.html", html);
await writeFile(
  "dist/build.json",
  JSON.stringify({ version: digest(html), assets }),
);
await copyFile("favicon.svg", "dist/favicon.svg");
await cp("data", "dist/data", { recursive: true });
await copyFile(".nojekyll", "dist/.nojekyll");
console.log("Built static GitHub Pages application in dist/");
