import { describe, it, expect } from 'vitest';
import { parseJson } from '../src/reviewers.js';

describe('parseJson', () => {
  it('parses plain JSON', () => {
    const result = parseJson('{"findings": [], "summary": "OK"}');
    expect(result.findings).toEqual([]);
  });

  it('parses JSON wrapped in markdown code fences', () => {
    const result = parseJson('```json\n{"findings": [], "summary": "OK"}\n```');
    expect(result.findings).toEqual([]);
  });

  it('extracts JSON from preamble text', () => {
    const result = parseJson('Here is my review:\n{"findings": [], "summary": "Clean"}');
    expect(result.summary).toBe('Clean');
  });

  it('extracts JSON with trailing text', () => {
    const result = parseJson('{"findings": [], "summary": "OK"}\n\nLet me know if you need more details.');
    expect(result.findings).toEqual([]);
  });

  it('throws with meaningful error on no JSON', () => {
    expect(() => parseJson('No JSON here')).toThrow('No JSON object found');
  });

  it('throws with meaningful error on invalid JSON', () => {
    expect(() => parseJson('{invalid json}')).toThrow('Invalid JSON');
  });
});
