#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE20_DIR="${NODE20_DIR:-/tmp/opencode/node20}"
NODE20_URL="https://nodejs.org/dist/v20.19.0/node-v20.19.0-linux-x64.tar.xz"
NODE20_BIN="$NODE20_DIR/node-v20.19.0-linux-x64/bin"

API_PORT="${API_PORT:-4000}"
AGENT_PORT="${AGENT_PORT:-8000}"

echo ""
echo "  ░░ NEURAL COACH — starting backend + frontend ░░"
echo ""

# --- 1. Node 20 (required for Expo SDK 57; Node 22.x type-stripping breaks it) ---
if [ ! -x "$NODE20_BIN/node" ]; then
  echo "  [setup] downloading Node 20.19.0 ..."
  mkdir -p "$NODE20_DIR"
  curl -fsSL -o /tmp/node20.tar.xz "$NODE20_URL"
  tar -xJf /tmp/node20.tar.xz -C "$NODE20_DIR"
  rm -f /tmp/node20.tar.xz
fi
export PATH="$NODE20_BIN:$PATH"
echo "  [setup] node $(node -v)  ·  $(command -v node)"

# --- 2. LAN IP for the device to reach the API ---
LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')" || true
LAN_IP="${LAN_IP:-127.0.0.1}"
echo "  [setup] API reachable at http://${LAN_IP}:${API_PORT}"

# --- 3. Build native compute engine if needed (js-fallback exists, never fatal) ---
if [ ! -f "$ROOT/packages/compute/build/Release/compute.node" ]; then
  npm run build:compute >/dev/null 2>&1 || echo "  [setup] native compute build skipped (JS fallback will be used)"
fi

pids=()
spawn() { "$@" & pids+=($!); }
_stopping=0
cleanup() { # fast shutdown: graceful TERM, then force-KILL stragglers
  if [ "$_stopping" = "1" ]; then return; fi
  _stopping=1
  echo ""
  echo "  [stop] shutting down all services ..."
  kill -TERM -- "-$$" 2>/dev/null || true            # group TERM (interactive mode)
  for pid in "${pids[@]:-}"; do kill -TERM "$pid" 2>/dev/null || true; done
  sleep 1
  for port in "$API_PORT" "$AGENT_PORT" 8081; do    # sweep anything left on our ports
    while read -r pid; do
      [ -n "$pid" ] && kill -9 "$pid" 2>/dev/null || true
    done < <(ss -tlnp 2>/dev/null | grep ":$port " | grep -oP 'pid=\K[0-9]+' | sort -u)
  done
  for pid in "${pids[@]:-}"; do kill -9 "$pid" 2>/dev/null || true; done
  kill -9 -- "-$$" 2>/dev/null || true
  exit 0
}
trap cleanup INT TERM
trap cleanup EXIT

port_free() { ! ss -tlnp 2>/dev/null | grep -q ":$1 "; }
free_port() { # kill whatever is squatting on a port (we own the frontend port)
  local pid
  pid="$(ss -tlnp 2>/dev/null | grep ":$1 " | grep -oP 'pid=\K[0-9]+' | head -1)" || true
  if [ -n "$pid" ]; then
    kill "$pid" 2>/dev/null || true
    echo "  [setup] freed port :$1 (stale pid $pid)"
  fi
  return 0
}

# --- 3.5 Standalone MariaDB (:3307) for auth/logs (no-op if docker MySQL is used) ---
if port_free 3307; then
  bash "$ROOT/infra/dev-db.sh" start || echo "  [db] skipped"
else
  echo "  [db] already running on :3307"
fi

# --- 4. Python agent swarm (:8000) ---
if port_free "$AGENT_PORT"; then
  echo "  [agent-swarm] starting on :$AGENT_PORT ..."
  spawn bash -c "cd '$ROOT/services/agents/src' && python3 -m uvicorn main:app --port $AGENT_PORT >/tmp/agents.log 2>&1"
else
  echo "  [agent-swarm] already running on :$AGENT_PORT (reusing)"
fi

# --- 5. Express API (:4000) ---
if port_free "$API_PORT"; then
  echo "  [api] starting on :$API_PORT ..."
  spawn bash -c "cd '$ROOT/apps/api' && node src/index.js >/tmp/api.log 2>&1"
else
  echo "  [api] already running on :$API_PORT (reusing)"
fi

# --- 6. Frontend — Expo dev server with env wired to the backend ---
free_port 8081
echo "  [frontend] starting Expo — browser: http://localhost:8081  ·  Expo Go: scan QR  ·  emulator: press a ..."
export EXPO_PUBLIC_API_URL="http://${LAN_IP}:${API_PORT}"
export EXPO_PUBLIC_WS_URL="ws://${LAN_IP}:${API_PORT}/live-session"
spawn bash -c "cd '$ROOT/frontend/mobile' && npx expo start >/tmp/expo.log 2>&1"

sleep 4
echo ""
echo "  ┌─────────────────────────────────────────────────────────────┐"
echo "  │  Express API    http://${LAN_IP}:${API_PORT}         (log: /tmp/api.log)     │"
echo "  │  Agent swarm    http://${LAN_IP}:${AGENT_PORT}         (log: /tmp/agents.log) │"
echo "  │  Expo dev       http://localhost:8081  (open in browser, or press 'w') │"
echo "  │  press Ctrl+C to stop everything                                │"
echo "  └─────────────────────────────────────────────────────────────┘"
echo ""

wait
