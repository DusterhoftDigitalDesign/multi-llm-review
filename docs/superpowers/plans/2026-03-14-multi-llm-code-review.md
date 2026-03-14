# Multi-LLM Code Review Tool — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a CLI tool (`llm-review`) that sends code to Gemini 3.1 Pro, Claude Sonnet 4.6, and GPT-5.4 in parallel for specialized review, then merges results via consensus filter into structured JSON output.

**Architecture:** Node.js ES Module CLI tool with three parallel API reviewers (each with role-specific prompts based on empirically proven strengths), a consensus filter that deduplicates and scores findings, and a Claude Code skill (`/code-review`) that wraps the CLI for seamless integration. The tool lives in its own project directory and is invoked via `npx` or `npm run review`.

**Tech Stack:** Node.js (ES Modules), `@google/generative-ai` (Gemini), `@anthropic-ai/sdk` (Claude), `openai` (GPT), `dotenv`, `vitest` for testing.

---

## Chunk 1: Project Scaffolding + Config

### Task 1: Initialize project

**Files:**
- Create: `multi-llm-review/package.json`
- Create: `multi-llm-review/.env.example`
- Create: `multi-llm-review/.gitignore`

- [ ] **Step 1: Initialize package.json with ES Modules**

```json
{
  "name": "multi-llm-review",
  "version": "1.0.0",
  "description": "Multi-LLM Code Review Pipeline for Düsterhöft Digital Design",
  "type": "module",
  "bin": {
    "llm-review": "./src/cli.js"
  },
  "scripts": {
    "review": "node src/cli.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.39.0",
    "@google/generative-ai": "^0.28.0",
    "openai": "^5.0.0",
    "dotenv": "^16.4.0"
  },
  "devDependencies": {
    "cross-env": "^7.0.3",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create .env.example**

```
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_GENERATIVE_AI_API_KEY=AIza...
OPENAI_API_KEY=sk-...

# Optional: override models
GEMINI_MODEL=gemini-3.1-pro
CLAUDE_MODEL=claude-sonnet-4-6-20260301
GPT_MODEL=gpt-5.4
```

- [ ] **Step 3: Create .gitignore**

```
node_modules/
.env
*.log
```

- [ ] **Step 4: Create vitest.config.js**

```js
// vitest.config.js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: ['tests/integration.test.js', 'node_modules'],
  },
});
```

- [ ] **Step 5: Run npm install**

Run: `cd multi-llm-review && npm install`
Expected: All dependencies installed, no errors.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .env.example .gitignore vitest.config.js
git commit -m "feat: scaffold multi-llm-review project"
```

---

### Task 2: Config loader with validation

**Files:**
- Create: `multi-llm-review/src/config.js`
- Create: `multi-llm-review/tests/config.test.js`

- [ ] **Step 1: Write failing test for config loader**

```js
// tests/config.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('throws if ANTHROPIC_API_KEY is missing', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY', 'test');
    vi.stubEnv('OPENAI_API_KEY', 'test');
    expect(() => loadConfig()).toThrow('ANTHROPIC_API_KEY');
  });

  it('throws if GOOGLE_GENERATIVE_AI_API_KEY is missing', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test');
    vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY', '');
    vi.stubEnv('OPENAI_API_KEY', 'test');
    expect(() => loadConfig()).toThrow('GOOGLE_GENERATIVE_AI_API_KEY');
  });

  it('throws if OPENAI_API_KEY is missing', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test');
    vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY', 'test');
    vi.stubEnv('OPENAI_API_KEY', '');
    expect(() => loadConfig()).toThrow('OPENAI_API_KEY');
  });

  it('returns config with defaults when all keys present', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
    vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY', 'AIza-test');
    vi.stubEnv('OPENAI_API_KEY', 'sk-test');
    const config = loadConfig();
    expect(config.anthropicKey).toBe('sk-ant-test');
    expect(config.geminiModel).toBe('gemini-3.1-pro');
    expect(config.claudeModel).toBe('claude-sonnet-4-6-20260301');
    expect(config.gptModel).toBe('gpt-5.4');
  });

  it('allows model overrides via env', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test');
    vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY', 'test');
    vi.stubEnv('OPENAI_API_KEY', 'test');
    vi.stubEnv('GEMINI_MODEL', 'gemini-3.1-flash');
    const config = loadConfig();
    expect(config.geminiModel).toBe('gemini-3.1-flash');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd multi-llm-review && npx vitest run tests/config.test.js`
