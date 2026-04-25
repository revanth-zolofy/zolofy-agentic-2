#!/bin/bash
# Daily dev launcher — run from WSL: bash ~/zolofy-agentic/start.sh
# Starts both Convex dev and Next.js dev. Ctrl+C stops both.

cd ~/zolofy-agentic

# Trap Ctrl+C and kill both processes
cleanup() {
  echo ""
  echo "Stopping servers..."
  kill $CONVEX_PID 2>/dev/null
  exit 0
}
trap cleanup SIGINT SIGTERM

echo "==> Starting Convex dev..."
npx convex dev &
CONVEX_PID=$!

echo "==> Waiting 8s for Convex to connect..."
sleep 8

echo ""
echo "==> Starting Next.js dev (http://localhost:3000)..."
npm run dev

# If npm run dev exits, clean up convex too
kill $CONVEX_PID 2>/dev/null
