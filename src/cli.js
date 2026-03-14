#!/usr/bin/env node
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
