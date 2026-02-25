#!/usr/bin/env node

import process from "node:process";
import { createStdioPassthroughProxy } from "@civic/passthrough-mcp-server";
import {
  getDefaultEnvironment,
  StdioClientTransport,
} from "@modelcontextprotocol/sdk/client/stdio.js";
import { PlaywrightTokenSaverHook } from "./hook.js";

const DEFAULT_PLAYWRIGHT_COMMAND = "npx";
const DEFAULT_PLAYWRIGHT_ARGS = ["-y", "@playwright/mcp@latest"];

function isTruthy(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function buildDefaultArgsWithFlags(): string[] {
  const args = [...DEFAULT_PLAYWRIGHT_ARGS];

  if (isTruthy(process.env.PLAYWRIGHT_HEADLESS)) {
    args.push("--headless");
  }

  if (isTruthy(process.env.PLAYWRIGHT_ISOLATED)) {
    args.push("--isolated");
  }

  return args;
}

function parsePlaywrightArgs(): string[] {
  const argsJson = process.env.PLAYWRIGHT_ARGS_JSON;
  if (argsJson) {
    const parsed = JSON.parse(argsJson) as unknown;
    if (
      !Array.isArray(parsed) ||
      parsed.some((arg) => typeof arg !== "string")
    ) {
      throw new Error("PLAYWRIGHT_ARGS_JSON must be a JSON string array");
    }
    return parsed;
  }

  const argsCsv = process.env.PLAYWRIGHT_ARGS;
  if (!argsCsv) {
    return buildDefaultArgsWithFlags();
  }

  const parsed = argsCsv
    .split(",")
    .map((arg) => arg.trim())
    .filter((arg) => arg.length > 0);

  return parsed.length > 0 ? parsed : buildDefaultArgsWithFlags();
}

function buildTransportEnv(): Record<string, string> {
  const mergedEnv: NodeJS.ProcessEnv = {
    ...getDefaultEnvironment(),
    ...process.env,
  };

  const cleanedEntries = Object.entries(mergedEnv).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string",
  );

  return Object.fromEntries(cleanedEntries);
}

async function main(): Promise<void> {
  const command = process.env.PLAYWRIGHT_COMMAND || DEFAULT_PLAYWRIGHT_COMMAND;
  const args = parsePlaywrightArgs();
  const cwd = process.env.PLAYWRIGHT_CWD;

  const proxy = await createStdioPassthroughProxy({
    target: {
      transportType: "custom",
      transportFactory: () =>
        new StdioClientTransport({
          command,
          args,
          ...(cwd ? { cwd } : {}),
          env: buildTransportEnv(),
        }),
    },
    hooks: [new PlaywrightTokenSaverHook()],
  });

  const shutdown = async () => {
    await proxy.stop();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown();
  });

  process.on("SIGTERM", () => {
    void shutdown();
  });

  process.stdin.resume();
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`playwright-tokensaver-proxy failed: ${message}\n`);
  process.exit(1);
});
