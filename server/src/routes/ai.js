import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../config.js';
import { requireAuth, requireUser } from '../middleware/auth.js';
import { badRequest } from '../utils/http.js';
import { chatCompletion } from '../ai/openai.js';
import { buildMessages } from '../ai/coach.js';

const router = Router();

const MAX_MESSAGES = 24;
const MAX_MESSAGE_CHARS = 4000;
const MAX_CONTEXT_BYTES = 60_000;

/** Whether the AI coach is available on this server (no secrets exposed). */
router.get('/status', requireAuth, (_req, res) => {
  res.json({ enabled: Boolean(config.ai.apiKey), model: config.ai.apiKey ? config.ai.model : null });
});

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => String(req.userId),
  message: { error: 'You’ve sent a lot of AI requests — please wait a few minutes.' },
});

router.post('/chat', requireAuth, requireUser, aiLimiter, async (req, res) => {
  const { messages, context } = req.body || {};
  if (!Array.isArray(messages) || !messages.length || messages.length > MAX_MESSAGES) {
    throw badRequest(`Send between 1 and ${MAX_MESSAGES} messages.`);
  }
  const history = messages.map((m) => {
    if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string' || !m.content.trim()) {
      throw badRequest('Each message needs a role (user/assistant) and text.');
    }
    if (m.content.length > MAX_MESSAGE_CHARS) throw badRequest(`Messages are limited to ${MAX_MESSAGE_CHARS} characters.`);
    return { role: m.role, content: m.content.trim() };
  });
  if (history[history.length - 1].role !== 'user') throw badRequest('The last message must be from you.');
  if (!context || typeof context !== 'object' || Array.isArray(context)) throw badRequest('Missing data snapshot.');
  if (Buffer.byteLength(JSON.stringify(context)) > MAX_CONTEXT_BYTES) throw badRequest('Data snapshot is too large.');

  const result = await chatCompletion(buildMessages(context, history));
  res.json({ reply: result.text, model: result.model });
});

export default router;
