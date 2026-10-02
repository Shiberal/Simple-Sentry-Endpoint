import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { SentryClient } from '../src/client.mjs';
import { createServer } from '../src/server.mjs';

function stubApi() {
  const seen = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      seen.push({ method: req.method, url: req.url, cookie: req.headers.cookie, auth: req.headers.authorization, body });
      res.setHeader('content-type', 'application/json');
      if (req.url === '/api/auth/login') {
        res.setHeader('Set-Cookie', 'session=%7B%22userId%22%3A1%7D; Path=/; HttpOnly');
        return res.end('{"success":true}');
      }
      if (req.url.startsWith('/api/issues/404')) { res.statusCode = 404; return res.end('{"error":"nope"}'); }
      res.end(JSON.stringify({ ok: true, url: req.url }));
    });
  });
  return new Promise((r) => server.listen(0, () => r({ server, seen, port: server.address().port })));
}

async function connect({ port, allowWrites, cronSecret }) {
  const client = new SentryClient({ baseUrl: `http://127.0.0.1:${port}`, email: 'a@b.c', password: 'x', cronSecret });
  const mcp = createServer({ client, allowWrites });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await mcp.connect(a);
  const c = new Client({ name: 't', version: '0' });
  await c.connect(b);
  return c;
}

test('read-only by default; logs in and sends cookie', async () => {
  const { server, seen, port } = await stubApi();
  const c = await connect({ port });
  const names = (await c.listTools()).tools.map((t) => t.name);
  assert.ok(names.includes('list_issues') && names.includes('performance_timeseries') && names.includes('list_monitors'));
  assert.ok(!names.includes('update_issue') && !names.includes('run_cron_monitors_ping'));
  const r = await c.callTool({ name: 'list_issues', arguments: { projectId: 1, status: 'active', pageSize: 5 } });
  assert.match(r.content[0].text, /"ok": true/);
  const call = seen.find((s) => s.url.startsWith('/api/issues'));
  assert.equal(call.url, '/api/issues?projectId=1&status=active&pageSize=5');
  assert.match(call.cookie, /^session=/);
  server.close();
});

test('write tools and cron tool appear only when enabled', async () => {
  const { server, seen, port } = await stubApi();
  const c = await connect({ port, allowWrites: true, cronSecret: 's3' });
  const names = (await c.listTools()).tools.map((t) => t.name);
  assert.ok(names.includes('update_issue') && names.includes('run_cron_monitors_ping'));
  await c.callTool({ name: 'run_cron_monitors_ping', arguments: { force: true } });
  const cron = seen.find((s) => s.url.startsWith('/api/cron'));
  assert.equal(cron.url, '/api/cron/monitors-ping?force=1');
  assert.equal(cron.auth, 'Bearer s3');
  assert.equal(cron.cookie, undefined);
  await c.callTool({ name: 'update_issue', arguments: { issueId: 3, status: 'RESOLVED' } });
  const patch = seen.find((s) => s.method === 'PATCH');
  assert.equal(patch.url, '/api/issues/3');
  assert.equal(patch.body, '{"status":"RESOLVED"}');
  server.close();
});

test('API errors come back as tool errors', async () => {
  const { server, port } = await stubApi();
  const c = await connect({ port });
  const r = await c.callTool({ name: 'get_issue', arguments: { issueId: 404 } });
  assert.equal(r.isError, true);
  assert.match(r.content[0].text, /HTTP 404\): nope/);
  server.close();
});
