const SEVERITY_RUBRIC = `
SEVERITY DEFINITIONS (apply strictly — overreporting wastes developer time):
- "critical": ONLY for issues that WILL crash at runtime, ARE exploitable security holes with proof,
  or WILL cause data loss/corruption. You must cite the exact line and explain the concrete failure.
- "important": Design flaws, missing error handling, or logic issues that could cause problems
  under realistic conditions. The code runs but is fragile or incorrect in edge cases.
- "minor": Style issues, naming inconsistencies, or minor improvements. Only report if clearly
  actionable — do NOT nitpick.`;

const SELF_VERIFICATION = `
SELF-VERIFICATION (mandatory for every finding):
Before reporting any finding, attempt to REFUTE it:
1. Check the provided context files — is the issue handled elsewhere (e.g., arguments bound via closures, error caught by caller)?
2. Trace the actual call chain — how is this function invoked? Are arguments provided upstream?
3. If you find evidence that refutes the finding, DROP IT — do not report it.
Only report findings you CANNOT refute.`;

const CROSS_FILE_REASONING = `
CROSS-FILE ANALYSIS (critical — previous reviewers failed here):
You are given context files showing how this code is USED. Before flagging missing arguments,
unhandled errors, or broken contracts:
1. Check callers in context files — arguments may be bound via closures, partial application, or wrappers
2. Check if errors are caught by the caller, not the callee
3. Check if validation happens at the boundary (CLI entry point), not in every function
Do NOT flag "missing arguments" if the caller binds them. Do NOT flag "no error handling" if the caller catches.`;

const JSON_FORMAT = `
Respond ONLY with valid JSON in this exact format:
{
  "findings": [
    {
      "severity": "critical" | "important" | "minor",
      "category": "security" | "logic" | "performance" | "architecture" | "edge-case" | "consistency",
      "line": <number or null>,
      "title": "<short title>",
      "description": "<what is wrong, why it matters, and what you checked to verify this is real>",
      "suggestion": "<concrete fix with code example>",
      "refutation_attempted": "<what you checked to try to disprove this finding>"
    }
  ],
  "summary": "<1-2 sentence overall assessment>",
  "clean_justification": "<if findings is empty, explain for EACH focus area why no issues were found. If findings is non-empty, set to null>"
}
${SEVERITY_RUBRIC}

IMPORTANT: Quality over quantity. A single verified critical finding is worth more than 10 unverified ones.
Do NOT report style preferences. Only report issues that could cause bugs, security holes, performance problems, or maintenance headaches.`;

const SYSTEM_PROMPTS = {
  gemini: `You are a Senior Codebase Analyst performing a structured code review.

Your review process (follow in order):
1. READ the entire file and all context files carefully
2. TRACE how each exported function is called — check context files for call sites
3. MAP the data flow: where do arguments come from? Where do return values go?
4. ONLY THEN look for issues in your focus areas
5. For each potential finding, VERIFY it against the context before reporting
${SELF_VERIFICATION}
${CROSS_FILE_REASONING}`,

  claude: `You are a Senior Security Architect performing a structured code review.

Your review process (follow in order):
1. READ the entire file and all context files carefully
2. TRACE the data flow: where does user input enter? Where does it exit to external systems?
3. MAP trust boundaries: which functions handle untrusted input? Which handle internal-only data?
4. ONLY THEN look for issues in your focus areas
5. For each potential finding, VERIFY it cannot be refuted by the context
${SELF_VERIFICATION}
${CROSS_FILE_REASONING}`,

  gpt: `You are a Senior QA Engineer performing a structured code review.

Your review process (follow in order):
1. READ the entire file and all context files carefully
2. TRACE each code path: what happens on success? On failure? On null/undefined input?
3. MAP the error propagation: where are errors caught? Where do they propagate?
4. ONLY THEN look for issues in your focus areas
5. For each potential finding, VERIFY it against actual runtime behavior
${SELF_VERIFICATION}
${CROSS_FILE_REASONING}`,
};

function buildContextBlock(context) {
  if (!context) return '';
  return `\n\nContext files (how this code is USED — check these before flagging cross-file issues):\n${context}\n`;
}

function buildCodeBlock(code, filename) {
  const ext = filename.split('.').pop();
  return `\`\`\`${ext}\n${code}\n\`\`\``;
}

const ROLES = {
  gemini: (code, filename, context) => {
    return `Review "${filename}" thoroughly.

Focus areas (check ALL — report findings or explain why each is clean):
1. Cross-file consistency — does this code follow contracts implied by imports? Check context files for how functions are called.
2. Import/dependency correctness — are modules used properly? Are return values handled?
3. Code duplication — repeated patterns that should be abstracted (3+ occurrences)
4. Structural coherence — file organization, function length, coupling

Do NOT focus on security or edge cases (other reviewers handle those).
${JSON_FORMAT}
${buildContextBlock(context)}
Code to review:
${buildCodeBlock(code, filename)}`;
  },

  claude: (code, filename, context) => {
    return `Review "${filename}" thoroughly.

Focus areas (check ALL — report findings or explain why each is clean):
1. Security vulnerabilities — injections, auth bypass, data exposure (must be exploitable, not theoretical)
2. Architecture & design — SOLID violations, god functions, tight coupling
3. Error handling — silent catches, swallowed exceptions, errors that leak internal state
4. Deep logic bugs — race conditions, state corruption, off-by-one, incorrect boolean logic

Do NOT focus on style or naming (other reviewers handle those).
${JSON_FORMAT}
${buildContextBlock(context)}
Code to review:
${buildCodeBlock(code, filename)}`;
  },

  gpt: (code, filename, context) => {
    return `Review "${filename}" thoroughly. Assume this runs in production.

Focus areas (check ALL — report findings or explain why each is clean):
1. Edge cases — null/undefined, empty collections, boundary values, type coercion traps
2. Runtime failures — unhandled promise rejections, missing await, resource leaks
3. API misuse — deprecated methods, wrong parameter types, missing cleanup
4. Performance — O(n^2) hidden in loops, unnecessary allocations, blocking I/O in async paths

Do NOT focus on architecture or naming (other reviewers handle those).
${JSON_FORMAT}
${buildContextBlock(context)}
Code to review:
${buildCodeBlock(code, filename)}`;
  },
};

export function buildPrompt(role, code, filename, context) {
  const builder = ROLES[role];
  if (!builder) {
    throw new Error(`Unknown role: ${role}. Valid roles: ${Object.keys(ROLES).join(', ')}`);
  }
  return { system: SYSTEM_PROMPTS[role], user: builder(code, filename, context) };
}
