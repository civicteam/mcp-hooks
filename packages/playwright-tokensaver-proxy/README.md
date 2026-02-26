# @civic/playwright-tokensaver-proxy

A single stdio MCP server that proxies to Playwright MCP and adds a token-saving `run_code_cheap` tool.

## What it does

- Runs as one stdio MCP server (easy to drop into MCP client config)
- Launches upstream Playwright MCP via stdio:
  - default command: `npx -y @playwright/mcp@latest`
- Clones `browser_run_code` into `run_code_cheap`
- Keeps all Playwright tools exposed
- Adds guidance to `browser_*` tools to prefer `run_code_cheap` when full output is not needed
- Rewrites `run_code_cheap` calls through a harness and returns compact results:
  - `success`
  - `failure`

## Behavioral contract for `run_code_cheap`

Your provided code should return:

```json
{ "success": true }
```

Anything else is treated as failure:
- throw
- `{ "success": false }`
- invalid return shape

## Usage

### Start directly

```bash
cd packages/playwright-tokensaver-proxy
pnpm build
pnpm start
```

### Use from MCP client config

```json
{
  "mcpServers": {
    "playwright-tokensaver-proxy": {
      "type": "stdio",
      "command": "../packages/playwright-tokensaver-proxy/run.sh",
      "args": []
    }
  }
}
```

## Environment variables

- `PLAYWRIGHT_COMMAND`:
  default `npx`
- `PLAYWRIGHT_ARGS`:
  comma-separated args, e.g. `-y,@playwright/mcp@latest,--headless,--isolated`
- `PLAYWRIGHT_ARGS_JSON`:
  JSON array alternative to `PLAYWRIGHT_ARGS` (takes precedence)
- `PLAYWRIGHT_HEADLESS`:
  set to `true`/`1`/`yes` to append `--headless` when using default args
- `PLAYWRIGHT_ISOLATED`:
  set to `true`/`1`/`yes` to append `--isolated` when using default args
- `PLAYWRIGHT_CWD`:
  optional working directory for the upstream Playwright MCP process
