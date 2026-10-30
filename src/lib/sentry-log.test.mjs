import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isLogContainer,
  logEntryToEvent,
  logContainerToEvents
} from './sentry-log.js';

const sampleEntry = {
  body: 'prod-ordini-odierni status=200 bodyType=List<dynamic> body=[]',
  level: 'info',
  trace_id: '5218cb5f1aa64ccaae7c8ed7f3c83da7',
  timestamp: 1793374846.97599,
  attributes: {
    'os.name': { type: 'string', value: 'iOS' },
    'user.id': { type: 'string', value: 'XXXX' },
    'os.rooted': { type: 'boolean', value: false },
    'os.version': { type: 'string', value: '27.2' },
    'user.email': { type: 'string', value: 'listino' },
    'device.model': { type: 'string', value: 'iPhone17,1' },
    'device.family': { type: 'string', value: 'iOS' },
    'sentry.release': { type: 'string', value: 'it.agorasoft.coalvi@2.1.5+27' },
    'sentry.sdk.name': { type: 'string', value: 'sentry.dart.flutter' },
    'sentry.environment': { type: 'string', value: 'production' },
    'sentry.sdk.version': { type: 'string', value: '10.2.0' }
  },
  severity_number: 9
};

test('detects flutter log containers', () => {
  assert.equal(isLogContainer({ items: [sampleEntry, sampleEntry] }), true);
  assert.equal(isLogContainer({ message: 'hi' }), false);
  assert.equal(isLogContainer({ items: [{ foo: 1 }] }), false);
  assert.equal(isLogContainer({ items: [] }), false);
});

test('maps log entry to MESSAGE-shaped event', () => {
  const ev = logEntryToEvent(sampleEntry);
  assert.equal(ev.message, sampleEntry.body);
  assert.equal(ev.level, 'info');
  assert.equal(ev.logger, 'sentry.log');
  assert.equal(ev.platform, 'flutter');
  assert.equal(ev.release, 'it.agorasoft.coalvi@2.1.5+27');
  assert.equal(ev.environment, 'production');
  assert.equal(ev.user?.email, 'listino');
  assert.equal(ev.user?.id, 'XXXX');
  assert.equal(ev.contexts?.os?.name, 'iOS');
  assert.equal(ev.contexts?.device?.model, 'iPhone17,1');
  assert.equal(ev.contexts?.trace?.trace_id, sampleEntry.trace_id);
  assert.equal(ev.sdk?.name, 'sentry.dart.flutter');
  assert.equal(ev.sdk?.version, '10.2.0');
});

test('parameterized logs fingerprint on template', () => {
  const entry = {
    ...sampleEntry,
    body: 'User John has logged in!',
    attributes: {
      ...sampleEntry.attributes,
      'sentry.message.template': { type: 'string', value: 'User %s has logged in!' },
      'sentry.message.parameter.0': { type: 'string', value: 'John' }
    }
  };
  const ev = logEntryToEvent(entry);
  assert.deepEqual(ev.fingerprint, ['sentry.log', 'User %s has logged in!']);
});

test('expands container into one event per entry', () => {
  const events = logContainerToEvents({ items: [sampleEntry, sampleEntry] });
  assert.equal(events.length, 2);
  assert.equal(events[0].message, sampleEntry.body);
});
