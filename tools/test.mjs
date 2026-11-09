// Prüft jede Übung: Musterlösung muss bestehen, Startcode darf nicht bestehen.
// Prüft ausserdem jeden TypeScript-Codeblock in den Erklärtexten.
import { Worker } from 'node:worker_threads';
import path from 'node:path';
import { ROOT, ts, core, buildLibs, indexCourse, lintSetFor } from './common.mjs';
import { loadCourse, codeBlocks } from './lessons.mjs';

const only = process.argv[2];
const course = indexCourse(loadCourse(path.join(ROOT, 'lessons')));
const env = core.createEnv(ts, buildLibs());

function runSource(src) {
  return new Promise((resolve) => {
    const run = { lines: [], res: {}, crash: null, timeout: false };
    const w = new Worker("const {parentPort}=require('worker_threads');const postMessage=(m)=>parentPort.postMessage(m);\n" + src, { eval: true });
    const timer = setTimeout(() => { run.timeout = true; w.terminate(); resolve(run); }, 6000);
    w.on('message', (m) => {
      if (m.t === 'log') run.lines.push({ k: m.k, s: m.s });
      else if (m.t === 'res') run.res[m.i] = { ok: m.ok, err: m.err };
      else if (m.t === 'crash') run.crash = run.crash || (m.n + ': ' + m.s);
      else if (m.t === 'done') { clearTimeout(timer); w.terminate(); resolve(run); }
    });
    w.on('error', (e) => { run.crash = String(e.message); clearTimeout(timer); resolve(run); });
  });
}
async function evaluate(ex, files, lintSet) {
  const prep = core.prepare(env, ex, files, lintSet);
  const run = prep.runSource ? await runSource(prep.runSource) : null;
  const res = core.conclude(ex, prep, run);
  return { prep, run, res };
}

let bad = 0, nEx = 0, nQuiz = 0, nTask = 0, nLessons = 0;
const fail = (msg) => { bad++; console.log('✗ ' + msg); };
for (const part of course.parts) for (const lesson of part.lessons) {
  nLessons++;
  for (const b of lesson.blocks) {
    if (b.type === 'quiz') nQuiz++;
    if (b.type === 'task') nTask++;
    if (b.type !== 'code') continue;
    nEx++;
    if (only && b.id !== only && lesson.id !== only) continue;
    const lintSet = lintSetFor(course, lesson);
    const sol = await evaluate(b, b.solution, lintSet);
    if (!sol.res.passed) {
      fail(`${lesson.id}/${b.id}: Musterlösung besteht NICHT`);
      sol.prep.diagnostics.forEach((d) => console.log(`    TS${d.code} ${d.file}:${d.line + 1} ${d.message}`));
      sol.res.checks.filter((c) => c.state !== 'ok').forEach((c) => console.log(`    [${c.state}] ${c.label} ${c.detail}`));
      if (sol.run && sol.run.crash) console.log('    Absturz: ' + sol.run.crash);
      if (sol.run && sol.run.timeout) console.log('    Timeout');
      if (sol.run) console.log('    Ausgabe: ' + JSON.stringify(sol.run.lines.map((l) => l.s)));
    }
    if (sol.prep.tips.length) fail(`${lesson.id}/${b.id}: Musterlösung bekommt Stil-Tipps: ${sol.prep.tips.map((t) => t.id).join(', ')}`);
    const st = await evaluate(b, b.files, lintSet);
    if (st.res.passed && !b.flags.startok) fail(`${lesson.id}/${b.id}: Startcode besteht bereits`);
    if (only) { console.log(JSON.stringify(sol.res, null, 1)); console.log(sol.run && sol.run.lines); }
  }
}
// Codeblöcke in Texten
for (const cb of codeBlocks) {
  if (cb.lang !== 'ts' || cb.flags.nocheck) continue;
  const an = core.analyze(env, { 'main.ts': cb.code }, { angular: !!cb.flags.ng });
  const has = an.diagnostics.length > 0;
  if (cb.flags.error && !has) fail(`Codeblock ${cb.where} ist als "error" markiert, hat aber keinen Fehler:\n${cb.code}`);
  if (!cb.flags.error && has) fail(`Codeblock ${cb.where} hat Fehler: ${an.diagnostics.map((d) => 'TS' + d.code + ' Z' + (d.line + 1) + ' ' + d.message).join(' | ')}\n${cb.code}`);
}
console.log(`${nLessons} Lektionen, ${nEx} Code-Übungen, ${nQuiz} Quizfragen, ${nTask} VS-Code-Aufgaben, ${codeBlocks.length} Codeblöcke – ${bad} Probleme`);
process.exit(bad ? 1 : 0);
