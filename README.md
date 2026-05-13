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
  <a href="https://github.com/doomL/OpenRouter-Studio/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-Apache_2.0_with_Commons_Clause-red.svg?style=flat-square" alt="Apache 2.0 with Commons Clause" /></a>
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
| **Accounts** | Sign up to sync **encrypted API key** (with `AUTH_SECRET`), **canvas**, **saved workflows**, **theme**, and **video job metadata** in **PostgreSQL**—resume on another device. |
| **Self-host** | Run locally or in Docker; export/import workflows as JSON for backups. |

---

## Quick start (local)

You need a **PostgreSQL** instance and **`DATABASE_URL`** (see `.env.example`).

```bash
npm install
cp .env.example .env
# Set AUTH_SECRET (e.g. openssl rand -base64 32). Optionally set NEXTAUTH_URL to match PORT.
# Start Postgres (example: Compose service only) and align DATABASE_URL / POSTGRES_PASSWORD:
docker compose up postgres -d
npx prisma migrate dev   # applies migrations to the database in DATABASE_URL
npm run dev
```

With the example `.env`, the dev server uses **port 3080** (see `PORT` and `NEXTAUTH_URL`). Open [http://localhost:3080](http://localhost:3080), register or sign in, then paste your **OpenRouter API key** in the studio when prompted (keys are not required in `.env` for local dev).

---

## Production

```bash
npm run build
npm start
```

Set **`DATABASE_URL`** to your PostgreSQL server, plus **`AUTH_SECRET`** and usually **`NEXTAUTH_URL`** to match your public URL. `AUTH_SECRET` also encrypts stored OpenRouter keys in the database.

Prisma reads the migration URL from **`prisma.config.ts`** (typically the same `DATABASE_URL` env var). The app uses **`@prisma/adapter-pg`** at runtime.

---

## Docker

Compose runs **PostgreSQL 16** (`postgres`), **MinIO** (`minio`) for an S3-compatible API, a one-shot **`minio-init`** job that creates the default bucket, and the **app** (`openrouter-studio`). Images use **Next.js standalone**. On each container start, **`docker-entrypoint.sh`** runs **`prisma migrate deploy`** so the schema exists before **`node server.js`**. The app process runs as **`nextjs`**.

The stack uses **`restart: unless-stopped`** on long-running services so it comes back after host reboots or process crashes (for example OOM). That reduces downtime but does not remove the need to keep API payloads small.

Inside Compose, **`STUDIO_S3_*`** defaults point at **`http://minio:9000`** with bucket **`studio-media`** and credentials **`STUDIO_S3_ACCESS_KEY`** / **`STUDIO_S3_SECRET_KEY`** (change in **`.env`** for production). MinIO's ports are bound to **loopback only** (`127.0.0.1`), so the Console is **`http://127.0.0.1:${MINIO_CONSOLE_PORT:-9001}`** and the S3 API **`http://127.0.0.1:${MINIO_PORT:-9000}`** from the host (not reachable from other machines). To use **external** S3 instead (managed AWS, another MinIO, Garage, etc.), set those variables in **`.env`** and remove or replace the `minio` / `minio-init` services and the app's **`depends_on: minio-init`** in **`docker-compose.yml`**.

### Node.js heap vs container RAM

Compose sets **`NODE_OPTIONS=--max-old-space-size=4096`** as a reasonable default. That value is the **V8 old-generation heap ceiling in megabytes**, not "all memory used by the process." Setting it **much lower** (for example 2048) **caps** the runtime on purpose. Setting it **far above** available RAM does not create physical memory and can make behavior worse. Tune it to roughly **75% of the memory you can afford** for the Node process.

### Studio media blobs (S3 / MinIO)

Heavy canvas media can be offloaded to **S3-compatible storage** so `PUT /api/settings/studio` stays small. **Docker Compose uses MinIO** by default; any compatible endpoint (AWS S3, Garage, etc.) works if you set the same variables.

| Variable | Example |
|----------|---------|
| `STUDIO_S3_ENDPOINT` | `http://minio:9000` (app inside Compose) · `http://127.0.0.1:9000` (`npm run dev` on host) · or your external S3/MinIO URL |
| `STUDIO_S3_REGION` | `us-east-1` (common for MinIO; many providers accept any non-empty string) |
| `STUDIO_S3_BUCKET` | `studio-media` |
| `STUDIO_S3_ACCESS_KEY` / `STUDIO_S3_SECRET_KEY` | API keys for that bucket |

With these set, the server uploads inline `data:` payloads on save, stores **`…BlobId` fields** in `node.data`, and serves bytes from **`GET /api/studio/blobs/:id`**.

One-shot migration for existing DB rows: **`npm run migrate:studio-blobs`** (requires the same env and a reachable bucket).

**1. Environment**

```bash
cp .env.example .env
```

Minimum in **`.env`**: **`AUTH_SECRET`**. Compose sets **`DATABASE_URL`** for the app to `postgresql://studio:…@postgres:5432/openrouter_studio` (password from **`POSTGRES_PASSWORD`** in `.env`, default `studio_secret`). For local development against Compose Postgres from the host, use **`localhost:5432`** in **`DATABASE_URL`** as in `.env.example`.

Database and MinIO files live in the **`postgres-data`** and **`minio-data`** named volumes and **persist across image rebuilds** and container recreation. To wipe the database and object storage, run **`docker compose down -v`**.

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
| Database | **Prisma 7**, **PostgreSQL**, **`pg`** via **`@prisma/adapter-pg`** |
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

This repository is licensed under the **[Apache License 2.0 with Commons Clause](LICENSE)**.

### What you can do
- Use, study, and modify the software for personal or internal business purposes.
- Distribute modified or unmodified copies, provided you include this license and all attribution notices.
- Build products or internal workflows on top of OpenRouter Studio for your own use.

### What you cannot do
- **Sell** the software or any product or service whose value derives substantially from its functionality — including hosting it as a paid SaaS, offering it as a managed service, or reselling it as part of a commercial offering — without a separate written commercial license from the authors.

"Sell" is defined as described in the Commons Clause condition at the top of the [LICENSE](LICENSE) file.

### Commercial licensing

If you want to offer OpenRouter Studio (or a derivative) as a paid product or service, contact the authors to discuss a commercial license. Nothing in the Apache 2.0 license obligates the authors to grant additional rights beyond the public license; anything beyond it requires a separate written agreement.

**How to reach out:** use GitHub Discussions or Issues on this repository, or your usual business development channel, and reference "OpenRouter Studio / commercial license."

### Copyright & trademarks

- **Copyright:** [NOTICE](NOTICE) states project copyright and trademark notices required when redistributing. If you are the sole copyright holder preparing a sale or exclusive license of this codebase, replace *OpenRouter Studio authors* in `LICENSE`, `NOTICE`, and this file with your legal name or entity so counterparties can identify assignable rights.
- **Trademarks:** *OpenRouter* and related marks belong to their respective owners. This studio is a separate product; the name refers to API compatibility only unless you have a separate trademark agreement.
- **Dependencies:** Third-party packages remain under their own licenses.
