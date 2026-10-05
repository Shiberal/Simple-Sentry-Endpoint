import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSample, downsample, generateReportToken } from './monitor-resources.js';

test('parseSample accepts valid numbers and drops unknown fields', () => {
  const { sample } = parseSample({ cpuPercent: 12.5, memUsedBytes: 1024, junk: 'x' });
  assert.deepEqual(sample, { cpuPercent: 12.5, memUsedBytes: 1024 });
});

test('parseSample rejects bad input', () => {
  assert.ok(parseSample(null).error);
  assert.ok(parseSample({}).error);
  assert.ok(parseSample({ cpuPercent: -1 }).error);
  assert.ok(parseSample({ cpuPercent: '5' }).error);
  assert.ok(parseSample({ memUsedBytes: Infinity }).error);
});

test('downsample caps the series length', () => {
  const rows = Array.from({ length: 1000 }, (_, i) => i);
  assert.equal(downsample(rows, 100).length, 100);
  assert.equal(downsample([1, 2, 3], 100).length, 3);
});

test('tokens are unique and prefixed', () => {
  assert.notEqual(generateReportToken(), generateReportToken());
  assert.match(generateReportToken(), /^smr_[0-9a-f]{48}$/);
});
