# NEURAL COACH — Backend API

Express backend for the Hyper-Adaptive Lifting & Form Coach: real-time **computer-vision
form correction** (C++ KD-Tree nearest-neighbor), **dynamic-programming schedule
optimization**, an **autonomous agent orchestrator**, a **voice assistant**, and a
suite of **DSA services** (Trie, Fenwick Tree, Topological Sort, Priority Queue, …).

> This repository contains **only the backend** (`apps/api` + `packages/*` + `infra`).
> The mobile frontend is a separate repo: `Coach_Frontend_1`.

## What's inside

| Path | What |
|------|------|
| `apps/api` | Express — REST + WebSocket live-session, DSA services, agent orchestrator |
| `packages/compute` | C++ KD-Tree + DP scheduler (Node-API) with JS fallback |
| `packages/dsa` | 8 applied algorithms, tested + narrated demo |
| `infra` | SQL schema + docker-compose (MySQL / TiDB) |

## Quickstart

### 1. Install (also builds the native C++ engine via `gypfile`)

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# edit .env and set at least:
#   DATABASE_URL = mysql://user:pass@host:3306/db?ssl=true   (TiDB Serverless)
#   JWT_SECRET   = any-long-random-string
```

### 3. Start the backend

```bash
npm start          # production: node apps/api/src/index.js   (:4000)
npm run dev        # watch mode (node --watch)
```

Health check: `GET /api/health`. Live WebSocket: `ws://localhost:4000/live-session`.

## Verify

```bash
npm run smoke:api      # boots the API, hits surfaces (no DB needed)
npm run test:compute   # C++/JS KD-Tree + DP unit tests
npm run bench:compute  # sub-50µs latency proof
npm run test:dsa       # 8 algorithms × unit tests
npm run demo:dsa       # the walkthrough demo
```

## API surface (all live without MySQL)

| Endpoint | Algorithm | Notes |
|----------|-----------|-------|
| `POST /form/analyze` | KD-Tree | 33-landmark frame → verdict |
| `POST /schedule/optimize` | DP | fatigue overrides accepted |
| `GET /search/exercises` | Trie | autocomplete + did-you-mean |
| `GET /analytics/volume` | Fenwick | cumulative volume range queries |
| `GET /analytics/pr-timeline` | Monotonic stack | all-time PRs |
| `POST /sessions/build` | Topo sort | safe exercise order |
| `POST /sessions/:id/complete` | — | fires the agent swarm |
| `POST /coach/next-cue` | Priority queue | highest-criticality cue |
| `ws://:4000/live-session` | KD-Tree | streaming verdicts |

## Environment variables

| Var | Required | Notes |
|-----|----------|-------|
| `DATABASE_URL` | yes | Full mysql2 URL; `?ssl=true` enables TLS (TiDB Serverless) |
| `JWT_SECRET` | yes | Throws on boot if missing |
| `PORT` | no | default 4000 |
| `OPENAI_API_KEY` / `GEMINI_API_KEY` | no | LLM features |
| `AGENTS_URL` | no | default `http://localhost:8000` |
| `SMTP_*` | no | empty → welcome emails logged (dev mode) |
