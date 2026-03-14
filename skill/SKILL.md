---
name: code-review
description: Run Multi-LLM code review (Gemini + Claude + GPT in parallel) on a file or git diff. Use when reviewing code quality, before merging, or when user types /code-review or @review.
---

# Multi-LLM Code Review

## Trigger
- User types `/code-review` or `@review`
- After completing a major feature (auto-suggest)
- Before creating a PR

## Workflow

### Step 1: Determine what to review

Ask the user or infer from context:
- **Single file:** `llm-review <path>`
- **Git diff:** Save diff to temp file, then review

If the user selected code in their IDE, use that selection.

### Step 2: Run the review

```bash
cd d:/DüsterhöftDigitalDesign/DüsterhöftDigitalDesign/Terminal/multi-llm-review
node src/cli.js <filepath> --json
```

### Step 3: Process results

Parse the JSON output. For each finding:
1. **Critical:** Fix immediately, explain the fix
2. **Important:** Present to user, ask if they want auto-fix
3. **Minor:** List as suggestions, don't auto-fix

### Step 4: Present results

Format findings as a table:

| Severity | Line | Issue | Agreed By |
|----------|------|-------|-----------|
| ... | ... | ... | ... |

### Fallback

If the multi-llm-review tool is not installed or API keys are missing:
- Fall back to Claude-internal review using the existing `superpowers:code-reviewer` subagent
- Inform user that external LLM perspectives are unavailable
