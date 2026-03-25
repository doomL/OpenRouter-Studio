# OpenRouter Studio

A visual, node-based canvas for chaining **LLM chat**, **image generation**, and **video generation** through [OpenRouter](https://openrouter.ai). Build pipelines by connecting nodes—no glue code. **Bring your own OpenRouter API key**; usage is billed by OpenRouter.

**Repository:** [github.com/doomL/OpenRouter-Studio](https://github.com/doomL/OpenRouter-Studio)

## What you get

- **React Flow canvas** — Drag nodes from the palette, wire outputs to inputs, run nodes or the whole graph.
- **LLM nodes** — Chat completions (and vision where the model supports it). Pick any model exposed by OpenRouter; pricing hints come from the models API when available.
- **Image nodes** — Text-to-image and image-to-image with reference inputs; images flow through the graph as base64/data URLs.
- **Video nodes** — Submit async video jobs, poll status, preview and download via proxied API routes (OpenRouter alpha video API).
- **Supporting nodes** — Prompt, image/video inputs, notes, and a consolidated output node.
- **Auth (cloud path)** — Register / sign in with **NextAuth.js** (credentials) and **Prisma** + **SQLite** (default `DATABASE_URL` is `file:./dev.db` at the project root). The **studio** route is protected by middleware; the landing and auth pages are public.
- **API proxy** — Browser calls go to Next.js **Route Handlers** under `/api/openrouter/*` and `/api/utils/*`, so your API key is not sent from the client to `openrouter.ai` directly (you still configure the key in the app).
- **Per-account studio sync** — While signed in, your **OpenRouter API key** (encrypted at rest with `AUTH_SECRET`), **canvas**, **saved workflows**, **theme**, and **video job metadata** are stored in SQLite and synced across devices. Only **theme** is also cached locally for faster first paint. Export/import JSON still works for backups.

## Quick start

```bash
npm install
cp .env.example .env
# Edit .env: set AUTH_SECRET (e.g. openssl rand -base64 32) and NEXTAUTH_URL for your deployment.
npx prisma migrate dev   # create SQLite DB when using auth
npm run dev
```

OpenRouter API keys are **not** set in `.env` — enter your key in the Studio UI when prompted.

Open [http://localhost:3000](http://localhost:3000). Create an account or use **Self-host** / GitHub instructions on the landing page; in the studio, paste your **OpenRouter API key** when prompted.

## Production

```bash
npm run build
npm start
```

Set `NEXTAUTH_URL` and `AUTH_SECRET` (or `NEXTAUTH_SECRET`) for auth in production. `AUTH_SECRET` is also used to encrypt stored OpenRouter keys in the database.

## Docker

The image uses **Next.js standalone** output. On each start, the container runs **`prisma migrate deploy`** (see `docker-entrypoint.sh`) so SQLite tables exist before the server boots. The app runs as user **`nextjs`** with a writable `/app` tree for `dev.db`.

### Prerequisites

1. Copy env template and set secrets (same as local dev):

   ```bash
   cp .env.example .env
   ```

2. In **`.env`**, at minimum:

   - **`AUTH_SECRET`** — long random string (e.g. `openssl rand -base64 32`). Used by NextAuth and to encrypt stored OpenRouter keys.
   - **`NEXTAUTH_URL`** — URL you open in the browser, **no trailing slash** (e.g. `http://localhost:3000`).

   **`DATABASE_URL`** defaults to `file:./dev.db` (SQLite file inside the container). **`OPENROUTER_API_KEY`** is still optional here; users can enter the key in the Studio UI.

### Run

```bash
docker compose build
docker compose up -d
```

If **port 3000 is already in use** (for example `npm run dev`), publish another host port:

```bash
APP_PORT=3080 docker compose up -d
```

Then open `http://localhost:3080` and set **`NEXTAUTH_URL=http://localhost:3080`** in `.env` (or pass it in the shell for that run) so NextAuth matches the URL you use.

Compose loads **`.env`** when present (`required: false` if the file is missing). It sets **`AUTH_TRUST_HOST=true`** so NextAuth accepts requests when the Host header differs from the container hostname (typical behind port mapping or a reverse proxy). Override **`NEXTAUTH_URL`** if you publish the app on another origin.

Open [http://localhost:3000](http://localhost:3000) (or whatever host/port you mapped). Register, sign in, then use the studio.

### Notes

- **Host port** defaults to **3000**; override with **`APP_PORT`** (see above).
- **SQLite data** lives **inside the container** by default; removing the container removes the database. To persist it, add a **volume** for `/app/dev.db` or point `DATABASE_URL` at a mounted file path.
- **`.dockerignore`** excludes `dev.db`, `.env`, and `*.db` so local secrets and databases are not copied into the build context.

## Tech stack

| Area | Choice |
|------|--------|
| Framework | **Next.js 16** (App Router) |
| UI | **React 19**, **Tailwind CSS** v4, **shadcn/ui** (Base UI) |
| Canvas | **@xyflow/react** (React Flow v12) |
| State | **Zustand** (graph + UI; theme in `localStorage`, rest synced per user via `/api/settings/studio`) |
| Auth | **NextAuth.js v5**, **@auth/prisma-adapter** |
| Database | **Prisma 7** + **better-sqlite3** driver adapter |
| Types | **TypeScript** |

## How it works (short)

1. Sign in; the studio loads your saved key and graph from the server (after the first sync, changes save automatically with a short debounce).
2. Add nodes (prompt, LLM, image, video, inputs, etc.) and connect handles.
3. Configure models and parameters per node; use **Run** / **Run all** where implemented.
4. LLM/image/video requests are executed from the server via your OpenRouter key; video jobs are polled until complete, then assets are fetched through the app’s download route.

For deeper behavior (models, image/video payloads), see `openrouter-studio-prompt.md` and the `app/api/openrouter` routes in the repo.

## License

See the repository license file (e.g. MIT if specified in the repo).
