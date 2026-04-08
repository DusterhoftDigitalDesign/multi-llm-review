const SEVERITY_RANK = { critical: 3, important: 2, minor: 1 };

function jaccard(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return 0;
  const tokenize = s => s.toLowerCase().replace(/[-_]/g, ' ').split(/\s+/).filter(Boolean);
  const wordsA = new Set(tokenize(a));
  const wordsB = new Set(tokenize(b));
  const intersection = [...wordsA].filter(w => wordsB.has(w));
  const union = new Set([...wordsA, ...wordsB]);
  return union.size > 0 ? intersection.length / union.size : 0;
}

function isSimilar(a, b) {
  // Same category + similar title = likely same issue
  if (a.category === b.category && jaccard(a.title, b.title) > 0.4) return true;

  // Nearby lines + similar description
  if (a.line !== null && b.line !== null && Math.abs(a.line - b.line) <= 3) {
    return jaccard(a.description, b.description) > 0.3;
  }

  return false;
}

function getConfidence(agreedBy) {
  if (agreedBy.length >= 3) return 'high';
  if (agreedBy.length === 2) return 'medium';
  return 'low';
}

export function filterFindings(results, options = {}) {
  const { minAgreementForMinor = 2 } = options;

  const all = results.flatMap(r =>
    (r.findings || []).map(f => ({ ...f, reviewer: r.reviewer }))
  );

  // Sort by severity descending for deterministic seed selection
  all.sort((a, b) => (SEVERITY_RANK[b.severity] || 0) - (SEVERITY_RANK[a.severity] || 0));

  const groups = [];
  const used = new Set();

  for (let i = 0; i < all.length; i++) {
    if (used.has(i)) continue;
    const group = [all[i]];
    used.add(i);
    for (let j = i + 1; j < all.length; j++) {
      if (used.has(j)) continue;
      if (group.some(member => isSimilar(member, all[j]))) {
        group.push(all[j]);
        used.add(j);
      }
    }
    groups.push(group);
  }

  const merged = groups.map(group => {
    const agreedBy = [...new Set(group.map(f => f.reviewer))];
    const confidence = getConfidence(agreedBy);
    const primary = group.reduce((best, f) =>
      (SEVERITY_RANK[f.severity] || 0) > (SEVERITY_RANK[best.severity] || 0) ? f : best,
      group[0]
    );

    // Severity calibration: solo critical with low confidence → downgrade to important
    let severity = primary.severity;
    if (severity === 'critical' && confidence === 'low') {
      severity = 'important';
    }

    return {
      severity,
      category: primary.category,
      line: primary.line,
      title: primary.title,
      description: primary.description,
      suggestion: primary.suggestion,
      agreedBy,
      confidence,
    };
  });

  const filtered = merged.filter(f => {
    // Critical always passes
    if (f.severity === 'critical') return true;
    // Important always passes
    if (f.severity === 'important') return true;
    // Minor needs consensus (default: 2+ LLMs agree)
    return f.agreedBy.length >= minAgreementForMinor;
  });

  // Sort by severity desc, then confidence desc
  filtered.sort((a, b) => {
    const sevDiff = (SEVERITY_RANK[b.severity] || 0) - (SEVERITY_RANK[a.severity] || 0);
    if (sevDiff !== 0) return sevDiff;
    const confRank = { high: 3, medium: 2, low: 1 };
    return (confRank[b.confidence] || 0) - (confRank[a.confidence] || 0);
  });

  return filtered;
}
