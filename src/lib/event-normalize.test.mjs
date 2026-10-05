import assert from 'node:assert/strict';
import { normalizeOrigin } from './event-normalize.js';

assert.equal(normalizeOrigin({ request: { url: 'https://Massagest.agoracloud.it/a?b=1' } }), 'massagest.agoracloud.it');
assert.equal(normalizeOrigin({ request: { url: 'http://localhost:9001/x' } }), 'localhost:9001');
assert.equal(normalizeOrigin({ extra: { page_url: 'http://localhost:9001/' } }), 'localhost:9001');
assert.equal(normalizeOrigin({}, { headers: { origin: 'http://localhost:9001' } }), 'localhost:9001');
assert.equal(normalizeOrigin({}, { headers: { referer: 'https://a.example.com/p' } }), 'a.example.com');
assert.equal(normalizeOrigin({ server_name: 'Host-1' }), 'host-1');
assert.equal(normalizeOrigin({}), null);
console.log('ok');
