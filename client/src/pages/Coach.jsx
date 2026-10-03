import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bot, Copy, Eye, HardDrive, Info, KeyRound, LoaderCircle, MessageSquarePlus, Send, ShieldCheck, Sparkles, TriangleAlert } from 'lucide-react';
import { useData } from '../store/data.jsx';
import { useToast } from '../components/ui/Feedback.jsx';
import { Callout, Card, PageHeader } from '../components/ui/Card.jsx';
import { ToggleRow } from '../components/ui/Fields.jsx';
import { Markdown } from '../components/ui/Markdown.jsx';
import { buildAiContext } from '../logic/aiContext.js';

const HISTORY_KEY = 'lifeos.coach.chat';
const MAX_TURNS_SENT = 12;

const SUGGESTIONS = [
  'What should I focus on today and this week?',
  'How can I reach my target SGPA? Give me a subject-by-subject plan.',
  'Which subjects need the most attention, and why?',
  'Make me a 7-day study schedule around my deadlines and exams.',
  'Review my GATE preparation and tell me what to change.',
  'Give me an honest weekly review of my progress.',
  'How are my sleep and screen habits affecting my productivity?',
  'Am I studying the right subjects for my credits and targets?',
];

const readHistory = (key) => {
  try {
    return JSON.parse(sessionStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
};

function SnapshotPreview({ context }) {
  return (
    <details className="snapshot">
      <summary className="row-sm small">
        <Eye size={14} /> See exactly what is shared
      </summary>
      <pre className="snapshot-json">{JSON.stringify(context, null, 2)}</pre>
    </details>
  );
}

export default function Coach() {
  const { adapter, mode, analysis, data, profile, today, saveProfile, user } = useData();
  const historyKey = `${HISTORY_KEY}.${user?.id || 'device'}`;
  const toast = useToast();
  const [status, setStatus] = useState(null);
  const [messages, setMessages] = useState(() => readHistory(historyKey));
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const privacy = profile.privacy || {};
  const includeLifestyle = privacy.aiIncludeLifestyle !== false && privacy.useLifestyleInInsights !== false;

  useEffect(() => {
    let alive = true;
    adapter
      .aiStatus()
      .then((s) => alive && setStatus(s))
      .catch((e) => alive && setStatus({ enabled: false, error: e.message }));
    return () => {
      alive = false;
    };
  }, [adapter]);

  useEffect(() => {
    try {
      sessionStorage.setItem(historyKey, JSON.stringify(messages.slice(-40)));
    } catch {
      /* ignore */
    }
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, busy, historyKey]);

  const context = useMemo(() => buildAiContext(analysis, data, profile, today, { includeLifestyle }), [analysis, data, profile, today, includeLifestyle]);

  /** Sends the conversation (ending with a user message) and appends the reply. */
  const ask = async (history) => {
    setMessages(history);
    setError('');
    setBusy(true);
    try {
      const { reply } = await adapter.aiChat(history.slice(-MAX_TURNS_SENT), context);
      setMessages((m) => [...m, { role: 'assistant', content: reply }]);
    } catch (e) {
      setError(e.message || 'The AI coach could not answer.');
    } finally {
      setBusy(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const send = (text) => {
    const content = String(text ?? input).trim();
    if (!content || busy) return;
    setInput('');
    ask([...messages, { role: 'user', content }]);
  };

  const retry = () => {
    if (!busy && messages[messages.length - 1]?.role === 'user') ask(messages);
  };

  const header = (
    <PageHeader
      eyebrow="Intelligence"
      title="AI Coach"
      description="Ask anything about your progress. The coach reasons over LifeOS’s own calculations from your data — marks, credits, targets, study, goals, deadlines and habits."
      actions={
        messages.length > 0 && (
          <button type="button" className="btn" onClick={() => { setMessages([]); setError(''); }}>
            <MessageSquarePlus size={15} /> New chat
          </button>
        )
      }
    />
  );

  if (!status) {
    return (
      <div>
        {header}
        <Card><div className="row-sm muted"><LoaderCircle size={16} className="spin" /> Checking AI availability…</div></Card>
      </div>
    );
  }

  if (mode === 'device') {
    return (
      <div>
        {header}
        <Card>
          <div className="stack">
            <Callout tone="info" icon={HardDrive}>
              You’re using LifeOS in <b>device mode</b>. The AI coach runs on the LifeOS server, so it needs a LifeOS account.
            </Callout>
            <p className="small text-2">Export your data (Settings → Data &amp; privacy), sign out, create an account, then import the file with “Replace everything”.</p>
            <div><Link className="btn" to="/settings?tab=data">Open data settings</Link></div>
          </div>
        </Card>
      </div>
    );
  }

  if (!status.enabled) {
    return (
      <div>
        {header}
        <Card title="AI Coach isn’t switched on yet" icon={KeyRound}>
          <div className="stack">
            {status.error ? (
              <Callout tone="critical" icon={TriangleAlert}>{status.error}</Callout>
            ) : import.meta.env.DEV ? (
              <p className="text-2">The server doesn’t have an OpenAI API key yet. To enable the coach:</p>
            ) : (
              <p className="text-2">The coach hasn’t been enabled on this LifeOS server yet. Everything else in LifeOS works without it.</p>
            )}
            {import.meta.env.DEV && (
              <>
                <ol className="small text-2" style={{ paddingLeft: 18, margin: 0, lineHeight: 1.8 }}>
                  <li>Create an API key at <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer noopener">platform.openai.com/api-keys</a>.</li>
                  <li>Open <code className="md-code">server/.env</code> and set <code className="md-code">OPENAI_API_KEY=</code> to your key.</li>
                  <li>Save the file — the API restarts automatically in development. Then reload this page.</li>
                </ol>
                <p className="tiny muted">The key stays on your server; it is never sent to the browser.</p>
              </>
            )}
          </div>
        </Card>
      </div>
    );
  }

  if (!privacy.aiConsent) {
    return (
      <div>
        {header}
        <Card title="Before you start" icon={ShieldCheck}>
          <div className="stack">
            <p className="text-2">
              To answer, the coach sends a <b>summary</b> of your LifeOS data to the AI provider ({status.model}) through your LifeOS server: your grading rules, SGPA/CGPA, subjects with credits and projected grades, targets, study totals, goals, upcoming deadlines, attendance and LifeOS’s insights.
            </p>
            <ul className="small text-2" style={{ paddingLeft: 18, margin: 0, lineHeight: 1.7 }}>
              <li>Never shared: your name, email, password, notes or individual daily log entries.</li>
              <li>Data is sent only when you ask a question. Chats are kept only in this browser tab.</li>
              <li>You can turn the coach off any time in Settings → Data &amp; privacy.</li>
            </ul>
            <ToggleRow
              title="Include lifestyle averages"
              description="Sleep, screen time, social media, exercise, mood and productivity averages"
              checked={privacy.aiIncludeLifestyle !== false}
              onChange={(v) => saveProfile((p) => ({ ...p, privacy: { ...p.privacy, aiIncludeLifestyle: v } }))}
            />
            <SnapshotPreview context={context} />
            <div>
              <button type="button" className="btn btn-primary" onClick={() => saveProfile((p) => ({ ...p, privacy: { ...p.privacy, aiConsent: true } })).then(() => toast('AI Coach enabled'))}>
                <Sparkles size={15} /> Enable AI Coach
              </button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      {header}
      <div className="coach">
        <div className="coach-messages" aria-live="polite">
          {messages.length === 0 && (
            <div className="coach-empty">
              <span className="empty-icon"><Bot size={22} /></span>
              <h3>How can I help?</h3>
              <p className="small text-2">Pick a question or ask your own. Answers use your latest LifeOS numbers.</p>
              <div className="coach-suggestions">
                {SUGGESTIONS.map((s) => (
                  <button key={s} type="button" className="coach-suggestion" onClick={() => send(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`coach-msg ${m.role}`}>
              {m.role === 'assistant' && (
                <span className="coach-avatar" aria-hidden><Bot size={15} /></span>
              )}
              <div className="coach-bubble">
                {m.role === 'assistant' ? <Markdown text={m.content} /> : <p>{m.content}</p>}
                {m.role === 'assistant' && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm coach-copy"
                    onClick={() => navigator.clipboard?.writeText(m.content).then(() => toast('Copied', 'info'))}
                  >
                    <Copy size={12} /> Copy
                  </button>
                )}
              </div>
            </div>
          ))}
          {busy && (
            <div className="coach-msg assistant">
              <span className="coach-avatar" aria-hidden><Bot size={15} /></span>
              <div className="coach-bubble row-sm muted"><LoaderCircle size={15} className="spin" /> Thinking about your data…</div>
            </div>
          )}
          {error && (
            <div className="coach-error">
              <Callout tone="critical" icon={TriangleAlert}>
                {error}{' '}
                <button type="button" className="btn btn-sm" style={{ marginLeft: 8 }} onClick={retry}>Retry</button>
              </Callout>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form
          className="coach-input"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <textarea
            ref={inputRef}
            className="textarea"
            rows={2}
            placeholder="Ask about your marks, targets, study plan, GATE prep, habits…"
            value={input}
            maxLength={4000}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            aria-label="Message the AI coach"
          />
          <button type="submit" className="btn btn-primary" disabled={busy || !input.trim()} aria-label="Send">
            <Send size={16} />
          </button>
        </form>
        <div className="row between wrap tiny muted" style={{ gap: 8 }}>
          <span className="row-sm"><Info size={12} /> AI can make mistakes. Official numbers are in LifeOS; estimates are labelled.</span>
          <SnapshotPreview context={context} />
        </div>
      </div>
    </div>
  );
}
