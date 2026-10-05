import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeMonitorStats, percentile, summarizeProjectStats } from './monitor-stats.js';

const now = new Date('2026-10-05T12:00:00Z');
const at = (minsAgo) => new Date(now.getTime() - minsAgo * 60000);
const run = (minsAgo, status, durationMs = 100) => ({ status, durationMs, createdAt: at(minsAgo) });

test('percentile uses nearest rank', () => {
  assert.equal(percentile([], 95), null);
  assert.equal(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 95), 10);
  assert.equal(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 50), 5);
});

test('windows count runs, uptime and latency; in_progress is ignored', () => {
  const s = computeMonitorStats({
    now,
    checkIns: [run(10, 'ok', 100), run(20, 'ok', 300), run(30, 'error', 9999), run(5, 'in_progress', null), run(60 * 24 * 3, 'ok', 50)]
  });
  assert.equal(s.windows['24h'].runs, 3);
  assert.equal(s.windows['24h'].uptime, 66.7);
  assert.equal(s.windows['24h'].avgMs, 200); // failed run latency excluded
  assert.equal(s.windows['7d'].runs, 4);
  assert.equal(s.windows['30d'].p95Ms, 300);
});

test('streak and incidents', () => {
  const s = computeMonitorStats({
    now,
    checkIns: [run(100, 'ok'), run(90, 'error'), run(80, 'error'), run(70, 'ok'), run(60, 'ok'), run(20, 'error'), run(10, 'error')]
  });
  assert.deepEqual([s.streak.status, s.streak.count], ['error', 2]);
  assert.equal(s.incidents.count30d, 2);
  assert.equal(s.incidents.ongoing, true);
  assert.equal(s.incidents.currentDowntimeMs, 20 * 60000);
  assert.equal(s.incidents.mttrMs, 20 * 60000); // 90 -> 70
  assert.equal(s.incidents.longestMs, 20 * 60000);
  assert.equal(s.incidents.recent[1].failedRuns, 2);
  assert.equal(s.lastSuccessAt.getTime(), at(60).getTime());
});

test('empty monitor yields nulls and a full daily series', () => {
  const s = computeMonitorStats({ now, checkIns: [] });
  assert.equal(s.windows['24h'].uptime, null);
  assert.equal(s.streak, null);
  assert.equal(s.daily.length, 30);
  assert.equal(s.daily[29].date, '2026-10-05');
});

test('project summary pools runs across monitors', () => {
  const a = computeMonitorStats({ now, checkIns: [run(10, 'ok'), run(20, 'ok')] });
  const b = computeMonitorStats({ now, checkIns: [run(10, 'error')] });
  const sum = summarizeProjectStats([a, b]);
  assert.equal(sum.windows['24h'].uptime, 66.7);
  assert.equal(sum.incidentsOpen, 1);
  assert.equal(sum.daily[29].error, 1);
});
