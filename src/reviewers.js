import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import { buildPrompt } from './prompts.js';

export function parseJson(text) {
  let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*?\}/g);
  if (!match) {
    throw new Error(`No JSON object found in response: ${cleaned.slice(0, 200)}`);
  }
  for (const candidate of match.reverse()) {
    try {
      return JSON.parse(candidate);
    } catch { /* try next */ }
  }
  throw new Error(`Invalid JSON in LLM response. Tried ${match.length} candidate(s).\nRaw: ${match[match.length - 1].slice(0, 300)}`);
}

export function createGeminiReviewer(config) {
  const ai = new GoogleGenAI({ apiKey: config.geminiKey });

  return async function reviewWithGemini(code, filename) {
    const prompt = buildPrompt('gemini', code, filename);
    const response = await ai.models.generateContent({
      model: config.geminiModel,
      contents: prompt,
    });
    return parseJson(response.text);
  };
}

export function createClaudeReviewer(config) {
  const client = new Anthropic({ apiKey: config.anthropicKey });

  return async function reviewWithClaude(code, filename) {
    const prompt = buildPrompt('claude', code, filename);
    const message = await client.messages.create({
      model: config.claudeModel,
      max_tokens: 4096,
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }],
    });
    return parseJson(message.content[0].text);
  };
}

export function createGptReviewer(config) {
  const client = new OpenAI({ apiKey: config.openaiKey });

  return async function reviewWithGpt(code, filename) {
    const prompt = buildPrompt('gpt', code, filename);
    const response = await client.chat.completions.create({
      model: config.gptModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
    });
    return parseJson(response.choices[0].message.content);
  };
}

export async function reviewAll(geminiReviewer, claudeReviewer, gptReviewer) {
  const reviewers = [
    { name: 'gemini', fn: geminiReviewer },
    { name: 'claude', fn: claudeReviewer },
    { name: 'gpt', fn: gptReviewer },
  ];

  const results = await Promise.allSettled(
    reviewers.map(r => r.fn())
  );

  return results.map((result, i) => {
    if (result.status === 'fulfilled') {
      return {
        reviewer: reviewers[i].name,
        findings: result.value.findings || [],
        summary: result.value.summary || '',
        error: null,
      };
    }
    return {
      reviewer: reviewers[i].name,
      findings: [],
      summary: '',
      error: result.reason?.message || 'Unknown error',
    };
  });
}
