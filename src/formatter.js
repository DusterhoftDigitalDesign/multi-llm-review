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
