#!/usr/bin/env bash
# PostToolUse hook: corre eslint sobre archivos .ts/.js editados o creados.
# Recibe payload JSON por stdin con tool_input.file_path.
# Exit 2 + stderr → Claude ve los errores y puede corregir.

set -uo pipefail

INPUT=$(cat)

FILE_PATH=$(printf '%s' "$INPUT" | python3 -c '
import json, sys
try:
    data = json.load(sys.stdin)
    print(data.get("tool_input", {}).get("file_path", ""))
except Exception:
    pass
')

[ -z "$FILE_PATH" ] && exit 0

case "$FILE_PATH" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs) ;;
  *) exit 0 ;;
esac

case "$FILE_PATH" in
  *"/dist/"*|*"/node_modules/"*|*"/coverage/"*|*"/.git/"*) exit 0 ;;
esac

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"

ESLINT_BIN="$PROJECT_DIR/node_modules/.bin/eslint"
[ -x "$ESLINT_BIN" ] || exit 0

[ -f "$FILE_PATH" ] || exit 0

case "$FILE_PATH" in
  "$PROJECT_DIR"/*) ;;
  *) exit 0 ;;
esac

cd "$PROJECT_DIR"

if OUTPUT=$("$ESLINT_BIN" --no-warn-ignored "$FILE_PATH" 2>&1); then
  exit 0
fi

printf 'eslint failed on %s:\n%s\n' "$FILE_PATH" "$OUTPUT" >&2
exit 2
