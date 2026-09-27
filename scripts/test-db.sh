#!/usr/bin/env bash
# Применяет все миграции к чистой базе Postgres и прогоняет проверку прав.
# Подключение берётся из стандартных переменных PGHOST, PGPORT, PGUSER, PGPASSWORD.
# База PGDATABASE (по умолчанию homework_test) пересоздаётся.
set -euo pipefail
cd "$(dirname "$0")/.."

DB="${PGDATABASE:-homework_test}"
psql -d postgres -v ON_ERROR_STOP=1 -qc "drop database if exists \"$DB\"" -qc "create database \"$DB\""

args=(-d "$DB" -v ON_ERROR_STOP=1 -q -f supabase/tests/auth_stub.sql)
for f in supabase/migrations/*.sql; do args+=(-f "$f"); done
args+=(-f supabase/tests/permissions.sql)
psql "${args[@]}"
