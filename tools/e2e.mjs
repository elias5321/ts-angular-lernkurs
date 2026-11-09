// Öffnet den gebauten Kurs in Chromium und löst jede Übung mit der Musterlösung.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './common.mjs';
const dist = path.join(ROOT, 'dist');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
const server = http.createServer((req, res) => {
  const f = path.join(dist, decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/index.html'));
  if (!fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(0);
const port = server.address().port;
const shotDir = process.env.SHOTS;
const only = process.argv[2];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: process.env.DARK ? 'dark' : 'light' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto(`http://localhost:${port}/`);
const course = await page.evaluate(() => window.KURS);
let bad = 0, n = 0;
for (const part of course.parts) for (const lesson of part.lessons) {
  if (only && lesson.id !== only) continue;
  await page.goto(`http://localhost:${port}/#${lesson.id}`);
  await page.waitForSelector('.lesson-head h1');
  for (const b of lesson.blocks) {
    if (b.type === 'quiz') {
      const idx = b.options.findIndex((o) => o.correct);
      await page.locator(`#ex-${b.id} .option`).nth(idx).click();
    } else if (b.type === 'task') {
      for (const cb of await page.locator(`#ex-${b.id} input[type=checkbox]`).all()) await cb.check();
    } else if (b.type === 'code') {
      n++;
      const names = Object.keys(b.solution);
      for (let i = 0; i < names.length; i++) {
        await page.locator(`#ex-${b.id} .tab`).nth(i).click();
        await page.evaluate(([id, text]) => { document.querySelector(`#ex-${id} .CodeMirror`).CodeMirror.setValue(text); }, [b.id, b.solution[names[i]]]);
      }
      await page.locator(`#ex-${b.id} .ide-bar .btn-primary`).click();
      try {
        await page.waitForSelector(`#ex-${b.id} .result .banner`, { timeout: 30000 });
        const ok = await page.locator(`#ex-${b.id} .banner-ok`).count();
        if (!ok) { bad++; console.log('✗ ' + lesson.id + '/' + b.id + ': ' + (await page.locator(`#ex-${b.id} .result`).innerText()).slice(0, 600)); }
      } catch (e) { bad++; console.log('✗ ' + lesson.id + '/' + b.id + ': kein Ergebnis'); }
    }
  }
  const pill = await page.locator('.ex .pill:not(.is-done)').count();
  if (pill) { bad++; console.log('✗ ' + lesson.id + ': nicht alle Blöcke als gelöst markiert'); }
  if (shotDir && (only || process.env.ALLSHOTS)) await page.screenshot({ path: path.join(shotDir, lesson.id + '.png'), fullPage: true });
}
if (shotDir) {
  await page.goto(`http://localhost:${port}/#start`); await page.waitForSelector('.home-hero');
  await page.screenshot({ path: path.join(shotDir, 'home.png'), fullPage: true });
  await page.setViewportSize({ width: 400, height: 800 });
  await page.screenshot({ path: path.join(shotDir, 'home-phone.png') });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 0) { bad++; console.log('✗ Seite scrollt horizontal auf dem Handy: ' + overflow + 'px'); }
}
console.log(n + ' Code-Übungen im Browser geprüft, ' + bad + ' Probleme, ' + errors.length + ' Konsolenfehler');
errors.slice(0, 10).forEach((e) => console.log('  ' + e));
await browser.close(); server.close();
process.exit(bad || errors.length ? 1 : 0);
