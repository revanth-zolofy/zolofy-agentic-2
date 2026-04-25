#!/bin/bash
# Step 1 of 2 — Run this from WSL:
#   bash /mnt/d/zolofy-agentic/wsl-setup.sh

set -e
PROJECT="/mnt/d/zolofy-agentic"
cd "$PROJECT"

echo "==> [1/3] Removing Windows node_modules and lockfile..."
rm -rf node_modules package-lock.json
echo "    Done."

echo ""
echo "==> [2/3] Installing Linux-compatible packages..."
npm install
echo "    Done."

echo ""
echo "==> [3/3] Starting npx convex dev..."
echo "    Keep this terminal open. Open a second WSL terminal and run:"
echo "    bash /mnt/d/zolofy-agentic/start-nextjs.bat  (or use PowerShell: npm run dev)"
echo ""
npx convex dev
