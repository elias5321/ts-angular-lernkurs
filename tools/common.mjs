import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const BUILD = ROOT;
const require = createRequire(path.join(BUILD, 'x.js'));
export const ts = require('typescript');
export const core = createRequire(import.meta.url)(path.join(ROOT, 'src/core.js'));

export const LINT_FROM = {
  var: 'variablen', const: 'variablen', naming: 'variablen', noinit: 'typen', template: 'strings',
  eqeqeq: 'vergleiche', booleancmp: 'vergleiche', returntype: 'funktionen', returnbool: 'funktionen',
  forof: 'arrays', any: 'any-unknown', nonnull: 'null-undefined',
};

export function buildLibs() {
  const libDir = path.join(BUILD, 'node_modules/typescript/lib');
  const lib = {};
  for (const f of fs.readdirSync(libDir)) {
    if (!/^lib\..*\.d\.ts$/.test(f)) continue;
    if (/dom|webworker|scripthost|esnext|full|es2023|es2024|es2025/.test(f)) continue;
    lib[f] = fs.readFileSync(path.join(libDir, f), 'utf8').replace(/\/\*\*[\s\S]*?\*\//g, '').replace(/\n\s*\n+/g, '\n');
  }
  const ng = {};
  for (const f of fs.readdirSync(path.join(ROOT, 'ng'))) ng[f] = fs.readFileSync(path.join(ROOT, 'ng', f), 'utf8');
  const de = JSON.parse(fs.readFileSync(path.join(libDir, 'de/diagnosticMessages.generated.json'), 'utf8'));
  return { lib, ng, de };
}

export function indexCourse(course) {
  let n = 0;
  const order = {};
  course.parts.forEach((p) => p.lessons.forEach((l) => { l.index = n; order[l.id] = n; n++; }));
  course.lints = {};
  for (const [k, id] of Object.entries(LINT_FROM)) {
    if (order[id] == null) { if (process.env.LENIENT) { course.lints[k] = 0; continue; } throw new Error('Lint ' + k + ' verweist auf unbekannte Lektion ' + id); }
    course.lints[k] = order[id];
  }
  return course;
}
export function lintSetFor(course, lesson) {
  const set = {};
  for (const [k, idx] of Object.entries(course.lints)) if (lesson.index >= idx) set[k] = true;
  return set;
}