Expected: FAIL — module `../src/config.js` not found.

- [ ] **Step 3: Implement config loader**

```js
// src/config.js
import 'dotenv/config';

const REQUIRED_KEYS = [
  'ANTHROPIC_API_KEY',
  'GOOGLE_GENERATIVE_AI_API_KEY',
  'OPENAI_API_KEY',
];

export function loadConfig() {
  for (const key of REQUIRED_KEYS) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }

  return {
    anthropicKey: process.env.ANTHROPIC_API_KEY,
    geminiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    openaiKey: process.env.OPENAI_API_KEY,
    geminiModel: process.env.GEMINI_MODEL || 'gemini-3.1-pro',
    claudeModel: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6-20260301',
    gptModel: process.env.GPT_MODEL || 'gpt-5.4',
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd multi-llm-review && npx vitest run tests/config.test.js`
Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/config.js tests/config.test.js
git commit -m "feat: add config loader with env validation and model overrides"
```

---

## Chunk 2: Review Prompts (Role-Specific)

### Task 3: Prompt templates per reviewer role

**Files:**
- Create: `multi-llm-review/src/prompts.js`
- Create: `multi-llm-review/tests/prompts.test.js`

- [ ] **Step 1: Write failing test for prompt generation**

```js
// tests/prompts.test.js
import { describe, it, expect } from 'vitest';
import { buildPrompt } from '../src/prompts.js';

