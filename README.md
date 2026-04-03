<p align="center">
  <img src="public/favicon.svg#gh-light-mode-only" width="72" height="72" alt="OpenRouter Studio" />
  <img src="public/favicon_dark.svg#gh-dark-mode-only" width="72" height="72" alt="OpenRouter Studio" />
</p>

<h1 align="center">OpenRouter Studio</h1>

<p align="center">
  <strong>Visual node canvas</strong> for chaining <strong>LLM</strong>, <strong>image</strong>, and <strong>video</strong> models via <a href="https://openrouter.ai">OpenRouter</a>. Wire nodes, run pipelines—no glue code.
</p>

<p align="center">
  <em>Independent project — not affiliated with OpenRouter unless agreed in writing. See <a href="#license--intellectual-property">License &amp; IP</a>.</em>
</p>

<p align="center">
  <a href="https://github.com/doomL/OpenRouter-Studio/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-Apache_2.0-blue.svg?style=flat-square" alt="Apache License 2.0" /></a>
  <a href="https://github.com/doomL/OpenRouter-Studio/blob/main/NOTICE"><img src="https://img.shields.io/badge/NOTICE-trademark%20%26%20IP-informational?style=flat-square" alt="NOTICE" /></a>
  <a href="https://nextjs.org/"><img src="https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js&logoColor=white" alt="Next.js 16" /></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React 19" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" /></a>
  <a href="https://www.docker.com/"><img src="https://img.shields.io/badge/Docker-ready-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker" /></a>
</p>

<p align="center">
  <a href="https://github.com/doomL/OpenRouter-Studio">GitHub</a>
  &nbsp;·&nbsp;
  <a href="https://openrouter.ai">OpenRouter</a>
  &nbsp;·&nbsp;
  <a href="https://github.com/doomL/OpenRouter-Studio/stargazers"><img src="https://img.shields.io/github/stars/doomL/OpenRouter-Studio?style=flat-square&logo=github&label=stars" alt="GitHub stars" /></a>
</p>

---

## Features

| | |
|--|--|
| **Canvas** | Drag nodes from a palette, connect outputs to inputs, run one node or **Run all** in dependency order. |
| **Models** | Anything OpenRouter exposes—chat, vision-capable models, image generators, video jobs (including alpha APIs where applicable). |
| **Your key** | Bring your own OpenRouter API key; usage is billed by OpenRouter. The app proxies requests through your server so the key is not sent straight from the browser to `openrouter.ai`. |
| **Accounts** | Sign up to sync **encrypted API key** (with `AUTH_SECRET`), **canvas**, **saved workflows**, **theme**, and **video job metadata** in SQLite—resume on another device. |
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

With the example `.env`, the dev server uses **port 3080** (see `PORT` and `NEXTAUTH_URL`). Open [http://localhost:3080](http://localhost:3080), register or sign in, then paste your **OpenRouter API key** in the studio when prompted (keys are not required in `.env` for local dev).

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

Minimum in **`.env`**: **`AUTH_SECRET`**, and usually **`NEXTAUTH_URL`** only when you need a fixed canonical URL. Compose sets **`DATABASE_URL=file:/app/data/studio.db`** and mounts a **named volume** on `/app/data`, so the SQLite database and accounts **persist across image rebuilds** and container recreation. To wipe data, run **`docker compose down -v`**.

**2. Build and run**

```bash
docker compose up --build -d
```

**Different host port?** Set **`APP_PORT`** (and matching **`NEXTAUTH_URL`**) in `.env`, for example:

```bash
APP_PORT=3000 NEXTAUTH_URL=http://localhost:3000 docker compose up --build -d
```

Or edit `.env` before `docker compose up`. NextAuth must use the same origin you open in the browser.

Compose may load **`.env`**; it sets **`AUTH_TRUST_HOST=true`** for port mapping and reverse proxies.

**nginx on the same host:** The app listens on **`127.0.0.1:${APP_PORT:-3080}`** on the host (mapped to port **3000** inside the container). Point your `server` / `location` at that upstream, for example `proxy_pass http://127.0.0.1:3080;`. Set **`NEXTAUTH_URL`** to your public `https://your.domain` (no trailing slash). The hostname in container logs (e.g. `f5030adb7722`) is only valid *inside* Docker—not the URL you use in nginx or a browser.

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

## How it works

1. After sign-in, the studio loads your saved state from the server; edits debounce and sync automatically.
2. Add **Prompt**, **LLM**, **Image**, **Video**, input nodes, **Notes**, and **Output**; connect compatible handles.
3. Choose models and parameters per node; run steps individually or use **Run all** where supported.
4. Server route handlers call OpenRouter with your key; video flows use polling and proxied downloads.

For payload details and model notes, see **`openrouter-studio-prompt.md`** and **`app/api/openrouter/`**.

---

## License & intellectual property

This repository is licensed under the **[Apache License 2.0](LICENSE)**. You may use, modify, and distribute the software for commercial and non-commercial purposes, subject to the terms of that license (including the patent grant where applicable). See the license text for full conditions.

- **Copyright:** [NOTICE](NOTICE) states project copyright and trademark notices required or recommended when redistributing under Apache 2.0. If you are the sole copyright holder preparing a sale or exclusive license, replace *OpenRouter Studio authors* in `LICENSE`, `NOTICE`, and this file with your legal name or entity so counterparties can identify assignable rights.
- **Trademarks:** *OpenRouter* and related marks belong to their respective owners. This studio is a separate product; the name refers to API compatibility only unless you have a separate trademark agreement.
- **Dependencies:** Third-party packages remain under their own licenses.

### For OpenRouter and strategic partners

The maintainers welcome good-faith conversations about **acquisition**, **exclusive or enterprise licensing**, **official product or hosting integration**, or **partnership** with OpenRouter or other organizations. Nothing in the Apache license obliges the authors to grant additional rights beyond that license; anything beyond the public license is subject to a separate written agreement.

**How to reach out:** use GitHub Discussions or Issues on this repository, or your usual business development channel, and reference “OpenRouter Studio / licensing or partnership.”
