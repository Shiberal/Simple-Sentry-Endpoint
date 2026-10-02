#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer, clientFromEnv } from './server.mjs';

if (!process.env.SENTRY_MONITOR_URL) {
  console.error('SENTRY_MONITOR_URL is required (e.g. https://errors.example.com)');
  process.exit(1);
}

const server = createServer({
  client: clientFromEnv(),
  allowWrites: process.env.SENTRY_MCP_ALLOW_WRITES === '1'
});
await server.connect(new StdioServerTransport());
