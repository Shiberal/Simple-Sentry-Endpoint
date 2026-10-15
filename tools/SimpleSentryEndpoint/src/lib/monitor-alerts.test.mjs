import { test } from 'node:test';
import assert from 'node:assert/strict';
import { thresholdReached, buildAlertMessage, parseAlertFields, describeFailure } from './monitor-alerts.js';

const err = { status: 'error' };
const ok = { status: 'ok' };

test('threshold needs N consecutive failures, newest first', () => {
  assert.equal(thresholdReached([err], 1), true);
  assert.equal(thresholdReached([ok], 1), false);
  assert.equal(thresholdReached([err, ok], 2), false);
  assert.equal(thresholdReached([err, err], 2), true);
  assert.equal(thresholdReached([err], 3), false); // not enough history yet
});

test('messages name the monitor, reason and link', () => {
  const m = { id: 5, slug: 'api', name: 'API', environment: 'prod' };
  const down = buildAlertMessage({ kind: 'down', monitor: m, project: { name: 'Demo' }, reason: 'HTTP 500', baseUrl: 'https://x.io' });
  assert.match(down.text, /Monitor offline: API/);
  assert.match(down.text, /Reason: HTTP 500/);
  assert.match(down.text, /https:\/\/x.io\/monitors\/5/);
  const up = buildAlertMessage({ kind: 'recovered', monitor: m, project: { name: 'Demo' }, downForMs: 5 * 60000 });
  assert.match(up.text, /Monitor back online: API/);
  assert.match(up.text, /Down for 5 min/);
});

test('failure reason comes from failed ping results', () => {
  assert.equal(describeFailure({ data: { results: [{ ok: false, url: 'https://a', status: 503 }] } }), 'https://a: HTTP 503');
  assert.equal(describeFailure({ data: {} }), null);
});

test('alert settings are validated', () => {
  assert.deepEqual(parseAlertFields({}), { data: {} });
  assert.equal(parseAlertFields({ failureThreshold: 0 }).error !== undefined, true);
  assert.equal(parseAlertFields({ alertEmails: 'nope' }).error !== undefined, true);
  assert.equal(parseAlertFields({ alertSlackUrl: 'ftp://x' }).error !== undefined, true);
  assert.deepEqual(parseAlertFields({ alertEmails: 'a@b.co, c@d.io', alertSlackUrl: '', failureThreshold: '3' }).data, { alertEmails: 'a@b.co, c@d.io', alertSlackUrl: null, failureThreshold: 3 });
});
