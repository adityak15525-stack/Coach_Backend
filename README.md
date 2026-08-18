# NEURAL COACH — AI-Powered Fitness Platform

**Real-time computer-vision form correction, AI coaching, and workout optimization — built from algorithms up.**

Neural Coach watches you lift through your phone camera, catches dangerous form deviations *before* they cause injury, and tells you exactly which joint to fix. It also plans your weekly splits, tracks your nutrition, and speaks coaching cues through a voice assistant.

Built as a monorepo: C++ compute engine → Node.js API → Python AI agents → Docker infrastructure.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  React Native / Expo (mobile)                               │
│  Camera → MediaPipe 33-landmarks → WebSocket → API          │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│  Express API (Node.js)                                      │
│  ┌─────────────┐ ┌──────────────┐ ┌───────────────────────┐ │
│  │ Form Engine  │ │ Schedule DP  │ │ Voice Coach (TTS)     │ │
│  │ KD-Tree NN   │ │ 0/1 Knapsack │ │ ElevenLabs streaming  │ │
│  └──────┬──────┘ └──────┬───────┘ └───────────┬───────────┘ │
│         │               │                     │             │
│  ┌──────▼───────────────▼─────────────────────▼───────────┐ │
│  │  C++ Compute Engine (Node-API)                         │ │
│  │  KD-Tree: sub-50µs queries | DP Scheduler: ~130µs      │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌─────────────┐ ┌──────────────┐ ┌───────────────────────┐ │
│  │ Food Vision  │ │ Analytics    │ │ Session Builder       │ │
│  │ Gemini Vision│ │ Fenwick Tree │ │ Topological Sort      │ │
│  └─────────────┘ └──────────────┘ └───────────────────────┘ │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│  Python Agent Swarm (FastAPI)                               │
│  NutritionAgent → LogisticsAgent → SummarizerAgent          │
│  (local fallback when LLM keys absent)                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│  MySQL / TiDB Serverless (14 tables)                        │
└─────────────────────────────────────────────────────────────┘
```

## Key Metrics

| Metric | Value |
|--------|-------|
| KD-Tree query latency | **< 50µs** (C++, 1000 iterations) |
| DP schedule optimization | **~130µs** (adaptive slack-filling) |
| API surfaces | **9 endpoints** (all work without DB) |
| DSA algorithms | **8** (KD-Tree, DP, Trie, Fenwick, Monotonic Stack, Topo Sort, Priority Queue, Levenshtein) |
| Form verdicts | perfect / minor / moderate / severe (per-joint, mm deviation) |

## Quickstart

```bash
# 1. Install (builds C++ engine via node-gyp)
npm install

# 2. Run — no database needed for core features
npm run dev

# 3. Verify all 9 surfaces
npm run smoke:api
```

**Health check:** `GET /api/health`

## What's Inside

| Path | Tech | Purpose |
|------|------|---------|
| `apps/api` | Express + WebSocket | REST API, live form analysis, agent orchestrator |
| `packages/compute` | C++ (Node-API) | KD-Tree nearest-neighbor + DP 0/1 knapsack scheduler |
| `packages/dsa` | JavaScript | 8 algorithm library with unit tests + narrated demo |
| `services/agents` | Python (FastAPI) | Multi-agent AI: nutrition, logistics, voice summarizer |
| `infra` | Docker + Nginx | Production deployment (4 services, TLS, WebSocket proxy) |

## API Endpoints

| Endpoint | Algorithm | What It Does |
|----------|-----------|--------------|
| `POST /api/form/analyze` | KD-Tree | 33-landmark frame → form verdict + deviations + coaching |
| `POST /api/schedule/optimize` | DP Knapsack | Weekly split optimized for time, fatigue, priority |
| `GET /api/search/exercises` | Trie | Autocomplete + "did you mean?" (Levenshtein) |
| `GET /api/food/scan` | Trie | Food lookup with nutrition + recommendations |
| `POST /api/food/analyze-image` | Gemini Vision | Camera photo → food ID → nutrition pipeline |
| `GET /api/analytics/volume` | Fenwick Tree | Cumulative volume lifted (O(log n) range query) |
| `GET /api/analytics/pr-timeline` | Monotonic Stack | All-time PRs + record survival time |
| `POST /api/sessions/build` | Topological Sort | Safe exercise order (warmup → compound → isolation) |
| `POST /api/sessions/:id/complete` | — | Fires agent swarm → voice summary |
| `ws://:4000/live-session` | KD-Tree | Streaming frame-by-frame form analysis |

## Run Tests & Benchmarks

```bash
npm run smoke:api       # 9-surface smoke test (no DB)
npm run test:compute    # C++ KD-Tree + DP unit tests
npm run bench:compute   # sub-50µs latency proof
npm run test:dsa        # 8 algorithms × unit tests
npm run demo:dsa        # narrated algorithm walkthrough
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | MySQL/TiDB connection string (`?ssl=true` for TiDB) |
| `JWT_SECRET` | Yes | JWT signing key (throws on boot if missing) |
| `PORT` | No | Default: `4000` |
| `OPENAI_API_KEY` | No | Enables LLM-powered voice summaries |
| `GEMINI_API_KEY` | No | Enables food camera vision |
| `ELEVENLABS_API_KEY` | No | Enables TTS voice coaching |
| `SMTP_HOST/USER/PASS` | No | Welcome emails (dev mode: logged to console) |

## Tech Stack

**Backend:** Node.js · Express · WebSocket · MySQL · JWT · bcrypt  
**Compute:** C++ · Node-API (node-gyp) · KD-Tree · Dynamic Programming  
**AI/ML:** MediaPipe Pose · Google Gemini Vision · OpenAI · ElevenLabs TTS  
**Agents:** Python · FastAPI · httpx · Pydantic  
**Infrastructure:** Docker Compose · Nginx · TiDB Serverless · Render  
**Frontend:** React Native · Expo (separate repo)

## License

Private — © 2025 Aditya Kumar. All rights reserved.
