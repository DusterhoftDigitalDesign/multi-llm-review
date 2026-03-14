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
  }, 60000);
});
