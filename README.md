<p align="center">
  <img src="client/public/logo.jpg" alt="LifeOS" width="140" />
</p>

<h1 align="center">LifeOS</h1>
<p align="center">A personal academic, study, goal, lifestyle and productivity intelligence system.</p>

---

## Overview

Academic records, study time, goals and daily habits usually end up in different places: marks in a
university portal, attendance in a notebook, GATE preparation in a spreadsheet, sleep and screen time
in phone settings. None of them answer the questions that actually matter during a semester. *What
SGPA am I heading for? What do I need in the end-sem to reach my target? Which subject needs my time
this week? Is my preparation on pace?*

LifeOS brings all of it into one application. You record your semesters, subjects, marks, attendance,
study sessions, goals, deadlines and daily logs. LifeOS calculates your grades, SGPA and CGPA using
your own university's rules, then turns that history into targets, simulations, projections and
specific recommendations.

It is a multi-user web app. Each person has a private workspace, new accounts are approved by an
administrator, and nobody, including the administrator, can see another user's data.

## Features

**Academics**
- University profile with a fully configurable grading system: grade names, minimum percentages,
  grade points, passing marks, per-component minimum-pass rules, credit rules and CGPA method
  (credit-weighted or SGPA average). Presets for common 10-point and 4.0 scales.
- Semesters with a weekly timetable (past semesters can be just an official SGPA and credits), and
  subjects with credits, optional separate theory/practical credits, faculty, difficulty and target
  grade.
- Marks per assessment component (mid-sems, internals, assignments, quizzes, practicals, viva,
  projects, NPTEL/MOOC, end-sem…), each tagged as **confirmed, expected, estimated or pending**.
- SGPA and CGPA with transparent calculation tables. Confirmed and projected values are always kept
  apart, and official results override calculated ones.
- **Target calculator**: required score on remaining assessments, a credit-aware grade plan, minimum
  grade per subject, high-impact subjects and CGPA planning across remaining semesters.
- **What-if simulator**: change any mark hypothetically and see the effect on grades, SGPA and CGPA.
  Nothing is saved.
- Lecture-level **attendance**: per-day marking pre-filled from the timetable, subject-wise
  percentages, "can still miss / must attend" margins and an end-of-semester projection.
- **Submissions** with deadlines and statuses (not started, in progress, submitted, late, missed),
  and **exams** with preparation tracking and results.

**Growth**
- **Study tracker**: sessions by subject, topic, type, goal and productivity, with daily to monthly
  totals, streaks, consistency and a calendar heatmap.
- **Goals** measured by a manual value, milestones, study hours, linked tasks, CGPA, SGPA or exam
  syllabus coverage, with pace tracking and a completion estimate. Goals can be paused, archived,
  completed or deleted.
- **Competitive-exam tracker** (GATE and similar): subjects with weightage (GATE CSE pre-filled),
  topics with status and confidence, lectures, questions solved, revisions, weekly targets and mock
  tests.
- Tasks linked to subjects and goals.

**Life**
- **Daily logbook**: academic activity, sleep, screen time, social media, exercise, mood,
  productivity, planned vs completed work, notes, plus your own **custom fields**.
- **Lifestyle** trends, an "average day" view, and lifestyle ↔ productivity relationships once enough
  data exists.

**Intelligence**
- **Command Center** dashboard: academic status, targets, study, attendance, risks, deadlines,
  goals, insights, achievements and a *Recommended for today* plan. Widgets can be turned on or off.
- **Life Orbit 3D**: an interactive Three.js view where each area of your life is a planet coloured
  by its health.
- **Insights & predictions**: area-of-improvement analysis, recommendations and estimates with ranges
  and confidence levels.
- **Analytics** across academics, study, lifestyle, tasks and attendance. Charts can be switched to a
  table view.
- **Timeline** of results, marks, grade changes, goals, study, submissions, exams and logs.
- **AI Coach** (optional, off unless the server has an OpenAI API key and the user turns it on).

