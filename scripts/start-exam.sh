#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PORT="${1:-8000}"
URL="http://127.0.0.1:${PORT}/docs/"

if command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="python3"
elif command -v python >/dev/null 2>&1; then
  PYTHON_BIN="python"
else
  echo "Python is required to start the local exam server." >&2
  exit 1
fi

echo "Serving GH-300 practice exam at ${URL}"
echo "Press Ctrl+C to stop the server."

if command -v xdg-open >/dev/null 2>&1; then
  (sleep 1 && xdg-open "${URL}" >/dev/null 2>&1) &
elif command -v open >/dev/null 2>&1; then
  (sleep 1 && open "${URL}" >/dev/null 2>&1) &
fi

cd "${REPO_ROOT}"
exec "${PYTHON_BIN}" -m http.server "${PORT}"
