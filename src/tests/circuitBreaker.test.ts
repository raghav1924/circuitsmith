/**
 * CircuitSmith Circuit Breaker & Bulkhead Tests
 * Author: Jatin Sharma (https://jatinsh.netlify.app/)
 */

import test from 'node:test';
import assert from 'node:assert';
import { CircuitBreaker } from '../core/circuitBreaker.js';

test('CircuitBreaker: allows normal execution in CLOSED state', async () => {
  const breaker = new CircuitBreaker('test-service', { minimumNumberOfCalls: 3 });
  const res = await breaker.execute(async () => 'OK');

  assert.strictEqual(res.outcome, 'SUCCESS');
  assert.strictEqual(res.value, 'OK');
  assert.strictEqual(res.circuitState, 'CLOSED');
});

test('CircuitBreaker: trips to OPEN when failure rate crosses threshold', async () => {
  const breaker = new CircuitBreaker('test-flaky', {
    failureRateThreshold: 50,
    minimumNumberOfCalls: 4,
    slidingWindowSize: 4
  });

  // 1 success, 3 failures
  await breaker.execute(async () => 'ok');
  await breaker.execute(async () => { throw new Error('fail 1'); });
  await breaker.execute(async () => { throw new Error('fail 2'); });
  await breaker.execute(async () => { throw new Error('fail 3'); });

  assert.strictEqual(breaker.getState(), 'OPEN');
});

test('CircuitBreaker: fast-fails immediately with fallback when OPEN', async () => {
  const breaker = new CircuitBreaker('test-open', { waitDurationInOpenStateMs: 10000 });
  breaker.trip();

  const start = Date.now();
  const res = await breaker.execute(
    async () => 'should not run',
    async () => 'safe-cached-fallback'
  );
  const elapsed = Date.now() - start;

  assert.strictEqual(res.outcome, 'REJECTED_OPEN');
  assert.strictEqual(res.value, 'safe-cached-fallback');
  assert.strictEqual(res.fallbackUsed, true);
  assert.ok(elapsed < 5, 'Fast-fail should take under 5ms');
});

test('CircuitBreaker: transitions to HALF_OPEN and recovers on successful probes', async () => {
  const breaker = new CircuitBreaker('test-recover', {
    waitDurationInOpenStateMs: 50, // fast transition for testing
    enableHalfOpenJitter: false,
    permittedNumberOfCallsInHalfOpenState: 2
  });

  breaker.trip();
  assert.strictEqual(breaker.getState(), 'OPEN');

  // Wait for open duration
  await new Promise((r) => setTimeout(r, 60));
  assert.strictEqual(breaker.getState(), 'HALF_OPEN');

  // Probe 1
  const res1 = await breaker.execute(async () => 'probe 1 pass');
  assert.strictEqual(res1.outcome, 'SUCCESS');

  // Probe 2
  const res2 = await breaker.execute(async () => 'probe 2 pass');
  assert.strictEqual(res2.outcome, 'SUCCESS');

  // Circuit should have recovered back to CLOSED
  assert.strictEqual(breaker.getState(), 'CLOSED');
});

test('CircuitBreaker: bulkhead limits concurrent calls', async () => {
  const breaker = new CircuitBreaker('test-bulkhead', {
    maxConcurrentCalls: 1
  });

  let resolveFirst: any;
  const firstPromise = new Promise((r) => { resolveFirst = r; });

  // Call 1 holds the 1 available slot
  const p1 = breaker.execute(async () => {
    await firstPromise;
    return 'p1';
  });

  // Call 2 arrives while slot is occupied -> rejected by bulkhead
  const p2 = await breaker.execute(
    async () => 'p2',
    async () => 'bulkhead-fallback'
  );

  assert.strictEqual(p2.outcome, 'REJECTED_BULKHEAD');
  assert.strictEqual(p2.fallbackUsed, true);

  resolveFirst();
  const res1 = await p1;
  assert.strictEqual(res1.outcome, 'SUCCESS');
});