**Accounts and everything else**
- Email and password accounts with **administrator approval**, and an **Admin Dashboard** to
  approve, reject, suspend, reactivate or remove registration requests.
- Global search with filters and a command palette (Ctrl/⌘ + K).
- In-app reminders, with optional browser notifications.
- Dark and light themes, accent colours, reduced-motion setting and a responsive layout down to phone
  width.
- Full export (JSON, or CSV per collection), import (merge or replace), and deletion of all data or
  the whole account.

## Tech stack

| Area | Technologies |
|---|---|
| Frontend | React 19, Vite, React Router, plain CSS with design tokens |
| Charts | Recharts |
| 3D | Three.js via React Three Fiber and drei |
| UI utilities | lucide-react icons, date-fns |
| Backend | Node.js 22, Express 5 |
| Database | MongoDB Atlas with Mongoose |
| Authentication | Server-side sessions in HttpOnly cookies, bcrypt password hashing |
| Security middleware | Helmet (Content-Security-Policy), express-rate-limit, CORS |
| Email | Nodemailer over SMTP |
| AI Coach (optional) | OpenAI Chat Completions API, or any OpenAI-compatible endpoint |
| Deployment | Render (Blueprint in `render.yaml`); the client can also be hosted on Vercel or Netlify |
| Tooling | npm workspaces, concurrently |

All calculations (grades, SGPA/CGPA, targets, attendance, goals, predictions, insights) live in plain
JavaScript modules in `client/src/logic/`, separate from the UI.

## How it works

### Academic system

Every university grades differently, so nothing is hard-coded. In **Settings → Grading** you define
the grade scale (grade, minimum %, grade points), the passing percentage, minimum-pass rules for
individual components (for example 35% in the end-sem), whether failed credits count, how CGPA is
calculated, and reusable **assessment templates** that new subjects start from.

A subject is made of weighted components, for example *Mid-sem 1 (20)*, *Assignments (10)*,
*End-sem (70)*. Each component can be internal or external and theory or practical. A subject can
be graded as one unit or as separate theory and practical parts with their own credits.

- **Component score** = obtained ÷ max × weight. Weights are relative and are scaled if they don't
  add up to 100.
- **Grade** comes from your scale. Falling below the passing percentage, or below a component's
  minimum-pass rule, gives the fail grade. An official grade always overrides the calculation.
- **SGPA** = Σ(credits × grade points) ÷ Σ credits, where split subjects contribute two graded parts.
- **CGPA** = credit-weighted SGPAs, or a simple SGPA average if your university uses that.
  *Confirmed CGPA* uses only confirmed or official results. *Projected CGPA* adds the current
  semester's estimate.

Each mark has a **data state**. *Confirmed* marks are official. *Expected* and *estimated* marks are
your own provisional numbers and are only used for projections. *Pending* components haven't been
assessed yet. *Hypothetical* values exist only inside the simulator. The states are never mixed
silently.

**Targets** solve for the score needed on the remaining assessments. The **what-if simulator**
applies temporary overrides to the same calculation engine, so its numbers always match the real
ones.

### Goals and study tracking

Study sessions record date, duration, subject or exam subject, topic, type (lecture revision,
problem solving, coding, project, …), productivity and an optional goal. LifeOS turns them into daily, weekly
and monthly totals, subject- and goal-wise breakdowns, streaks and a consistency score.

A goal measures progress by one metric: a manual value, completed milestones, study hours, linked
tasks, CGPA or SGPA, or syllabus coverage of a competitive exam. LifeOS compares progress with the
time elapsed to label the pace (ahead, on track, behind, at risk) and estimates the likelihood of finishing
on time from recent progress. Grade-based goals are judged by the projected value rather than by
elapsed time, because grades only move when results arrive.

The **competitive-exam tracker** lives inside a goal: exam subjects with weightage, topics marked
not started → learning → completed → revised with a confidence level, lecture and question counts,
revisions, weekly hour targets and mock-test scores. Syllabus coverage is weighted by marks
weightage and compared against the date you want to finish the syllabus.

### Lifestyle tracking

