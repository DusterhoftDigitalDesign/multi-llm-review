import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';

const MAX_CONTEXT_LINES = 150;
const MAX_CONTEXT_FILES = 5;

/**
 * Extract import paths from a source file.
 * Supports Python (import/from...import) and JS/TS (import...from).
 */
function extractImports(code, filename) {
  const imports = [];
  const ext = filename.split('.').pop();

  if (['py'].includes(ext)) {
    // Python: from server.orchestrator.models import Foo
    //         import server.config
    const fromPattern = /^from\s+([\w.]+)\s+import/gm;
    const importPattern = /^import\s+([\w.]+)/gm;
    let m;
    while ((m = fromPattern.exec(code)) !== null) imports.push(m[1]);
    while ((m = importPattern.exec(code)) !== null) imports.push(m[1]);
  } else if (['ts', 'tsx', 'js', 'jsx'].includes(ext)) {
    // JS/TS: import { Foo } from './bar'
    //        import Foo from '../baz'
    const pattern = /from\s+['"]([^'"]+)['"]/g;
    let m;
    while ((m = pattern.exec(code)) !== null) imports.push(m[1]);
  }

  return imports;
}

/**
 * Resolve a Python module path to a file path relative to the project.
 */
function resolvePythonImport(importPath, filePath) {
  // Convert dots to path separators: server.config -> server/config
  const parts = importPath.split('.');
  const dir = dirname(filePath);

  // Try relative to file's directory first, then walk up
  const candidates = [];

  // Absolute import (from project root)
  candidates.push(resolve(dir, '..', ...parts) + '.py');
  candidates.push(resolve(dir, '../..', ...parts) + '.py');
  candidates.push(resolve(dir, '../../..', ...parts) + '.py');

  // Also try as package (__init__.py)
  candidates.push(resolve(dir, '..', ...parts, '__init__.py'));
  candidates.push(resolve(dir, '../..', ...parts, '__init__.py'));

  return candidates;
}

/**
 * Resolve a JS/TS import path to a file path.
 */
function resolveJsImport(importPath, filePath) {
  if (!importPath.startsWith('.')) return []; // skip node_modules

  const dir = dirname(filePath);
  const base = resolve(dir, importPath);
  const candidates = [];

  for (const ext of ['', '.ts', '.tsx', '.js', '.jsx']) {
    candidates.push(base + ext);
  }
  candidates.push(join(base, 'index.ts'));
  candidates.push(join(base, 'index.js'));

  return candidates;
}

/**
 * Build context string from imported files.
 * Returns truncated content of resolved imports.
 */
export function buildContext(code, filePath) {
  const filename = filePath.split(/[/\\]/).pop();
  const imports = extractImports(code, filename);
  const ext = filename.split('.').pop();

  const resolved = [];

  for (const imp of imports) {
    const candidates = ext === 'py'
      ? resolvePythonImport(imp, filePath)
      : resolveJsImport(imp, filePath);

    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        resolved.push(candidate);
        break;
      }
    }

    if (resolved.length >= MAX_CONTEXT_FILES) break;
  }

  if (resolved.length === 0) return null;

  const parts = resolved.map(fp => {
    try {
      const content = readFileSync(fp, 'utf8');
      const lines = content.split('\n').slice(0, MAX_CONTEXT_LINES);
      const relativePath = fp.split(/[/\\]/).slice(-3).join('/');
      return `--- ${relativePath} (first ${MAX_CONTEXT_LINES} lines) ---\n${lines.join('\n')}`;
    } catch {
      return null;
    }
  }).filter(Boolean);

  return parts.join('\n\n');
}
