import { describe, it, expect, vi } from 'vitest';
import { reviewAll } from '../src/reviewers.js';

describe('reviewAll', () => {
  it('calls all three reviewers in parallel and returns results', async () => {
    const mockGemini = vi.fn().mockResolvedValue({
      findings: [{ severity: 'minor', category: 'consistency', line: 1, title: 'Naming', description: 'test', suggestion: 'test' }],
      summary: 'OK'
    });
    const mockClaude = vi.fn().mockResolvedValue({
      findings: [],
      summary: 'Clean'
    });
    const mockGpt = vi.fn().mockResolvedValue({
      findings: [{ severity: 'critical', category: 'edge-case', line: 5, title: 'Null check', description: 'test', suggestion: 'test' }],
      summary: 'Issues found'
    });

    const results = await reviewAll(mockGemini, mockClaude, mockGpt);

    expect(results).toHaveLength(3);
    expect(results[0].reviewer).toBe('gemini');
    expect(results[1].reviewer).toBe('claude');
    expect(results[2].reviewer).toBe('gpt');
    expect(mockGemini).toHaveBeenCalledOnce();
    expect(mockClaude).toHaveBeenCalledOnce();
    expect(mockGpt).toHaveBeenCalledOnce();
  });

  it('handles single reviewer failure gracefully', async () => {
    const mockGemini = vi.fn().mockRejectedValue(new Error('API timeout'));
    const mockClaude = vi.fn().mockResolvedValue({ findings: [], summary: 'OK' });
    const mockGpt = vi.fn().mockResolvedValue({ findings: [], summary: 'OK' });

    const results = await reviewAll(mockGemini, mockClaude, mockGpt);

    expect(results[0].reviewer).toBe('gemini');
    expect(results[0].error).toBe('API timeout');
    expect(results[0].findings).toEqual([]);
    expect(results[1].findings).toEqual([]);
    expect(results[2].findings).toEqual([]);
  });
});