The daily logbook records sleep (hours, bed and wake time), screen time, social media, exercise,
entertainment, breaks, mood, productivity, tasks planned/completed/skipped and notes. You can add
your own numeric, yes/no, rating or text fields.

The Lifestyle page shows trends, averages and an "average day". When at least 10 days of paired data
exist, LifeOS reports relationships between lifestyle metrics and study or productivity using
Pearson correlation, and only when the correlation is meaningful (|r| ≥ 0.3). These are presented as
patterns in your data, **not** as causes.

### Analytics, predictions and recommendations

- **Analytics**: SGPA/CGPA trend against target, subject performance against target, theory vs
  practical, internal vs external, credit-weighted contribution, semester comparison, weekly and
  monthly study, study by subject and goal, lifestyle trends, task completion (completed, late,
  missed) and subject-wise attendance.
- **Predictions**: projected SGPA and CGPA with a range based on the spread of your marks, subject
  risk (failing or missing the target), deadline risk, end-of-semester attendance and study-hour
  projections. Pending components are filled with your current scoring rate, and nothing is projected
  until at least one component has been assessed. Every prediction is labelled as an estimate with a
  confidence level.
- **Recommendations**: the improvement engine checks target gaps, credit weight, weak components,
  declining marks, study time vs need, consistency, deadlines, attendance, goals behind schedule
  and lifestyle patterns. Each recommendation links to the page where you can act on it, and
  *Recommended for today* turns them into a short daily plan.

### Life Orbit 3D

The 3D view shows each area (academics, study, goals, attendance, lifestyle, …) as a planet whose
colour reflects its health and whose ring shows its score. You can rotate, zoom, and select a planet
to see what drives it. The 3D library is loaded only when this view opens. Devices without WebGL get
a flat fallback, and the view can be turned off in Settings.

### AI Coach (optional)

When the server has an `OPENAI_API_KEY`, users can chat with a coach about study plans, target
strategies and weekly reviews. It only works after the user enables it. It receives a summary built
from LifeOS's own calculations (never the user's name, email, notes or individual log entries), and
the user can view exactly what is shared. The API key stays on the server.

## Authentication and admin approval

- **Registration**: anyone can request an account with an email and password. The account is
  created as a regular user with status **pending**. No session is created, and the role can never be
  chosen by the client.
- **Admin notification**: the administrator is emailed about the request (when SMTP is configured)
  and can always see it in the Admin Dashboard.
- **Approval**: the administrator approves or rejects the request. Approved users are emailed and can
  sign in to their own empty workspace. Pending, rejected and suspended accounts cannot sign in, and
  each gets a clear message explaining why.
- **Sessions**: signing in creates a server-side session referenced by a random token in an
  HttpOnly cookie. Sessions expire after a period of inactivity (14 days by default).
- **Logout and revocation**: logging out deletes the session on the server. Suspending an account or
  changing a password ends that account's other sessions immediately.
- **Administrator**: there is exactly one admin account. It is created from server environment
  variables or a CLI command, never through sign-up. It manages accounts only, has no personal
  workspace, and cannot read anyone's LifeOS records.
- **Isolation**: every personal-data request is authorised on the server and scoped to the signed-in
  user. References inside a request (semester, subject, goal, timetable slot) must also belong to that
  user. Changing a URL, an id, a request body or browser storage therefore cannot reach another
  user's data.

Accounts that existed before approval was introduced are kept **active** automatically, with their
data untouched.

## Project structure

