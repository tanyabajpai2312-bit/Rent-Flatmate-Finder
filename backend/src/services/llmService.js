const { computeFallbackScore } = require('./scoringFallback');

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

/**
 * Builds the prompt sent to the LLM as specified in the assignment's
 * "LLM Usage Guidance" section.
 */
function buildPrompt(listing, tenantProfile) {
  const listingSummary = {
    location: listing.location,
    rent: listing.rent,
    availableFrom: listing.availableFrom,
    roomType: listing.roomType,
    furnishingStatus: listing.furnishingStatus,
  };

  const tenantSummary = {
    preferredLocation: tenantProfile.preferredLocation,
    budgetMin: tenantProfile.budgetMin,
    budgetMax: tenantProfile.budgetMax,
    moveInDate: tenantProfile.moveInDate,
  };

  return (
    `Given this room listing: ${JSON.stringify(listingSummary)} ` +
    `and this tenant profile: ${JSON.stringify(tenantSummary)}, ` +
    `compute a compatibility score from 0 to 100 based on budget and location match. ` +
    `Respond with ONLY valid JSON in this exact shape and nothing else: ` +
    `{"score": number, "explanation": string}`
  );
}

/**
 * Calls Claude to get a compatibility score. If the call fails for any
 * reason (network error, timeout, malformed JSON, non-2xx response),
 * falls back to a deterministic rule-based score so the feature never
 * breaks the user-facing flow.
 *
 * Returns: { score, explanation, source: 'llm' | 'rule-based-fallback' }
 */
async function getCompatibilityScore(listing, tenantProfile) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const timeoutMs = Number(process.env.LLM_TIMEOUT_MS || 8000);

  if (!apiKey) {
    const fallback = computeFallbackScore(listing, tenantProfile);
    return { ...fallback, source: 'rule-based-fallback' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: process.env.LLM_MODEL || 'claude-3-5-haiku-20241022',
        max_tokens: 300,
        messages: [{ role: 'user', content: buildPrompt(listing, tenantProfile) }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`LLM API returned status ${response.status}`);
    }

    const data = await response.json();
    const textBlock = (data.content || []).find((b) => b.type === 'text');
    if (!textBlock) throw new Error('No text content in LLM response');

    const cleaned = textBlock.text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    const score = Math.max(0, Math.min(100, Math.round(Number(parsed.score))));
    const explanation = String(parsed.explanation || '').slice(0, 1000);

    if (Number.isNaN(score) || !explanation) {
      throw new Error('Malformed LLM JSON output');
    }

    return { score, explanation, source: 'llm' };
  } catch (err) {
    clearTimeout(timeout);
    console.error('[llmService] Falling back to rule-based scoring:', err.message);
    const fallback = computeFallbackScore(listing, tenantProfile);
    return { ...fallback, source: 'rule-based-fallback' };
  }
}

module.exports = { getCompatibilityScore, buildPrompt };
