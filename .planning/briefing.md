# Briefing: Multi-LLM Code Review Pipeline

Typ: internal-tool | Datum: 2026-03-14

## Strategischer Kontext

**Anlass** -> Eigene Projekte nach Abschluss systematisch verifizieren und verbessern. Toolkit wird in ein fertiges Projekt geladen und prueft es durch.

**Kostenbudget** -> Kein Limit — Qualitaet hat Prioritaet.

**Ziel-Codebasen** -> Eigene Projekte (Webflow, n8n, Node.js, Python etc.)

**Qualitaetsmassstab** -> Funktionalitaet und Stabilitaet. Muss getestet werden — der Consensus-Filter muss nachweisbar bessere Ergebnisse liefern als ein einzelner LLM-Call.

**Deadline** -> Keine.

**Integration** -> Erstmal nur als Claude Code Skill. CI/CD, GitHub Actions oder n8n-Integration spaeter moeglich, aber nicht im Scope v1.

## Nutzer & UX

**Nutzer** -> Nur der Entwickler selbst (Patrick Duesterhoft).

**Review-Szenarien** -> Alles: Security-Audits, Performance-Checks, Style/Conventions.

**Aktueller Workflow** -> Kein systematischer Review-Prozess nach Projektabschluss. Das Tool schliesst diese Luecke.

**Erfahrung mit v1.0** -> Keine bisherige Nutzung, Prototyp ist fertig aber ungetestet im Praxiseinsatz.

**Erfolgskriterium** -> Review-Qualitaet und Konsistenz ueber verschiedene Projekte hinweg.

**Output-Format** -> Strukturierte Zusammenfassung aller Aspekte mit Gewichtung: kritisch / wichtig / nice-to-have.

## Offene Punkte

- Consensus-Filter-Qualitaet muss durch Tests validiert werden (kein Praxisfeedback vorhanden)
- Spaetere Integrationspunkte (CI/CD, n8n) fuer zukuenftige Milestones vormerken
