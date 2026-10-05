import assert from 'node:assert/strict';
import { summarizeTransactions } from './performance-summary.js';

const tx = (name, ms, status, minute) => ({ id: `${name}${minute}${ms}`, createdAt: new Date(Date.UTC(2026, 0, 1, 0, minute)).toISOString(), data: { transaction: name, start_timestamp: 100, timestamp: 100 + ms / 1000, contexts: { trace: { status } } } });
const s = summarizeTransactions([tx('GET /a', 100, 'ok', 0), tx('GET /a', 300, 'ok', 5), tx('GET /b', 2000, 'internal_error', 10), tx('GET /b', 1000, 'ok', 10)]);
assert.equal(s.total, 4);
assert.equal(s.errors, 1);
assert.equal(s.endpoints.find((e) => e.name === 'GET /b').errorRate, 0.5);
assert.equal(s.slowest[0].ms, 2000);
assert.equal(s.p95, 2000);
assert.equal(s.histogram.reduce((n, b) => n + b.count, 0), 4);
assert.equal(summarizeTransactions([]), null);
console.log('ok');
