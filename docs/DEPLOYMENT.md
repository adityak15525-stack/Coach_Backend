# NEURAL COACH — Deployment Guide

Production deployment for the full stack: **web (Expo static) + Express API + FastAPI agent swarm + MySQL**, all behind a single nginx entrypoint. `docker compose up` on any VPS (or local Docker) gives you the whole product on `http://<server>:80`.

## Architecture

```
            ┌──────────────┐
  browser → │  nginx :80   │  web container (Expo export + nginx)
            └─────┬────────┘
        ┌─────────┼──────────┬───────────────┐
        ▼         ▼          ▼               ▼
   /api/*   /live-session   /mp/ /models/   /canvaskit.wasm, assets
        │         │          │
        ▼         ▼          ▼
   Express :4000 (WS)   Express static    (served by nginx, static)
        │   ▲
        │   └── AGENTS_URL=http://agents:8000
        ▼
   MySQL 8.4  (auth, sessions, logs)
```

- **`/`**            — static Expo web app (hashed bundles cached 1y)
- **`/api/*`**       — rewritten to Express (the `/api` prefix is stripped)
- **`/live-session`**— WebSocket upgrade → Express live form scoring
- **`/mp/`, `/models/`, `/gesture-engine.html`** — MediaPipe wasm + hand model (used by the gesture WebView)
- **`/canvaskit.wasm`** — Skia runtime for the 3D avatar (bundled into the export)

## One-command deploy

```bash
# on the server (with docker + docker compose plugin)
git clone <your-repo> neural-coach && cd neural-coach

cp infra/.env.example .env        # then edit .env (secrets below)

cd infra
docker compose up --build -d
```

The site is live at `http://<server-ip>/` once `mysql` reports healthy.

## Required secrets (.env)

| Var | Notes |
|---|---|
| `JWT_SECRET` | Long random string — signs login tokens |
| `MYSQL_ROOT_PASSWORD`, `DB_PASSWORD` | Database passwords |
| `ELEVENLABS_API_KEY` | Voice coach TTS (https://elevenlabs.io). Blank → speech is disabled server-side |
| `SMTP_HOST/PASS` | Welcome emails. Blank → emails are logged to the API console instead of sent |

Generate a secret: `openssl rand -hex 32`

## URLs baked into the web build

The web container is built with `EXPO_PUBLIC_API_URL=/api` and
`EXPO_PUBLIC_WS_URL=/live-session` — same-origin, so the browser talks to nginx
only. No CORS, no public API port needed. (Ports 4000/8000 are exposed for
debugging; you can remove the `ports:` blocks to keep them private.)

## Operations

```bash
docker compose ps                 # status
docker compose logs -f api        # API logs
docker compose logs -f web        # nginx/static logs
docker compose up -d --build      # deploy a new build (zero-downtime-ish)
docker compose down               # stop everything (keeps mysql-data volume)
docker compose down -v            # wipe DB too
```

## Build a native app (Android/iOS)

The mobile app shares the same source. Point it at the server:

```bash
cd frontend/mobile
EXPO_PUBLIC_API_URL=https://your-server.com/api \
EXPO_PUBLIC_WS_URL=wss://your-server.com/live-session \
  npx expo start          # then: a (android) / i (ios) / scan with Expo Go
```

> The web build uses a same-origin `/api` prefix; native builds need absolute
> URLs — set them via env as above at build/start time.

## Smoke test after deploy

```bash
curl -s http://<server>/api/health        # → {"status":"ok","db":"connected",...}
curl -s http://<server>/api/catalog/exercises   # → exercise list
curl -s http://<server>/mp/vision_bundle.js     # → MediaPipe wasm (200)
```

Then open the site: sign up → welcome email/voice greeting → 3D FORM LIBRARY
shows the avatar performing every exercise.
