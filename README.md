# NEURAL COACH — Hyper-Adaptive Lifting & Form Coach

A futuristic lifting coach: real-time **computer-vision form correction** (KD-Tree nearest-neighbor in C++),
**dynamic-programming schedule optimization**, an **autonomous agent swarm** (nutrition → grocery → GenAI summary),
a **voice assistant**, and a **3D holographic mobile UI**.

```
┌──────────────┐  frames/verdicts   ┌──────────────────┐  HTTP      ┌───────────────────┐
│   Mobile     │ ◄───── WS ───────► │   Express API     │ ─────────► │  Python Agents    │
│ (Expo + Skia │                    │  (DSA services)   │  agent     │ (FastAPI swarm)   │
│  3D + voice) │                    │        │          │  swarm     │ nutrition/logistics│
└──────────────┘                    └────────┼──────────┘            │ /summarizer       │
                                             │ C++ Node-API         └───────────────────┘
                                             ▼
                                      KD-Tree + DP
                                      (sub-50 µs)
```

## Ten DSA applications — all wired to features

See [docs/DSA_MAP.md](docs/DSA_MAP.md). KD-Tree, DP knapsack, Trie, Fenwick Tree, Topological Sort,
Sliding Window + EMA, LRU Cache, Priority Queue, Rabin-Karp, Monotonic Stack.

## Architecture

| Path | What |
|------|------|
| `frontend/mobile` | React Native (Expo) — 3D Skia renderer, voice assistant, live session |
| `apps/api` | Express — REST + WebSocket live-session, DSA services, agent orchestrator |
| `packages/compute` | C++ KD-Tree + DP scheduler (Node-API) with JS fallback |
| `packages/dsa` | 8 applied algorithms, tested + narrated demo |
| `services/agents` | Python agent swarm (FastAPI) |
| `infra` | docker-compose (MySQL + API + agents), SQL schema |
| `docs/DSA_MAP.md` | algorithm → feature map with measured latency |

## Quickstart

### 1. Install + build the C++ engine

```bash
npm install                       # workspace install (compute, dsa, api)
npm run build:compute             # native .node (falls back to JS automatically)
```

### 2. Run every verification

```bash
npm run test:compute      # C++/JS KD-Tree + DP unit tests
npm run bench:compute     # sub-50µs latency proof
npm run test:dsa          # 8 algorithms × unit tests
npm run demo:dsa          # the 45-second-set walkthrough
npm run smoke:api         # boots the API, hits 9 surfaces (no DB needed)
python3 services/agents/smoke_test.py   # agent swarm smoke
```

### 3. Run the whole app — one command

```bash
./start.sh        # or: npm run start:all
```

Starts (or reuses, if already running) the **Python agent swarm** (:8000),
the **Express API** (:4000), and the **Expo dev server** (frontend/mobile, :8081),
auto-wiring `EXPO_PUBLIC_API_URL`/`EXPO_PUBLIC_WS_URL` to your LAN IP.

- **Browser**: open `http://localhost:8081` (web build via react-native-web).
- **Phone**: scan the QR with **Expo Go** (same Wi-Fi).
- **Emulator**: press `a` in the Expo terminal.
- `Ctrl+C` stops everything it started.
- Logs: `/tmp/api.log`, `/tmp/agents.log`, `/tmp/expo.log`.

Running pieces individually instead:

```bash
# MySQL (optional for DSA endpoints; required for auth/logs)
docker compose -f infra/docker-compose.yml up mysql

# Python agent swarm
cd services/agents/src && uvicorn main:app --port 8000

# Express API
npm run start:api                  # :4000  + ws /live-session

# Frontend only
cd frontend/mobile && npm install && npx expo start
```

Point the app at your backend: set `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_WS_URL`
(use your LAN IP for a physical device).

### Live form session

The **Live Session** screen streams simulated pose frames over WebSocket.
The API scores each frame against a KD-Tree of perfect-form templates (< 50 µs),
flags deviations (knee valgus, rounded back), queues a voice cue, and the
holo-athlete on screen mirrors the rep depth.

### Voice assistant

`expo-speech` TTS speaks the agent-generated scripts (works in Expo Go).
Speech-to-text commands (e.g. "start squats") use `@react-native-voice/voice`
and require a development build: `npx expo run:android`.

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
| `GET /coach/next-cue` | Priority queue | highest-criticality cue |
| `ws://:4000/live-session` | KD-Tree | streaming verdicts |

## Notes

- **Node 20 LTS** is recommended for Expo tooling (newer Node 22.x enables TS
  type-stripping that breaks Expo SDK 57 config loading).
- The app runs on **Android/iOS (Expo Go) and the web** (react-native-web).
  Web shares the full UI — 3D Skia, animations, and voice *output* — but voice
  *input* (`@react-native-voice/voice`) and device sensors need a native build.
- MySQL schema lives in `infra/mysql/init/001_schema.sql` and includes vector
  support hooks for `agent_memory.embedding`.
- The C++ module auto-falls back to a pure-JS twin so the stack runs anywhere.
