#!/usr/bin/env bash
# Starts the standalone MariaDB dev instance on :3307 (used when Docker is
# unavailable). Creates the datadir + schema on first run.
#   ./infra/dev-db.sh start | stop | status
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DBDIR="$ROOT/.mariadb"
PORT="${DB_PORT:-3307}"
DATA="$DBDIR/data"
SOCK="$DBDIR/run/mysql.sock"
PID_FILE="$DBDIR/run/mariadb.pid"

mkdir -p "$DBDIR/run"

start() {
  if [ -S "$SOCK" ] && mariadb --socket="$SOCK" -uroot -e "SELECT 1" >/dev/null 2>&1; then
    echo "  [db] already running on :$PORT"
    return 0
  fi
  if [ ! -d "$DATA/mysql" ]; then
    echo "  [db] initializing datadir ..."
    mariadb-install-db --datadir="$DATA" --auth-root-authentication-method=normal --skip-test-db >/dev/null 2>&1
  fi
  setsid nohup mariadbd --datadir="$DATA" --socket="$SOCK" --port="$PORT" \
    --bind-address=127.0.0.1 --pid-file="$PID_FILE" \
    --log-error="$DBDIR/run/error.log" >/dev/null 2>&1 < /dev/null &
  for _ in $(seq 1 20); do
    sleep 0.5
    mariadb --socket="$SOCK" -uroot -e "SELECT 1" >/dev/null 2>&1 && break
  done
  # idempotent user + schema
  mariadb --socket="$SOCK" -uroot -e "
    CREATE USER IF NOT EXISTS 'ai_coach'@'localhost' IDENTIFIED BY 'ai_coach';
    CREATE USER IF NOT EXISTS 'ai_coach'@'127.0.0.1' IDENTIFIED BY 'ai_coach';
    GRANT ALL PRIVILEGES ON *.* TO 'ai_coach'@'localhost';
    GRANT ALL PRIVILEGES ON *.* TO 'ai_coach'@'127.0.0.1';
    FLUSH PRIVILEGES;" 2>/dev/null || true
  mariadb --socket="$SOCK" -uroot < "$ROOT/infra/mysql/init/001_schema.sql" 2>/dev/null || true
  echo "  [db] MariaDB listening on 127.0.0.1:$PORT"
}

stop() {
  if [ -f "$PID_FILE" ]; then
    kill "$(cat "$PID_FILE")" 2>/dev/null || true
    echo "  [db] stopped"
  else
    echo "  [db] not running"
  fi
}

case "${1:-start}" in
  start) start ;;
  stop) stop ;;
  status) mariadb --socket="$SOCK" -uroot -e "SELECT 'up' AS status" 2>/dev/null || echo "  [db] down" ;;
  *) echo "usage: $0 start|stop|status"; exit 1 ;;
esac
