const SEVERITY_RANK = { critical: 3, important: 2, minor: 1 };

function jaccard(a, b) {
  const tokenize = s => s.toLowerCase().replace(/[-_]/g, ' ').split(/\s+/).filter(Boolean);
  const wordsA = new Set(tokenize(a));
  const wordsB = new Set(tokenize(b));
  const intersection = [...wordsA].filter(w => wordsB.has(w));
  const union = new Set([...wordsA, ...wordsB]);
  return union.size > 0 ? intersection.length / union.size : 0;
}

function isSimilar(a, b) {
  if (a.line === null && b.line === null) {
    return a.category === b.category && jaccard(a.title, b.title) > 0.5;
  }
  if (a.line === null || b.line === null) return false;
  if (a.line !== b.line) return false;
  return jaccard(a.title, b.title) > 0.5;
}

export function filterFindings(results, options = {}) {
  const { minAgreementForMinor = 1 } = options;

  const all = results.flatMap(r =>
    r.findings.map(f => ({ ...f, reviewer: r.reviewer }))
  );

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

  const merged = groups.map(group => {
    const bestSeverity = group.reduce((best, f) =>
      (SEVERITY_RANK[f.severity] || 0) > (SEVERITY_RANK[best] || 0) ? f.severity : best,
      group[0].severity
    );
    const agreedBy = [...new Set(group.map(f => f.reviewer))];
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

  const filtered = merged.filter(f => {
    if (f.severity === 'critical') return true;
    if (f.severity === 'important') return true;
    return f.agreedBy.length >= minAgreementForMinor;
  });

  filtered.sort((a, b) => (SEVERITY_RANK[b.severity] || 0) - (SEVERITY_RANK[a.severity] || 0));

  return filtered;
}
