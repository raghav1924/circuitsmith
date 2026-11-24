/**
 * CircuitSmith Resilience Linter Tests
 * Author: Jatin Sharma (https://jatinsh.netlify.app/)
 */

import test from 'node:test';
import assert from 'node:assert';
import { ResilienceLinter } from '../linter/resilienceLinter.js';

test('ResilienceLinter: catches critical missing fallback vulnerability (CIRCUIT-001)', () => {
  const result = ResilienceLinter.audit({
    circuitConfig: { failureRateThreshold: 50 },
    hasFallback: false,
    timeoutMs: 2000
  });

  assert.ok(result.issues.some((i) => i.code === 'CIRCUIT-001'));
  assert.strictEqual(result.isProductionReady, false);
});

test('ResilienceLinter: catches dangerous retry-storm amplification (CIRCUIT-011)', () => {
  const result = ResilienceLinter.audit({
    circuitConfig: { failureRateThreshold: 50 },
    hasFallback: true,
    timeoutMs: 2000,
    hasRetry: true,
    retryCount: 5
  });

  const issue = result.issues.find((i) => i.code === 'CIRCUIT-011');
  assert.ok(issue);
  assert.strictEqual(issue?.severity, 'CRITICAL');
});

test('ResilienceLinter: awards A+ grade to hardened resilience architecture', () => {
  const result = ResilienceLinter.audit({
    circuitConfig: {
      failureRateThreshold: 50,
      slowCallRateThreshold: 50,
      slowCallDurationThresholdMs: 1000,
      minimumNumberOfCalls: 10,
      maxConcurrentCalls: 15,
      waitDurationInOpenStateMs: 5000,
      enableHalfOpenJitter: true
    },
    timeoutMs: 2000,
    hasFallback: true,
    hasRetry: false,
    hasStateListener: true,
    injectHeader: true
  });

  assert.strictEqual(result.grade, 'A+');
  assert.ok(result.score >= 95);
  assert.strictEqual(result.isProductionReady, true);
});
