// Baut jede Angular-Musterlösung in einem echten Angular-Projekt (ng build).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT } from './common.mjs';
import { loadCourse } from './lessons.mjs';
const proj = path.resolve(process.env.NG_PROJEKT || path.join(ROOT, '../lern-app'));
const base = path.join(ROOT, 'ng-basis');
const only = process.argv[2];
const course = loadCourse(path.join(ROOT, 'lessons'));
let bad = 0, n = 0;
for (const part of course.parts) for (const lesson of part.lessons) for (const b of lesson.blocks) {
  if (b.type !== 'code' || !b.flags.angular) continue;
  if (only && b.id !== only && lesson.id !== only) continue;
  n++;
  fs.rmSync(path.join(proj, 'src'), { recursive: true, force: true });
  fs.cpSync(base, path.join(proj, 'src'), { recursive: true });
  for (const [name, text] of Object.entries(b.solution)) {
    const f = path.join(proj, 'src/app', name);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, text);
  }
  try {
    execFileSync('npx', ['ng', 'build', '--configuration', 'development'], { cwd: proj, stdio: 'pipe' });
    console.log('✓ ' + lesson.id + '/' + b.id);
  } catch (e) {
    bad++;
    console.log('✗ ' + lesson.id + '/' + b.id + '\n' + String(e.stdout || '') .slice(-1500) + String(e.stderr || '').slice(-2500));
  }
}
console.log(n + ' Angular-Lösungen gebaut, ' + bad + ' fehlgeschlagen');
process.exit(bad ? 1 : 0);
