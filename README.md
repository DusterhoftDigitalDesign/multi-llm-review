# Multi-LLM Code Review

Ein CLI-Tool, das Code-Reviews **parallel an 3 LLMs** sendet (Gemini, Claude, GPT), die Ergebnisse per Consensus-Filter zusammenfuehrt und False Positives eliminiert.

## Warum 3 LLMs?

Jedes Modell hat eine **spezialisierte Rolle** mit eigenem Fokus:

| Reviewer | Modell | Fokus |
|----------|--------|-------|
| **Gemini** | gemini-3.1-pro-preview | Strukturanalyse: Cross-File-Konsistenz, Import-Korrektheit, Code-Duplikation |
| **Claude** | claude-sonnet-4-6 | Security & Architektur: Sicherheitsluecken, SOLID-Prinzipien, Logik-Bugs |
| **GPT** | gpt-5.4 | QA Engineering: Edge Cases, Runtime-Fehler, API-Missbrauch, Performance |

Durch die Kombination verschiedener Perspektiven werden Probleme gefunden, die ein einzelnes Modell uebersehen wuerde.

## Features

- **Parallele Reviews** — Alle 3 LLMs laufen gleichzeitig (`Promise.allSettled`)
- **Consensus-Filter** — Jaccard-Similarity-basierte Deduplizierung, Minor-Findings brauchen Zustimmung von mindestens 2/3 Reviewern
- **Confidence-Scoring** — High (3 Reviewer einig), Medium (2), Low (1 Reviewer)
- **Severity-Kalibrierung** — Solo-Critical mit niedriger Confidence wird zu Important herabgestuft
- **Verification-Phase** — Optionale Gegenprobe durch Claude, um False Positives zu eliminieren
- **Cross-File-Context** — Automatische Import-Aufloesung (JS/TS/Python) fuer praezisere Reviews
- **Fehlertoleranz** — Wenn ein LLM ausfaellt, laufen die anderen weiter
- **JSON-Output** — Maschinenlesbarer Output fuer Tool-Integration

## Unterstuetzte Sprachen

- **Import-Aufloesung:** JavaScript, TypeScript, Python
- **Code-Review:** Grundsaetzlich alle Sprachen (die Prompts sind sprachneutral)

---

## Installation

### Voraussetzungen

- [Node.js](https://nodejs.org/) >= 18
- API-Keys fuer mindestens 2 der 3 LLMs (alle 3 empfohlen):
  - [Anthropic API Key](https://console.anthropic.com/) (Claude)
  - [Google AI API Key](https://aistudio.google.com/apikey) (Gemini)
  - [OpenAI API Key](https://platform.openai.com/api-keys) (GPT)

### Setup

```bash
# 1. Repository klonen
git clone git@github.com:DEIN-USER/multi-llm-review.git
cd multi-llm-review

# 2. Dependencies installieren
npm install

# 3. API-Keys konfigurieren
cp .env.example .env
# Dann .env bearbeiten und die 3 API-Keys eintragen
```

### .env Konfiguration

```env
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_GENERATIVE_AI_API_KEY=AIza...
OPENAI_API_KEY=sk-...

# Optional: Modelle ueberschreiben
GEMINI_MODEL=gemini-3.1-pro-preview
CLAUDE_MODEL=claude-sonnet-4-6
GPT_MODEL=gpt-5.4
```

### Global installieren (optional)

```bash
npm link
# Danach von ueberall nutzbar:
llm-review /pfad/zu/datei.js
```

---

## Bedienung

### Grundaufruf

```bash
# Datei reviewen
node src/cli.js pfad/zur/datei.js

# Oder wenn global installiert:
llm-review pfad/zur/datei.js
```

### Optionen

| Flag | Beschreibung |
|------|-------------|
| `--json` | JSON-Output statt Klartext (fuer Tool-Integration) |
| `--no-context` | Import-Aufloesung ueberspringen (schneller, weniger praezise) |
| `--no-verify` | Verification-Phase ueberspringen (schneller, mehr False Positives) |
| `--help, -h` | Hilfe anzeigen |

### Beispiele

```bash
# Standard-Review mit allem drum und dran
llm-review src/server.js

# Schneller Review ohne Context und Verification
llm-review src/utils.py --no-context --no-verify

# JSON-Output fuer Weiterverarbeitung
llm-review src/api.ts --json

# JSON in Datei speichern
llm-review src/api.ts --json > review-result.json
```

### Output-Format

**Klartext (Standard):**
```
[CRITICAL] ●●● SQL Injection in User Query
  Line 42 | security | agreed: gemini, claude
  User input wird ungefiltert in SQL-Query eingesetzt...
  Fix: Prepared Statements verwenden...

[IMPORTANT] ●●○ Missing Error Handling in API Call
  Line 87 | logic | agreed: claude, gpt
  ...

--- Summary: 3 findings (1 critical, 1 important, 1 minor) ---
```

**JSON (--json):**
```json
{
  "findings": [
    {
      "severity": "critical",
      "category": "security",
      "line": 42,
      "title": "SQL Injection in User Query",
      "description": "...",
      "suggestion": "...",
      "agreedBy": ["gemini", "claude"],
      "confidence": "high"
    }
  ],
  "meta": {
    "total": 3,
    "critical": 1,
    "important": 1,
    "minor": 1,
    "reviewers": [...]
  }
}
```

---

## Architektur

```
src/
  cli.js         — CLI Entry Point, orchestriert den gesamten Flow
  config.js      — Laedt API-Keys aus .env
  prompts.js     — Rollenspezifische Prompts fuer jedes LLM
  reviewers.js   — 3 LLM-Reviewer + parallele Ausfuehrung
  consensus.js   — Jaccard-Deduplizierung + Confidence-Scoring + Filterung
  context.js     — Import-Aufloesung (JS/TS/Python) fuer Cross-File-Context
  formatter.js   — Klartext- und JSON-Ausgabe
  verifier.js    — Optionale Gegenprobe durch Claude
```

### Pipeline

```
Datei einlesen
    |
    v
Import-Aufloesung (optional)
    |
    v
3 LLMs parallel reviewen
    |
    v
Consensus-Filter (Dedup + Confidence)
    |
    v
Verification-Phase (optional)
    |
    v
Formatierte Ausgabe
```

---

## Tests

```bash
# Unit-Tests
npm test

# Integration-Tests (echte API-Calls, braucht gueltige Keys)
npm run test:integration
```

---

## Severity-Definitionen

| Severity | Bedeutung | Filterregel |
|----------|-----------|-------------|
| **Critical** | Bugs, Security-Luecken, Datenverlust | Kommt immer durch |
| **Important** | Fehlende Fehlerbehandlung, Performance, Design-Probleme | Kommt immer durch |
| **Minor** | Refactoring, Style, Best Practices | Braucht Zustimmung von 2+ Reviewern |

---

## Kosten

Pro Review werden 3 API-Calls gemacht (+ optional 1 fuer Verification). Die Kosten haengen von der Dateigroesse und den aktuellen API-Preisen ab. Typisch fuer eine 100-Zeilen-Datei: **< $0.10 pro Review**.

---

## Lizenz

Private Nutzung. Nicht weiterverbreiten ohne Genehmigung.
