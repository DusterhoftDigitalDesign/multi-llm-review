import { describe, it, expect } from 'vitest';
import { buildPrompt } from '../src/prompts.js';

describe('buildPrompt', () => {
  const code = 'function add(a, b) { return a + b; }';
  const filename = 'math.js';

  it('generates gemini prompt with codebase-context focus', () => {
    const prompt = buildPrompt('gemini', code, filename);
    expect(prompt).toContain('cross-file');
    expect(prompt).toContain('consistency');
    expect(prompt).toContain(code);
    expect(prompt).toContain('math.js');
  });

  it('generates claude prompt with security + architecture focus', () => {
    const prompt = buildPrompt('claude', code, filename);
    expect(prompt).toContain('security');
    expect(prompt).toContain('architecture');
    expect(prompt).toContain(code);
  });

  it('generates gpt prompt with edge-cases + runtime focus', () => {
    const prompt = buildPrompt('gpt', code, filename);
    expect(prompt).toContain('edge case');
    expect(prompt).toContain('runtime');
    expect(prompt).toContain(code);
  });

  it('throws on unknown role', () => {
    expect(() => buildPrompt('deepseek', code, filename)).toThrow('Unknown role');
  });

  it('includes JSON output instruction in all prompts', () => {
    for (const role of ['gemini', 'claude', 'gpt']) {
      const prompt = buildPrompt(role, code, filename);
      expect(prompt).toContain('"findings"');
    }
  });
});
