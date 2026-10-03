<p align="center">
  <img src="client/public/logo.jpg" alt="LifeOS" width="140" />
</p>

<h1 align="center">LifeOS</h1>
<p align="center"><b>Personal Academic + Study + Goal + Lifestyle + Productivity Intelligence System</b></p>

LifeOS is a personal command center for students. It records your academic performance, study,
attendance, goals, competitive-exam preparation, submissions, exams and lifestyle, then turns that
history into understanding: where you stand, where you are slipping, what you need to score, and
what to focus on today.

---

## Highlights

| Area | What you get |
|---|---|
| **Command Center** | One-screen status: CGPA/SGPA (confirmed vs projected), targets, study today/this week, attendance, risks, strong/weak subjects, goals, deadlines, exams, insights, achievements, recent activity and a *Recommended for today* plan. Widgets are toggleable. |
| **Life Orbit 3D** | Interactive Three.js scene: each life area is a planet coloured by health with a score ring. Rotate, zoom, select a planet to fly to it and see what affects it, then jump into that area. Lazy-loaded, with a flat fallback when WebGL is unavailable. |
| **Your grading system** | Configure grade names, minimum %, grade points, passing marks, component minimum-pass rules (e.g. 35% in end-sem), credit rules (count/exclude failed credits), CGPA method (credit-weighted or SGPA average) and assessment templates (mid-sems, assignments, quizzes, attendance marks, practicals, viva, projects, NPTEL/MOOC, internal/external…). |
| **Semesters & subjects** | Unlimited semesters (past ones can be just *official SGPA + credits*), subjects with credits, combined or **separate theory/practical credits**, faculty, difficulty, strength, target grade, official grades, timetable. |
| **Marks** | Every component shows obtained/max, %, weight and contribution. Marks are **confirmed, expected, estimated or pending** — never mixed. Hypothetical values exist only in the simulator. |
| **SGPA / CGPA** | Transparent calculation tables (credits × grade points ÷ credits) per semester and cumulatively, with confirmed and projected values kept apart. Changing marks, credits or rules recalculates everything instantly. |
| **Target calculator** | Required % on all remaining assessments, an efficient credit-aware grade plan, minimum grade needed per subject, high-impact subjects, subject target status, and CGPA target planning across remaining semesters. |
| **What-if simulator** | Change any mark hypothetically (e.g. *CN Mid-2 = 15/20*) and see grade, SGPA, CGPA and target effects side by side. Clearly labelled as simulation; nothing is saved. |
| **Attendance** | Mark individual lectures/labs/tutorials per day (pre-filled from your timetable), with subject-wise %, “can still miss” / “must attend” margins, risk levels and end-of-semester projection. |
| **Study tracker** | Sessions by subject, topic, type, goal and productivity; daily → yearly analytics, streaks, consistency and a 26-week heatmap. |
| **Goals & GATE** | Unlimited goals (pause, archive, complete, delete) measured by manual value, milestones, study hours, tasks, CGPA, SGPA or exam syllabus progress. Competitive-exam tracker with subjects (pre-filled GATE CSE weightage), topics, weak/strong topics, lectures, questions, revisions, weekly targets and mock tests. |
| **Submissions, exams, tasks** | Deadlines, statuses (not started → missed), marks, links, preparation tracking and results. |
| **Daily logbook** | Academic, lifestyle and productivity logging, plus your own **custom fields**. |
| **Lifestyle** | Sleep, screen time, social media, exercise, mood and productivity trends, an “average day”, and lifestyle ↔ productivity patterns once enough data exists (explicitly *correlation, not causation*). |
| **AI Coach (optional)** | Chat with an OpenAI-powered coach about your progress — study plans, target strategies, weekly reviews, GATE advice. It reasons over a privacy-conscious summary of LifeOS’s own calculations (never your name, email or notes), only after you enable it, and you can view exactly what is shared. |
| **Intelligence** | Area-of-improvement engine and recommendations (credit weight, target gaps, theory vs practical, internal vs external, study allocation vs need, declining marks, deadlines, attendance, goals behind schedule, consistency, lifestyle), predictions with ranges and confidence, and *Your questions, answered*. |
| **History** | Timeline of results, marks entered, grade changes, goals, milestones, study, submissions, exams, logs and achievements over months and years. |
| **Accounts & admin approval** | Email + password sign-up creates a *pending* request; the administrator is emailed, reviews it in the Admin Dashboard and approves, rejects, suspends, reactivates or deletes accounts. Every user’s data is completely private to their account. |
| **Everything else** | Global search (Ctrl/⌘ K) and advanced filters, reminders (in-app + optional browser notifications), dark/light themes with accent colours, reduced motion, responsive down to phones, full export (JSON/CSV), import (merge/replace), delete data or account. |

