/**
 * CircuitSmith Resilience Proxy Integration Tests
 * Author: Jatin Sharma (https://jatinsh.netlify.app/)
 */

import test from 'node:test';
import assert from 'node:assert';
import http from 'http';
import { ResilienceProxy } from '../proxy/resilienceProxy.js';

function requestPromise(url: string, method = 'GET'): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        resolve({ statusCode: res.statusCode || 200, headers: res.headers, body: data });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

test('ResilienceProxy: passes normal traffic, fast-fails when tripped, and resets', async () => {
  const testPort = 8997;
  const proxy = new ResilienceProxy({ port: testPort });
  await proxy.start();

  try {
    // 1. Initial request -> CLOSED
    const res1 = await requestPromise(`http://localhost:${testPort}/api/resource`);
    assert.strictEqual(res1.statusCode, 200);
    assert.strictEqual(res1.headers['x-circuit-state'], 'CLOSED');

    // 2. Trip circuit
    const tripRes = await requestPromise(`http://localhost:${testPort}/__circuitsmith/trip`);
    const tripJson = JSON.parse(tripRes.body);
    assert.strictEqual(tripJson.state, 'OPEN');

    // 3. Request while OPEN -> 503 fast-fail
    const res2 = await requestPromise(`http://localhost:${testPort}/api/resource`);
    assert.strictEqual(res2.statusCode, 503);
    assert.strictEqual(res2.headers['x-circuit-state'], 'OPEN');
    assert.strictEqual(res2.headers['x-circuit-outcome'], 'REJECTED_OPEN');

    // 4. Reset circuit
    const resetRes = await requestPromise(`http://localhost:${testPort}/__circuitsmith/reset`);
    const resetJson = JSON.parse(resetRes.body);
    assert.strictEqual(resetJson.state, 'CLOSED');

    // 5. Request after reset -> 200
    const res3 = await requestPromise(`http://localhost:${testPort}/api/resource`);
    assert.strictEqual(res3.statusCode, 200);
    assert.strictEqual(res3.headers['x-circuit-state'], 'CLOSED');
  } finally {
    await proxy.stop();
  }
});
