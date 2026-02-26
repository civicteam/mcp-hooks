#!/bin/bash
# Runner for the playwright-tokensaver-proxy stdio MCP server

cd "$(dirname "$0")"

if [ ! -d "dist" ]; then
  echo "Building playwright-tokensaver-proxy..." >&2
  pnpm build
fi

exec node dist/index.js