## Tech stack

- **Client:** React 19, Vite, React Router, Recharts, Three.js via React Three Fiber + drei, lucide icons, date-fns. Plain CSS with design tokens (no CSS framework).
- **Server:** Node.js (22.9+), Express 5, Mongoose 9, server-side sessions in HttpOnly cookies, bcrypt password hashing, Helmet, rate limiting, compression, Nodemailer (SMTP email).
- **AI (optional):** OpenAI Chat Completions API (default model `gpt-6-luna`), or any OpenAI-compatible API via `OPENAI_BASE_URL`.
- **Database:** MongoDB Atlas.
- **Device mode (off by default):** an optional no-account mode that keeps data only in the browser. Because it bypasses admin approval it is disabled unless the client is built with `VITE_ALLOW_DEVICE_MODE=true`. Data saved this way by earlier versions can be imported into an account (LifeOS offers this after sign-in).

All calculations (grades, SGPA/CGPA, targets, predictions, insights) run in pure, framework-free modules in `client/src/logic/`, so they are easy to read, test and change.

## Project structure

```
LifeOS/
├─ package.json              # npm workspaces: client + server; dev/build/start scripts
├─ render.yaml               # one-service deploy blueprint (Render)
├─ client/                   # React app (Vite)
│  ├─ index.html
│  ├─ public/                # logo, icons, web manifest, SPA redirect rules
│  ├─ vercel.json            # SPA rewrites when hosting the client on Vercel
│  └─ src/
│     ├─ main.jsx, App.jsx   # entry, providers, routing (pages are code-split)
│     ├─ assets/brand/       # original logo artwork
│     ├─ styles/             # tokens (themes), base, layout, components, pages
│     ├─ lib/                # dates, formatting, ids, collections, storage adapters
│     │  └─ adapters/        # remote.js (API) · local.js (device mode)
│     ├─ store/              # session, data (records + derived analysis), quick forms
│     ├─ logic/              # academics, targets, attendance, study, goals, competitive,
│     │                      # lifestyle, insights, predictions, notifications,
│     │                      # achievements, timeline, search, analysis (orchestrator)
│     ├─ hooks/              # theme, form state, saving marks, goal actions
│     ├─ components/
│     │  ├─ ui/              # cards, fields, modal, badges, progress, feedback (toasts/confirm)
│     │  ├─ layout/          # app shell, sidebar, command palette, notifications, brand
│     │  ├─ charts/          # chart kit (tooltip/legend/table view), calendar heatmap
│     │  ├─ three/           # Life Orbit 3D scene + lazy/fallback wrapper
│     │  ├─ forms/           # semester, subject, marks, study, assignment, exam, goal, task
│     │  ├─ goals/           # competitive-exam tracker
│     │  └─ settings/        # settings sections
│     └─ pages/              # one file per route
└─ server/                   # Express API
   ├─ .env.example
   └─ src/
      ├─ index.js, app.js, config.js, db.js
      ├─ middleware/auth.js
      ├─ models/             # one Mongoose model per collection
      ├─ routes/             # auth, data (generic CRUD per collection), account
      └─ utils/              # http errors/sanitising, cascade deletes, import/export
```