```
LifeOS/
├── package.json            npm workspaces (client, server) and top-level scripts
├── render.yaml             Render Blueprint: one web service for API + client
├── .nvmrc                  Node version
├── client/                 React application (Vite)
│   ├── index.html
│   ├── vite.config.js      dev proxy to the API, chunking
│   ├── vercel.json         SPA rewrites if the client is hosted on Vercel
│   ├── .env.example
│   ├── public/             logo, icons, web manifest, Netlify SPA redirects
│   └── src/
│       ├── main.jsx        entry point
│       ├── App.jsx         providers, auth gate, routes (pages are lazy-loaded)
│       ├── logic/          calculation engine: academics, targets, attendance, study,
│       │                   goals, competitive exams, lifestyle, insights, predictions,
│       │                   notifications, achievements, timeline, search, analysis
│       ├── store/          session, data (records + derived analysis), quick-entry forms
│       ├── lib/            dates, formatting, ids, collections
│       │   └── adapters/   remote.js (API client) and local.js (optional device mode)
│       ├── hooks/          theme, form state, saving marks, goal actions
│       ├── components/
│       │   ├── ui/         cards, fields, modal, badges, feedback (toasts, confirm)
│       │   ├── layout/     app shell, sidebar, command palette, notifications, brand
│       │   ├── charts/     chart kit with table view, calendar heatmap
│       │   ├── three/      Life Orbit 3D scene and its fallback
│       │   ├── forms/      semester, subject, marks, study, assignment, exam, goal, task
│       │   ├── goals/      competitive-exam tracker
│       │   └── settings/   settings sections
│       ├── pages/          one component per route
│       │   └── admin/      Admin Dashboard
│       └── styles/         design tokens, base, layout, components, pages
└── server/                 Express API
    ├── .env.example
    └── src/
        ├── index.js        startup: config check, database, bootstrap, HTTP server
        ├── app.js          middleware, routes, serves client/dist in production
        ├── config.js       environment configuration and validation
        ├── db.js           MongoDB connection
        ├── middleware/     authentication and role checks
        ├── models/         Mongoose models (users, sessions and one per record type)
        ├── routes/         auth, data, account, admin, ai
        ├── services/       admin bootstrap, email
        ├── ai/             AI Coach provider client and instructions
        ├── scripts/        admin CLI (create / reset password)
        └── utils/          errors, sanitising, sessions, ownership checks,
                            cascade deletes, import/export
```

## Getting started

### Prerequisites

- **Node.js 22.9 or newer** (`node -v`). The repository includes an `.nvmrc`.
- A **MongoDB Atlas** account. The free M0 cluster is enough.

### 1. Clone and install

```bash
git clone https://github.com/digigrowexpress-boop/lifeos1.git
cd lifeos1
npm install
```

`npm install` at the root installs both workspaces (`client` and `server`).

### 2. Set up the database

