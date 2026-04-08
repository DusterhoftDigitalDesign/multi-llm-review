import Anthropic from '@anthropic-ai/sdk';
import { parseJson } from './reviewers.js';

const VERIFY_SYSTEM = `You are a Senior Code Review Verifier. Your ONLY job is to check whether reported findings are real bugs or false positives.

You will receive:
1. The source code being reviewed
2. Context files showing how the code is used
3. A list of findings from other reviewers

For EACH finding, you must:
1. Read the cited line in the source code
2. Trace the actual execution path — check how functions are called in context files
3. Look for closures, wrappers, try/catch blocks, or upstream validation that may handle the issue
4. Determine: CONFIRMED (the bug is real) or REJECTED (false positive, handled elsewhere)

Be ruthlessly accurate. False positives waste developer time. Missing real bugs causes incidents.
Err on the side of REJECTING weak findings.`;

function buildVerifyPrompt(code, filename, context, findings) {
  const findingsList = findings.map((f, i) =>
    `[${i + 1}] ${f.severity.toUpperCase()} — ${f.title} (Line ${f.line ?? 'N/A'}, agreed by: ${f.agreedBy.join(', ')})
    Description: ${f.description}`
  ).join('\n\n');

  const contextBlock = context
    ? `\nContext files (how this code is USED):\n${context}\n`
    : '';

  return `Verify these ${findings.length} findings against the actual code.

For each finding, respond with CONFIRMED or REJECTED and a brief justification.

Respond ONLY with valid JSON:
{
  "verifications": [
    {
      "index": 1,
      "verdict": "confirmed" | "rejected",
      "justification": "<why this is real or why it's a false positive>"
    }
  ]
}

Source code ("${filename}"):
\`\`\`${filename.split('.').pop()}
${code}
\`\`\`
${contextBlock}
Findings to verify:
${findingsList}`;
}

export function createVerifier(config) {
  const client = new Anthropic({ apiKey: config.anthropicKey });

  return async function verify(code, filename, context, findings) {
    if (findings.length === 0) return findings;

    const response = await client.messages.create({
      model: config.claudeModel,
      max_tokens: 4096,
      temperature: 0,
      system: VERIFY_SYSTEM,
      messages: [{ role: 'user', content: buildVerifyPrompt(code, filename, context, findings) }],
    });

    const textBlock = response.content.find(b => b.type === 'text');
    if (!textBlock) return findings;

    try {
      const result = parseJson(textBlock.text);
      const verdicts = new Map(
        (result.verifications || []).map(v => [v.index, v])
      );

      return findings
        .map((f, i) => {
          const v = verdicts.get(i + 1);
          if (!v) return f;
          return {
            ...f,
            verified: v.verdict === 'confirmed',
            verifierNote: v.justification,
          };
        })
        .filter(f => f.verified !== false);
    } catch {
      // Verification failed — return unfiltered findings
      return findings;
    }
  };
}
