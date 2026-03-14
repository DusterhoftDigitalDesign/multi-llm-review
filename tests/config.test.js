import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('throws if ANTHROPIC_API_KEY is missing', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY', 'test');
    vi.stubEnv('OPENAI_API_KEY', 'test');
    expect(() => loadConfig()).toThrow('ANTHROPIC_API_KEY');
  });

  it('throws if GOOGLE_GENERATIVE_AI_API_KEY is missing', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test');
    vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY', '');
    vi.stubEnv('OPENAI_API_KEY', 'test');
    expect(() => loadConfig()).toThrow('GOOGLE_GENERATIVE_AI_API_KEY');
  });

  it('throws if OPENAI_API_KEY is missing', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test');
    vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY', 'test');
    vi.stubEnv('OPENAI_API_KEY', '');
    expect(() => loadConfig()).toThrow('OPENAI_API_KEY');
  });

  it('returns config with defaults when all keys present', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
    vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY', 'AIza-test');
    vi.stubEnv('OPENAI_API_KEY', 'sk-test');
    const config = loadConfig();
    expect(config.anthropicKey).toBe('sk-ant-test');
    expect(config.geminiModel).toBe('gemini-3.1-pro-preview');
    expect(config.claudeModel).toBe('claude-sonnet-4-6');
    expect(config.gptModel).toBe('gpt-5.4');
  });

  it('allows model overrides via env', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test');
    vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY', 'test');
    vi.stubEnv('OPENAI_API_KEY', 'test');
    vi.stubEnv('GEMINI_MODEL', 'gemini-2.5-flash');
    const config = loadConfig();
    expect(config.geminiModel).toBe('gemini-2.5-flash');
  });
});
