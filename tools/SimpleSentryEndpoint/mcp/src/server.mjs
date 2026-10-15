import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SentryClient } from './client.mjs';
import { buildTools, text } from './tools.mjs';

export function createServer({ client, allowWrites = false }) {
  const server = new McpServer({ name: 'sentry-monitor', version: '0.1.0' });
  for (const tool of buildTools(client)) {
    if (tool.write && !allowWrites) continue;
    if (tool.cron && !client.cronSecret) continue;
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.schema,
        annotations: { readOnlyHint: !tool.write }
      },
      async (args) => {
        try {
          return text(await tool.run(args));
        } catch (e) {
          return { isError: true, content: [{ type: 'text', text: e.message }] };
        }
      }
    );
  }
  return server;
}

export function clientFromEnv(env = process.env) {
  return new SentryClient({
    baseUrl: env.SENTRY_MONITOR_URL,
    email: env.SENTRY_MONITOR_EMAIL,
    password: env.SENTRY_MONITOR_PASSWORD,
    cronSecret: env.MONITOR_CRON_SECRET
  });
}
