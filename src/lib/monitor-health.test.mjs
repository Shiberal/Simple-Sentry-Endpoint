import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeMonitorHealth, describeSchedule, lastScheduledRun, nextScheduledRun } from './monitor-health.js';
import { parseCronSchedule, isMonitorDueForHttpPing } from './monitor-schedule.js';

const now = new Date('2026-05-01T10:12:30.000Z');
const at = (min) => new Date(now.getTime() - min * 60000);
const mon = (over = {}) => ({ schedule: '*/5 * * * *', pingUrls: [], status: 'active', createdAt: at(24 * 60), ...over });
const run = (status, minAgo) => ({ status, createdAt: at(minAgo) });

test('describeSchedule wording', () => {
  assert.equal(describeSchedule('*/5 * * * *'), 'Every 5 minutes');
  assert.equal(describeSchedule('0 * * * *'), 'Every hour');
  assert.equal(describeSchedule('30 2 * * *'), 'Daily at 02:30');
  assert.equal(describeSchedule('0 9 * * 1-5'), 'Weekdays at 09:00');
  assert.equal(describeSchedule('0 9 * * 1'), 'Mondays at 09:00');
  assert.equal(describeSchedule('nonsense'), 'nonsense');
});

test('last/next scheduled run', () => {
  const parsed = parseCronSchedule('*/5 * * * *');
  assert.equal(lastScheduledRun(parsed, now).getUTCMinutes() % 5, 0);
  assert.ok(nextScheduledRun(parsed, now) > now);
});

test('health states', () => {
  const f = (m, latest, lastFinished) => computeMonitorHealth({ monitor: m, latest, lastFinished, now }).health;
  assert.equal(f(mon(), run('ok', 1), run('ok', 1)), 'ok');
  assert.equal(f(mon(), run('error', 1), run('error', 1)), 'failing');
  assert.equal(f(mon(), run('ok', 30), run('ok', 30)), 'missed');
  assert.equal(f(mon({ status: 'paused' }), run('ok', 30), run('ok', 30)), 'paused');
  assert.equal(f(mon(), run('in_progress', 1), run('ok', 30)), 'running');
  assert.equal(f(mon(), run('in_progress', 300), run('ok', 30)), 'missed', 'stale in_progress is not "running"');
  assert.equal(f(mon(), null, null), 'missed', 'old monitor that never ran');
  assert.equal(f(mon({ createdAt: at(1) }), null, null), 'pending', 'brand new monitor');
  assert.equal(f(mon({ schedule: null }), null, null), 'unknown');
  assert.equal(f(mon({ schedule: null, pingUrls: ['https://a.b'] }), run('ok', 1), run('ok', 1)), 'ok');
  assert.equal(f(mon({ schedule: null, pingUrls: ['https://a.b'] }), run('ok', 60), run('ok', 60)), 'missed');
});

test('a run within grace is not missed', () => {
  // last */5 slot was :10, now is :12:30 -> 2.5 min, grace is 2 min but interval*10% = 0.5 -> floor 2 min
  const parsed = parseCronSchedule('*/5 * * * *');
  const expected = lastScheduledRun(parsed, now);
  const justAfter = new Date(expected.getTime() + 30000);
  const health = computeMonitorHealth({ monitor: mon(), latest: { status: 'ok', createdAt: justAfter }, lastFinished: { status: 'ok', createdAt: justAfter }, now });
  assert.equal(health.health, 'ok');
});

test('first HTTP ping is not lost when the worker misses the exact minute', () => {
  const m = { schedule: '*/5 * * * *', lastCheckInAt: null, createdAt: at(12) };
  assert.equal(isMonitorDueForHttpPing(m, now), true, 'a slot passed since creation');
  assert.equal(isMonitorDueForHttpPing({ ...m, createdAt: at(1) }, now), false, 'nothing due yet');
});
