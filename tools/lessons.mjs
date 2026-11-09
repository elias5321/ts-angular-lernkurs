// Liest die Lektions-Textdateien und macht daraus das Kurs-Objekt.
import fs from 'node:fs';
import path from 'node:path';

export function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function inline(src) {
  // Code-Stellen zuerst herausnehmen, damit Fett/Kursiv auch um Code herum funktioniert.
  const codes = [];
  let t = String(src).replace(/(`+)([\s\S]*?[^`])\1(?!`)/g, (_, ticks, body) => {
    codes.push('<code>' + esc(body.replace(/^ (?=`)|(?<=`) $/g, '')) + '</code>');
    return '\u0001' + (codes.length - 1) + '\u0001';
  });
  t = esc(t);
  t = t.replace(/\[\[(.+?)\]\]/g, '<kbd>$1</kbd>');
  t = t.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  t = t.replace(/\[([^\]]+)\]\(#([a-z0-9-]+)\)/g, '<a href="#$2">$1</a>');
  t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/(^|[\s(„«])\*([^*\s][^*]*?)\*(?=[\s.,;:!?)“»]|$)/g, '$1<em>$2</em>');
  return t.replace(/\u0001(\d+)\u0001/g, (_, n) => codes[Number(n)]);
}

export const codeBlocks = []; // für die Prüfung im Test: { lang, flags, code, where }

export function md(src, where = '') {
  const lines = String(src).replace(/\r/g, '').split('\n');
  let html = '';
  let i = 0;
  const isBlockStart = (l) => /^(```|#{2,4} |> ?|\| |- |\d+\. )/.test(l);
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    let m;
    if ((m = /^```(\w+)?(.*)$/.exec(l))) {
      const lang = m[1] || 'text';
      const rest = m[2].trim();
      const flags = {};
      let title = '';
      rest.split(/\s+/).filter(Boolean).forEach((f) => { const t = /^title=(.+)$/.exec(f); if (t) title = t[1]; else flags[f] = true; });
      const body = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) body.push(lines[i++]);
      if (i >= lines.length) throw new Error('Codeblock nicht geschlossen ' + where);
      i++;
      const code = body.join('\n');
      codeBlocks.push({ lang, flags, code, where });
      const tryable = lang === 'ts' && !flags.nocheck && !flags.ng && !flags.notry;
      html += '<figure class="code' + (flags.error ? ' code-bad' : '') + '">' +
        (title || flags.error ? '<figcaption>' + (title ? '<span class="code-file">' + esc(title) + '</span>' : '') + (flags.error ? '<span class="code-flag">enthält absichtlich einen Fehler</span>' : '') + '</figcaption>' : '') +
        '<pre data-lang="' + esc(lang) + '"><code>' + esc(code) + '</code></pre>' +
        (tryable ? '<button class="try" type="button" data-try>In der Spielwiese öffnen</button>' : '') + '</figure>';
      continue;
    }
    if ((m = /^(#{2,4}) (.+)$/.exec(l))) { const n = m[1].length; html += `<h${n}>${inline(m[2])}</h${n}>`; i++; continue; }
    if (/^> ?/.test(l)) {
      const body = [];
      while (i < lines.length && /^>/.test(lines[i])) body.push(lines[i++].replace(/^> ?/, ''));
      let kind = 'note', title = '';
      const h = /^\[!(\w+)\]\s*(.*)$/.exec(body[0]);
      if (h) { kind = h[1].toLowerCase(); title = h[2]; body.shift(); }
      const names = { tip: 'Tipp', warn: 'Achtung', note: 'Gut zu wissen', vscode: 'In VS Code', merke: 'Merke', js: 'Kennst du aus JavaScript' };
      if (!names[kind]) throw new Error('Unbekannter Kasten ' + kind + ' ' + where);
      html += `<aside class="box box-${kind}"><p class="box-title">${inline(title || names[kind])}</p>${md(body.join('\n'), where)}</aside>`;
      continue;
    }
    if (/^\| /.test(l)) {
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++]);
      const cells = (r) => r.replace(/^\||\|\s*$/g, '').split(/(?<!\\)\|/).map((c) => inline(c.trim().replace(/\\\|/g, '|')));
      const head = cells(rows[0]);
      const bodyRows = rows.slice(/^\|[\s:|-]+\|?\s*$/.test(rows[1] || '') ? 2 : 1);
      html += '<div class="table-wrap"><table><thead><tr>' + head.map((c) => `<th>${c}</th>`).join('') + '</tr></thead><tbody>' +
        bodyRows.map((r) => '<tr>' + cells(r).map((c) => `<td>${c}</td>`).join('') + '</tr>').join('') + '</tbody></table></div>';
      continue;
    }
    if (/^(- |\d+\. )/.test(l)) {
      const ordered = /^\d+\. /.test(l);
      const re = ordered ? /^\d+\. / : /^- /;
      const items = [];
      while (i < lines.length && (re.test(lines[i]) || /^ {2,}\S/.test(lines[i]) || (!lines[i].trim() && /^ {2,}\S/.test(lines[i + 1] || '')))) {
        if (re.test(lines[i])) items.push([lines[i].replace(re, '')]);
        else items[items.length - 1].push(lines[i].replace(/^ {2,3}/, ''));
        i++;
      }
      const tag = ordered ? 'ol' : 'ul';
      html += `<${tag}>` + items.map((it) => {
        if (it.length === 1) return `<li>${inline(it[0])}</li>`;
        return `<li>${md(it.join('\n'), where).replace(/^<p>([\s\S]*?)<\/p>/, '$1')}</li>`;
      }).join('') + `</${tag}>`;
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) para.push(lines[i++].trim());
    html += `<p>${inline(para.join(' '))}</p>`;
  }
  return html;
}

function trimBlock(s) {
  return s.replace(/^\s*\n/, '').replace(/\s+$/, '') + '\n';
}

function parseChecks(text, where) {
  const types = ['var', 'kind', 'annotated', 'fn', 'fnannot', 'shape', 'exists', 'has', 'hasnot', 'src', 'nosrc', 'tpl', 'notpl', 'run', 'setup', 'out', 'outhas', 'noout'];
  const checks = [];
  text.split('\n').forEach((line) => {
    if (!line.trim() || /^#/.test(line)) return;
    const m = /^(\w+)\s+([\s\S]+)$/.exec(line.trim());
    if (!m || !types.includes(m[1])) throw new Error('Unbekannte Prüfzeile "' + line + '" ' + where);
    let arg = m[2], label = '', hint = '';
    let k = arg.indexOf(' ?? ');
    const kl = arg.indexOf(' :: ');
    if (kl >= 0) {
      let rest = arg.slice(kl + 4);
      arg = arg.slice(0, kl);
      k = rest.indexOf(' ?? ');
      if (k >= 0) { hint = rest.slice(k + 4).trim(); rest = rest.slice(0, k); }
      label = rest.trim();
    }
    const needLabel = ['has', 'hasnot', 'src', 'nosrc', 'tpl', 'notpl', 'run', 'noout'];
    if (needLabel.includes(m[1]) && !label) throw new Error('Prüfzeile braucht ein Label: ' + line + ' ' + where);
    checks.push({ type: m[1], arg: arg.trim(), label: label, hint: hint });
  });
  return checks;
}

function parseExercise(kind, head, body, where) {
  const [id, title] = head.split('|').map((x) => x.trim());
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error('Ungültige ID "' + id + '" ' + where);
  if (kind === 'quiz') {
    const lines = body.split('\n');
    const qi = lines.findIndex((l) => /^\((x| )\) /.test(l));
    if (qi < 0) throw new Error('Quiz ohne Antworten ' + where);
    const options = [];
    for (let i = qi; i < lines.length; i++) {
      const m = /^\((x| )\) ([\s\S]*)$/.exec(lines[i]);
      if (m) {
        const [text, feedback] = m[2].split(' :: ');
        if (!feedback) throw new Error('Antwort ohne Rückmeldung: ' + lines[i] + ' ' + where);
        options.push({ html: inline(text.trim()), correct: m[1] === 'x', feedback: inline(feedback.trim()) });
      } else if (lines[i].trim()) throw new Error('Unerwartete Zeile im Quiz: ' + lines[i] + ' ' + where);
    }
    if (options.filter((o) => o.correct).length !== 1) throw new Error('Quiz braucht genau eine richtige Antwort ' + where);
    return { type: 'quiz', id, html: md(lines.slice(0, qi).join('\n'), where), options };
  }
  if (kind === 'task') {
    const lines = body.split('\n');
    const steps = lines.filter((l) => /^\[ \] /.test(l)).map((l) => inline(l.slice(4)));
    if (!steps.length) throw new Error('Aufgabe ohne Schritte ' + where);
    return { type: 'task', id, title: title || 'In VS Code', html: md(lines.filter((l) => !/^\[ \] /.test(l)).join('\n'), where), steps };
  }
  // code
  const sections = [];
  let cur = { name: 'prompt', arg: '', lines: [] };
  body.split('\n').forEach((l) => {
    const m = /^@(starter|solution|tests|hints|after|flags)(?:\s+(.*))?$/.exec(l);
    if (m) { sections.push(cur); cur = { name: m[1], arg: (m[2] || '').trim(), lines: [] }; } else cur.lines.push(l);
  });
  sections.push(cur);
  const ex = { type: 'code', id, title: title || 'Übung', html: '', files: {}, solution: {}, checks: [], hints: [], after: '', flags: {} };
  for (const s of sections) {
    const text = s.lines.join('\n');
    if (s.name === 'prompt') ex.html = md(text, where);
    else if (s.name === 'starter') ex.files[s.arg || 'main.ts'] = trimBlock(text);
    else if (s.name === 'solution') ex.solution[s.arg || 'main.ts'] = trimBlock(text);
    else if (s.name === 'tests') ex.checks = parseChecks(text, where);
    else if (s.name === 'hints') ex.hints = text.split(/^- /m).map((h) => h.trim()).filter(Boolean).map((h) => md(h, where));
    else if (s.name === 'after') ex.after = md(text, where);
    else if (s.name === 'flags') s.arg.split(/\s+/).filter(Boolean).forEach((f) => { ex.flags[f] = true; });
  }
  const a = Object.keys(ex.files).sort().join(), b = Object.keys(ex.solution).sort().join();
  if (!a) throw new Error('Übung ohne @starter ' + where);
  if (a !== b) throw new Error('Starter- und Lösungsdateien unterscheiden sich (' + a + ' / ' + b + ') ' + where);
  if (!ex.checks.length) throw new Error('Übung ohne Prüfungen ' + where);
  return ex;
}

export function loadCourse(dir) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.txt')).sort();
  const parts = [];
  const ids = new Set();
  const uniq = (id, where) => { if (ids.has(id)) throw new Error('Doppelte ID ' + id + ' ' + where); ids.add(id); };
  let part = null;
  for (const f of files) {
    const text = fs.readFileSync(path.join(dir, f), 'utf8').replace(/\r/g, '');
    const lines = text.split('\n');
    let lesson = null, block = null;
    const closeBlock = () => {
      if (!block) return;
      const where = `(${f}: ${lesson.id})`;
      const body = block.lines.join('\n');
      if (block.kind === 'text') { if (body.trim()) lesson.blocks.push({ type: 'text', html: md(body, where) }); } else {
        const ex = parseExercise(block.kind, block.head, body, where + ' ' + block.head);
        uniq(ex.id, where);
        lesson.blocks.push(ex);
      }
      block = null;
    };
    for (const line of lines) {
      let m;
      if ((m = /^#part (.+)$/.exec(line))) {
        closeBlock();
        const [id, title, desc] = m[1].split('|').map((x) => x.trim());
        part = { id, title, desc: desc || '', lessons: [] };
        parts.push(part);
        lesson = null;
      } else if ((m = /^=== (.+)$/.exec(line))) {
        closeBlock();
        const [id, title, minutes] = m[1].split('|').map((x) => x.trim());
        if (!/^[a-z0-9-]+$/.test(id)) throw new Error('Ungültige Lektions-ID ' + id);
        uniq(id, f);
        lesson = { id, title, minutes: Number(minutes) || 10, blocks: [] };
        part.lessons.push(lesson);
        block = { kind: 'text', lines: [] };
      } else if ((m = /^--- (quiz|code|task|text)\s*(.*)$/.exec(line))) {
        closeBlock();
        block = { kind: m[1], head: m[2], lines: [] };
      } else if (block) block.lines.push(line);
      else if (line.trim()) throw new Error('Text ausserhalb einer Lektion in ' + f + ': ' + line);
    }
    closeBlock();
  }
  return { parts };
}
