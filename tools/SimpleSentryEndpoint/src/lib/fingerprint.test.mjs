import { generateFingerprint, normalizeFilename } from './fingerprint.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';
const ev = (msg, file='https://cdn.x.io/main.4f9a2c1b.js?v=3', extra={}) => ({ exception:{values:[{type:'TypeError',value:msg,stacktrace:{frames:[{filename:'lib.js',function:'a',in_app:false},{filename:file,function:'load',in_app:true,lineno:10}]}}]}, ...extra });

test('fingerprint grouping', () => {
  assert.equal(generateFingerprint(ev('User 42 not found')), generateFingerprint(ev('User 97 not found')), 'msg vars group');
  assert.equal(generateFingerprint(ev('x','https://cdn.x.io/main.99aa11bb.js')), generateFingerprint(ev('x','https://cdn.x.io/main.4f9a2c1b.js?v=3')), 'hashed bundle groups');
  assert.notEqual(generateFingerprint(ev('x')), generateFingerprint(ev('x','https://cdn.x.io/other.js')), 'different file splits');
  assert.equal(normalizeFilename('https://a.b/static/app.abcdef123456.js?x=1'), 'static/app.js');
  const noStack = (m)=>({message:m,platform:'node'});
  assert.equal(generateFingerprint(noStack('Order 1234 failed for a@b.co')), generateFingerprint(noStack('Order 55 failed for z@y.io')));
  assert.notEqual(generateFingerprint(noStack('Payment failed')), generateFingerprint(noStack('Login failed')));
  const custom = generateFingerprint(ev('a',undefined,{fingerprint:['my-group']}));
  assert.equal(custom, generateFingerprint(ev('totally different',undefined,{fingerprint:['my-group']})));
  assert.notEqual(generateFingerprint(ev('a',undefined,{fingerprint:['{{ default }}','tenant-1']})), generateFingerprint(ev('a',undefined,{fingerprint:['{{ default }}','tenant-2']})));
  assert.equal(generateFingerprint(ev('a',undefined,{fingerprint:['{{ default }}']})), generateFingerprint(ev('a')), 'default-only custom equals default');
});
