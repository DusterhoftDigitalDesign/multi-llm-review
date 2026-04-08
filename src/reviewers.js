import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import { buildPrompt } from './prompts.js';

export function parseJson(text) {
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('Empty or non-string LLM response');
  }
  let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  // Try to find the root object containing "findings" array
  const findingsMatch = cleaned.match(/\{[\s\S]*"findings"\s*:\s*\[[\s\S]*\][\s\S]*\}/);
  if (findingsMatch) {
    try {
      return JSON.parse(findingsMatch[0]);
    } catch { /* fall through */ }
  }

  // Fallback: try the largest JSON object
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error(`No JSON object found in response: ${cleaned.slice(0, 200)}`);
  }
  try {
    return JSON.parse(match[0]);
  } catch {
    throw new Error(`Invalid JSON in LLM response.\nRaw: ${match[0].slice(0, 300)}`);
  }
}

export function createGeminiReviewer(config) {
  const ai = new GoogleGenAI({ apiKey: config.geminiKey });

  return async function reviewWithGemini(code, filename, context) {
    const { system, user } = buildPrompt('gemini', code, filename, context);
    const response = await ai.models.generateContent({
      model: config.geminiModel,
      contents: user,
      config: {
        systemInstruction: system,
        temperature: 0.5,
      },
    });
    return parseJson(response.text);
  };
}

export function createClaudeReviewer(config) {
  const client = new Anthropic({ apiKey: config.anthropicKey });

  return async function reviewWithClaude(code, filename, context) {
    const { system, user } = buildPrompt('claude', code, filename, context);
    const message = await client.messages.create({
      model: config.claudeModel,
      max_tokens: 4096,
      temperature: 0.5,
      system,
      messages: [{ role: 'user', content: user }],
    });
    return parseJson(message.content[0].text);
  };
}

export function createGptReviewer(config) {
  const client = new OpenAI({ apiKey: config.openaiKey });

  return async function reviewWithGpt(code, filename, context) {
    const { system, user } = buildPrompt('gpt', code, filename, context);
    const response = await client.chat.completions.create({
      model: config.gptModel,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.5,
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
        cleanJustification: result.value.clean_justification || null,
        error: null,
      };
    }
    return {
      reviewer: reviewers[i].name,
      findings: [],
      summary: '',
      cleanJustification: null,
      error: result.reason?.message || 'Unknown error',
    };
  });
}