## Getting started

### 1. Prerequisites

- Node.js **22.9 or newer** (`node -v`)
- A free **MongoDB Atlas** cluster

### 2. Create the Atlas database

1. Create a cluster at [cloud.mongodb.com](https://cloud.mongodb.com) (the free M0 tier is enough).
2. **Database Access** → add a database user with a strong password.
3. **Network Access** → allow your IP (and your host’s outbound IPs when deployed; `0.0.0.0/0` works but is less strict).
4. **Connect → Drivers** → copy the connection string and add the database name, e.g.
   `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/lifeos?retryWrites=true&w=majority`

### 3. Configure and run

```bash
npm install
cp server/.env.example server/.env    # then set MONGODB_URI, SESSION_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
npm run dev
```

- Web app: http://localhost:5173 (Vite proxies `/api` to the API)
- API: http://localhost:4000 (`GET /api/health`)

Generate a session secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

On first start the API creates the administrator from `ADMIN_EMAIL` / `ADMIN_PASSWORD` (see [Accounts & administration](#accounts--administration)). Sign in with those details to reach the Admin Dashboard.

### Environment variables

| Variable | Where | Description |
|---|---|---|
| `MONGODB_URI` | server | Atlas connection string (required) |
| `SESSION_SECRET` | server | ≥ 32-character secret protecting login sessions (required; `JWT_SECRET` from older setups also works) |
| `SESSION_DAYS` | server | Days a login stays valid without activity, default `14` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | server | Creates the single administrator on first start (password ≥ 12 chars). Delete `ADMIN_PASSWORD` afterwards |
| `ADMIN_RESET_PASSWORD` | server | `true` + a new `ADMIN_PASSWORD` resets a forgotten admin password on restart |
| `ADMIN_NOTIFY_EMAIL` | server | Where registration emails go, default `ADMIN_EMAIL` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `MAIL_FROM` | server | Outgoing email. `MAIL_TRANSPORT=console` prints emails to the terminal instead (development) |
| `NOTIFY_USERS` | server | Email users when approved/rejected, default `true` |
| `APP_URL` | server | Public web-app URL used in email links |
| `COOKIE_SECURE` / `COOKIE_SAMESITE` | server | Override session-cookie defaults (Secure in production; SameSite=Lax, or None when `CORS_ORIGIN` is set) |
| `PORT` | server | API port, default `4000` |
| `CORS_ORIGIN` | server | Comma-separated allowed origins — only when the client is hosted on a different domain |
| `NODE_ENV` | server | `production` when deployed |
| `OPENAI_API_KEY` | server | Enables the AI Coach (optional). Get one at platform.openai.com/api-keys |
| `OPENAI_MODEL` | server | AI model, default `gpt-6-luna` |
| `OPENAI_REASONING_EFFORT` | server | `none`/`low`/`medium`/`high`, default `low` |
| `OPENAI_BASE_URL` | server | OpenAI-compatible endpoint, default `https://api.openai.com/v1` |
| `VITE_ALLOW_DEVICE_MODE` | client | `true` re-enables no-account device mode (bypasses approval) |
| `VITE_API_URL` | client | API base URL — only when the client is hosted separately (e.g. `https://lifeos-api.onrender.com`) |

## Accounts & administration

**Workflow:** a visitor chooses *Create account* and submits email + password → the account is created as **role user, status pending** (no session is created) → the administrator is emailed → the admin opens the **Admin Dashboard** (sign in with the admin email; it opens at `/admin`) → **Approve** makes the account active, and the user is emailed and can sign in to their own, empty LifeOS workspace. **Reject** keeps the account unable to sign in.

**Statuses:** `pending` and `rejected` can’t sign in; `active` can; `suspended` is signed out everywhere immediately and can’t sign in until reactivated. Status is enforced by the API on every request, not just in the UI.

**Admin Dashboard:** pending requests, active, rejected and suspended users, all users with search, registration history (every status change), and the admin password. Only account details (email, dates, status) are visible — never anyone’s LifeOS data. Pending and rejected requests can be deleted; active accounts can be suspended (not deleted) so nobody’s data is lost by accident.

**The administrator account** is configured on the server only — never through sign-up:
- set `ADMIN_EMAIL` and `ADMIN_PASSWORD` (≥ 12 characters) in `server/.env`; it is created on start, after which `ADMIN_PASSWORD` can be deleted; or
- run `npm run admin:create` (prompts with hidden password input). Forgot it? `npm run admin:reset-password`.

The admin account manages accounts only and has no personal LifeOS workspace; use a separate normal account for your own data.

**Email:** any SMTP provider. For Gmail, enable 2-step verification, create an [App Password](https://myaccount.google.com/apppasswords), and set `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_USER`, `SMTP_PASS`. Without SMTP, `MAIL_TRANSPORT=console` prints the emails in the API terminal; registrations always appear in the Admin Dashboard regardless.

**Existing data:** accounts created before approval existed are kept **active** automatically on first start, with all of their records untouched.

## AI Coach

1. Create an API key at [platform.openai.com/api-keys](https://platform.openai.com/api-keys) (requires billing on your OpenAI account).
2. Put it in `server/.env` as `OPENAI_API_KEY=...` and save — the API restarts automatically in development.
3. Open **AI Coach** in the sidebar, review what is shared, and enable it.

The key never leaves the server. Each question sends the conversation plus a computed summary (grading rules, SGPA/CGPA, subjects with credits and projected grades, targets, study totals, goals, deadlines, attendance, LifeOS insights and — if allowed — lifestyle averages). Requests are rate-limited per user. Device mode can’t use the coach because the key lives on the server.

## Troubleshooting

| What you see | Fix |
|---|---|
| `MONGODB_URI still contains the placeholder <db_username>` | Replace `<db_username>` and `<db_password>` **including the `<` `>` brackets** with the database user and password from Atlas → Database Access. |
| `bad auth : Authentication failed` | Wrong database username/password. Use a *database user* (Atlas → Database Access), not your Atlas website login. Percent-encode special characters in the password (`@` → `%40`, `#` → `%23`, `/` → `%2F`, `:` → `%3A`). |
| `Could not reach the Atlas cluster` / timeouts | Atlas → Network Access → add your current IP address. |
| `Can’t reach the LifeOS API server` in the app | The API isn’t running — run `npm run dev` from the project folder and read the `[api]` lines in the terminal. |
| The web app starts on port 5174 | Something else is using 5173; stop it, or just use the URL Vite prints. |
| “No administrator account yet” in the API terminal | Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` (≥ 12 chars) in `server/.env` and save, or run `npm run admin:create`. |
| “… already belongs to a regular LifeOS account” | `ADMIN_EMAIL` must be an email that isn’t used by a normal account. |
| Sign-in says “waiting for approval” | Expected for new accounts — approve it in the Admin Dashboard. |
| AI Coach says it isn’t switched on | Set `OPENAI_API_KEY` in `server/.env` and save. “Rejected the API key” or “quota” errors come from your OpenAI account (key or billing). |

Saving `server/.env` restarts the API automatically during `npm run dev`.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | API (with watch) + web app together |
| `npm run dev:client` / `npm run dev:server` | Run one side only |
| `npm run build` | Production build of the client into `client/dist` |
| `npm start` | Start the API; it also serves `client/dist` when present |
| `npm run admin:create` | Create the administrator interactively (hidden password prompt) |
| `npm run admin:reset-password` | Reset the administrator password |

## Deployment

### Option A — single service (recommended)

The API serves the built client, so one Node service hosts everything.

- **Render:** push the repo and create a *Blueprint* from `render.yaml`, then set `MONGODB_URI`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `APP_URL` and the `SMTP_*` values in the dashboard (`SESSION_SECRET` is generated).
- **Any Node host** (Railway, Fly.io, a VPS…): build command `npm ci && npm run build`, start command `npm start`, and set `NODE_ENV=production`, `MONGODB_URI`, `SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `APP_URL` and `SMTP_*`.

Remember to allow the host’s IPs in Atlas → Network Access.

### Option B — separate client and API

1. Deploy the API (`server/`) as above, with `CORS_ORIGIN=https://your-client-domain` (session cookies then use `SameSite=None; Secure`, so both sites must use HTTPS).
2. Deploy `client/` to Vercel or Netlify with build command `npm run build`, output `dist`, and `VITE_API_URL=https://your-api-domain`. SPA routing is preconfigured (`client/vercel.json`, `client/public/_redirects`).

## How the numbers work

- **Component score** = obtained ÷ max × weight. Weights are relative and scaled if they don’t total 100.
- **Grade** comes from your scale; below the passing % — or below a component’s minimum-pass % — gives the fail grade. An **official grade** always overrides calculated values.
- **SGPA** = Σ(credits × grade points) ÷ Σ credits. Subjects with separate theory/practical credits contribute two graded parts.
- **CGPA** = credit-weighted SGPAs (or a simple SGPA average, if your university uses that). *Confirmed CGPA* uses only confirmed/official results; *projected* adds the current semester’s estimate.
- **Projections** fill pending assessments with your current performance rate in that subject (or your semester average). No projection is shown until something has been assessed. Ranges and confidence are shown alongside, and every estimate is labelled.
- **Targets** solve for the score needed on remaining work, assuming entered expected/estimated marks hold.

## Data model

Every record belongs to one user and lives in its own collection:
`semesters`, `subjects` (with embedded assessment components), `studySessions`, `dailyLogs`,
`attendance`, `assignments`, `exams`, `goals` (with milestones and an optional competitive-exam
tracker), `tasks`, `events` (timeline entries). Every record carries the owning `userId`, and every
query is scoped to the signed-in user. The `users` collection stores the email, bcrypt password
hash, role (`user`/`admin`), status, status history, profile, grading rules and preferences; the
`sessions` collection stores hashed session tokens with automatic expiry.

Deleting cascades so removed data never affects calculations: a semester removes its subjects; a
subject removes its marks, attendance, assignments and exams (study sessions and tasks are kept
but unlinked); a goal unlinks its sessions, tasks and exams.

## Privacy & security

- LifeOS stores only what you enter, uses it only to compute your own analytics, and includes no third-party trackers.
- Export everything (JSON, or CSV per collection), import into any account (ids are remapped), delete all records or the whole account at any time.
- **Passwords** are stored only as bcrypt hashes and are never returned by any API or shown to the administrator.
- **Sessions** are random tokens in an HttpOnly, SameSite cookie (Secure in production); only a keyed hash is stored. Logging out, suspension and password changes revoke sessions on the server immediately, and expired sessions are deleted automatically.
- **Isolation:** every personal-data API requires an active user session, every query is filtered by the signed-in user, and every reference in a request (semester, subject, goal, timetable slot) must belong to that user — so changing an id, URL, body or browser storage can’t reach another user’s data. Analytics, predictions, insights and the AI coach only ever see the signed-in user’s records.
- **Admin protection:** admin APIs require the admin role on the server; the admin account can’t read personal LifeOS data.
- **Other:** CSRF protection (a custom header is required on every state-changing request), rate-limited auth endpoints, generic sign-in errors that don’t reveal which emails exist, payload sanitising against operator injection, and a strict Content-Security-Policy via Helmet. Secrets (database, session, SMTP, OpenAI) exist only in server environment variables.

## Accessibility

Keyboard-navigable throughout (command palette, focus-trapped dialogs, skip link), visible focus
states, status always shown with icon + text (never colour alone), every chart has a table view,
colour-blind-safe chart palette validated for both themes, and a reduced-motion setting.
