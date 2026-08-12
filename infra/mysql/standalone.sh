#!/usr/bin/env bash
# Start the standalone MariaDB instance (port 3307) + seed the ai_coach DB,
# for machines where docker is unavailable. Idempotent.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA=/tmp/opencode/mariadb/data
RUN=/tmp/opencode/mariadb/run
SOCK="$RUN/mysql.sock"
DB_PORT="${DB_PORT:-3307}"

mkdir -p "$DATA" "$RUN"

if [ ! -d "$DATA/mysql" ]; then
  echo "[db] initializing data dir ..."
  mariadb-install-db --datadir="$DATA" --auth-root-authentication-method=normal --user="$(id -un)" >/dev/null 2>&1
fi

if ! mysqladmin --socket="$SOCK" ping >/dev/null 2>&1; then
  echo "[db] starting mariadbd on :$DB_PORT ..."
  setsid bash -c "exec mariadbd --datadir=$DATA --port=$DB_PORT --socket=$SOCK --pid-file=$RUN/mysqld.pid --bind-address=127.0.0.1 > $RUN/server.log 2>&1" </dev/null >/dev/null 2>&1 &
  for _ in $(seq 1 20); do mysqladmin --socket="$SOCK" ping >/dev/null 2>&1 && break; sleep 0.5; done
fi

echo "[db] seeding schema + user ..."
mysql --socket="$SOCK" -u root <<SQL
CREATE DATABASE IF NOT EXISTS ai_coach CHARACTER SET utf8mb4;
CREATE USER IF NOT EXISTS 'ai_coach'@'localhost' IDENTIFIED BY 'ai_coach';
CREATE USER IF NOT EXISTS 'ai_coach'@'127.0.0.1' IDENTIFIED BY 'ai_coach';
GRANT ALL PRIVILEGES ON ai_coach.* TO 'ai_coach'@'localhost';
GRANT ALL PRIVILEGES ON ai_coach.* TO 'ai_coach'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL
mysql --socket="$SOCK" -u root ai_coach < "$ROOT/infra/mysql/init/001_schema.sql"
echo "[db] ready on 127.0.0.1:$DB_PORT (database ai_coach)"
