import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkFraudScoring } from '../../services/supabaseEdgeFunctions';

describe('Supabase Edge Functions', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  it('calls checkFraudScoring function successfully', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as any);

    const result = await checkFraudScoring('prop123') as any;
    
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/functions/v1/ai-fraud-detection'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ property_id: 'prop123' })
      })
    );
    expect(result.success).toBe(true);
  });

  it('throws an error if function invocation fails', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Network error' }),
    } as any);

    await expect(checkFraudScoring('prop123')).rejects.toThrow('Network error');
  });
});

