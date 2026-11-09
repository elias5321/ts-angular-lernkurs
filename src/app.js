/* Oberfläche des Lernkurses. */
(function () {
  'use strict';
  var core = window.TSK.core;
  var COURSE = window.KURS;
  var CM = window.CodeMirror;

  /* ---------- kleine Helfer ---------- */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c == null || c === false) continue;
      if (Array.isArray(c)) c.forEach(function (x) { if (x) el.appendChild(x); });
      else el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return el;
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function miniInline(s) {
    return esc(s).replace(/``\s?([\s\S]+?)\s?``/g, '<code>$1</code>').replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  }
  /* Einfaches Markdown für die Antworten des Tutors (alles wird zuerst maskiert). */
  function miniBlock(src) {
    var out = '', lines = String(src).split('\n'), i = 0;
    while (i < lines.length) {
      var l = lines[i];
      if (/^```/.test(l)) {
        var body = []; i++;
        while (i < lines.length && !/^```/.test(lines[i])) body.push(lines[i++]);
        i++;
        out += '<pre><code>' + esc(body.join('\n')) + '</code></pre>';
      } else if (/^\s*([-*]|\d+[.)])\s+/.test(l)) {
        var ordered = /^\s*\d/.test(l), items = [];
        while (i < lines.length && /^\s*([-*]|\d+[.)])\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*([-*]|\d+[.)])\s+/, ''));
        out += (ordered ? '<ol>' : '<ul>') + items.map(function (x) { return '<li>' + miniInline(x) + '</li>'; }).join('') + (ordered ? '</ol>' : '</ul>');
      } else if (/^#{1,4}\s+/.test(l)) { out += '<p><strong>' + miniInline(l.replace(/^#{1,4}\s+/, '')) + '</strong></p>'; i++; }
      else if (!l.trim()) i++;
      else {
        var para = [];
        while (i < lines.length && lines[i].trim() && !/^```/.test(lines[i]) && !/^\s*([-*]|\d+[.)])\s+/.test(lines[i]) && !/^#{1,4}\s+/.test(lines[i])) para.push(lines[i++]);
        out += '<p>' + miniInline(para.join(' ')) + '</p>';
      }
    }
    return out;
  }
  function debounce(fn, ms) { var t; return function () { clearTimeout(t); t = setTimeout(fn, ms); }; }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  /* ---------- Kursindex ---------- */
  var lessons = [], byId = {};
  COURSE.parts.forEach(function (p, pi) {
    p.num = pi + 1;
    p.isNg = /angular|projekt/.test(p.id);
    p.lessons.forEach(function (l) { l.part = p; lessons.push(l); byId[l.id] = l; l.items = l.blocks.filter(function (b) { return b.id; }); });
  });
  function lintSetFor(lesson) {
    var set = {};
    Object.keys(COURSE.lints).forEach(function (k) { if (lesson.index >= COURSE.lints[k]) set[k] = true; });
    return set;
  }

  /* ---------- Fortschritt ---------- */
  var KEY = 'tsk.progress.v1';
  var store = { done: {}, read: {}, tasks: {}, last: '' };
  try { var raw = JSON.parse(lsGet(KEY) || 'null'); if (raw && typeof raw === 'object') store = Object.assign(store, raw); } catch (e) {}
  ['done', 'read', 'tasks'].forEach(function (k) { if (!store[k] || typeof store[k] !== 'object') store[k] = {}; });
  function save(local) {
    lsSet(KEY, JSON.stringify(store));
    updateProgressUI();
    if (!local) scheduleSync();
  }
  function lessonState(l) {
    if (!l.items.length) return store.read[l.id] ? 'done' : 'open';
    var n = l.items.filter(function (b) { return store.done[b.id]; }).length;
    return n === l.items.length ? 'done' : (n > 0 ? 'part' : 'open');
  }
  function totals() {
    var done = lessons.filter(function (l) { return lessonState(l) === 'done'; }).length;
    return { done: done, all: lessons.length, pct: lessons.length ? Math.round(done / lessons.length * 100) : 0 };
  }
  function nextLesson() {
    var last = byId[store.last];
    if (last && lessonState(last) !== 'done') return last;
    for (var i = 0; i < lessons.length; i++) if (lessonState(lessons[i]) !== 'done') return lessons[i];
    return lessons[0];
  }
  function markDone(id) {
    if (store.done[id]) return;
    store.done[id] = Date.now();
    save();
  }

  /* ---------- Speichern im Claude-Konto (wenn verfügbar) ---------- */
  var syncRef = null, syncState = 'local', syncChain = Promise.resolve(), syncTimer = null;
  function mergeRemote(remote) {
    var changed = false;
    ['done', 'read'].forEach(function (k) {
      var r = remote && remote[k];
      if (r && typeof r === 'object') Object.keys(r).forEach(function (id) { if (!store[k][id]) { store[k][id] = r[id]; changed = true; } });
    });
    var rt = remote && remote.tasks;
    if (rt && typeof rt === 'object') Object.keys(rt).forEach(function (id) { if (!store.tasks[id] && Array.isArray(rt[id])) { store.tasks[id] = rt[id].slice(); changed = true; } });
    return changed;
  }
  function countKeys(o) { return o && typeof o === 'object' ? Object.keys(o).length : 0; }
  function pushSync() {
    if (!syncRef) return;
    var body = { v: 1, done: store.done, read: store.read, tasks: store.tasks, updated: Date.now() };
    syncChain = syncChain.then(function () { return syncRef.set(JSON.parse(JSON.stringify(body))); }).then(function () { setSync('cloud'); }, function () { setSync('local'); });
  }
  function scheduleSync() { if (!syncRef) return; clearTimeout(syncTimer); syncTimer = setTimeout(pushSync, 2500); }
  function setSync(s) { syncState = s; var el = document.getElementById('sync-note'); if (el) el.textContent = syncText(); }
  function syncText() {
    return syncState === 'cloud' ? 'Dein Fortschritt wird in deinem Claude-Konto gespeichert und ist auf all deinen Geräten da.' : 'Dein Fortschritt wird in diesem Browser gespeichert.';
  }
  function initSync() {
    var claude = window.claude;
    if (!claude || typeof claude.use !== 'function') return;
    Promise.all([claude.use('db'), claude.use('user')]).then(function (r) {
      var db = r[0], user = r[1];
      if (!db || !user) return;
      return user.id().then(function (uid) {
        if (!uid) return;
        var ref = db.doc('data/users/' + uid + '/progress');
        var timeout = new Promise(function (_, rej) { setTimeout(function () { rej(new Error('timeout')); }, 10000); });
        return Promise.race([ref.get(), timeout]).then(function (snap) {
          var remote = snap.exists ? snap.data() : null;
          var changed = mergeRemote(remote);
          syncRef = ref;
          setSync('cloud');
          if (changed) { save(true); rerender(); }
          var localMore = !remote || countKeys(store.done) > countKeys(remote.done) || countKeys(store.read) > countKeys(remote.read) || countKeys(store.tasks) > countKeys(remote.tasks);
          if (localMore && (countKeys(store.done) || countKeys(store.read) || countKeys(store.tasks))) pushSync();
        });
      });
    }).catch(function () {});
  }

  /* ---------- Claude als Tutor (wenn verfügbar) ---------- */
  var samplePromise = (window.claude && typeof window.claude.use === 'function') ? window.claude.use('sample').catch(function () { return null; }) : Promise.resolve(null);
  var tutorOff = false;
  var TUTOR_RULES = [
    'Du bist ein geduldiger Programmier-Tutor in einem deutschsprachigen Lernkurs für TypeScript und Angular.',
    'Der Lernende ist Anfänger: ein Schüler, der gerade erst mit JavaScript begonnen hat.',
    'Antworte auf Deutsch in der Du-Form, kurz und konkret (höchstens etwa 160 Wörter). Schreibe «ss» statt «ß».',
    'Regeln:',
    '1. Sag zuerst in einem Satz, was schon gut ist (nur wenn es stimmt).',
    '2. Nenne dann die ein bis drei wichtigsten Punkte, die besser werden können, mit Zeilenangabe.',
    '3. Verrate NICHT die fertige Lösung, ausser der Lernende bittet ausdrücklich darum. Gib stattdessen einen Hinweis, der zum nächsten Schritt führt.',
    '4. Benutze nur Konzepte, die zur aktuellen Lektion passen, und erkläre Fachwörter in einem Halbsatz.',
    '5. Für Angular gilt der aktuelle Stil (Version 22): Standalone-Komponenten, Signals, @if/@for im Template, inject(), @Service(), Dateinamen ohne «.component».',
    '6. Wenn der Code schon gut ist, sag das klar und schlage höchstens eine kleine Verfeinerung vor.',
  ].join('\n');
  function tutorErrorText(code) {
    if (code === 'rate_limited') return 'Im Moment sind es zu viele Anfragen. Warte kurz und versuch es dann nochmal.';
    if (code === 'session_expired') return 'Du musst dich bei Claude neu anmelden, dann klappt es wieder.';
    if (code === 'refused' || code === 'empty_completion') return 'Darauf gab es keine Antwort. Formuliere die Frage anders.';
    if (code === 'prompt_too_large') return 'Dein Code ist zu lang für eine Anfrage. Kürze ihn etwas.';
    return 'Das hat gerade nicht geklappt. Versuch es später nochmal.';
  }
  /* getContext() → Text mit Lektion, Aufgabe, Code, Prüfergebnis */
  function mountTutor(host, getContext) {
    var box = h('div', { class: 'tutor', hidden: true });
    host.appendChild(box);
    samplePromise.then(function (sample) {
      if (!sample || tutorOff) return;
      var history = [], ctl = null, busy = false;
      var out = h('div', { class: 'tutor-log' });
      var input = h('input', { type: 'text', id: 'tutor-q-' + (host.dataset.tid || Math.random().toString(36).slice(2)), placeholder: 'Oder stell eine eigene Frage zu dieser Übung …', 'aria-label': 'Frage an Claude' });
      var askBtn = h('button', { class: 'btn', type: 'button', text: 'Fragen' });
      var fbBtn = h('button', { class: 'btn', type: 'button', text: 'Claude um Feedback zu meinem Code bitten' });
      var stopBtn = h('button', { class: 'btn btn-quiet', type: 'button', text: 'Stopp', hidden: true });
      function ask(question, shown) {
        if (busy) return;
        busy = true; fbBtn.disabled = true; askBtn.disabled = true; stopBtn.hidden = false;
        var q = h('div', { class: 'tutor-q', text: shown });
        var a = h('div', { class: 'tutor-out' }, h('span', { class: 'tutor-who', text: 'Claude' }), h('div', { class: 'tutor-text', text: 'Claude denkt nach …' }));
        out.appendChild(q); out.appendChild(a);
        var textEl = a.lastChild;
        var past = history.slice(-3).map(function (t) { return 'Frage: ' + t.q + '\nAntwort: ' + t.a; }).join('\n\n');
        var prompt = TUTOR_RULES + '\n\n' + getContext() + (past ? '\n\nBisheriges Gespräch:\n' + past : '') + '\n\nAnliegen des Lernenden: ' + question;
        ctl = new AbortController();
        sample(prompt.slice(0, 60000), { cache: false, signal: ctl.signal, onText: function (u) { textEl.innerHTML = miniBlock(u.text); } })
          .then(function (r) { textEl.innerHTML = miniBlock(r.text); history.push({ q: question, a: r.text }); },
            function (e) {
              var code = e && e.code;
              if (code === 'cancelled') { if (e.text) textEl.innerHTML = miniBlock(e.text); else { q.remove(); a.remove(); } return; }
              if (code === 'not_granted' || code === 'sampling_disabled' || code === 'not_declared' || code === 'capability_disabled' || code === 'capability_removed') {
                tutorOff = true; q.remove(); a.remove();
                box.replaceChildren(h('p', { class: 'tutor-note', text: 'Der Claude-Tutor ist in dieser Ansicht nicht verfügbar. Die automatische Prüfung funktioniert weiterhin.' }));
                return;
              }
              textEl.textContent = (e && e.text ? e.text + '\n\n' : '') + tutorErrorText(code);
            })
          .then(function () { busy = false; fbBtn.disabled = false; askBtn.disabled = false; stopBtn.hidden = true; });
      }
      fbBtn.addEventListener('click', function () { ask('Bitte gib mir Feedback zu meinem aktuellen Code: Was ist gut, was kann ich besser machen?', 'Feedback zu meinem Code, bitte.'); });
      function sendQ() { var v = input.value.trim(); if (!v) return; input.value = ''; ask(v, v); }
      askBtn.addEventListener('click', sendQ);
      input.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') sendQ(); });
      stopBtn.addEventListener('click', function () { if (ctl) ctl.abort(); });
      box.appendChild(h('div', { class: 'tutor-row' }, fbBtn, stopBtn));
      box.appendChild(h('div', { class: 'tutor-row' }, input, askBtn));
      box.appendChild(h('p', { class: 'tutor-note', text: 'Claude sieht dabei die Aufgabe, deinen Code und das Prüfergebnis. Die Anfrage läuft über dein Claude-Konto.' }));
      box.appendChild(out);
      box.hidden = false;
    });
  }

  /* ---------- TypeScript laden ---------- */
  var envPromise = null;
  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = function () { rej(new Error('Laden fehlgeschlagen: ' + src)); };
      document.head.appendChild(s);
    });
  }
  function loadEnv() {
    if (!envPromise) {
      envPromise = Promise.all([loadScript('vendor-ts.js'), loadScript('libs.js')]).then(function () {
        if (!window.ts || !window.TSK_LIBS) throw new Error('TypeScript fehlt');
        return core.createEnv(window.ts, window.TSK_LIBS);
      });
      envPromise.catch(function () { envPromise = null; });
    }
    return envPromise;
  }

  /* ---------- Programm ausführen (Web Worker) ---------- */
  function runSource(src) {
    return new Promise(function (resolve) {
      var run = { lines: [], res: {}, crash: null, timeout: false, unavailable: false };
      var settled = false, worker = null, url = null, timer = null, gotMessage = false;
      function finish() {
        if (settled) return; settled = true;
        clearTimeout(timer);
        try { if (worker) worker.terminate(); } catch (e) {}
        if (url) URL.revokeObjectURL(url);
        resolve(run);
      }
      function onMsg(m) {
        gotMessage = true;
        if (!m) return;
        if (m.t === 'log') { if (run.lines.length < 500) run.lines.push({ k: m.k, s: String(m.s).slice(0, 4000) }); }
        else if (m.t === 'res') run.res[m.i] = { ok: m.ok, err: m.err };
        else if (m.t === 'crash') run.crash = run.crash || { name: m.n, message: m.s };
        else if (m.t === 'done') finish();
      }
      try {
        url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
        worker = new Worker(url);
        worker.onmessage = function (ev) { onMsg(ev.data); };
        worker.onerror = function (ev) {
          if (ev && ev.preventDefault) ev.preventDefault();
          if (!gotMessage && !(ev && ev.message)) { run.unavailable = true; }
          else run.crash = run.crash || { name: 'Error', message: (ev && ev.message) || 'Unbekannter Fehler' };
          finish();
        };
        timer = setTimeout(function () { run.timeout = true; finish(); }, 6000);
      } catch (e) { run.unavailable = true; finish(); }
    });
  }

  /* ---------- Editor ---------- */
  function modeFor(name) {
    if (/\.html$/.test(name)) return 'htmlmixed';
    if (/\.css$/.test(name)) return 'css';
    if (/\.json$/.test(name)) return { name: 'javascript', json: true };
    return { name: 'javascript', typescript: true };
  }
  function highlight(root) {
    if (!CM || !CM.runMode) return;
    root.querySelectorAll('pre[data-lang]').forEach(function (pre) {
      if (pre.dataset.done) return;
      pre.dataset.done = '1';
      var lang = pre.dataset.lang, code = pre.firstChild, text = pre.textContent;
      var mode = lang === 'ts' || lang === 'js' ? modeFor('x.ts') : lang === 'html' ? 'htmlmixed' : lang === 'css' ? 'css' : lang === 'json' ? modeFor('x.json') : null;
      if (!mode) return;
      try { code.textContent = ''; CM.runMode(text, mode, code); } catch (e) { code.textContent = text; }
    });
  }
  /* opts: { files, storageKey, onChange, onRun } */
  function createIDE(opts) {
    var names = Object.keys(opts.files);
    var saved = null;
    try { saved = JSON.parse(lsGet(opts.storageKey) || 'null'); } catch (e) {}
    var contents = {};
    names.forEach(function (n) { contents[n] = saved && typeof saved[n] === 'string' ? saved[n] : opts.files[n]; });
    var active = names[0];
    var tabs = h('div', { class: 'tabs', role: 'tablist' });
    var host = h('div', { class: 'editor-host' });
    var el = h('div', { class: 'ide' }, tabs, host);
    var cm = null, docs = {}, marks = [], plain = null, errCount = {};
    var persist = debounce(function () { lsSet(opts.storageKey, JSON.stringify(getFiles())); }, 400);
    function changed() { persist(); if (opts.onChange) opts.onChange(); }
    function getFiles() {
      var out = {};
      names.forEach(function (n) { out[n] = cm ? docs[n].getValue() : (n === active && plain ? plain.value : contents[n]); });
      return out;
    }
    function renderTabs() {
      tabs.replaceChildren.apply(tabs, names.map(function (n) {
        var b = h('button', { class: 'tab', type: 'button', role: 'tab', 'aria-selected': n === active ? 'true' : 'false', onclick: function () { show(n); } }, n);
        if (errCount[n]) b.appendChild(h('span', { class: 'tab-err', text: '● ' + errCount[n], title: plural(errCount[n], 'Problem', 'Probleme') }));
        return b;
      }));
    }
    function show(n) {
      if (!cm && plain) contents[active] = plain.value;
      active = n;
      if (cm) cm.swapDoc(docs[n]); else if (plain) plain.value = contents[n];
      renderTabs();
    }
    function mount() {
      if (CM) {
        names.forEach(function (n) { docs[n] = CM.Doc(contents[n], modeFor(n)); });
        cm = CM(host, {
          value: docs[active], theme: 'tsk', lineNumbers: true, tabSize: 2, indentUnit: 2, indentWithTabs: false,
          viewportMargin: Infinity, autoCloseBrackets: true, matchBrackets: true, autoCloseTags: true,
          gutters: ['CodeMirror-linenumbers', 'tsk-gutter'],
          extraKeys: {
            Tab: function (c) { if (c.somethingSelected()) c.indentSelection('add'); else c.replaceSelection('  ', 'end'); },
            'Shift-Tab': function (c) { c.indentSelection('subtract'); },
            'Ctrl-Enter': function () { if (opts.onRun) opts.onRun(); },
            'Cmd-Enter': function () { if (opts.onRun) opts.onRun(); },
            'Ctrl-/': 'toggleComment', 'Cmd-/': 'toggleComment',
            Esc: function (c) { c.getInputField().blur(); el.focus(); },
          },
        });
        el.tabIndex = -1;
        cm.on('changes', changed);
      } else {
        plain = h('textarea', { class: 'plain', spellcheck: 'false', 'aria-label': 'Code' });
        plain.value = contents[active];
        plain.addEventListener('input', function () { contents[active] = plain.value; changed(); });
        host.appendChild(plain);
      }
      renderTabs();
    }
    function mark(diags) {
      errCount = {};
      diags.forEach(function (d) { if (d.file) errCount[d.file] = (errCount[d.file] || 0) + 1; });
      renderTabs();
      if (!cm) return;
      marks.forEach(function (m) { m.clear(); });
      marks = [];
      names.forEach(function (n) {
        var doc = docs[n];
        doc.clearGutter('tsk-gutter');
        doc.eachLine(function (lh) { doc.removeLineClass(lh, 'background', 'tsk-errline'); });
      });
      diags.forEach(function (d) {
        var doc = docs[d.file];
        if (!doc) return;
        var from = { line: d.line, ch: d.col }, to = { line: d.endLine, ch: d.endCol };
        if (from.line === to.line && from.ch === to.ch) { if (from.ch > 0) from.ch--; else to.ch++; }
        var title = (d.german || d.message);
        marks.push(doc.markText(from, to, { className: 'tsk-err', attributes: { title: title } }));
        doc.setGutterMarker(d.line, 'tsk-gutter', h('div', { class: 'tsk-gutter-mark', title: title, text: '●' }));
        doc.addLineClass(d.line, 'background', 'tsk-errline');
      });
    }
    function goTo(file, line, col) {
      if (file && file !== active && names.indexOf(file) >= 0) show(file);
      if (cm) { cm.focus(); cm.setCursor({ line: line, ch: col || 0 }); cm.scrollIntoView({ line: line, ch: 0 }, 60); }
    }
    function setFiles(files) {
      names.forEach(function (n) {
        if (files[n] == null) return;
        contents[n] = files[n];
        if (cm) docs[n].setValue(files[n]); else if (plain && n === active) plain.value = files[n];
      });
      changed();
    }
    mount();
    return { el: el, getFiles: getFiles, setFiles: setFiles, mark: mark, goTo: goTo, refresh: function () { if (cm) cm.refresh(); }, names: names };
  }

  /* ---------- Ergebnisanzeige ---------- */
  function problemsPanel(diags, ide) {
    var body = h('div', { class: 'panel-body' });
    diags.slice(0, 12).forEach(function (d) {
      var where = (d.file ? d.file + ', ' : '') + 'Zeile ' + (d.line + 1) + ' · TS' + d.code;
      var item = h('div', { class: 'problem' },
        h('button', { class: 'problem-where', type: 'button', text: where, title: 'Zur Stelle springen', onclick: function () { ide.goTo(d.file, d.line, d.col); } }),
        h('div', { class: 'problem-msg', text: d.german || d.message }));
      if (d.explain) item.appendChild(h('div', { class: 'problem-explain', html: '<strong>Heisst:</strong> ' + miniInline(d.explain) }));
      if (d.german) item.appendChild(h('div', { class: 'problem-en', text: 'Auf Englisch: ' + d.message }));
      body.appendChild(item);
    });
    if (diags.length > 12) body.appendChild(h('div', { class: 'problem-en', text: '… und ' + (diags.length - 12) + ' weitere. Oft verschwinden viele, wenn du den ersten Fehler behebst.' }));
    return h('div', { class: 'panel' }, h('h4', null, 'Probleme', h('span', { class: 'n', text: String(diags.length) })), body);
  }
  function consolePanel(run, note) {
    var pre = h('pre', { class: 'console', 'aria-label': 'Ausgabe des Programms' });
    if (note) pre.appendChild(h('span', { class: 'is-empty', text: note }));
    else {
      run.lines.forEach(function (l) { pre.appendChild(h('span', { class: l.k === 'log' ? '' : 'is-' + l.k, text: l.s + '\n' })); });
      if (run.crash) pre.appendChild(h('span', { class: 'is-error', text: 'Absturz – ' + run.crash.name + ': ' + run.crash.message + '\n' }));
      if (run.timeout) pre.appendChild(h('span', { class: 'is-error', text: 'Abgebrochen: Das Programm lief länger als 6 Sekunden. Steckt es in einer Endlosschleife?\n' }));
      if (!run.lines.length && !run.crash && !run.timeout) pre.appendChild(h('span', { class: 'is-empty', text: '(Dein Programm hat nichts ausgegeben. Mit console.log(...) machst du Werte sichtbar.)' }));
    }
    return h('div', { class: 'panel' }, h('h4', null, 'Ausgabe'), pre);
  }
  function checksPanel(checks) {
    var okN = checks.filter(function (c) { return c.state === 'ok'; }).length;
    var ul = h('ul', { class: 'checks' });
    checks.forEach(function (c) {
      var li = h('li', { class: 'check is-' + c.state },
        h('span', { class: 'check-icon', 'aria-hidden': 'true', text: c.state === 'ok' ? '✓' : c.state === 'fail' ? '✗' : '·' }),
        h('span', { html: '<span class="sr">' + (c.state === 'ok' ? 'Erfüllt: ' : c.state === 'fail' ? 'Noch offen: ' : 'Noch nicht geprüft: ') + '</span>' + miniInline(c.label) }));
      if (c.state === 'fail' && (c.detail || c.hint)) li.appendChild(h('span', { class: 'check-detail', html: miniInline([c.detail, c.hint].filter(Boolean).join(' ')) }));
      ul.appendChild(li);
    });
    return h('div', { class: 'panel' }, h('h4', null, 'Anforderungen', h('span', { class: 'n', text: okN + ' von ' + checks.length })), h('div', { class: 'panel-body' }, ul));
  }
  function tipsPanel(tips, ide, passed) {
    var ul = h('ul', { class: 'tips' });
    tips.forEach(function (t) {
      ul.appendChild(h('li', null,
        h('button', { class: 'problem-where', type: 'button', text: (ide.names.length > 1 ? t.file + ', ' : '') + 'Zeile ' + (t.line + 1), onclick: function () { ide.goTo(t.file, t.line, 0); } }),
        h('div', { html: miniInline(t.text) })));
    });
    return h('div', { class: 'panel' }, h('h4', null, passed ? 'Das geht noch schöner' : 'Stil-Tipps', h('span', { class: 'n', text: 'freiwillig' })), h('div', { class: 'panel-body' }, ul));
  }
  function solutionView(ex, ide) {
    var box = h('div', { class: 'solution' });
    Object.keys(ex.solution).forEach(function (n) {
      box.appendChild(h('figure', { class: 'code' }, h('figcaption', null, h('span', { class: 'code-file', text: n }), h('span', { text: 'Musterlösung' })),
        h('pre', { 'data-lang': /\.html$/.test(n) ? 'html' : /\.css$/.test(n) ? 'css' : 'ts' }, h('code', { text: ex.solution[n] }))));
    });
    box.appendChild(h('div', null, h('button', { class: 'btn', type: 'button', text: 'Musterlösung in den Editor übernehmen', onclick: function () { ide.setFiles(ex.solution); } })));
    box.appendChild(h('p', { class: 'tutor-note', text: 'Es gibt fast immer mehrere richtige Lösungen. Wenn deine die Anforderungen erfüllt, ist sie richtig – auch wenn sie anders aussieht.' }));
    highlight(box);
    return box;
  }

  /* ---------- Code-Übung ---------- */
  function mountCode(ex, lesson, host) {
    var isNg = !!ex.flags.angular;
    var pill = h('span', { class: 'pill' });
    function setPill() { var d = !!store.done[ex.id]; pill.textContent = d ? 'Gelöst ✓' : 'Offen'; pill.className = 'pill' + (d ? ' is-done' : ''); }
    setPill();
    var status = h('span', { class: 'ide-status', role: 'status' });
    var result = h('div', { class: 'result', 'aria-live': 'polite' });
    var extra = h('div', { class: 'hint-list' });
    var lastSummary = 'Noch nicht geprüft.';
    var hintsShown = 0, busy = false, liveToken = 0;
    var runBtn = h('button', { class: 'btn btn-primary', type: 'button', text: isNg && ex.flags.norun ? 'Prüfen' : 'Ausführen & prüfen', title: 'Strg+Enter' });
    var hintBtn = ex.hints.length ? h('button', { class: 'btn', type: 'button', text: 'Tipp anzeigen' }) : null;
    var solBtn = h('button', { class: 'btn btn-quiet', type: 'button', text: 'Lösung' });
    var resetBtn = h('button', { class: 'btn btn-quiet', type: 'button', text: 'Zurücksetzen' });

    var ide = createIDE({ files: ex.files, storageKey: 'tsk.code.' + ex.id, onRun: run, onChange: debounce(live, 700) });

    function setStatus(text, cls) { status.textContent = text; status.className = 'ide-status' + (cls ? ' ' + cls : ''); }
    function live() {
      if (busy || !envPromise) return;
      var token = ++liveToken;
      envPromise.then(function (env) {
        if (token !== liveToken || busy) return;
        var an = core.analyze(env, ide.getFiles(), { angular: isNg });
        ide.mark(an.diagnostics);
        if (an.diagnostics.length) setStatus(plural(an.diagnostics.length, 'Problem', 'Probleme') + ' – siehe rote Markierung', 'is-bad');
        else setStatus('Keine TypeScript-Fehler', 'is-ok');
        var old = result.querySelector('[data-live-problems]');
        if (old) { var p = an.diagnostics.length ? problemsPanel(an.diagnostics, ide) : h('div'); p.setAttribute('data-live-problems', ''); old.replaceWith(p); }
      }).catch(function () {});
    }
    function run() {
      if (busy) return;
      busy = true; runBtn.disabled = true;
      setStatus(envPromise ? 'Prüfe …' : 'TypeScript wird geladen …');
      loadEnv().then(function (env) {
        var files = ide.getFiles();
        var prep = core.prepare(env, ex, files, lintSetFor(lesson));
        ide.mark(prep.diagnostics);
        return (prep.runSource ? runSource(prep.runSource) : Promise.resolve(null)).then(function (r) {
          var unavailable = r && r.unavailable;
          if (unavailable) r = null;
          var res = core.conclude(ex, prep, r);
          if (unavailable && prep.diagnostics.length === 0) {
            /* Ohne Worker zählen nur die statischen Prüfungen. */
            res.checks.forEach(function (c) { if (c.state === 'fail' && /nicht ausgeführt/.test(c.detail)) c.state = 'pending'; });
            res.passed = res.checks.every(function (c) { return c.state !== 'fail'; }) && res.checks.some(function (c) { return c.state === 'ok'; });
          }
          render(prep, r, res, unavailable);
        });
      }).catch(function (e) {
        result.replaceChildren(h('div', { class: 'banner banner-bad' }, h('p', { text: 'Die Prüfung konnte nicht starten (' + (e && e.message || 'unbekannter Fehler') + '). Lade die Seite neu und versuch es nochmal.' })));
        setStatus('');
      }).then(function () { busy = false; runBtn.disabled = false; });
    }
    function render(prep, r, res, unavailable) {
      var kids = [], nd = prep.diagnostics.length;
      var okN = res.checks.filter(function (c) { return c.state === 'ok'; }).length;
      if (res.passed) {
        kids.push(h('div', { class: 'banner banner-ok' }, h('strong', { text: 'Geschafft!' }), h('p', { text: prep.tips.length ? 'Alle Anforderungen sind erfüllt. Unten stehen noch freiwillige Stil-Tipps.' : 'Alle Anforderungen sind erfüllt – und am Stil gibt es nichts auszusetzen.' })));
        setStatus('Gelöst', 'is-ok');
        markDone(ex.id); setPill(); refreshNav();
      } else if (nd) {
        kids.push(h('div', { class: 'banner banner-bad' }, h('p', { html: '<strong>TypeScript hat ' + plural(nd, 'Problem', 'Probleme') + ' gefunden.</strong> Behebe ' + (nd === 1 ? 'es' : 'sie') + ' zuerst – erst danach wird dein Programm ausgeführt und geprüft. Fang mit dem obersten an.' })));
        setStatus(plural(nd, 'Problem', 'Probleme'), 'is-bad');
      } else if (r && r.timeout) {
        kids.push(h('div', { class: 'banner banner-bad' }, h('p', { html: '<strong>Dein Programm wurde nicht fertig.</strong> Wahrscheinlich eine Endlosschleife: Prüfe, ob sich die Bedingung deiner Schleife irgendwann ändert.' })));
        setStatus('Abgebrochen', 'is-bad');
      } else if (r && r.crash) {
        kids.push(h('div', { class: 'banner banner-bad' }, h('p', { html: '<strong>Dein Programm ist beim Ausführen abgestürzt.</strong> Die Meldung steht unten in der Ausgabe.' })));
        setStatus('Absturz', 'is-bad');
      } else {
        kids.push(h('div', { class: 'banner banner-info' }, h('p', { html: '<strong>Noch nicht ganz.</strong> ' + okN + ' von ' + res.checks.length + ' Anforderungen sind erfüllt. Schau dir die mit ✗ an.' })));
        setStatus(okN + ' von ' + res.checks.length + ' erfüllt');
      }
      var probs = nd ? problemsPanel(prep.diagnostics, ide) : h('div');
      probs.setAttribute('data-live-problems', '');
      kids.push(probs);
      if (!nd) {
        if (r) kids.push(consolePanel(r));
        else if (ex.flags.norun) kids.push(consolePanel(null, 'Angular-Code läuft nicht direkt in diesem Editor. Geprüft werden hier Typen und Aufbau. Ausführen kannst du ihn in deinem Projekt in VS Code mit «ng serve».'));
        else if (unavailable) kids.push(consolePanel(null, 'In dieser Ansicht kann das Programm nicht ausgeführt werden. Geprüft wurden nur Typen und Aufbau.'));
      }
      kids.push(checksPanel(res.checks));
      if (prep.tips.length) kids.push(tipsPanel(prep.tips, ide, res.passed));
      if (res.passed && ex.after) kids.push(h('div', { class: 'box box-merke', html: '<p class="box-title">Was du gerade gelernt hast</p>' + ex.after }));
      result.replaceChildren.apply(result, kids);
      highlight(result);
      lastSummary = (nd ? 'TypeScript-Probleme:\n' + prep.diagnostics.map(function (d) { return '- ' + (d.file || '') + ' Zeile ' + (d.line + 1) + ' TS' + d.code + ': ' + d.message; }).join('\n') + '\n' : 'Keine TypeScript-Fehler.\n') +
        'Anforderungen:\n' + res.checks.map(function (c) { return '- [' + (c.state === 'ok' ? 'erfüllt' : c.state === 'fail' ? 'NICHT erfüllt' : 'nicht geprüft') + '] ' + c.label + (c.detail ? ' (' + c.detail + ')' : ''); }).join('\n') +
        (r ? '\nAusgabe des Programms:\n' + (r.lines.map(function (l) { return l.s; }).join('\n').slice(0, 1500) || '(keine)') + (r.crash ? '\nAbsturz: ' + r.crash.name + ': ' + r.crash.message : '') + (r.timeout ? '\nTimeout (Endlosschleife?)' : '') : '') +
        (prep.tips.length ? '\nAutomatische Stil-Tipps:\n' + prep.tips.map(function (t) { return '- Zeile ' + (t.line + 1) + ': ' + t.text; }).join('\n') : '');
    }
    runBtn.addEventListener('click', run);
    if (hintBtn) hintBtn.addEventListener('click', function () {
      if (hintsShown >= ex.hints.length) return;
      extra.appendChild(h('div', { class: 'hint', html: '<span class="hint-n">Tipp ' + (hintsShown + 1) + ' von ' + ex.hints.length + '</span>' + ex.hints[hintsShown] }));
      highlight(extra);
      hintsShown++;
      if (hintsShown >= ex.hints.length) { hintBtn.disabled = true; hintBtn.textContent = 'Alle Tipps gezeigt'; } else hintBtn.textContent = 'Nächster Tipp';
    });
    function confirmBox(text, yes, action) {
      var box = h('div', { class: 'confirm' }, h('span', { text: text }),
        h('button', { class: 'btn', type: 'button', text: yes, onclick: function () { box.remove(); action(); } }),
        h('button', { class: 'btn btn-quiet', type: 'button', text: 'Abbrechen', onclick: function () { box.remove(); } }));
      extra.querySelectorAll('.confirm').forEach(function (c) { c.remove(); });
      extra.appendChild(box);
    }
    solBtn.addEventListener('click', function () {
      if (extra.querySelector('.solution')) return;
      var showIt = function () { extra.appendChild(solutionView(ex, ide)); };
      if (store.done[ex.id]) showIt(); else confirmBox('Die Lösung anzusehen ist okay – aber du lernst mehr, wenn du es zuerst mit den Tipps versuchst.', 'Lösung trotzdem zeigen', showIt);
    });
    resetBtn.addEventListener('click', function () {
      confirmBox('Deinen Code in dieser Übung verwerfen und von vorn beginnen?', 'Ja, zurücksetzen', function () { ide.setFiles(ex.files); result.replaceChildren(); setStatus(''); ide.mark([]); });
    });

    var body = h('div', { class: 'ex-body' },
      h('div', { class: 'ex-prompt', html: ex.html }),
      h('div', null, ide.el, h('div', { class: 'ide-bar' }, runBtn, hintBtn, solBtn, resetBtn, status)),
      extra, result);
    var sec = h('section', { class: 'ex wide' + (isNg ? ' is-ng' : ''), id: 'ex-' + ex.id, 'aria-label': 'Übung: ' + ex.title },
      h('div', { class: 'ex-head' }, h('span', { class: 'ex-kind', text: isNg ? 'Angular-Übung' : 'Übung' }), h('h3', { text: ex.title }), pill), body);
    host.appendChild(sec);
    body.dataset.tid = ex.id;
    mountTutor(body, function () {
      var files = ide.getFiles();
      return 'Lektion: ' + lesson.title + ' (Teil: ' + lesson.part.title + ')\nAufgabe «' + ex.title + '»:\n' + h('div', { html: ex.html }).textContent.trim().slice(0, 3000) +
        '\n\nErgebnis der automatischen Prüfung:\n' + lastSummary + '\n\nCode des Lernenden:\n' +
        Object.keys(files).map(function (n) { return '--- ' + n + ' ---\n' + files[n]; }).join('\n').slice(0, 20000);
    });
    loadEnv().then(function () { setTimeout(live, 50); }).catch(function () {});
    ide.refresh();
  }

  /* ---------- Quiz ---------- */
  function mountQuiz(q, host) {
    var pill = h('span', { class: 'pill' });
    function setPill() { var d = !!store.done[q.id]; pill.textContent = d ? 'Gelöst ✓' : 'Offen'; pill.className = 'pill' + (d ? ' is-done' : ''); }
    setPill();
    var opts = h('div', { class: 'options' });
    q.options.forEach(function (o, i) {
      var b = h('button', { class: 'option', type: 'button', 'aria-pressed': 'false' },
        h('span', { class: 'mark', 'aria-hidden': 'true', text: String.fromCharCode(65 + i) }), h('span', { html: o.html }));
      b.addEventListener('click', function () {
        if (b.querySelector('.fb')) return;
        b.classList.add(o.correct ? 'is-right' : 'is-wrong');
        b.setAttribute('aria-pressed', 'true');
        b.firstChild.textContent = o.correct ? '✓' : '✗';
        b.appendChild(h('span', { class: 'fb', html: '<strong>' + (o.correct ? 'Richtig. ' : 'Nicht ganz. ') + '</strong>' + o.feedback }));
        if (o.correct) { markDone(q.id); setPill(); refreshNav(); }
      });
      opts.appendChild(b);
    });
    host.appendChild(h('section', { class: 'ex col', id: 'ex-' + q.id, 'aria-label': 'Verständnisfrage' },
      h('div', { class: 'ex-head' }, h('span', { class: 'ex-kind', text: 'Verständnisfrage' }), h('h3', { text: 'Kurz nachgedacht' }), pill),
      h('div', { class: 'ex-body' }, h('div', { class: 'quiz-q', html: q.html }), opts)));
  }

  /* ---------- Aufgabe für VS Code ---------- */
  function mountTask(t, host) {
    var pill = h('span', { class: 'pill' });
    var state = Array.isArray(store.tasks[t.id]) ? store.tasks[t.id] : [];
    function setPill() { var d = !!store.done[t.id]; pill.textContent = d ? 'Erledigt ✓' : 'Offen'; pill.className = 'pill' + (d ? ' is-done' : ''); }
    setPill();
    var ul = h('ul', { class: 'steps' });
    t.steps.forEach(function (s, i) {
      var cb = h('input', { type: 'checkbox', id: 'task-' + t.id + '-' + i });
      cb.checked = !!state[i];
      cb.addEventListener('change', function () {
        state[i] = cb.checked;
        store.tasks[t.id] = t.steps.map(function (_, k) { return !!state[k]; });
        if (store.tasks[t.id].every(Boolean)) { store.done[t.id] = store.done[t.id] || Date.now(); } else delete store.done[t.id];
        save(); setPill(); refreshNav();
      });
      ul.appendChild(h('li', null, h('label', null, cb, h('span', { html: s }))));
    });
    host.appendChild(h('section', { class: 'ex col', id: 'ex-' + t.id, 'aria-label': 'Aufgabe in VS Code' },
      h('div', { class: 'ex-head' }, h('span', { class: 'ex-kind', text: 'Auf deinem Computer' }), h('h3', { text: t.title }), pill),
      h('div', { class: 'ex-body' }, h('div', { class: 'ex-prompt', html: t.html }), ul,
        h('p', { class: 'tutor-note', text: 'Diese Schritte machst du selbst in VS Code. Hake ab, was erledigt ist.' }))));
  }

  /* ---------- Seiten ---------- */
  var main = document.getElementById('main'), side = document.getElementById('side');
  var currentId = null;
  function renderSide() {
    side.replaceChildren.apply(side, COURSE.parts.map(function (p) {
      var done = p.lessons.filter(function (l) { return lessonState(l) === 'done'; }).length;
      var hasCurrent = p.lessons.some(function (l) { return l.id === currentId; });
      var det = h('details', { class: 'side-part' + (p.isNg ? ' is-ng' : '') },
        h('summary', null, h('span', { class: 'num', text: String(p.num) }), h('span', { text: p.title }), h('span', { class: 'count', text: done + '/' + p.lessons.length })),
        h('ul', { class: 'side-list' }, p.lessons.map(function (l) {
          var st = lessonState(l);
          return h('li', null, h('a', { href: '#' + l.id, 'aria-current': l.id === currentId ? 'page' : null },
            h('span', { class: 'dot' + (st === 'done' ? ' is-done' : st === 'part' ? ' is-part' : ''), title: st === 'done' ? 'abgeschlossen' : st === 'part' ? 'angefangen' : 'offen' }), h('span', { text: l.title })));
        })));
      var np = nextLesson();
      if (hasCurrent || (!currentId && np && np.part === p)) det.open = true;
      return det;
    }));
    var cur = side.querySelector('[aria-current="page"]');
    if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest' });
  }
  function refreshNav() {
    side.querySelectorAll('.side-part').forEach(function (det, pi) {
      var p = COURSE.parts[pi];
      var done = p.lessons.filter(function (l) { return lessonState(l) === 'done'; }).length;
      det.querySelector('.count').textContent = done + '/' + p.lessons.length;
      det.querySelectorAll('.dot').forEach(function (dot, li) {
        var st = lessonState(p.lessons[li]);
        dot.className = 'dot' + (st === 'done' ? ' is-done' : st === 'part' ? ' is-part' : '');
      });
    });
    var note = document.getElementById('open-note');
    if (note && currentId && byId[currentId]) note.textContent = openText(byId[currentId]);
  }
  function updateProgressUI() {
    var t = totals();
    var meter = document.getElementById('bar-meter');
    meter.firstElementChild.style.width = t.pct + '%';
    meter.setAttribute('aria-valuenow', String(t.pct));
    document.getElementById('bar-label').textContent = t.done + ' von ' + t.all + ' Lektionen';
  }
  function openText(l) {
    var open = l.items.filter(function (b) { return !store.done[b.id]; }).length;
    if (!l.items.length) return '';
    return open ? 'In dieser Lektion ' + (open === 1 ? 'ist noch 1 Übung' : 'sind noch ' + open + ' Übungen') + ' offen. Du kannst trotzdem weitergehen und später zurückkommen.' : 'Alle Übungen dieser Lektion sind gelöst.';
  }
  function renderLesson(l) {
    currentId = l.id;
    store.last = l.id; save(true);
    var idx = lessons.indexOf(l), prev = lessons[idx - 1], next = lessons[idx + 1];
    var nEx = l.items.length;
    var frag = [h('div', { class: 'col lesson-head' },
      h('p', { class: 'eyebrow' + (l.part.isNg ? ' is-ng' : ''), text: 'Teil ' + l.part.num + ' · ' + l.part.title }),
      h('h1', { text: l.title }),
      h('p', { class: 'lesson-meta' }, h('span', { text: 'ca. ' + l.minutes + ' Minuten' }), h('span', { text: nEx ? plural(nEx, 'Übung', 'Übungen') : 'Lesen' }), h('span', { text: 'Lektion ' + (idx + 1) + ' von ' + lessons.length })))];
    var holder = h('div');
    l.blocks.forEach(function (b) {
      if (b.type === 'text') holder.appendChild(h('div', { class: 'col prose', html: b.html }));
      else if (b.type === 'quiz') mountQuiz(b, holder);
      else if (b.type === 'task') mountTask(b, holder);
      else if (b.type === 'code') mountCode(b, l, holder);
    });
    frag.push(holder);
    var foot = h('div', { class: 'col' },
      h('p', { class: 'open-note', id: 'open-note', text: openText(l) }),
      h('div', { class: 'lesson-foot' },
        prev ? h('a', { class: 'btn', href: '#' + prev.id }, h('small', { text: '← Zurück' }), prev.title) : h('span'),
        next ? h('a', { class: 'btn btn-primary', href: '#' + next.id, onclick: function () { if (!l.items.length) { store.read[l.id] = store.read[l.id] || Date.now(); save(); } } }, h('small', { text: 'Weiter →' }), next.title)
          : h('a', { class: 'btn btn-primary', href: '#start', onclick: function () { if (!l.items.length) { store.read[l.id] = store.read[l.id] || Date.now(); save(); } } }, h('small', { text: 'Fertig' }), 'Zur Übersicht')));
    frag.push(foot);
    main.replaceChildren.apply(main, frag);
    highlight(main);
    renderSide();
    document.title = l.title + ' · TypeScript & Angular Lernkurs';
  }
  function renderHome() {
    currentId = null;
    var t = totals(), nl = nextLesson();
    var started = t.done > 0 || Object.keys(store.done).length > 0;
    var nExercises = 0; lessons.forEach(function (l) { nExercises += l.items.length; });
    var minutes = 0; lessons.forEach(function (l) { minutes += l.minutes; });
    var home = h('div', { class: 'col home' },
      h('div', { class: 'home-hero' },
        h('p', { class: 'eyebrow', text: 'Lernkurs für Einsteiger' }),
        h('h1', { html: 'Von den ersten Zeilen <span class="ts">TypeScript</span> bis zur eigenen <span class="ng">Angular</span>-App' }),
        h('p', { text: 'Du brauchst kein Vorwissen ausser ein bisschen JavaScript aus der Schule. Jede Lektion erklärt ein Thema und lässt dich sofort selbst programmieren – direkt hier im Browser. Dein Code wird automatisch geprüft, und du siehst gleich, was stimmt und was du besser machen kannst.' }),
        h('div', { class: 'home-cta' },
          h('a', { class: 'btn btn-primary', href: '#' + nl.id, text: started ? 'Weiterlernen: ' + nl.title : 'Kurs starten' }),
          h('span', { class: 'home-stats', text: lessons.length + ' Lektionen · ' + nExercises + ' Übungen · etwa ' + Math.round(minutes / 60) + ' Stunden' }))),
      h('ol', { class: 'how' },
        h('li', { html: '<strong>Lesen</strong>Kurze Erklärung mit Beispielen, die du ausprobieren kannst.' }),
        h('li', { html: '<strong>Selbst schreiben</strong>Der Editor zeigt Fehler schon beim Tippen, wie VS Code.' }),
        h('li', { html: '<strong>Prüfen lassen</strong>Anforderungen, Ausgabe und Stil-Tipps auf einen Blick.' }),
        h('li', { html: '<strong>In VS Code nachbauen</strong>Aufgaben für deinen Computer zeigen, wie es «in echt» geht.' })));
    COURSE.parts.forEach(function (p) {
      var done = p.lessons.filter(function (l) { return lessonState(l) === 'done'; }).length;
      var meter = h('div', { class: 'meter' }, h('i'));
      meter.firstChild.style.width = Math.round(done / p.lessons.length * 100) + '%';
      home.appendChild(h('section', { class: 'part-row' + (p.isNg ? ' is-ng' : '') },
        h('div', { class: 'part-num', 'aria-hidden': 'true', text: String(p.num) }),
        h('div', null, h('h2', { text: p.title }), h('p', { text: p.desc }),
          h('div', { class: 'part-meter' }, meter, h('span', { text: done + ' von ' + p.lessons.length + ' Lektionen' })),
          h('ul', { class: 'part-lessons' }, p.lessons.map(function (l) {
            var st = lessonState(l);
            return h('li', null, h('a', { href: '#' + l.id }, h('span', { class: 'dot' + (st === 'done' ? ' is-done' : st === 'part' ? ' is-part' : '') }), h('span', { text: l.title })));
          })))));
    });
    var resetHost = h('span');
    var resetBtn = h('button', { class: 'btn btn-quiet', type: 'button', text: 'Fortschritt zurücksetzen' });
    resetBtn.addEventListener('click', function () {
      resetHost.replaceChildren(h('span', { class: 'confirm' }, h('span', { text: 'Wirklich alles löschen? Auch dein gespeicherter Code geht verloren.' }),
        h('button', { class: 'btn', type: 'button', text: 'Ja, alles löschen', onclick: function () {
          try { Object.keys(localStorage).forEach(function (k) { if (k.indexOf('tsk.') === 0) localStorage.removeItem(k); }); } catch (e) {}
          store = { done: {}, read: {}, tasks: {}, last: '' };
          lsDel(KEY); updateProgressUI(); pushSync(); renderHome();
        } }),
        h('button', { class: 'btn btn-quiet', type: 'button', text: 'Abbrechen', onclick: function () { resetHost.replaceChildren(); } })));
    });
    home.appendChild(h('div', { class: 'home-foot' }, h('span', { id: 'sync-note', class: 'sync', text: syncText() }), resetBtn, resetHost));
    main.replaceChildren(home);
    renderSide();
    document.title = 'TypeScript & Angular Lernkurs';
  }
  function route(scroll) {
    var id = (location.hash || '').replace(/^#/, '');
    closeSide();
    if (byId[id]) renderLesson(byId[id]); else renderHome();
    if (scroll !== false) { window.scrollTo(0, 0); }
  }
  function rerender() { route(false); }

  /* ---------- Kursplan auf kleinen Bildschirmen ---------- */
  var menuBtn = document.getElementById('menu-btn'), scrim = document.getElementById('scrim');
  function closeSide() { side.classList.remove('is-open'); scrim.classList.remove('is-open'); menuBtn.setAttribute('aria-expanded', 'false'); }
  menuBtn.addEventListener('click', function () {
    var open = !side.classList.contains('is-open');
    side.classList.toggle('is-open', open); scrim.classList.toggle('is-open', open); menuBtn.setAttribute('aria-expanded', String(open));
  });
  scrim.addEventListener('click', closeSide);

  /* ---------- Spielwiese ---------- */
  var drawer = document.getElementById('drawer'), drawerBody = document.getElementById('drawer-body'), playIDE = null, playRun = null;
  var PLAY_START = '// Hier kannst du frei ausprobieren.\nconst name: string = "Welt";\nconsole.log(`Hallo ${name}!`);\n';
  function openPlay(code) {
    drawer.hidden = false;
    if (!playIDE) {
      var result = h('div', { class: 'result', 'aria-live': 'polite' });
      var status = h('span', { class: 'ide-status', role: 'status' });
      var busy = false, last = 'Noch nicht ausgeführt.';
      var all = {}; Object.keys(COURSE.lints).forEach(function (k) { all[k] = true; });
      var ex = { checks: [], flags: {} };
      playRun = function () {
        if (busy) return; busy = true; status.textContent = envPromise ? 'Läuft …' : 'TypeScript wird geladen …';
        loadEnv().then(function (env) {
          var prep = core.prepare(env, ex, playIDE.getFiles(), all);
          playIDE.mark(prep.diagnostics);
          return (prep.runSource ? runSource(prep.runSource) : Promise.resolve(null)).then(function (r) {
            var kids = [];
            if (prep.diagnostics.length) kids.push(problemsPanel(prep.diagnostics, playIDE));
            else if (r && !r.unavailable) kids.push(consolePanel(r));
            else kids.push(consolePanel(null, 'In dieser Ansicht kann das Programm nicht ausgeführt werden.'));
            if (prep.tips.length) kids.push(tipsPanel(prep.tips, playIDE, false));
            result.replaceChildren.apply(result, kids);
            status.textContent = prep.diagnostics.length ? plural(prep.diagnostics.length, 'Problem', 'Probleme') : 'Fertig';
            status.className = 'ide-status' + (prep.diagnostics.length ? ' is-bad' : ' is-ok');
            last = prep.diagnostics.length ? 'TypeScript-Probleme:\n' + prep.diagnostics.map(function (d) { return '- Zeile ' + (d.line + 1) + ' TS' + d.code + ': ' + d.message; }).join('\n') : 'Ausgabe:\n' + (r ? r.lines.map(function (l) { return l.s; }).join('\n').slice(0, 1500) : '');
          });
        }).catch(function () { status.textContent = 'TypeScript konnte nicht geladen werden.'; }).then(function () { busy = false; });
      };
      playIDE = createIDE({ files: { 'spielwiese.ts': PLAY_START }, storageKey: 'tsk.code.spielwiese', onRun: function () { playRun(); } });
      var runBtn = h('button', { class: 'btn btn-primary', type: 'button', text: 'Ausführen', title: 'Strg+Enter', onclick: function () { playRun(); } });
      var tutorHost = h('div');
      drawerBody.replaceChildren(
        h('p', { text: 'Ein leeres Blatt zum Ausprobieren. Hier gibt es keine Aufgabe – nur dich, TypeScript und die Ausgabe.' }),
        h('div', null, playIDE.el, h('div', { class: 'ide-bar' }, runBtn, status)), result, tutorHost);
      tutorHost.dataset.tid = 'spielwiese';
      mountTutor(tutorHost, function () { return 'Der Lernende probiert frei in der «Spielwiese» etwas aus (keine feste Aufgabe).\n' + last + '\n\nCode:\n' + playIDE.getFiles()['spielwiese.ts'].slice(0, 20000); });
    }
    if (typeof code === 'string') playIDE.setFiles({ 'spielwiese.ts': code });
    playIDE.refresh();
    document.getElementById('drawer-close').focus();
    if (typeof code === 'string') playRun();
  }
  document.getElementById('play-btn').addEventListener('click', function () { if (drawer.hidden) openPlay(); else drawer.hidden = true; });
  document.getElementById('drawer-close').addEventListener('click', function () { drawer.hidden = true; });
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && !drawer.hidden && !ev.defaultPrevented) drawer.hidden = true; });
  main.addEventListener('click', function (ev) {
    var b = ev.target.closest && ev.target.closest('[data-try]');
    if (!b) return;
    var pre = b.parentNode.querySelector('pre');
    if (pre) openPlay(pre.textContent + '\n');
  });

  /* ---------- Start ---------- */
  window.addEventListener('hashchange', function () { route(); });
  updateProgressUI();
  route(false);
  initSync();
})();
