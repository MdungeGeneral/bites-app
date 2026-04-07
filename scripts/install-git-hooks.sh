#!/bin/sh
# Install repository Git hooks: set core.hooksPath to .githooks
set -e
ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || echo .)"
cd "$ROOT_DIR"

echo "Setting git core.hooksPath to .githooks in this repository"
git config core.hooksPath .githooks

echo "Done. To verify, run: git config core.hooksPath"
