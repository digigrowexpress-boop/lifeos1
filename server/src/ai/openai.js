import { config } from '../config.js';
import { HttpError } from '../utils/http.js';

const isOpenAI = () => /(^|\.)openai\.com$/i.test(new URL(config.ai.baseUrl).hostname);

/**
 * Minimal OpenAI Chat Completions client (no SDK needed). Works with any
 * OpenAI-compatible endpoint via OPENAI_BASE_URL.
 */
export async function chatCompletion(messages, { maxTokens = 2500 } = {}) {
  if (!config.ai.apiKey) throw new HttpError(503, 'The AI coach is not configured on this server (OPENAI_API_KEY is missing).');

  const body = { model: config.ai.model, messages };
  if (isOpenAI()) {
    body.max_completion_tokens = maxTokens;
    const effort = (process.env.OPENAI_REASONING_EFFORT ?? 'low').trim();
    if (effort) body.reasoning_effort = effort;
  } else {
    body.max_tokens = maxTokens;
    if (process.env.OPENAI_REASONING_EFFORT) body.reasoning_effort = process.env.OPENAI_REASONING_EFFORT.trim();
  }

  let res;
  try {
    res = await fetch(`${config.ai.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.ai.apiKey}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90_000),
    });
  } catch (err) {
    const timeout = err?.name === 'TimeoutError';
    throw new HttpError(504, timeout ? 'The AI provider took too long to answer. Please try again.' : 'Could not reach the AI provider. Check the server’s internet connection.');
  }

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const providerMsg = json?.error?.message || `HTTP ${res.status}`;
    console.error('[ai] provider error:', res.status, providerMsg);
    if (res.status === 401) throw new HttpError(502, 'The AI provider rejected the API key (check OPENAI_API_KEY).');
    if (res.status === 404) throw new HttpError(502, `The AI model “${config.ai.model}” is not available for this API key (check OPENAI_MODEL).`);
    if (res.status === 429) throw new HttpError(429, 'The AI provider’s rate limit or quota was reached. Try again later or check your OpenAI billing.');
    if (res.status === 400) throw new HttpError(502, `The AI provider rejected the request: ${providerMsg}`);
    throw new HttpError(502, 'The AI provider returned an error. Please try again.');
  }

  const choice = json?.choices?.[0];
  const text = typeof choice?.message?.content === 'string' ? choice.message.content.trim() : '';
  if (!text) {
    throw new HttpError(502, choice?.finish_reason === 'length' ? 'The AI ran out of space before answering — try a shorter question.' : 'The AI returned an empty answer. Please try again.');
  }
  return { text, usage: json.usage || null, model: json.model || config.ai.model };
}
