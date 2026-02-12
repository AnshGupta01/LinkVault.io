#!/bin/bash
set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "Installing dependencies..."
npm --prefix "$SCRIPT_DIR/backend" install
npm --prefix "$SCRIPT_DIR/frontend" install

echo "Starting backend + frontend..."

npx concurrently \
  "npm --prefix $SCRIPT_DIR/backend run dev" \
  "npm --prefix $SCRIPT_DIR/frontend run dev -- --host"
