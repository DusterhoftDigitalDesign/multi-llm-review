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
