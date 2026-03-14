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
