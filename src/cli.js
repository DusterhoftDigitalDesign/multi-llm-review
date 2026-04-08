#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { loadConfig } from './config.js';
import { buildContext } from './context.js';
import { createGeminiReviewer, createClaudeReviewer, createGptReviewer, reviewAll } from './reviewers.js';
import { filterFindings } from './consensus.js';
import { formatFindings, formatJson } from './formatter.js';
import { createVerifier } from './verifier.js';

try {
  const args = process.argv.slice(2);
  const jsonFlag = args.includes('--json');
  const noContextFlag = args.includes('--no-context');
  const noVerifyFlag = args.includes('--no-verify');
  const filePath = args.find(a => !a.startsWith('--'));

  if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage: llm-review <file> [options]\n');
    console.log('  <file>         Path to the file to review');
    console.log('  --json         Output machine-readable JSON');
    console.log('  --no-context   Skip import resolution (faster, less accurate)');
    console.log('  --no-verify    Skip verification phase (faster, more false positives)');
    console.log('  --help         Show this help message');
    process.exit(0);
  }

  if (!filePath) {
    console.error('Usage: llm-review <file> [--json] [--no-context] [--no-verify]');
    process.exit(1);
  }

  const resolved = resolve(filePath);
  if (!existsSync(resolved)) {
    console.error(`Error: File not found: ${resolved}`);
    process.exit(1);
  }

  const code = readFileSync(resolved, 'utf8');
  const filename = basename(resolved);

  // Build cross-file context from imports
  let context = null;
  if (!noContextFlag) {
    context = buildContext(code, resolved);
    if (context && !jsonFlag) {
      const contextFiles = (context.match(/^--- /gm) || []).length;
      console.log(`Resolved ${contextFiles} imported file(s) for context.`);
    }
  }

  if (!jsonFlag) console.log(`Reviewing ${filename} with 3 LLMs in parallel...\n`);

  const config = loadConfig();

  const gemini = createGeminiReviewer(config);
  const claude = createClaudeReviewer(config);
  const gpt = createGptReviewer(config);

  const geminiReview = () => gemini(code, filename, context);
  const claudeReview = () => claude(code, filename, context);
  const gptReview = () => gpt(code, filename, context);

  const results = await reviewAll(geminiReview, claudeReview, gptReview);

  for (const r of results) {
    if (r.error) {
      const safeMsg = String(r.error).slice(0, 200);
      console.error(`Warning: ${r.reviewer} failed: ${safeMsg}`);
    }
  }

  let findings = filterFindings(results, { minAgreementForMinor: 2 });

  // Verification phase: cross-check findings against code
  if (!noVerifyFlag && findings.length > 0) {
    if (!jsonFlag) console.log('Verifying findings...\n');
    try {
      const verifier = createVerifier(config);
      findings = await verifier(code, filename, context, findings);
    } catch (err) {
      console.error(`Warning: Verification failed: ${String(err.message).slice(0, 200)}`);
    }
  }

  if (jsonFlag) {
    console.log(formatJson(findings, results));
  } else {
    console.log(formatFindings(findings));
    const critical = findings.filter(f => f.severity === 'critical').length;
    const important = findings.filter(f => f.severity === 'important').length;
    const minor = findings.filter(f => f.severity === 'minor').length;
    console.log(`\n--- Summary: ${findings.length} findings (${critical} critical, ${important} important, ${minor} minor) ---`);

    // Show clean justifications if no findings
    if (findings.length === 0) {
      const justifications = results
        .filter(r => r.cleanJustification && !r.error)
        .map(r => `  ${r.reviewer}: ${r.cleanJustification}`);
      if (justifications.length > 0) {
        console.log('\nClean justifications:');
        console.log(justifications.join('\n'));
      }
    }
  }
} catch (err) {
  console.error(`Error: ${err.message}`);
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
}
