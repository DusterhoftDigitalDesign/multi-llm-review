# Multi-LLM Code Review Pipeline — Project Rules

CLI-Tool das Code-Reviews parallel an Claude, GPT und Gemini schickt, per Consensus-Filter zusammenfasst und als Claude Code Skill integriert wird.

**Stack:** Node.js (ESM), Anthropic SDK, OpenAI SDK, Google GenAI SDK, Vitest

---

## Bug-Memory

**VOR jeder Implementierung** den `bug-fixes` Skill konsultieren.
**NACH jedem geloesten Bug:** Den `bug-memory` Agent spawnen.

## Code Review Output

Reviews muessen eine strukturierte Zusammenfassung liefern mit Gewichtung:
- **Kritisch** — Bugs, Security-Luecken, Stabilitaetsprobleme
- **Wichtig** — Performance, fehlende Error-Handling, Convention-Verstoesse
- **Nice-to-have** — Refactoring-Vorschlaege, Code-Style-Optimierungen

## Testing

- Unit-Tests mit Vitest (`npm test`)
- Integration-Tests mit echten API-Calls (`npm run test:integration`)
- Consensus-Filter muss nachweisbar bessere Ergebnisse liefern als einzelner LLM-Call
