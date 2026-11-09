/* Kern des Lernkurses: TypeScript-Analyse, Prüfungen, Tipps, Ausführung.
   Läuft im Browser (window.TSK.core) und in Node (module.exports) – so werden
   alle Musterlösungen vor dem Veröffentlichen automatisch getestet. */
(function (root) {
  'use strict';

  var GLOBALS_DTS = [
    'declare const console: { log(...daten: any[]): void; error(...daten: any[]): void; warn(...daten: any[]): void; info(...daten: any[]): void; table(daten: any): void; };',
    'declare function setTimeout(callback: (...args: any[]) => void, ms?: number, ...args: any[]): number;',
    'declare function clearTimeout(id: number | undefined): void;',
    'declare function setInterval(callback: (...args: any[]) => void, ms?: number, ...args: any[]): number;',
    'declare function clearInterval(id: number | undefined): void;',
    'interface EventTarget {}',
    'interface Event { readonly type: string; readonly target: EventTarget | null; preventDefault(): void; stopPropagation(): void; }',
    'interface KeyboardEvent extends Event { readonly key: string; }',
    'interface MouseEvent extends Event { readonly clientX: number; readonly clientY: number; }',
    'interface HTMLElement extends EventTarget { textContent: string | null; focus(): void; }',
    'interface HTMLInputElement extends HTMLElement { value: string; checked: boolean; }',
    'interface Storage { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void; clear(): void; }',
    'declare const localStorage: Storage;',
  ].join('\n');
  /* Dateien, die jedes Angular-Projekt hat und die eine Übung nicht jedes Mal mitliefern muss. */
  var NG_BASELINE = {
    '/src/app.routes.ts': "import { Routes } from '@angular/router';\nexport const routes: Routes = [];\n",
  };

  function createEnv(ts, libs) {
    return { ts: ts, libs: libs, libCache: {}, lastProgram: null };
  }

  function baseOptions(env, angular) {
    var ts = env.ts;
    var o = {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleDetection: ts.ModuleDetectionKind.Force,
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      noImplicitReturns: true,
      noImplicitOverride: true,
      lib: ['lib.es2022.d.ts'],
      types: [],
    };
    if (angular) o.experimentalDecorators = true;
    return o;
  }

  function dirname(p) { var i = p.lastIndexOf('/'); return i <= 0 ? '/' : p.slice(0, i); }
  function joinPath(dir, rel) {
    var parts = (dir + '/' + rel).split('/'), out = [];
    for (var i = 0; i < parts.length; i++) {
      if (parts[i] === '' || parts[i] === '.') continue;
      if (parts[i] === '..') out.pop(); else out.push(parts[i]);
    }
    return '/' + out.join('/');
  }

  /* files: { "main.ts": "...", "app.html": "..." } */
  function analyze(env, files, opts) {
    opts = opts || {};
    var ts = env.ts, libs = env.libs;
    var options = baseOptions(env, opts.angular);
    var vfs = {};
    var roots = ['/lib/tsk-globals.d.ts'];
    Object.keys(files).forEach(function (n) {
      if (/\.ts$/.test(n)) { vfs['/src/' + n] = files[n]; roots.push('/src/' + n); }
    });
    function libText(name) {
      if (name === '/lib/tsk-globals.d.ts') return GLOBALS_DTS;
      var m = /^\/lib\/(.+)$/.exec(name);
      if (m && libs.lib[m[1]] != null) return libs.lib[m[1]];
      m = /^\/ng\/(.+)$/.exec(name);
      if (m && libs.ng[m[1]] != null) return libs.ng[m[1]];
      return undefined;
    }
    var hidden = {};
    if (opts.angular) Object.keys(NG_BASELINE).forEach(function (k) { if (vfs[k] == null) hidden[k] = NG_BASELINE[k]; });
    function read(name) { return vfs[name] != null ? vfs[name] : hidden[name] != null ? hidden[name] : libText(name); }
    var host = {
      getSourceFile: function (name, lang) {
        if (vfs[name] != null) return ts.createSourceFile(name, vfs[name], lang, true);
        if (hidden[name] != null) return ts.createSourceFile(name, hidden[name], lang, true);
        var t = libText(name);
        if (t == null) return undefined;
        if (!env.libCache[name]) env.libCache[name] = ts.createSourceFile(name, t, lang, true);
        return env.libCache[name];
      },
      getDefaultLibFileName: function () { return '/lib/lib.es2022.d.ts'; },
      getDefaultLibLocation: function () { return '/lib'; },
      writeFile: function () {},
      getCurrentDirectory: function () { return '/'; },
      getCanonicalFileName: function (f) { return f; },
      useCaseSensitiveFileNames: function () { return true; },
      getNewLine: function () { return '\n'; },
      fileExists: function (n) { return read(n) != null; },
      readFile: function (n) { return read(n); },
      directoryExists: function () { return true; },
      getDirectories: function () { return []; },
      resolveModuleNames: function (names, containing) {
        return names.map(function (name) {
          if (name.charAt(0) === '.') {
            var p = joinPath(dirname(containing), name);
            if (vfs[p + '.ts'] != null || hidden[p + '.ts'] != null) return { resolvedFileName: p + '.ts', extension: '.ts' };
            if (vfs[p] != null && /\.ts$/.test(p)) return { resolvedFileName: p, extension: '.ts' };
            if (libText(p + '.d.ts') != null) return { resolvedFileName: p + '.d.ts', extension: '.d.ts', isExternalLibraryImport: true };
            return undefined;
          }
          var key = name.replace(/^@angular\//, '').replace(/\//g, '-') + '.d.ts';
          if (libs.ng[key] != null) return { resolvedFileName: '/ng/' + key, extension: '.d.ts', isExternalLibraryImport: true };
          return undefined;
        });
      },
    };
    function run() {
      var program = ts.createProgram(roots, options, host);
      var diags = ts.getPreEmitDiagnostics(program).filter(function (d) {
        return !d.file || /^\/src\//.test(d.file.fileName);
      });
      return { program: program, diags: diags };
    }
    var r = run();
    var german = null;
    if (r.diags.length && libs.de && ts.setLocalizedDiagnosticMessages && !opts.quick) {
      try {
        ts.setLocalizedDiagnosticMessages(libs.de);
        german = run().diags.map(function (d) { return ts.flattenDiagnosticMessageText(d.messageText, '\n'); });
      } catch (e) { german = null; }
      try { ts.setLocalizedDiagnosticMessages(undefined); } catch (e2) {}
    }
    var diagnostics = r.diags.map(function (d, i) {
      var o = { code: d.code, message: ts.flattenDiagnosticMessageText(d.messageText, '\n'), file: null, line: 0, col: 0, endLine: 0, endCol: 0 };
      if (german && german[i] && german.length === r.diags.length) o.german = german[i];
      if (d.file && d.start != null) {
        var a = d.file.getLineAndCharacterOfPosition(d.start);
        var b = d.file.getLineAndCharacterOfPosition(d.start + (d.length || 1));
        o.file = d.file.fileName.replace(/^\/src\//, '');
        o.line = a.line; o.col = a.character; o.endLine = b.line; o.endCol = b.character;
      }
      o.explain = explain(o);
      return o;
    });
    var sourceFiles = {};
    Object.keys(vfs).forEach(function (p) { sourceFiles[p.replace(/^\/src\//, '')] = r.program.getSourceFile(p); });
    return { ts: ts, program: r.program, checker: r.program.getTypeChecker(), diagnostics: diagnostics, sourceFiles: sourceFiles, files: files };
  }

  /* ---------- Erklärungen zu Fehlermeldungen ---------- */
  var EXPLAIN = {
    2322: function (m) {
      var x = /Type '(.+?)' is not assignable to type '(.+?)'/.exec(m);
      return x ? 'Hier landet ein Wert vom Typ `' + x[1] + '`, erwartet wird aber `' + x[2] + '`. Entweder ist der Wert falsch oder die Typangabe.' : 'Der Wert passt nicht zum erwarteten Typ.';
    },
    2345: function (m) {
      var x = /Argument of type '(.+?)' is not assignable to parameter of type '(.+?)'/.exec(m);
      return x ? 'Du übergibst der Funktion einen Wert vom Typ `' + x[1] + '`, der Parameter erwartet aber `' + x[2] + '`.' : 'Ein Argument beim Funktionsaufruf hat den falschen Typ.';
    },
    2304: function (m) {
      var x = /Cannot find name '(.+?)'/.exec(m);
      return 'TypeScript kennt ' + (x ? '`' + x[1] + '`' : 'diesen Namen') + ' nicht. Häufige Ursachen: Tippfehler, Gross-/Kleinschreibung, oder die Variable wurde nie deklariert (`let`/`const` vergessen).';
    },
    2552: function () { return 'Diesen Namen gibt es nicht – wahrscheinlich ein Tippfehler. TypeScript schlägt dir einen ähnlichen Namen vor.'; },
    2551: function () { return 'Diese Eigenschaft gibt es nicht – wahrscheinlich ein Tippfehler. TypeScript schlägt dir eine ähnliche vor.'; },
    2339: function (m) {
      var x = /Property '(.+?)' does not exist on type '(.+?)'/.exec(m);
      return x ? 'Der Typ `' + x[2] + '` hat keine Eigenschaft `' + x[1] + '`. Prüfe die Schreibweise – oder die Eigenschaft fehlt im Typ/Interface.' : 'Diese Eigenschaft gibt es auf dem Typ nicht.';
    },
    2554: function (m) {
      var x = /Expected (\S+) arguments?, but got (\d+)/.exec(m);
      return x ? 'Die Funktion erwartet ' + x[1] + ' Argument(e), du übergibst ' + x[2] + '.' : 'Die Anzahl der Argumente stimmt nicht.';
    },
    2555: function () { return 'Du übergibst zu wenige Argumente.'; },
    2588: function () { return 'Eine `const`-Variable kann nicht neu zugewiesen werden. Wenn sich der Wert ändern soll, deklariere sie mit `let`.'; },
    7006: function () { return 'Der Parameter hat keinen Typ. Schreibe den Typ hinter den Namen, z. B. `(name: string)`.'; },
    7005: function () { return 'TypeScript kann hier keinen Typ erkennen. Gib einen Typ an oder einen Startwert.'; },
    7034: function () { return 'Die Variable hat weder Typ noch Startwert. Gib einen Typ an, z. B. `let punkte: number;`.'; },
    7053: function () { return 'Du greifst mit einem Schlüssel zu, von dem TypeScript nicht weiss, ob es ihn gibt.'; },
    2531: function () { return 'Der Wert könnte `null` sein. Prüfe das zuerst (z. B. mit `if`) oder nutze `?.`.'; },
    2532: function () { return 'Der Wert könnte `undefined` sein. Prüfe das zuerst (z. B. mit `if`) oder nutze `?.` bzw. `??`.'; },
    2533: function () { return 'Der Wert könnte `null` oder `undefined` sein. Prüfe das zuerst.'; },
    18047: function () { return 'Der Wert könnte `null` sein. Prüfe das zuerst mit `if (wert !== null)` oder nutze `?.`.'; },
    18048: function () { return 'Der Wert könnte `undefined` sein. Prüfe das zuerst mit `if (wert !== undefined)` oder nutze `?.` bzw. `??`.'; },
    18049: function () { return 'Der Wert könnte `null` oder `undefined` sein. Prüfe das zuerst.'; },
    18046: function () { return 'Der Wert hat den Typ `unknown`. Du musst erst prüfen, was es ist (z. B. `typeof wert === "string"`), bevor du ihn benutzt.'; },
    1005: function (m) {
      var x = /'(.+?)' expected/.exec(m);
      return 'Hier fehlt ein Zeichen' + (x ? ': `' + x[1] + '`' : '') + '. Schau auch eine Zeile weiter oben – oft fehlt dort eine Klammer oder ein Anführungszeichen.';
    },
    1109: function () { return 'Hier erwartet TypeScript einen Wert oder Ausdruck. Vielleicht ist die Zeile unvollständig.'; },
    1128: function () { return 'Hier steht etwas, das nicht hingehört – oft eine Klammer `}` zu viel oder zu wenig.'; },
    1002: function () { return 'Ein Text (String) wurde nicht geschlossen. Es fehlt das zweite Anführungszeichen.'; },
    1160: function () { return 'Ein Template-String wurde nicht geschlossen. Es fehlt der zweite Backtick `` ` ``.'; },
    1003: function () { return 'Hier erwartet TypeScript einen Namen.'; },
    1136: function () { return 'In einem Objekt fehlt hier der Name der Eigenschaft.'; },
    1161: function () { return 'Ein regulärer Ausdruck wurde nicht geschlossen – vermutlich steht hier ein `/` zu viel.'; },
    2451: function () { return 'Diesen Variablennamen gibt es in diesem Bereich schon. Jede Variable darf nur einmal deklariert werden.'; },
    2300: function () { return 'Dieser Name wird doppelt verwendet.'; },
    2355: function () { return 'Die Funktion verspricht einen Rückgabewert, gibt aber nichts zurück. Es fehlt ein `return`.'; },
    2366: function () { return 'Nicht jeder Weg durch die Funktion endet mit einem `return`. Am Ende fehlt eines.'; },
    7030: function () { return 'Nicht alle Wege durch die Funktion geben einen Wert zurück. Ergänze ein `return` für die übrigen Fälle.'; },
    2741: function (m) {
      var x = /Property '(.+?)' is missing/.exec(m);
      return 'Im Objekt fehlt die Pflicht-Eigenschaft' + (x ? ' `' + x[1] + '`' : '') + '.';
    },
    2739: function () { return 'Im Objekt fehlen mehrere Pflicht-Eigenschaften, die der Typ verlangt.'; },
    2740: function () { return 'Im Objekt fehlen mehrere Pflicht-Eigenschaften, die der Typ verlangt.'; },
    2353: function (m) {
      var x = /'(.+?)' does not exist in type '(.+?)'/.exec(m);
      return x ? 'Die Eigenschaft `' + x[1] + '` kommt im Typ `' + x[2] + '` nicht vor. Tippfehler – oder sie fehlt im Typ.' : 'Diese Eigenschaft kommt im Typ nicht vor.';
    },
    2540: function () { return 'Diese Eigenschaft ist `readonly` und darf nach dem Erstellen nicht mehr geändert werden.'; },
    2341: function () { return 'Diese Eigenschaft ist `private`. Von ausserhalb der Klasse kommst du nicht an sie heran.'; },
    2445: function () { return 'Diese Eigenschaft ist `protected`. Sie ist nur in der Klasse selbst und in Unterklassen sichtbar.'; },
    2564: function () { return 'Die Eigenschaft bekommt nie einen Wert. Gib ihr einen Startwert oder setze sie im `constructor`.'; },
    2367: function () { return 'Dieser Vergleich kann nie wahr sein, weil die beiden Typen nichts gemeinsam haben (z. B. Zahl mit Text).'; },
    2365: function () { return 'Dieser Operator funktioniert mit diesen Typen nicht (z. B. `<` zwischen Zahl und Text).'; },
    2362: function () { return 'Links vom Rechenzeichen muss eine Zahl stehen.'; },
    2363: function () { return 'Rechts vom Rechenzeichen muss eine Zahl stehen.'; },
    2349: function () { return 'Du rufst etwas mit `()` auf, das keine Funktion ist.'; },
    2769: function () { return 'Keine Variante dieser Funktion passt zu deinen Argumenten. Prüfe Anzahl und Typen.'; },
    2307: function () { return 'Das Modul wurde nicht gefunden. Prüfe den Pfad im `import` (Tippfehler? `./` vergessen?).'; },
    2305: function () { return 'Das Modul exportiert diesen Namen nicht. Prüfe die Schreibweise und ob dort `export` steht.'; },
    2614: function () { return 'Das Modul exportiert diesen Namen nicht.'; },
    2459: function () { return 'Dieser Name wird in der anderen Datei nicht exportiert. Dort fehlt `export`.'; },
    1308: function () { return '`await` funktioniert nur in Funktionen, die mit `async` markiert sind.'; },
    2420: function () { return 'Die Klasse erfüllt das Interface nicht: Es fehlt etwas oder ein Typ ist anders.'; },
    2416: function () { return 'Diese Eigenschaft passt nicht zu der in der Elternklasse.'; },
    4114: function () { return 'Diese Methode überschreibt eine Methode der Elternklasse. Schreibe `override` davor.'; },
    2377: function () { return 'Im `constructor` einer Unterklasse muss `super(...)` aufgerufen werden.'; },
    17009: function () { return '`super(...)` muss aufgerufen werden, bevor du `this` benutzt.'; },
    2511: function () { return 'Von einer abstrakten Klasse kann man kein Objekt erzeugen.'; },
    2448: function () { return 'Du benutzt die Variable, bevor sie deklariert wurde. Verschiebe die Deklaration nach oben.'; },
    2454: function () { return 'Die Variable wird benutzt, bevor sie einen Wert bekommen hat.'; },
    2693: function () { return 'Das ist ein Typ, kein Wert. Typen existieren nur beim Prüfen – im laufenden Programm kannst du sie nicht benutzen.'; },
    2749: function () { return 'Das ist ein Wert, kein Typ. Meinst du `typeof ...`?'; },
    2314: function () { return 'Dieser generische Typ braucht eine Typangabe in spitzen Klammern, z. B. `Array<string>`.'; },
    2558: function () { return 'Die Anzahl der Typargumente in `<...>` stimmt nicht.'; },
    2794: function () { return 'Hier fehlt ein Argument. Bei `new Promise` z. B. erwartet `resolve` einen Wert.'; },
    1206: function () { return 'Ein Decorator (`@...`) steht an einer Stelle, wo er nicht erlaubt ist. Er gehört direkt vor eine Klasse.'; },
    2559: function () { return 'Das Objekt hat keine einzige Eigenschaft mit dem erwarteten Typ gemeinsam.'; },
    2352: function () { return 'Diese Typumwandlung mit `as` ist vermutlich ein Fehler – die Typen haben nichts miteinander zu tun.'; },
    2774: function () { return 'Du prüfst die Funktion selbst statt ihr Ergebnis. Es fehlen die Klammern `()` für den Aufruf.'; },
    2872: function () { return 'Dieser Ausdruck ist immer wahr – die Prüfung ist überflüssig oder falsch.'; },
    2873: function () { return 'Dieser Ausdruck ist immer falsch – die Prüfung ist überflüssig oder falsch.'; },
  };
  function explain(d) {
    var f = EXPLAIN[d.code];
    return f ? f(d.message) : '';
  }

  /* ---------- Hilfen für statische Prüfungen ---------- */
  function normType(s) {
    s = String(s).replace(/\s+/g, '').replace(/;}/g, '}').replace(/"/g, "'");
    var parts = [], depth = 0, cur = '';
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      if (c === '(' || c === '<' || c === '{' || c === '[') depth++;
      else if (c === ')' || c === '}' || c === ']') depth--;
      else if (c === '>' && s[i - 1] !== '=') depth--;
      if (c === '|' && depth === 0) { parts.push(cur); cur = ''; } else cur += c;
    }
    parts.push(cur);
    return parts.filter(Boolean).sort().join('|');
  }
  function stripUndef(s) {
    return normType(s).split('|').filter(function (p) { return p !== 'undefined'; }).join('|');
  }
  function splitTop(s, sep) {
    var parts = [], depth = 0, cur = '';
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      if (c === '(' || c === '<' || c === '{' || c === '[') depth++;
      else if (c === ')' || c === '}' || c === ']') depth--;
      else if (c === '>' && s[i - 1] !== '=') depth--;
      if (c === sep && depth === 0) { parts.push(cur); cur = ''; } else cur += c;
    }
    if (cur.trim()) parts.push(cur);
    return parts.map(function (p) { return p.trim(); });
  }


  /* Erwartete Typen einer Prüfung als Liste von Typ-Texten (für den strukturellen Vergleich). */
  function expectedTypes(c) {
    var m;
    if (c.type === 'var') {
      m = /^([\w$.]+)\s*:\s*([\s\S]+)$/.exec(c.arg);
      return m ? { name: m[1], types: [m[2]] } : null;
    }
    if (c.type === 'fn') {
      if (/^[\w$.]+</.test(c.arg)) return null;
      m = /^([\w$.]+)\s*\(([\s\S]*)\)\s*:\s*([\s\S]+)$/.exec(c.arg);
      if (!m) return null;
      var ps = splitTop(m[2], ',').map(function (p) { return /\?$/.test(p) ? '(' + p.replace(/\?$/, '') + ') | undefined' : p; });
      return { name: m[1].split('.')[0], types: ps.concat([m[3]]) };
    }
    if (c.type === 'shape') {
      m = /^([\w$]+)\s*\{([\s\S]*)\}$/.exec(c.arg);
      if (!m) return null;
      return { name: m[1], types: splitTop(m[2], ';').map(function (p) {
        var pm = /^(readonly\s+)?([\w$]+)(\?)?\s*:\s*([\s\S]+)$/.exec(p);
        return pm[3] ? '(' + pm[4] + ') | undefined' : pm[4];
      }) };
    }
    return null;
  }
  function sameType(an, actual, i, j, actualStr, wantStr) {
    if (normType(actualStr) === normType(wantStr)) return true;
    var e = an.expect && an.expect[i] && an.expect[i][j];
    if (!e) return false;
    var ts = an.ts, ch = an.checker;
    if ((actual.flags & ts.TypeFlags.Any) && !(e.flags & ts.TypeFlags.Any)) return false;
    if (!ch.isTypeAssignableTo) return false;
    return ch.isTypeAssignableTo(actual, e) && ch.isTypeAssignableTo(e, actual);
  }
  /* Zweite Analyse mit angehängten Hilfstypen, damit erwartete und tatsächliche Typen
     strukturell verglichen werden können (Reihenfolge, eigene Typnamen usw. spielen dann keine Rolle). */
  function withExpectations(env, an, ex, files) {
    var extra = {}, wanted = {};
    ex.checks.forEach(function (c, i) {
      var e = expectedTypes(c);
      if (!e) return;
      var node = findTop(an, e.name);
      if (!node) return;
      var file = node.getSourceFile().fileName.replace(/^\/src\//, '');
      extra[file] = extra[file] || '';
      e.types.forEach(function (t, j) { extra[file] += '\ntype __tsk_' + i + '_' + j + ' = ' + t + ';'; });
      wanted[i] = e.types.length;
    });
    if (!Object.keys(extra).length) return an;
    var aug = {};
    Object.keys(files).forEach(function (n) { aug[n] = files[n] + (extra[n] ? '\n;' + extra[n] + '\n' : ''); });
    var an2;
    try { an2 = analyze(env, aug, { angular: !!(ex.flags && ex.flags.angular), quick: true }); } catch (err) { return an; }
    if (an2.diagnostics.length) return an;
    an2.expect = {};
    Object.keys(wanted).forEach(function (i) {
      an2.expect[i] = [];
      for (var j = 0; j < wanted[i]; j++) {
        var n = findTop(an2, '__tsk_' + i + '_' + j);
        an2.expect[i].push(n ? an2.checker.getDeclaredTypeOfSymbol(an2.checker.getSymbolAtLocation(n.name)) : null);
      }
    });
    an2.files = files;
    return an2;
  }

  function tsFiles(an) {
    return Object.keys(an.sourceFiles).map(function (k) { return an.sourceFiles[k]; }).filter(Boolean);
  }
  function findTop(an, name) {
    var ts = an.ts, found = null;
    tsFiles(an).forEach(function (sf) {
      sf.statements.forEach(function (st) {
        if (ts.isVariableStatement(st)) {
          st.declarationList.declarations.forEach(function (d) {
            if (ts.isIdentifier(d.name) && d.name.text === name) found = found || d;
          });
        } else if ((ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st) || ts.isInterfaceDeclaration(st) ||
          ts.isTypeAliasDeclaration(st) || ts.isEnumDeclaration(st)) && st.name && st.name.text === name) {
          found = found || st;
        }
      });
    });
    return found;
  }
  function typeStr(an, t) {
    return an.checker.typeToString(t, undefined, an.ts.TypeFormatFlags.NoTruncation | an.ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope);
  }
  function declaredOrValueType(an, node) {
    var ts = an.ts, ch = an.checker;
    if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isClassDeclaration(node)) {
      var sym = ch.getSymbolAtLocation(node.name);
      return ch.getDeclaredTypeOfSymbol(sym);
    }
    return ch.getTypeAtLocation(node.name);
  }
  function getSignature(an, spec) {
    var ch = an.checker, parts = spec.split('.');
    var node = findTop(an, parts[0]);
    if (!node) return null;
    var t;
    if (parts.length === 2) {
      var ct = declaredOrValueType(an, node);
      var p = ch.getPropertyOfType(ct, parts[1]);
      if (!p) return null;
      t = ch.getTypeOfSymbolAtLocation(p, node);
    } else t = ch.getTypeAtLocation(node.name || node);
    var sigs = t.getCallSignatures();
    return sigs.length ? { sig: sigs[0], node: node } : null;
  }
  function fnDeclNode(an, spec) {
    var ts = an.ts, parts = spec.split('.');
    var node = findTop(an, parts[0]);
    if (!node) return null;
    if (parts.length === 2 && ts.isClassDeclaration(node)) {
      var m = node.members.filter(function (x) { return x.name && x.name.getText() === parts[1]; })[0];
      if (!m) return null;
      if (ts.isPropertyDeclaration(m) && m.initializer) return m.initializer;
      return m;
    }
    if (ts.isVariableDeclaration(node)) return node.initializer || null;
    return node;
  }
  function stripComments(an, sf) {
    var ts = an.ts, text = sf.getFullText(), ranges = [];
    function add(rs) { if (rs) rs.forEach(function (r) { ranges.push([r.pos, r.end]); }); }
    function visit(n) {
      add(ts.getLeadingCommentRanges(text, n.getFullStart()));
      add(ts.getTrailingCommentRanges(text, n.getEnd()));
      ts.forEachChild(n, visit);
    }
    visit(sf);
    add(ts.getLeadingCommentRanges(text, sf.endOfFileToken.getFullStart()));
    var chars = text.split('');
    ranges.forEach(function (r) { for (var i = r[0]; i < r[1]; i++) if (chars[i] !== '\n') chars[i] = ' '; });
    return chars.join('');
  }
  function allSource(an) {
    return tsFiles(an).map(function (sf) { return stripComments(an, sf); }).join('\n');
  }
  function allTemplates(an) {
    var ts = an.ts, out = [];
    Object.keys(an.files).forEach(function (n) { if (/\.html$/.test(n)) out.push(an.files[n]); });
    tsFiles(an).forEach(function (sf) {
      (function visit(n) {
        if (ts.isPropertyAssignment(n) && n.name.getText() === 'template' &&
          (ts.isNoSubstitutionTemplateLiteral(n.initializer) || ts.isStringLiteral(n.initializer))) out.push(n.initializer.text);
        ts.forEachChild(n, visit);
      })(sf);
    });
    return out.join('\n').replace(/<!--[\s\S]*?-->/g, '');
  }
  function hasKind(an, kinds) {
    var ts = an.ts, found = false;
    var ids = kinds.map(function (k) { return ts.SyntaxKind[k]; });
    tsFiles(an).forEach(function (sf) {
      (function visit(n) { if (ids.indexOf(n.kind) >= 0) found = true; if (!found) ts.forEachChild(n, visit); })(sf);
    });
    return found;
  }
  function parseRegex(s) {
    var m = /^\/([\s\S]+)\/([a-z]*)$/.exec(s.trim());
    if (!m) throw new Error('Ungültiger regulärer Ausdruck: ' + s);
    return new RegExp(m[1], m[2]);
  }

  /* check: { type, arg, label, hint } → { ok, label, hint, detail } */
  function staticCheck(an, c, idx) {
    var ts = an.ts, ch = an.checker, node, m, t;
    switch (c.type) {
      case 'var': {
        m = /^([\w$.]+)\s*:\s*([\s\S]+)$/.exec(c.arg);
        node = findTop(an, m[1]);
        if (!node || !ts.isVariableDeclaration(node)) return { ok: false, detail: 'Ich finde keine Variable namens `' + m[1] + '`. Achte auf die genaue Schreibweise.' };
        t = ch.getTypeAtLocation(node.name);
        var got = typeStr(an, t), wide = typeStr(an, ch.getBaseTypeOfLiteralType(t));
        if (sameType(an, t, idx, 0, got, m[2]) || sameType(an, ch.getBaseTypeOfLiteralType(t), idx, 0, wide, m[2])) return { ok: true };
        return { ok: false, detail: '`' + m[1] + '` hat im Moment den Typ `' + wide + '`.' };
      }
      case 'kind': {
        m = /^([\w$]+)\s+(const|let)$/.exec(c.arg);
        node = findTop(an, m[1]);
        if (!node || !ts.isVariableDeclaration(node)) return { ok: false, detail: 'Ich finde keine Variable namens `' + m[1] + '`.' };
        var flags = node.parent.flags;
        var isConst = !!(flags & ts.NodeFlags.Const), isLet = !!(flags & ts.NodeFlags.Let);
        var ok = m[2] === 'const' ? isConst : isLet;
        return { ok: ok, detail: ok ? '' : '`' + m[1] + '` ist mit `' + (isConst ? 'const' : isLet ? 'let' : 'var') + '` deklariert.' };
      }
      case 'annotated': {
        node = findTop(an, c.arg);
        if (!node || !ts.isVariableDeclaration(node)) return { ok: false, detail: 'Ich finde keine Variable namens `' + c.arg + '`.' };
        return { ok: !!node.type, detail: node.type ? '' : 'Schreibe den Typ ausdrücklich hin: `' + c.arg + ': Typ = ...`.' };
      }
      case 'fn': {
        m = /^([\w$.]+)(?:<[^>]*>)?\s*\(([\s\S]*)\)\s*:\s*([\s\S]+)$/.exec(c.arg);
        var gs = getSignature(an, m[1]);
        if (!gs) return { ok: false, detail: 'Ich finde keine Funktion namens `' + m[1] + '`.' };
        var wantP = splitTop(m[2], ',');
        var ps = gs.sig.getParameters();
        if (ps.length !== wantP.length) return { ok: false, detail: '`' + m[1] + '` hat ' + ps.length + ' Parameter, erwartet sind ' + wantP.length + '.' };
        for (var i = 0; i < ps.length; i++) {
          var decl = ps[i].valueDeclaration;
          var pType = ch.getTypeOfSymbolAtLocation(ps[i], decl || gs.node);
          var pt = typeStr(an, pType);
          var opt = decl ? ch.isOptionalParameter(decl) : false;
          var wantOpt = /\?$/.test(wantP[i]);
          var wantT = wantP[i].replace(/\?$/, '');
          if (wantOpt !== opt) return { ok: false, detail: 'Parameter ' + (i + 1) + ' (`' + ps[i].name + '`) soll ' + (wantOpt ? 'optional sein (mit `?` oder Standardwert).' : 'ein Pflicht-Parameter sein.') };
          if ((opt ? stripUndef(pt) : normType(pt)) !== normType(wantT) && !sameType(an, pType, idx, i, pt, wantP[i])) return { ok: false, detail: 'Parameter ' + (i + 1) + ' (`' + ps[i].name + '`) hat den Typ `' + pt + '`, erwartet ist `' + wantT + '`.' };
        }
        var rType = ch.getReturnTypeOfSignature(gs.sig);
        var rt = typeStr(an, rType);
        if (!sameType(an, rType, idx, ps.length, rt, m[3])) return { ok: false, detail: 'Der Rückgabetyp ist `' + rt + '`, erwartet ist `' + m[3].trim() + '`.' };
        return { ok: true };
      }
      case 'fnannot': {
        var fnode = fnDeclNode(an, c.arg);
        if (!fnode || !fnode.parameters) return { ok: false, detail: 'Ich finde keine Funktion namens `' + c.arg + '`.' };
        var missing = fnode.parameters.filter(function (p) { return !p.type && !p.initializer; });
        if (missing.length) return { ok: false, detail: 'Dem Parameter `' + missing[0].name.getText() + '` fehlt die Typangabe.' };
        if (!fnode.type) return { ok: false, detail: 'Der Rückgabetyp fehlt. Er steht hinter der Parameter-Klammer: `function f(...): Typ { ... }`.' };
        return { ok: true };
      }
      case 'shape': {
        m = /^([\w$]+)\s*\{([\s\S]*)\}$/.exec(c.arg);
        node = findTop(an, m[1]);
        if (!node) return { ok: false, detail: 'Ich finde nichts mit dem Namen `' + m[1] + '`.' };
        t = declaredOrValueType(an, node);
        var props = splitTop(m[2], ';');
        for (var j = 0; j < props.length; j++) {
          var pm = /^(readonly\s+)?([\w$]+)(\?)?\s*:\s*([\s\S]+)$/.exec(props[j]);
          var sym = ch.getPropertyOfType(t, pm[2]);
          if (!sym) return { ok: false, detail: 'In `' + m[1] + '` fehlt `' + pm[2] + '`.' };
          var isOpt = !!(sym.flags & ts.SymbolFlags.Optional);
          var sType = ch.getTypeOfSymbolAtLocation(sym, node);
          var st = typeStr(an, sType);
          if (!!pm[3] !== isOpt) return { ok: false, detail: '`' + pm[2] + '` soll ' + (pm[3] ? 'optional sein (`' + pm[2] + '?:`).' : 'Pflicht sein (ohne `?`).') };
          if ((isOpt ? stripUndef(st) : normType(st)) !== normType(pm[4]) && !sameType(an, sType, idx, j, st, pm[4])) return { ok: false, detail: '`' + m[1] + '.' + pm[2] + '` hat den Typ `' + st + '`, erwartet ist `' + pm[4].trim() + '`.' };
          if (pm[1]) {
            var d0 = sym.valueDeclaration || (sym.declarations && sym.declarations[0]);
            var ro = d0 && (ts.getCombinedModifierFlags(d0) & ts.ModifierFlags.Readonly);
            if (!ro) return { ok: false, detail: '`' + pm[2] + '` soll `readonly` sein.' };
          }
        }
        return { ok: true };
      }
      case 'exists': {
        m = /^(interface|type|class|enum|function)\s+([\w$]+)$/.exec(c.arg);
        node = findTop(an, m[2]);
        var okk = !!node && ({
          interface: ts.isInterfaceDeclaration, type: ts.isTypeAliasDeclaration, class: ts.isClassDeclaration,
          enum: ts.isEnumDeclaration, function: ts.isFunctionDeclaration,
        })[m[1]](node);
        return { ok: okk, detail: okk ? '' : (node ? '`' + m[2] + '` gibt es, aber nicht als `' + m[1] + '`.' : 'Ich finde kein `' + m[1] + ' ' + m[2] + '`.') };
      }
      case 'has': return { ok: hasKind(an, c.arg.split('|')) };
      case 'hasnot': return { ok: !hasKind(an, c.arg.split('|')) };
      case 'src': return { ok: parseRegex(c.arg).test(allSource(an)) };
      case 'nosrc': return { ok: !parseRegex(c.arg).test(allSource(an)) };
      case 'tpl': return { ok: parseRegex(c.arg).test(allTemplates(an)) };
      case 'notpl': return { ok: !parseRegex(c.arg).test(allTemplates(an)) };
    }
    throw new Error('Unbekannte Prüfung: ' + c.type);
  }

  var STATIC_TYPES = ['var', 'kind', 'annotated', 'fn', 'fnannot', 'shape', 'exists', 'has', 'hasnot', 'src', 'nosrc', 'tpl', 'notpl'];
  var RUN_TYPES = ['run', 'out', 'outhas', 'noout'];

  function autoLabel(c) {
    var m;
    switch (c.type) {
      case 'var': m = /^([\w$.]+)\s*:\s*([\s\S]+)$/.exec(c.arg); return 'Variable `' + m[1] + '` hat den Typ `' + m[2].trim() + '`';
      case 'kind': m = c.arg.split(/\s+/); return '`' + m[0] + '` ist mit `' + m[1] + '` deklariert';
      case 'annotated': return '`' + c.arg + '` hat eine ausdrückliche Typangabe';
      case 'fn': m = /^([\w$.]+)(?:<[^>]*>)?\s*\(([\s\S]*)\)\s*:\s*([\s\S]+)$/.exec(c.arg);
        return 'Funktion `' + m[1] + '` nimmt (' + (m[2].trim() || 'nichts') + ') und gibt `' + m[3].trim() + '` zurück';
      case 'fnannot': return 'Bei `' + c.arg + '` sind Parameter und Rückgabetyp ausdrücklich angegeben';
      case 'shape': m = /^([\w$]+)\s*\{([\s\S]*)\}$/.exec(c.arg); return '`' + m[1] + '` hat: `' + m[2].trim().replace(/\s+/g, ' ') + '`';
      case 'exists': return 'Es gibt `' + c.arg + '`';
      case 'out': return 'Die Ausgabe enthält die Zeile `' + c.arg + '`';
      case 'outhas': return 'In der Ausgabe kommt `' + c.arg + '` vor';
    }
    return c.arg;
  }

  /* ---------- Tipps (Stil) ---------- */
  function lint(an, enabled) {
    var ts = an.ts, ch = an.checker, tips = [], seen = {};
    function on(id) { return !enabled || enabled[id]; }
    function tip(id, node, text) {
      if (!on(id) || seen[id]) return;
      seen[id] = true;
      var sf = node.getSourceFile();
      var lc = sf.getLineAndCharacterOfPosition(node.getStart());
      tips.push({ id: id, line: lc.line, file: sf.fileName.replace(/^\/src\//, ''), text: text });
    }
    tsFiles(an).forEach(function (sf) {
      var assigned = new Set();
      (function collect(n) {
        var target = null;
        if (ts.isBinaryExpression(n) && n.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && n.operatorToken.kind <= ts.SyntaxKind.LastAssignment) target = n.left;
        else if ((ts.isPrefixUnaryExpression(n) || ts.isPostfixUnaryExpression(n)) &&
          (n.operator === ts.SyntaxKind.PlusPlusToken || n.operator === ts.SyntaxKind.MinusMinusToken)) target = n.operand;
        if (target && ts.isIdentifier(target)) { var s = ch.getSymbolAtLocation(target); if (s) assigned.add(s); }
        if (target && (ts.isArrayLiteralExpression(target) || ts.isObjectLiteralExpression(target))) {
          (function ids(x) { if (ts.isIdentifier(x)) { var s2 = ch.getSymbolAtLocation(x); if (s2) assigned.add(s2); } ts.forEachChild(x, ids); })(target);
        }
        ts.forEachChild(n, collect);
      })(sf);

      (function visit(n) {
        if (ts.isVariableDeclarationList(n)) {
          var isLet = !!(n.flags & ts.NodeFlags.Let), isConst = !!(n.flags & ts.NodeFlags.Const);
          if (!isLet && !isConst) tip('var', n, '`var` ist die alte Schreibweise. Nimm `const` (Wert bleibt gleich) oder `let` (Wert ändert sich).');
          var inLoopHead = ts.isForStatement(n.parent) || ts.isForOfStatement(n.parent) || ts.isForInStatement(n.parent);
          n.declarations.forEach(function (d) {
            if (isLet && !inLoopHead && ts.isIdentifier(d.name) && d.initializer) {
              var s = ch.getSymbolAtLocation(d.name);
              if (s && !assigned.has(s)) tip('const', d, '`' + d.name.text + '` wird nie neu zugewiesen – dann ist `const` besser als `let`. So sieht man sofort: Dieser Wert bleibt.');
            }
            if (ts.isIdentifier(d.name) && !d.initializer && !d.type && !inLoopHead) tip('noinit', d, '`' + d.name.text + '` hat weder Typ noch Startwert. Gib mindestens einen Typ an, sonst kann TypeScript dich nicht schützen.');
            if (ts.isIdentifier(d.name)) {
              var nm = d.name.text;
              var isFn = d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer));
              if (/_/.test(nm) && !/^[A-Z0-9_]+$/.test(nm)) tip('naming', d, 'Namen schreibt man in TypeScript in camelCase: `' + nm.replace(/_+([a-zA-Z0-9])/g, function (_, c) { return c.toUpperCase(); }) + '` statt `' + nm + '`.');
              else if (/^[A-Z][a-z]/.test(nm) && !(d.initializer && ts.isClassExpression(d.initializer)) && !isFn) tip('naming', d, 'Variablen beginnen mit einem Kleinbuchstaben: `' + nm.charAt(0).toLowerCase() + nm.slice(1) + '`. Grossbuchstaben am Anfang sind für Klassen und Typen reserviert.');
            }
          });
        }
        if (n.kind === ts.SyntaxKind.AnyKeyword) tip('any', n, '`any` schaltet die Typprüfung ab. Versuche, den echten Typ anzugeben – oder nimm `unknown`, wenn du ihn wirklich nicht kennst.');
        if (ts.isBinaryExpression(n)) {
          var k = n.operatorToken.kind;
          if (k === ts.SyntaxKind.EqualsEqualsToken || k === ts.SyntaxKind.ExclamationEqualsToken) {
            var isNullCmp = n.right.kind === ts.SyntaxKind.NullKeyword || n.left.kind === ts.SyntaxKind.NullKeyword;
            if (!isNullCmp) tip('eqeqeq', n.operatorToken, 'Nimm `' + (k === ts.SyntaxKind.EqualsEqualsToken ? '===' : '!==') + '` statt `' + n.operatorToken.getText() + '`. Der strenge Vergleich vergleicht auch den Typ und überrascht dich nie.');
          }
          if ((k === ts.SyntaxKind.EqualsEqualsEqualsToken || k === ts.SyntaxKind.ExclamationEqualsEqualsToken) &&
            (n.right.kind === ts.SyntaxKind.TrueKeyword || n.right.kind === ts.SyntaxKind.FalseKeyword)) {
            tip('booleancmp', n, 'Ein `boolean` muss man nicht mit `true`/`false` vergleichen: `if (aktiv)` oder `if (!aktiv)` reicht.');
          }
          if (k === ts.SyntaxKind.PlusToken) {
            var l = n.left, r = n.right;
            var lit = function (x) { return ts.isStringLiteral(x) || ts.isNoSubstitutionTemplateLiteral(x); };
            if ((lit(l) && !lit(r)) || (lit(r) && !lit(l))) {
              var up = n.parent, nested = false;
              while (up && ts.isBinaryExpression(up)) { nested = true; up = up.parent; }
              void nested;
              tip('template', n, 'Text und Variablen lassen sich mit einem Template-String lesbarer verbinden: `` `Hallo ${name}!` `` statt `"Hallo " + name + "!"`.');
            }
          }
        }
        if (ts.isForStatement(n) && n.condition && ts.isBinaryExpression(n.condition) &&
          ts.isPropertyAccessExpression(n.condition.right) && n.condition.right.name.text === 'length') {
          tip('forof', n, 'Wenn du nur jedes Element eines Arrays brauchst, ist `for (const element of liste)` kürzer und sicherer als die Zähl-Schleife.');
        }
        if (ts.isFunctionDeclaration(n) && n.name && !n.type && n.body) tip('returntype', n.name, 'Gib bei Funktionen den Rückgabetyp an: `function ' + n.name.text + '(...): Typ`. Dann merkt TypeScript sofort, wenn du versehentlich etwas Falsches zurückgibst.');
        if (ts.isNonNullExpression(n)) tip('nonnull', n, 'Das `!` sagt TypeScript „vertrau mir, das ist nie null“. Sicherer ist eine echte Prüfung mit `if` oder `?.`.');
        if ((ts.isClassDeclaration(n) || ts.isInterfaceDeclaration(n) || ts.isTypeAliasDeclaration(n)) && n.name && /^[a-z]/.test(n.name.text)) {
          tip('naming', n.name, 'Klassen, Interfaces und Typen beginnen mit einem Grossbuchstaben: `' + n.name.text.charAt(0).toUpperCase() + n.name.text.slice(1) + '`.');
        }
        if (ts.isIfStatement(n) && ts.isBlock(n.thenStatement) && n.thenStatement.statements.length === 1 && n.elseStatement &&
          ts.isBlock(n.elseStatement) && n.elseStatement.statements.length === 1) {
          var a = n.thenStatement.statements[0], b = n.elseStatement.statements[0];
          if (ts.isReturnStatement(a) && ts.isReturnStatement(b) && a.expression && b.expression &&
            a.expression.kind === ts.SyntaxKind.TrueKeyword && b.expression.kind === ts.SyntaxKind.FalseKeyword) {
            tip('returnbool', n, '`if (bedingung) { return true; } else { return false; }` lässt sich kürzen zu `return bedingung;`.');
          }
        }
        ts.forEachChild(n, visit);
      })(sf);
    });
    return tips;
  }

  /* ---------- Ausführen ---------- */
  function transpile(env, files, angular) {
    var ts = env.ts, defs = '', entryJs = '';
    var names = Object.keys(files).filter(function (n) { return /\.ts$/.test(n); });
    var entry = files['main.ts'] != null ? 'main.ts' : names[0];
    names.forEach(function (n) {
      var out = ts.transpileModule(files[n], {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, experimentalDecorators: !!angular, esModuleInterop: false },
        fileName: n,
      }).outputText;
      if (n === entry) entryJs = '__mods[' + JSON.stringify(n.replace(/\.ts$/, '')) + '] = module;\n' + out;
      else defs += '__defs[' + JSON.stringify(n.replace(/\.ts$/, '')) + '] = function (exports, require, module) {\n' + out + '\n};\n';
    });
    return defs + entryJs;
  }

  /* Winziger Ersatz für @angular/core, damit Services (Signals, computed, effect) hier ausführbar sind. */
  function ngRuntime(exports) {
    var effects = [], scheduled = false;
    function flush() { scheduled = false; effects.slice().forEach(function (f) { f(); }); }
    function notify() { if (!scheduled) { scheduled = true; Promise.resolve().then(flush); } }
    function signal(v) {
      var s = function () { return v; };
      s.set = function (n) { v = n; notify(); };
      s.update = function (f) { v = f(v); notify(); };
      s.asReadonly = function () { return function () { return v; }; };
      return s;
    }
    exports.signal = signal;
    exports.computed = function (f) { return function () { return f(); }; };
    exports.effect = function (f) { effects.push(f); notify(); return { destroy: function () { effects.splice(effects.indexOf(f), 1); } }; };
    var deco = function () { return function (c) { return c; }; };
    exports.Service = deco; exports.Injectable = deco; exports.Component = deco; exports.Pipe = deco; exports.Directive = deco;
    exports.input = Object.assign(function (v) { return function () { return v; }; }, { required: function () { return function () { return undefined; }; } });
    exports.output = function () { return { emit: function () {} }; };
    var inst = new Map();
    exports.inject = function (C) { if (!inst.has(C)) inst.set(C, new C()); return inst.get(C); };
  }

  /* Baut den Quelltext, der in einem Web Worker (oder Node-Worker) läuft. */
  function buildRunSource(js, checks) {
    var tests = '';
    checks.forEach(function (c, i) {
      if (c.type === 'setup') tests += '\n' + c.arg + '\n';
      else if (c.type === 'run') {
        tests += '\ntry { __res(' + i + ', !!(await (async () => (' + c.arg + '\n))())); } catch (__e) { __res(' + i + ', false, String(__e && __e.message || __e)); }';
      }
    });
    return '"use strict";\n(async function () {\n' +
      'const __post = (m) => postMessage(m);\n' +
      'const __fmt = ' + formatValue.toString() + ';\n' +
      'const __lines = [];\n' +
      'const __zeilen = () => __lines.join("\\n").split("\\n").map((s) => s.trim());\n' +
      'const __line = (k, a) => { const s = a.map((x) => typeof x === "string" ? x : __fmt(x, 0)).join(" "); if (k === "log") __lines.push(s); __post({ t: "log", k: k, s: s }); };\n' +
      'const console = { log: (...a) => __line("log", a), info: (...a) => __line("log", a), debug: (...a) => __line("log", a), warn: (...a) => __line("warn", a), error: (...a) => __line("error", a), table: (...a) => __line("log", a) };\n' +
      'const __st = globalThis.setTimeout, __ct = globalThis.clearTimeout, __si = globalThis.setInterval, __ci = globalThis.clearInterval;\n' +
      'const __timers = new Set(), __ivals = new Set();\n' +
      'const __fail = (e) => __post({ t: "crash", s: String(e && e.message || e), n: e && e.name || "Error" });\n' +
      'const setTimeout = (fn, ms, ...args) => { const id = __st(() => { __timers.delete(id); try { fn(...args); } catch (e) { __fail(e); } }, Math.min(Number(ms) || 0, 1500)); __timers.add(id); return id; };\n' +
      'const clearTimeout = (id) => { __timers.delete(id); __ct(id); };\n' +
      'const setInterval = (fn, ms, ...args) => { const id = __si(() => { try { fn(...args); } catch (e) { __fail(e); } }, Math.max(Number(ms) || 0, 10)); __ivals.add(id); return id; };\n' +
      'const clearInterval = (id) => { __ivals.delete(id); __ci(id); };\n' +
      'const __settle = async () => { const t0 = Date.now(); for (;;) { await new Promise((r) => __st(r, 15)); if ((__timers.size === 0 && __ivals.size === 0) || Date.now() - t0 > 2500) break; } __ivals.forEach((id) => __ci(id)); __ivals.clear(); };\n' +
      'const __res = (i, ok, err) => __post({ t: "res", i: i, ok: ok, err: err });\n' +
      'const exports = {}; const module = { exports: exports }; const __defs = {}, __mods = {};\n' +
      'const __tick = () => new Promise((r) => __st(r, 5));\n' +
      'const localStorage = (() => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); }, clear: () => m.clear() }; })();\n' +
      '__defs["@angular/core"] = ' + ngRuntime.toString() + ';\n' +
      'const require = (name) => { name = String(name); const k = name.charAt(0) === "." ? name.replace(/^(\\.\\.?\\/)+/, "").replace(/\\.ts$/, "") : name; if (__mods[k]) return __mods[k].exports; if (!__defs[k]) return {}; if (!__mods[k]) { __mods[k] = { exports: {} }; __defs[k](__mods[k].exports, require, __mods[k]); } return __mods[k].exports; };\n' +      'globalThis.addEventListener && globalThis.addEventListener("unhandledrejection", (ev) => { __fail(ev.reason); });\n' +
      '/* ---- dein Programm ---- */\n' + js + '\n/* ---- Prüfungen ---- */\n' +
      'await __settle();\n__post({ t: "ran" });\n' + tests + '\n' +
      'await __settle();\n' +
      '})().then(() => postMessage({ t: "done" }), (e) => { postMessage({ t: "crash", s: String(e && e.message || e), n: e && e.name || "Error" }); postMessage({ t: "done" }); });\n';
  }

  /* Formatiert Werte ungefähr so, wie Node.js sie im Terminal ausgibt. */
  function formatValue(v, depth, seen) {
    seen = seen || [];
    var t = typeof v;
    if (t === 'string') return depth > 0 ? "'" + v.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n') + "'" : v;
    if (t === 'number' || t === 'boolean' || t === 'undefined' || v === null) return Object.is(v, -0) ? '-0' : String(v);
    if (t === 'bigint') return String(v) + 'n';
    if (t === 'symbol') return v.toString();
    if (t === 'function') {
      var src = Function.prototype.toString.call(v);
      if (/^class\b/.test(src)) return '[class ' + (v.name || '(anonymous)') + ']';
      return v.name ? '[Function: ' + v.name + ']' : '[Function (anonymous)]';
    }
    if (seen.indexOf(v) >= 0) return '[Circular]';
    if (v instanceof Error) return (v.name || 'Error') + ': ' + v.message;
    if (v instanceof Date) return isNaN(v.getTime()) ? 'Invalid Date' : v.toISOString();
    if (v instanceof RegExp) return String(v);
    if (typeof Promise !== 'undefined' && v instanceof Promise) return 'Promise { <pending> }';
    var isArr = Array.isArray(v);
    if (depth > 2) return isArr ? '[Array]' : '[Object]';
    seen = seen.concat([v]);
    var items = [], open, close, prefix = '';
    var self = formatValue;
    if (isArr) {
      for (var i = 0; i < v.length; i++) items.push(self(v[i], depth + 1, seen));
      open = '['; close = ']';
    } else if (v instanceof Map) {
      v.forEach(function (val, key) { items.push(self(key, depth + 1, seen) + ' => ' + self(val, depth + 1, seen)); });
      prefix = 'Map(' + v.size + ') '; open = '{'; close = '}';
    } else if (v instanceof Set) {
      v.forEach(function (val) { items.push(self(val, depth + 1, seen)); });
      prefix = 'Set(' + v.size + ') '; open = '{'; close = '}';
    } else {
      var ctor = v.constructor && v.constructor.name;
      if (ctor && ctor !== 'Object') prefix = ctor + ' ';
      Object.keys(v).forEach(function (k) {
        var key = /^[A-Za-z_$][\w$]*$/.test(k) ? k : "'" + k + "'";
        items.push(key + ': ' + self(v[k], depth + 1, seen));
      });
      open = '{'; close = '}';
    }
    if (!items.length) return prefix + open + close;
    var one = prefix + open + ' ' + items.join(', ') + ' ' + close;
    if (one.length <= 72 && one.indexOf('\n') < 0) return one;
    var pad = '  ';
    return prefix + open + '\n' + items.map(function (s) { return pad + s.replace(/\n/g, '\n' + pad); }).join(',\n') + '\n' + close;
  }

  /* Wertet Ausgabe-Prüfungen aus. lines: Array von Strings. */
  function outputCheck(c, lines) {
    var all = lines.join('\n');
    var flat = all.split('\n').map(function (s) { return s.trim(); });
    if (c.type === 'out') return flat.indexOf(c.arg.trim()) >= 0;
    if (c.type === 'outhas') return all.indexOf(c.arg.trim()) >= 0;
    if (c.type === 'noout') return all.indexOf(c.arg.trim()) < 0;
    return false;
  }

  /* Schritt 1: analysieren, statisch prüfen, Tipps sammeln, Lauf vorbereiten. */
  function prepare(env, ex, files, lintSet) {
    var flags = ex.flags || {};
    var an = analyze(env, files, { angular: !!flags.angular });
    var prep = { diagnostics: an.diagnostics, results: ex.checks.map(function () { return null; }), tips: [], runSource: null };
    if (an.diagnostics.length) return prep;
    var anX = withExpectations(env, an, ex, files);
    ex.checks.forEach(function (c, i) {
      if (STATIC_TYPES.indexOf(c.type) < 0) return;
      var r;
      try { r = staticCheck(anX, c, i); } catch (e) { r = { ok: false, detail: 'Diese Prüfung konnte nicht ausgeführt werden.' }; }
      prep.results[i] = { ok: !!r.ok, detail: r.ok ? '' : (r.detail || '') };
    });
    if (!flags.nolint) prep.tips = lint(an, lintSet);
    if (!flags.norun) prep.runSource = buildRunSource(transpile(env, files, !!flags.angular), ex.checks);
    return prep;
  }
  /* Schritt 2: Ergebnisse des Laufs einarbeiten. run: { lines:[{k,s}], res:{i:{ok,err}}, crash, timeout } */
  function conclude(ex, prep, run) {
    var results = prep.results.slice();
    var lines = run ? run.lines.filter(function (l) { return l.k === 'log'; }).map(function (l) { return l.s; }) : [];
    ex.checks.forEach(function (c, i) {
      if (RUN_TYPES.indexOf(c.type) < 0) return;
      if (prep.diagnostics.length) return;
      if (!run) { results[i] = { ok: false, detail: 'Das Programm konnte hier nicht ausgeführt werden.' }; return; }
      if (c.type === 'run') {
        var r = run.res[i];
        if (r) results[i] = { ok: !!r.ok, detail: r.ok ? '' : (r.err ? 'Beim Prüfen gab es einen Fehler: ' + r.err : '') };
        else results[i] = { ok: false, detail: run.timeout ? 'Das Programm wurde nicht fertig (Endlosschleife?).' : run.crash ? 'Dein Programm ist vorher abgestürzt.' : '' };
      } else results[i] = { ok: outputCheck(c, lines), detail: '' };
    });
    var visible = [], passed = prep.diagnostics.length === 0;
    ex.checks.forEach(function (c, i) {
      if (c.type === 'setup') return;
      var r = results[i];
      if (!r || !r.ok) passed = false;
      visible.push({ state: r ? (r.ok ? 'ok' : 'fail') : 'pending', label: c.label || autoLabel(c), hint: c.hint || '', detail: r ? r.detail : '' });
    });
    if (run && (run.crash || run.timeout)) passed = false;
    return { passed: passed, checks: visible };
  }

  var api = {
    prepare: prepare, conclude: conclude,
    createEnv: createEnv, analyze: analyze, staticCheck: staticCheck, lint: lint, transpile: transpile,
    buildRunSource: buildRunSource, formatValue: formatValue, outputCheck: outputCheck, autoLabel: autoLabel,
    STATIC_TYPES: STATIC_TYPES, RUN_TYPES: RUN_TYPES, explain: explain, normType: normType,
  };
  root.TSK = root.TSK || {};
  root.TSK.core = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
