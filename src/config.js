import 'dotenv/config';

const REQUIRED_KEYS = [
  'ANTHROPIC_API_KEY',
  'GOOGLE_GENERATIVE_AI_API_KEY',
  'OPENAI_API_KEY',
];

export function loadConfig() {
  for (const key of REQUIRED_KEYS) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }

  return {
    anthropicKey: process.env.ANTHROPIC_API_KEY,
    geminiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    openaiKey: process.env.OPENAI_API_KEY,
    geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    claudeModel: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
    gptModel: process.env.GPT_MODEL || 'gpt-5.4',
  };
}
