<p align="center">
  <img src="public/favicon.svg#gh-light-mode-only" width="72" height="72" alt="OpenRouter Studio" />
  <img src="public/favicon_dark.svg#gh-dark-mode-only" width="72" height="72" alt="OpenRouter Studio" />
</p>

# OpenRouter Studio

<p align="center">
  A <strong>visual node canvas</strong> for chaining <strong>LLM</strong>, <strong>image</strong>, and <strong>video</strong> models through <a href="https://openrouter.ai">OpenRouter</a>. Wire nodes, run pipelines, no glue code.
</p>

<p align="center">
  <a href="https://github.com/doomL/OpenRouter-Studio">GitHub</a>
  ·
  <a href="https://openrouter.ai">OpenRouter</a>
</p>

---

## Why use it

| | |
|--|--|
| **Canvas** | Drag nodes from a palette, connect outputs to inputs, run one node or **Run all** in dependency order. |
| **Models** | Anything OpenRouter exposes—chat, vision-capable models, image generators, video jobs (alpha APIs where applicable). |
| **Your key** | Bring your own OpenRouter API key; usage is billed by OpenRouter. The app proxies requests through your server so the key is not sent straight from the browser to `openrouter.ai`. |
| **Accounts** | Sign up to sync **encrypted API key** (with `AUTH_SECRET`), **canvas**, **saved workflows**, **theme**, and **video job metadata** in SQLite—pick up where you left off on another device. |
| **Self-host** | Run locally or in Docker; export/import workflows as JSON for backups. |

---

## Quick start (local)

```bash
npm install
cp .env.example .env
# Set AUTH_SECRET (e.g. openssl rand -base64 32) and NEXTAUTH_URL in .env
npx prisma migrate dev   # creates SQLite DB for auth
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), register or sign in, then paste your **OpenRouter API key** in the studio when prompted (keys are not required in `.env` for local dev).

---

## Production

```bash
npm run build
npm start
```

Set **`NEXTAUTH_URL`** and **`AUTH_SECRET`** to match your public URL and a long random secret. `AUTH_SECRET` also encrypts stored OpenRouter keys in the database.

---

## Docker

Images use **Next.js standalone**. Each container start runs **`prisma migrate deploy`** (`docker-entrypoint.sh`) so the schema exists before `node server.js`. The process runs as **`nextjs`** with a writable `/app` for SQLite.

**1. Environment**

```bash
cp .env.example .env
```

Minimum in **`.env`**: **`AUTH_SECRET`**, **`NEXTAUTH_URL`** (no trailing slash). **`DATABASE_URL`** defaults to `file:./dev.db` inside the container.

**2. Run**

```bash
docker compose build
docker compose up -d
```

**Port in use?** (e.g. dev server on 3000)

```bash
APP_PORT=3080 docker compose up -d
```

Use **`NEXTAUTH_URL=http://localhost:3080`** (or your real origin) so NextAuth matches the URL in the browser.

Compose may load **`.env`**; it sets **`AUTH_TRUST_HOST=true`** for port mapping and reverse proxies. Persist SQLite with a **volume** on `/app/dev.db` (or similar) if you need data to survive container removal.

---

## Stack

| Area | Choice |
|------|--------|
| Framework | **Next.js 16** (App Router) |
| UI | **React 19**, **Tailwind CSS** v4, **Base UI** / shadcn-style components |
| Canvas | **@xyflow/react** (React Flow v12) |
| State | **Zustand** (graph + UI; theme + sync via `/api/settings/studio` when signed in) |
| Auth | **NextAuth.js v5**, **@auth/prisma-adapter** |
| Database | **Prisma 7**, **SQLite**, **better-sqlite3** adapter |
| Language | **TypeScript** |

---

## How it works (short)

1. After sign-in, the studio loads your saved state from the server; edits debounce and sync automatically.
2. Add **Prompt**, **LLM**, **Image**, **Video**, input nodes, **Notes**, and **Output**; connect compatible handles.
3. Choose models and parameters per node; run steps individually or use **Run all** where supported.
4. Server route handlers call OpenRouter with your key; video flows use polling and proxied downloads.

For payload details and model notes, see **`openrouter-studio-prompt.md`** and **`app/api/openrouter/`**.

---

## License

See the license file in the repository (e.g. MIT if specified).
