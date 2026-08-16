#!/usr/bin/env bash
#
# One command to (re)start the whole local stack from a clean slate.
#
# Both the FastAPI server and Metro cache their state at startup — a
# long-running instance silently serves stale routes or a stale module map
# after code changes (this has bitten twice: a 404 on a newly-added /places
# route, and an unresolved native module). This script always kills and
# restarts, so "did I forget to restart the server" stops being a question.
#
# Usage:
#   scripts/dev.sh phone   # backend on LAN + Metro dev-client for the phone
#   scripts/dev.sh web     # backend + Expo web (browser, for local testing)
#
set -euo pipefail

MODE="${1:-web}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# The machine's LAN IP, so a phone on the same Wi-Fi can reach the backend.
LAN_IP="$(python -c "import socket; s=socket.socket(socket.AF_INET, socket.SOCK_DGRAM); s.connect(('8.8.8.8', 80)); print(s.getsockname()[0]); s.close()" 2>/dev/null || echo 127.0.0.1)"

kill_port() {
  for pid in $(netstat -ano 2>/dev/null | grep ":$1.*LISTENING" | awk '{print $NF}' | sort -u); do
    taskkill //F //PID "$pid" 2>/dev/null || true
  done
}

echo "Stopping any running servers..."
kill_port 8000
kill_port 8081
kill_port 8082

echo "Starting backend (fresh) on 0.0.0.0:8000..."
( cd "$ROOT/server" && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 ) &

if [ "$MODE" = "phone" ]; then
  echo "Backend reachable at http://$LAN_IP:8000"
  echo "Starting Metro dev-client (cleared cache)..."
  cd "$ROOT/app"
  EXPO_PUBLIC_API_URL="http://$LAN_IP:8000" npx expo start --dev-client --clear
else
  echo "Starting Expo web on http://localhost:8082..."
  cd "$ROOT/app"
  EXPO_PUBLIC_API_URL="http://127.0.0.1:8000" npx expo start --web --port 8082 --clear
fi