1. Create a cluster at [cloud.mongodb.com](https://cloud.mongodb.com).
2. **Database Access** → add a database user with a password. This is separate from your Atlas
   login.
3. **Network Access** → add your current IP address.
4. **Connect → Drivers** → copy the connection string, fill in the user and password, and add the
   database name `lifeos` before the `?`:
   `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/lifeos?retryWrites=true&w=majority`

There are no migration scripts to run. Mongoose creates the collections and indexes on first use.
On every start the server also:
- keeps accounts from before admin approval existed active (non-destructive, only fills in a missing
  status), and
- creates the administrator account if `ADMIN_EMAIL` and `ADMIN_PASSWORD` are set and no admin
  exists yet.

### 3. Configure environment variables

```bash
cp server/.env.example server/.env
```

On Windows (PowerShell): `Copy-Item server\.env.example server\.env`

Then edit `server/.env` and set at least:

- `MONGODB_URI`: your connection string
- `SESSION_SECRET`: a random string of 32+ characters, which you can generate with
  `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
- `ADMIN_EMAIL` and `ADMIN_PASSWORD` (12+ characters): the administrator account
- `MAIL_TRANSPORT=console`: for local development without SMTP, which prints emails in the terminal

The client needs no `.env` for local development.

### 4. Run

```bash
npm run dev
```

- Web app: http://localhost:5173. Vite proxies `/api` to the API.
- API: http://localhost:4000. `GET /api/health` reports the status.

On the first start the terminal shows `[auth] administrator account created for …`. Sign in with the admin
email to open the Admin Dashboard. Then use **Create account** with a different email, approve it in
the dashboard, and sign in with it to start using LifeOS. A short setup asks for your university,
grading scale and current semester.

Instead of `ADMIN_PASSWORD` in `.env` you can run `npm run admin:create`, which prompts for the
password with hidden input. Once the admin exists, remove `ADMIN_PASSWORD` from `.env`.

## Environment variables

### Server (`server/.env`)

| Variable | Required | Purpose |
|---|---|---|
| `MONGODB_URI` | yes | MongoDB Atlas connection string |
| `SESSION_SECRET` | yes | Secret (32+ chars) used to hash session tokens. `JWT_SECRET` is accepted for older setups |
| `SESSION_DAYS` | | Days a session stays valid without activity (default `14`) |
| `ADMIN_EMAIL` | for setup | Email of the single administrator account |
| `ADMIN_PASSWORD` | for setup | Creates the administrator on start (12+ chars). Remove it afterwards |
| `ADMIN_RESET_PASSWORD` | | `true` together with a new `ADMIN_PASSWORD` resets the admin password on the next start |
| `ADMIN_NOTIFY_EMAIL` | | Where registration emails go (default `ADMIN_EMAIL`) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | for email | Outgoing mail server. Port 465 uses TLS automatically. `SMTP_SECURE` overrides it |
| `MAIL_FROM` | | Sender address (default `SMTP_USER`) |
| `MAIL_TRANSPORT` | | `console` prints emails to the server log instead of sending them (development) |
| `NOTIFY_USERS` | | `false` stops emailing users when their request is approved or rejected |
| `APP_URL` | in production | Public URL of the app, used for links in emails |
| `NODE_ENV` | in production | `production` enables secure cookies and hides setup details from visitors |
| `PORT` | | API port (default `4000`). Hosting platforms usually set it |
| `CORS_ORIGIN` | | Comma-separated origins allowed to call the API. Only needed when the client is hosted on a different domain |
| `COOKIE_SECURE`, `COOKIE_SAMESITE` | | Override the session cookie defaults |
| `OPENAI_API_KEY` | | Enables the AI Coach |
| `OPENAI_MODEL` | | Model for the AI Coach (default `gpt-6-luna`) |
| `OPENAI_REASONING_EFFORT` | | `none`, `low`, `medium` or `high` (default `low`) |
| `OPENAI_BASE_URL` | | OpenAI-compatible endpoint (default `https://api.openai.com/v1`) |

### Client (`client/.env`, optional)

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | API URL when the client is deployed separately from the API |
| `VITE_ALLOW_DEVICE_MODE` | `true` enables a no-account mode that keeps data only in the browser. It bypasses admin approval, so it is off by default |

Client variables are embedded in the public JavaScript bundle, so they must never contain secrets.
Every secret belongs in the server environment.

## Deployment

LifeOS is designed to run as a **single Node service**. The Express API serves the built React app
from `client/dist`, so the frontend and backend share one domain and no CORS configuration is
needed.

### Render (recommended)

1. **Atlas**: Network Access → add `0.0.0.0/0`. Render's free services don't have fixed outbound IP
   addresses, so this is required. Access is still protected by the database user and password.
2. **Render**: New → **Blueprint** → connect the GitHub repository. Render reads `render.yaml`:
   - build: `npm ci --include=dev && npm run build`
   - start: `npm start`
   - health check: `/api/health`
   - `NODE_ENV=production`, and `SESSION_SECRET` is generated automatically
3. Enter `MONGODB_URI`, `ADMIN_EMAIL` and `ADMIN_PASSWORD` when prompted, then deploy.
4. After the first deploy, open **Environment** and:
   - set `APP_URL` to your service URL (for example `https://lifeos-xxxx.onrender.com`)
   - add the `SMTP_*` variables and `MAIL_FROM` if you want email notifications
   - add `OPENAI_API_KEY` if you want the AI Coach
   - delete `ADMIN_PASSWORD` once you have signed in as the administrator
5. To use a custom domain, add it under Settings → Custom Domains, then update `APP_URL`.

On Render's free plan the service sleeps when idle, so the first request after a while can take
up to a minute. The app keeps retrying in the meantime.

### Any other Node host

Use the same commands. The build is `npm ci --include=dev && npm run build` (the build needs Vite,
a dev dependency). Start with `npm start`. Set `NODE_ENV=production`, `MONGODB_URI`,
`SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `APP_URL` and optionally the `SMTP_*` variables.

### Separate frontend and API (optional)

1. Deploy the API as above and set `CORS_ORIGIN=https://your-frontend-domain`. Session cookies
   then use `SameSite=None; Secure`, so both sites must be served over HTTPS.
2. Deploy `client/` to Vercel or Netlify with build command `npm run build`, output directory
   `dist`, and `VITE_API_URL=https://your-api-domain`. SPA routing is already configured
   (`client/vercel.json`, `client/public/_redirects`).

### Production checklist

- `NODE_ENV=production`
- a unique, random `SESSION_SECRET`
- `ADMIN_PASSWORD` removed after the administrator exists
- `APP_URL` pointing at the public URL
- Atlas Network Access allows the host
- `/api/health` returns `{"ok":true,"db":"connected"}`

## Security

- **Passwords** are hashed with bcrypt and never stored in plaintext, returned by the API or shown to
  the administrator.
- **Sessions** use random tokens in HttpOnly cookies (Secure in production). The database stores
  only a keyed hash of each token. Logout, suspension and password changes revoke sessions on the
  server.
- **Authorisation is enforced on the server** for every request: account status, role (admin APIs
  require the admin role, and the admin account cannot use personal-data APIs) and record ownership.
- **Data isolation**: every database query is scoped to the signed-in user, and cross-record
  references are checked for ownership.
- **Request hardening**: CSRF protection on state-changing requests, rate limiting on sign-in,
  registration and AI requests, sanitising against MongoDB operator injection, and a strict
  Content-Security-Policy through Helmet.
- **Safe errors**: sign-in errors don't reveal which emails are registered, unexpected errors return
  a generic message, and in production configuration problems are logged on the server rather than
  shown to visitors.
- **Secrets** (database, session, SMTP, OpenAI) exist only in server environment variables. `.env`
  files are ignored by Git.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Run the API (auto-restarts on changes) and the web app together |
| `npm run dev:server` / `npm run dev:client` | Run one side only |
| `npm run build` | Build the client into `client/dist` |
| `npm start` | Start the API in production mode; it serves `client/dist` if present |
| `npm run admin:create` | Create the administrator interactively |
| `npm run admin:reset-password` | Reset the administrator password |

## Troubleshooting

| Message | What to do |
|---|---|
| `MONGODB_URI still contains the placeholder <db_username>` | Replace `<db_username>` and `<db_password>`, including the `<` `>` brackets, with your Atlas database user and password |
| `bad auth : Authentication failed` | Use a database user from Atlas → Database Access (not your Atlas login). Percent-encode special characters in the password (`@` → `%40`, `#` → `%23`, `/` → `%2F`, `:` → `%3A`) |
| `Could not reach the Atlas cluster` | Add your IP address in Atlas → Network Access |
| `Can't reach the LifeOS API server` | The API isn't running. Start it with `npm run dev` and check the `[api]` lines in the terminal |
| `no administrator account yet` | Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` (12+ characters) and restart, or run `npm run admin:create` |
| `already belongs to a regular LifeOS account` | `ADMIN_EMAIL` must not be the email of an existing user account |
| Sign-in says the account is waiting for approval | Approve the request in the Admin Dashboard |
| Deployed app says it is temporarily unavailable | Check the service logs. The server prints the exact configuration or database problem there |

During `npm run dev`, saving `server/.env` restarts the API automatically.

## Future improvements

- Automated tests for the calculation engine and the API, run in CI on every push
- Self-service "forgot password" by email (today users change their password while signed in, and
  only the admin password can be reset from the server)
- Email verification at sign-up and two-factor authentication for the administrator
- Offline support through a service worker
- Calendar (iCal) export for deadlines and exams
- CSV import of marks and attendance from university portals
