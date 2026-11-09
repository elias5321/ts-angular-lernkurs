import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, BUILD, buildLibs, indexCourse } from './common.mjs';
import { loadCourse } from './lessons.mjs';

const dist = path.join(ROOT, 'dist');
fs.mkdirSync(dist, { recursive: true });
const esbuild = path.join(BUILD, 'node_modules/.bin/esbuild');

const course = indexCourse(loadCourse(path.join(ROOT, 'lessons')));
const json = (o) => JSON.stringify(o).replace(/</g, '\\u003c').replace(new RegExp('\\u2028', 'g'), '\\u2028').replace(new RegExp('\\u2029', 'g'), '\\u2029');
fs.writeFileSync(path.join(dist, 'course.js'), 'window.KURS = ' + json(course) + ';\n');
fs.writeFileSync(path.join(dist, 'libs.js'), 'window.TSK_LIBS = ' + json(buildLibs()) + ';\n');

if (!fs.existsSync(path.join(dist, 'vendor-ts.js'))) {
  execFileSync(esbuild, [path.join(BUILD, 'node_modules/typescript/lib/typescript.js'), '--minify', '--legal-comments=inline', '--outfile=' + path.join(dist, 'vendor-ts.js')], { stdio: 'inherit' });
}
if (!fs.existsSync(path.join(dist, 'vendor-cm.js'))) {
  execFileSync(esbuild, [path.join(ROOT, 'tools/cm-entry.js'), '--bundle', '--minify', '--format=iife', '--outfile=' + path.join(dist, 'vendor-cm.js')], { stdio: 'inherit' });
}
for (const f of ['core.js', 'app.js']) fs.copyFileSync(path.join(ROOT, 'src', f), path.join(dist, f));
const cmCss = fs.readFileSync(path.join(BUILD, 'node_modules/codemirror/lib/codemirror.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const page = fs.readFileSync(path.join(ROOT, 'src/page.html'), 'utf8').replace('/*__CM_CSS__*/', () => cmCss);
fs.writeFileSync(path.join(dist, 'kurs.html'), page);
// Lokale Vorschau mit demselben Gerüst, das beim Veröffentlichen ergänzt wird
fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>' + page + '</body></html>');
let n = 0, ex = 0; course.parts.forEach((p) => p.lessons.forEach((l) => { n++; ex += l.blocks.filter((b) => b.id).length; }));
console.log('gebaut:', n, 'Lektionen,', ex, 'Übungen');
for (const f of fs.readdirSync(dist)) console.log(' ', f, Math.round(fs.statSync(path.join(dist, f)).size / 1024) + ' KB');
