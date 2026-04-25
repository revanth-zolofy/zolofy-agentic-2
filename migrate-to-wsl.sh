#!/bin/bash
# One-time migration: copy project to WSL native filesystem.
# Run from WSL: bash /mnt/d/zolofy-agentic/migrate-to-wsl.sh

set -e

SRC="/mnt/d/zolofy-agentic"
DEST="$HOME/zolofy-agentic"

echo "==> [1/4] Copying project to $DEST (excluding node_modules)..."
rsync -av --exclude='node_modules' --exclude='.next' --exclude='.convex/local' \
  "$SRC/" "$DEST/"
echo "    Done."

echo ""
echo "==> [2/4] Installing Linux-native packages in WSL filesystem..."
cd "$DEST"
rm -f package-lock.json
npm install
echo "    Done."

echo ""
echo "==> [3/4] Making start.sh executable..."
chmod +x "$DEST/start.sh"
echo "    Done."

echo ""
echo "==> [4/4] Migration complete!"
echo ""
echo "    Project is now at: $DEST"
echo "    Windows path:      \\\\wsl\$\\Ubuntu\\home\\$USER\\zolofy-agentic"
echo ""
echo "    To start your dev environment each day:"
echo "      bash ~/zolofy-agentic/start.sh"
echo ""
echo "    To point Cowork at the new folder, select:"
echo "      \\\\wsl\$\\Ubuntu\\home\\$USER\\zolofy-agentic"
