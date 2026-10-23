import { mkdir, copyFile, cp, rm } from 'node:fs/promises';
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
for (const f of ['index.html', 'style.css', 'app.js', 'engine.js', 'icons.js', 'favicon.svg']) await copyFile(f, `dist/${f}`);
await cp('data', 'dist/data', { recursive: true });
await copyFile('index.html', 'dist/404.html');
await copyFile('.nojekyll', 'dist/.nojekyll');
console.log('Built static GitHub Pages application in dist/');