describe('buildPrompt', () => {
  const code = 'function add(a, b) { return a + b; }';
  const filename = 'math.js';

  it('generates gemini prompt with codebase-context focus', () => {
    const prompt = buildPrompt('gemini', code, filename);
    expect(prompt).toContain('cross-file');
    expect(prompt).toContain('consistency');
    expect(prompt).toContain(code);
    expect(prompt).toContain('math.js');
  });

  it('generates claude prompt with security + architecture focus', () => {
    const prompt = buildPrompt('claude', code, filename);
    expect(prompt).toContain('security');
    expect(prompt).toContain('architecture');
    expect(prompt).toContain(code);
  });

  it('generates gpt prompt with edge-cases + runtime focus', () => {
    const prompt = buildPrompt('gpt', code, filename);
    expect(prompt).toContain('edge case');
    expect(prompt).toContain('runtime');
    expect(prompt).toContain(code);
  });

  it('throws on unknown role', () => {
    expect(() => buildPrompt('deepseek', code, filename)).toThrow('Unknown role');
  });

  it('includes JSON output instruction in all prompts', () => {
    for (const role of ['gemini', 'claude', 'gpt']) {
      const prompt = buildPrompt(role, code, filename);
      expect(prompt).toContain('"findings"');
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd multi-llm-review && npx vitest run tests/prompts.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement prompt templates**

```js
// src/prompts.js

const JSON_FORMAT = `
Respond ONLY with valid JSON in this exact format:
{
  "findings": [
    {
      "severity": "critical" | "important" | "minor",
      "category": "security" | "logic" | "performance" | "architecture" | "edge-case" | "consistency" | "style",
      "line": <number or null>,
      "title": "<short title>",
      "description": "<what is wrong and why it matters>",
      "suggestion": "<how to fix>"
    }
  ],
  "summary": "<1-2 sentence overall assessment>"
}
If no issues found, return {"findings": [], "summary": "..."}
`;

const ROLES = {
  gemini: (code, filename) => `You are a Senior Codebase Analyst reviewing "${filename}".

Your specialty is cross-file consistency, dependency analysis, and architectural coherence.

Focus your review on:
1. Cross-file consistency — does this code follow patterns used elsewhere?
2. Import/dependency correctness — are modules used properly?
3. Naming conventions — consistent with codebase standards?
4. Code duplication — could this reuse existing utilities?
5. Structural coherence — does the file organization make sense?

Do NOT focus on security or edge cases (other reviewers handle those).
${JSON_FORMAT}

Code to review:
\`\`\`
${code}
\`\`\``,

  claude: (code, filename) => `You are a Senior Security Architect reviewing "${filename}".

Your specialty is security vulnerability detection and architectural reasoning.

Focus your review on:
1. Security vulnerabilities — injections, auth bypass, data exposure, OWASP Top 10
2. Architecture & design — SOLID principles, separation of concerns, scalability
3. Error handling — are failure modes handled? Can errors leak sensitive data?
4. Deep logic bugs — subtle correctness issues, race conditions, state management
5. Input validation — are system boundaries properly guarded?

Do NOT focus on style or naming (other reviewers handle those).
${JSON_FORMAT}

Code to review:
\`\`\`
${code}
\`\`\``,

  gpt: (code, filename) => `You are a Senior QA Engineer reviewing "${filename}".

Your specialty is finding edge cases, runtime failures, and API misuse.

Focus your review on:
1. Edge cases — null/undefined, empty arrays, boundary values, type coercion
2. Runtime issues — unhandled promises, missing await, memory leaks, infinite loops
3. API misuse — deprecated methods, incorrect parameter types, missing error callbacks
4. Performance — unnecessary allocations, O(n²) where O(n) possible, excessive I/O
5. Testability — is this code easy to test? Are there hidden dependencies?

Do NOT focus on architecture or naming (other reviewers handle those).
${JSON_FORMAT}

Code to review:
\`\`\`
${code}
\`\`\``,
};

export function buildPrompt(role, code, filename) {
  const builder = ROLES[role];
  if (!builder) {
    throw new Error(`Unknown role: ${role}. Valid roles: ${Object.keys(ROLES).join(', ')}`);
  }
  return builder(code, filename);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd multi-llm-review && npx vitest run tests/prompts.test.js`
Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/prompts.js tests/prompts.test.js
git commit -m "feat: add role-specific review prompts (gemini=context, claude=security, gpt=edge-cases)"
```

---

## Chunk 3: API Clients

### Task 4: Reviewer clients (Gemini, Claude, GPT)

**Files:**
- Create: `multi-llm-review/src/reviewers.js`
- Create: `multi-llm-review/tests/reviewers.test.js`

- [ ] **Step 1: Write failing test with mocked APIs**

```js
// tests/reviewers.test.js
import { describe, it, expect, vi } from 'vitest';
import { reviewAll } from '../src/reviewers.js';

// We test the response parsing, not the actual API calls.
// Actual API calls are integration tests (Task 8).

describe('reviewAll', () => {
  it('calls all three reviewers in parallel and returns results', async () => {
    const mockGemini = vi.fn().mockResolvedValue({
      findings: [{ severity: 'minor', category: 'consistency', line: 1, title: 'Naming', description: 'test', suggestion: 'test' }],
      summary: 'OK'
    });
    const mockClaude = vi.fn().mockResolvedValue({
      findings: [],
      summary: 'Clean'
    });
    const mockGpt = vi.fn().mockResolvedValue({
      findings: [{ severity: 'critical', category: 'edge-case', line: 5, title: 'Null check', description: 'test', suggestion: 'test' }],
      summary: 'Issues found'
    });

    const results = await reviewAll(mockGemini, mockClaude, mockGpt);

    expect(results).toHaveLength(3);
    expect(results[0].reviewer).toBe('gemini');
    expect(results[1].reviewer).toBe('claude');
    expect(results[2].reviewer).toBe('gpt');
    expect(mockGemini).toHaveBeenCalledOnce();
    expect(mockClaude).toHaveBeenCalledOnce();
    expect(mockGpt).toHaveBeenCalledOnce();
  });

  it('handles single reviewer failure gracefully', async () => {
    const mockGemini = vi.fn().mockRejectedValue(new Error('API timeout'));
    const mockClaude = vi.fn().mockResolvedValue({ findings: [], summary: 'OK' });
    const mockGpt = vi.fn().mockResolvedValue({ findings: [], summary: 'OK' });

    const results = await reviewAll(mockGemini, mockClaude, mockGpt);

    expect(results[0].reviewer).toBe('gemini');
    expect(results[0].error).toBe('API timeout');
    expect(results[0].findings).toEqual([]);
    expect(results[1].findings).toEqual([]);
    expect(results[2].findings).toEqual([]);
  });
});
```

- [ ] **Step 2: Write test for parseJson resilience**

```js
// tests/parse-json.test.js
import { describe, it, expect } from 'vitest';
import { parseJson } from '../src/reviewers.js';

describe('parseJson', () => {
  it('parses plain JSON', () => {
    const result = parseJson('{"findings": [], "summary": "OK"}');
    expect(result.findings).toEqual([]);
  });

  it('parses JSON wrapped in markdown code fences', () => {
    const result = parseJson('```json\n{"findings": [], "summary": "OK"}\n```');
    expect(result.findings).toEqual([]);
  });

  it('extracts JSON from preamble text', () => {
    const result = parseJson('Here is my review:\n{"findings": [], "summary": "Clean"}');
    expect(result.summary).toBe('Clean');
  });

  it('extracts JSON with trailing text', () => {
    const result = parseJson('{"findings": [], "summary": "OK"}\n\nLet me know if you need more details.');
    expect(result.findings).toEqual([]);
  });

  it('throws with meaningful error on no JSON', () => {
    expect(() => parseJson('No JSON here')).toThrow('No JSON object found');
  });

  it('throws with meaningful error on invalid JSON', () => {
    expect(() => parseJson('{invalid json}')).toThrow('Invalid JSON');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd multi-llm-review && npx vitest run tests/reviewers.test.js tests/parse-json.test.js`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement reviewer clients**

```js
// src/reviewers.js
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { buildPrompt } from './prompts.js';

export function parseJson(text) {
  // Strip markdown code fences if present
  let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  // Extract first JSON object if surrounded by preamble/postamble text
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error(`No JSON object found in response: ${cleaned.slice(0, 200)}`);
  }
  try {
    return JSON.parse(match[0]);
  } catch (err) {
    throw new Error(`Invalid JSON in LLM response: ${err.message}\nRaw: ${match[0].slice(0, 300)}`);
  }
}

export function createGeminiReviewer(config) {
  const genAI = new GoogleGenerativeAI(config.geminiKey);
  const model = genAI.getGenerativeModel({ model: config.geminiModel });

  return async function reviewWithGemini(code, filename) {
    const prompt = buildPrompt('gemini', code, filename);
    const result = await model.generateContent(prompt);
    return parseJson(result.response.text());
  };
}

export function createClaudeReviewer(config) {
  const client = new Anthropic({ apiKey: config.anthropicKey });

  return async function reviewWithClaude(code, filename) {
    const prompt = buildPrompt('claude', code, filename);
    const message = await client.messages.create({
      model: config.claudeModel,
      max_tokens: 4096,
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }],
    });
    return parseJson(message.content[0].text);
  };
}

export function createGptReviewer(config) {
  const client = new OpenAI({ apiKey: config.openaiKey });

  return async function reviewWithGpt(code, filename) {
    const prompt = buildPrompt('gpt', code, filename);
    const response = await client.chat.completions.create({
      model: config.gptModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
    });
    return parseJson(response.choices[0].message.content);
  };
}

export async function reviewAll(geminiReviewer, claudeReviewer, gptReviewer) {
  const reviewers = [
    { name: 'gemini', fn: geminiReviewer },
    { name: 'claude', fn: claudeReviewer },
    { name: 'gpt', fn: gptReviewer },
  ];

  const results = await Promise.allSettled(
    reviewers.map(r => r.fn())
  );

  return results.map((result, i) => {
    if (result.status === 'fulfilled') {
      return {
        reviewer: reviewers[i].name,
        findings: result.value.findings || [],
        summary: result.value.summary || '',
        error: null,
      };
    }
    return {
      reviewer: reviewers[i].name,
      findings: [],
      summary: '',
      error: result.reason?.message || 'Unknown error',
    };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd multi-llm-review && npx vitest run tests/reviewers.test.js`
Expected: All 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/reviewers.js tests/reviewers.test.js
git commit -m "feat: add API reviewer clients (Gemini, Claude, GPT) with parallel execution"
```

---

## Chunk 4: Consensus Filter

### Task 5: Deduplication + confidence scoring

**Files:**
- Create: `multi-llm-review/src/consensus.js`
- Create: `multi-llm-review/tests/consensus.test.js`

- [ ] **Step 1: Write failing tests for consensus filter**

```js
// tests/consensus.test.js
import { describe, it, expect } from 'vitest';
import { filterFindings } from '../src/consensus.js';

describe('filterFindings', () => {
  it('deduplicates findings on same line with similar title', () => {
    const results = [
      {
        reviewer: 'gemini',
        findings: [{ severity: 'minor', category: 'consistency', line: 10, title: 'Unused import', description: 'fs is imported but unused', suggestion: 'Remove it' }],
      },
      {
        reviewer: 'claude',
        findings: [{ severity: 'minor', category: 'style', line: 10, title: 'Unused import detected', description: 'fs module not used', suggestion: 'Remove unused import' }],
      },
      {
        reviewer: 'gpt',
        findings: [],
      },
    ];

    const filtered = filterFindings(results);
    // Should merge into one finding with agreementCount = 2
    const line10 = filtered.filter(f => f.line === 10);
    expect(line10).toHaveLength(1);
    expect(line10[0].agreedBy).toContain('gemini');
    expect(line10[0].agreedBy).toContain('claude');
  });

  it('promotes severity when multiple reviewers agree', () => {
    const results = [
      {
        reviewer: 'gemini',
        findings: [{ severity: 'minor', category: 'logic', line: 5, title: 'Off by one', description: 'test', suggestion: 'test' }],
      },
      {
        reviewer: 'claude',
        findings: [{ severity: 'important', category: 'logic', line: 5, title: 'Off by one error', description: 'test', suggestion: 'test' }],
      },
      {
        reviewer: 'gpt',
        findings: [{ severity: 'critical', category: 'edge-case', line: 5, title: 'Off-by-one', description: 'test', suggestion: 'test' }],
      },
    ];

    const filtered = filterFindings(results);
    const line5 = filtered.find(f => f.line === 5);
    // 3 reviewers agree -> highest severity wins
    expect(line5.severity).toBe('critical');
    expect(line5.agreedBy).toHaveLength(3);
  });

  it('filters out low-confidence solo findings below threshold', () => {
    const results = [
      {
        reviewer: 'gpt',
        findings: [{ severity: 'minor', category: 'style', line: 20, title: 'Could use const', description: 'test', suggestion: 'test' }],
      },
      { reviewer: 'gemini', findings: [] },
      { reviewer: 'claude', findings: [] },
    ];

    // With confidence threshold requiring 2+ reviewers for minor issues
    const filtered = filterFindings(results, { minAgreementForMinor: 2 });
    expect(filtered).toHaveLength(0);
  });

  it('keeps solo critical findings regardless of agreement', () => {
    const results = [
      {
        reviewer: 'claude',
        findings: [{ severity: 'critical', category: 'security', line: 42, title: 'SQL injection', description: 'test', suggestion: 'test' }],
      },
      { reviewer: 'gemini', findings: [] },
      { reviewer: 'gpt', findings: [] },
    ];

    const filtered = filterFindings(results, { minAgreementForMinor: 2 });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].title).toBe('SQL injection');
  });

  it('deduplicates null-line findings by title+category similarity', () => {
    const results = [
      {
        reviewer: 'claude',
        findings: [{ severity: 'important', category: 'architecture', line: null, title: 'Missing error boundary', description: 'No top-level error handling', suggestion: 'Add try-catch' }],
      },
      {
        reviewer: 'gemini',
        findings: [{ severity: 'important', category: 'architecture', line: null, title: 'Missing error boundary pattern', description: 'No error boundary', suggestion: 'Wrap in error handler' }],
      },
      { reviewer: 'gpt', findings: [] },
    ];

    const filtered = filterFindings(results);
    const archFindings = filtered.filter(f => f.category === 'architecture');
    expect(archFindings).toHaveLength(1);
    expect(archFindings[0].agreedBy).toContain('claude');
    expect(archFindings[0].agreedBy).toContain('gemini');
  });

  it('sorts output by severity (critical > important > minor)', () => {
    const results = [
      {
        reviewer: 'claude',
        findings: [
          { severity: 'minor', category: 'style', line: 1, title: 'A', description: 't', suggestion: 't' },
          { severity: 'critical', category: 'security', line: 2, title: 'B', description: 't', suggestion: 't' },
          { severity: 'important', category: 'logic', line: 3, title: 'C', description: 't', suggestion: 't' },
        ],
      },
      { reviewer: 'gemini', findings: [] },
      { reviewer: 'gpt', findings: [] },
    ];

    const filtered = filterFindings(results);
    expect(filtered[0].severity).toBe('critical');
    expect(filtered[1].severity).toBe('important');
    expect(filtered[2].severity).toBe('minor');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd multi-llm-review && npx vitest run tests/consensus.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement consensus filter**

```js
// src/consensus.js

const SEVERITY_RANK = { critical: 3, important: 2, minor: 1 };

function normalize(str) {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function jaccard(a, b) {
  const wordsA = new Set(a.toLowerCase().split(/\s+/));
  const wordsB = new Set(b.toLowerCase().split(/\s+/));
  const intersection = [...wordsA].filter(w => wordsB.has(w));
  const union = new Set([...wordsA, ...wordsB]);
  return union.size > 0 ? intersection.length / union.size : 0;
}

function isSimilar(a, b) {
  // Both null lines: match by title+category similarity only
  if (a.line === null && b.line === null) {
    return a.category === b.category && jaccard(a.title, b.title) > 0.5;
  }
  // One null, one not: not similar
  if (a.line === null || b.line === null) return false;
  // Different lines: not similar
  if (a.line !== b.line) return false;
  // Same line: check title similarity via Jaccard
  return jaccard(a.title, b.title) > 0.5;
}

export function filterFindings(results, options = {}) {
  const { minAgreementForMinor = 1 } = options;

  // Flatten all findings with reviewer attribution
  const all = results.flatMap(r =>
    r.findings.map(f => ({ ...f, reviewer: r.reviewer }))
  );

  // Group similar findings
  const groups = [];
  const used = new Set();

  for (let i = 0; i < all.length; i++) {
    if (used.has(i)) continue;
    const group = [all[i]];
    used.add(i);
    for (let j = i + 1; j < all.length; j++) {
      if (used.has(j)) continue;
      if (isSimilar(all[i], all[j])) {
        group.push(all[j]);
        used.add(j);
      }
    }
    groups.push(group);
  }

  // Merge each group into a single finding
  const merged = groups.map(group => {
    const bestSeverity = group.reduce((best, f) =>
      (SEVERITY_RANK[f.severity] || 0) > (SEVERITY_RANK[best] || 0) ? f.severity : best,
      group[0].severity
    );
    const agreedBy = [...new Set(group.map(f => f.reviewer))];
    // Use the finding from the highest-severity reviewer as the primary
    const primary = group.reduce((best, f) =>
      (SEVERITY_RANK[f.severity] || 0) >= (SEVERITY_RANK[best.severity] || 0) ? f : best,
      group[0]
    );

    return {
      severity: bestSeverity,
      category: primary.category,
      line: primary.line,
      title: primary.title,
      description: primary.description,
      suggestion: primary.suggestion,
      agreedBy,
    };
  });

  // Filter by confidence threshold
  const filtered = merged.filter(f => {
    if (f.severity === 'critical') return true;
    if (f.severity === 'important') return true;
    return f.agreedBy.length >= minAgreementForMinor;
  });

  // Sort by severity descending
  filtered.sort((a, b) => (SEVERITY_RANK[b.severity] || 0) - (SEVERITY_RANK[a.severity] || 0));

  return filtered;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd multi-llm-review && npx vitest run tests/consensus.test.js`
Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/consensus.js tests/consensus.test.js
git commit -m "feat: add consensus filter with dedup, severity promotion, and confidence threshold"
```

---

## Chunk 5: CLI Entry Point

### Task 6: CLI tool with file input and formatted output

**Files:**
- Create: `multi-llm-review/src/cli.js`
- Create: `multi-llm-review/src/formatter.js`
- Create: `multi-llm-review/tests/formatter.test.js`

- [ ] **Step 1: Write failing test for output formatter**

```js
// tests/formatter.test.js
import { describe, it, expect } from 'vitest';
import { formatFindings, formatJson } from '../src/formatter.js';

describe('formatFindings', () => {
  const findings = [
    { severity: 'critical', category: 'security', line: 42, title: 'SQL injection', description: 'User input unsanitized', suggestion: 'Use parameterized queries', agreedBy: ['claude', 'gpt'] },
    { severity: 'minor', category: 'style', line: 10, title: 'Naming', description: 'Inconsistent', suggestion: 'Use camelCase', agreedBy: ['gemini'] },
  ];

  it('formats terminal output with severity colors and agreement', () => {
    const output = formatFindings(findings, 'terminal');
    expect(output).toContain('CRITICAL');
    expect(output).toContain('SQL injection');
    expect(output).toContain('claude, gpt');
    expect(output).toContain('Line 42');
  });

  it('formats JSON output for machine consumption', () => {
    const output = formatJson(findings, []);
    const parsed = JSON.parse(output);
    expect(parsed.findings).toHaveLength(2);
    expect(parsed.meta.totalFindings).toBe(2);
    expect(parsed.meta.criticalCount).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd multi-llm-review && npx vitest run tests/formatter.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement formatter**

```js
// src/formatter.js

const SEVERITY_ICONS = {
  critical: '\x1b[31m[CRITICAL]\x1b[0m',
  important: '\x1b[33m[IMPORTANT]\x1b[0m',
  minor: '\x1b[36m[MINOR]\x1b[0m',
};

export function formatFindings(findings, mode = 'terminal') {
  if (findings.length === 0) {
    return '\x1b[32mNo issues found. Code looks clean.\x1b[0m';
  }

  const lines = findings.map(f => {
    const icon = SEVERITY_ICONS[f.severity] || f.severity.toUpperCase();
    const line = f.line ? `Line ${f.line}` : 'General';
    const agreed = f.agreedBy.join(', ');
    return [
      `${icon} ${f.title}`,
      `  ${line} | Category: ${f.category} | Agreed by: ${agreed}`,
      `  ${f.description}`,
      `  Fix: ${f.suggestion}`,
      '',
    ].join('\n');
  });

  return lines.join('\n');
}

export function formatJson(findings, reviewerResults) {
  const output = {
    findings,
    meta: {
      totalFindings: findings.length,
      criticalCount: findings.filter(f => f.severity === 'critical').length,
      importantCount: findings.filter(f => f.severity === 'important').length,
      minorCount: findings.filter(f => f.severity === 'minor').length,
      reviewers: reviewerResults.map(r => ({
        name: r.reviewer,
        findingsCount: r.findings?.length || 0,
        error: r.error || null,
        summary: r.summary || '',
      })),
    },
  };
  return JSON.stringify(output, null, 2);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd multi-llm-review && npx vitest run tests/formatter.test.js`
Expected: All 2 tests PASS.

- [ ] **Step 5: Implement CLI entry point**

```js
#!/usr/bin/env node
// src/cli.js
import { readFileSync, existsSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { loadConfig } from './config.js';
import { createGeminiReviewer, createClaudeReviewer, createGptReviewer, reviewAll } from './reviewers.js';
import { filterFindings } from './consensus.js';
import { formatFindings, formatJson } from './formatter.js';

try {
  const args = process.argv.slice(2);
  const jsonFlag = args.includes('--json');
  const filePath = args.find(a => !a.startsWith('--'));

  if (!filePath) {
    console.error('Usage: llm-review <file> [--json]');
    console.error('  --json   Output machine-readable JSON');
    process.exit(1);
  }

  const resolved = resolve(filePath);
  if (!existsSync(resolved)) {
    console.error(`Error: File not found: ${resolved}`);
    process.exit(1);
  }

  const code = readFileSync(resolved, 'utf8');
  const filename = basename(resolved);

  console.log(`Reviewing ${filename} with 3 LLMs in parallel...\n`);

  const config = loadConfig();

  const gemini = createGeminiReviewer(config);
  const claude = createClaudeReviewer(config);
  const gpt = createGptReviewer(config);

  const geminiReview = () => gemini(code, filename);
  const claudeReview = () => claude(code, filename);
  const gptReview = () => gpt(code, filename);

  const results = await reviewAll(geminiReview, claudeReview, gptReview);

  // Log errors for failed reviewers
  for (const r of results) {
    if (r.error) {
      console.error(`Warning: ${r.reviewer} failed: ${r.error}`);
    }
  }

  const findings = filterFindings(results, { minAgreementForMinor: 1 });

  if (jsonFlag) {
    console.log(formatJson(findings, results));
  } else {
    console.log(formatFindings(findings));
    console.log(`\n--- Summary: ${findings.length} findings (${findings.filter(f => f.severity === 'critical').length} critical) ---`);
  }
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}
```

- [ ] **Step 6: Commit**

```bash
git add src/cli.js src/formatter.js tests/formatter.test.js
git commit -m "feat: add CLI entry point with terminal and JSON output"
```

---

## Chunk 6: Claude Code Skill Integration

### Task 7: Create /code-review skill for Claude Code

**Files:**
- Create: `multi-llm-review/skill/SKILL.md`

- [ ] **Step 1: Write the skill definition**

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add skill/SKILL.md
git commit -m "feat: add /code-review Claude Code skill wrapping multi-llm pipeline"
```

---

## Chunk 7: Integration Test + Documentation

### Task 8: Integration test with real APIs

**Files:**
- Create: `multi-llm-review/tests/integration.test.js`

- [ ] **Step 1: Write integration test (skipped by default)**

```js
// tests/integration.test.js
import { describe, it, expect } from 'vitest';
import { loadConfig } from '../src/config.js';
import { createGeminiReviewer, createClaudeReviewer, createGptReviewer, reviewAll } from '../src/reviewers.js';
import { filterFindings } from '../src/consensus.js';

// Only runs when INTEGRATION=true is set
const shouldRun = process.env.INTEGRATION === 'true';

describe.skipIf(!shouldRun)('Integration: real API calls', () => {
  it('reviews a sample file with all three LLMs', async () => {
    const config = loadConfig();
    const code = `
      function getUserData(userId) {
        const query = "SELECT * FROM users WHERE id = " + userId;
        const result = db.query(query);
        return result;
      }
    `;
    const filename = 'test-sample.js';

    const gemini = createGeminiReviewer(config);
    const claude = createClaudeReviewer(config);
    const gpt = createGptReviewer(config);

    const results = await reviewAll(
      () => gemini(code, filename),
      () => claude(code, filename),
      () => gpt(code, filename),
    );

    // At least one reviewer should flag the SQL injection
    const allFindings = results.flatMap(r => r.findings);
    const securityFindings = allFindings.filter(f =>
      f.category === 'security' || f.title.toLowerCase().includes('injection')
    );
    expect(securityFindings.length).toBeGreaterThan(0);

    // Consensus should produce merged results
    const filtered = filterFindings(results);
    expect(filtered.length).toBeGreaterThan(0);

    // No reviewer should have errored
    for (const r of results) {
      expect(r.error).toBeNull();
    }
  }, 60000); // 60s timeout for API calls
});
```

- [ ] **Step 2: Run unit tests to ensure nothing broke**

Run: `cd multi-llm-review && npx vitest run`
Expected: All unit tests PASS (integration test excluded via vitest.config.js).

- [ ] **Step 3: Commit**

```bash
git add tests/integration.test.js
git commit -m "feat: add integration test for real API calls (skipped by default)"
```

### Task 9: Final wiring + npm script

**Files:**
- Modify: `multi-llm-review/package.json` — add `review` script with file arg

- [ ] **Step 1: Update package.json scripts**

Add to scripts section:
```json
"review": "node src/cli.js",
"test:integration": "cross-env INTEGRATION=true vitest run tests/integration.test.js"
```

- [ ] **Step 2: Test the full CLI manually**

Run: `cd multi-llm-review && echo "function test() { return 1+1; }" > /tmp/test-sample.js && node src/cli.js /tmp/test-sample.js`
Expected: Output showing review results from all 3 LLMs (requires .env with valid keys).

- [ ] **Step 3: Final commit**

```bash
git add package.json
git commit -m "feat: complete multi-llm-review v1.0 with CLI, consensus filter, and skill integration"
```

---

## Summary of File Structure

```
multi-llm-review/
├── .env.example
├── .gitignore
├── package.json
├── vitest.config.js     # Excludes integration tests by default
├── src/
│   ├── cli.js           # CLI entry point (with try/catch error handling)
│   ├── config.js        # Env loading + validation
│   ├── prompts.js       # Role-specific review prompts
│   ├── reviewers.js     # API clients (Gemini, Claude, GPT) + parseJson
│   ├── consensus.js     # Dedup + severity + filtering (Jaccard similarity)
│   └── formatter.js     # Terminal + JSON output
├── tests/
│   ├── config.test.js
│   ├── prompts.test.js
│   ├── parse-json.test.js  # parseJson resilience tests
│   ├── reviewers.test.js
│   ├── consensus.test.js
│   ├── formatter.test.js
│   └── integration.test.js # Skipped by default, needs INTEGRATION=true
├── skill/
│   └── SKILL.md         # Claude Code /code-review skill
└── docs/
    └── superpowers/
        └── plans/
            └── 2026-03-14-multi-llm-code-review.md
```
