# TypeScript & Angular Lernkurs

Interaktiver Kurs für Einsteiger (Deutsch): 59 Lektionen von den ersten Zeilen
TypeScript bis zur eigenen Angular-App. Läuft als einzelne Webseite; der Code
der Lernenden wird im Browser mit dem echten TypeScript-Compiler geprüft.

## Aufbau

| Ordner | Inhalt |
| --- | --- |
| `lessons/` | Lektionen als Textdateien (Erklärung, Quiz, Übungen mit Prüfregeln) |
| `src/` | Seite (`page.html`), Oberfläche (`app.js`), Prüf-Kern (`core.js`) |
| `ng/` | vereinfachte Angular-Typen für die Prüfung im Browser |
| `ng-basis/` | Ausgangsdateien eines frischen Angular-Projekts für `ng-verify` |
| `tools/` | Bauen und Testen |

## Befehle

```bash
npm install
```

```bash
npm test
```

Prüft jede Übung: Die Musterlösung muss bestehen, der Startcode darf nicht.
Prüft ausserdem jeden TypeScript-Codeblock in den Erklärtexten.

```bash
npm run build
```

Erzeugt `dist/`. `dist/index.html` ist eine lokale Vorschau, `dist/kurs.html`
mit den `.js`-Dateien daneben ist die veröffentlichte Seite.

```bash
npm run e2e
```

Löst alle Übungen über die Oberfläche in Chromium (braucht Playwright).

```bash
NG_PROJEKT=/pfad/zu/einem/angular-projekt npm run ng-verify
```

Baut jede Angular-Musterlösung mit `ng build` in einem echten Angular-Projekt
(mit `ng new` erzeugt). Achtung: Der Ordner `src` dieses Projekts wird überschrieben.

## Format einer Lektion

```text
=== lektions-id | Titel | Minuten
Erklärtext (einfaches Markdown)

--- quiz quiz-id
Frage
( ) falsche Antwort :: Rückmeldung
(x) richtige Antwort :: Rückmeldung

--- code uebungs-id | Titel
Aufgabentext
@starter [datei.ts]
@solution [datei.ts]
@tests
fn add(number, number): number
run add(2, 3) === 5 :: Beschriftung ?? Hinweis bei Fehlschlag
@hints
- Tipp 1
@after
Text nach dem Lösen
```
