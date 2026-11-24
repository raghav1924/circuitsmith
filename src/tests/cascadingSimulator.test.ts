/**
 * CircuitSmith Cascading Failure Simulator Tests
 * Author: Jatin Sharma (https://jatinsh.netlify.app/)
 */

import test from 'node:test';
import assert from 'node:assert';
import { CascadingSimulator } from '../core/cascadingSimulator.js';

test('CascadingSimulator: confirms circuit breakers prevent multi-tier service collapse', async () => {
  const result = await CascadingSimulator.simulate(50, 0.9, 100);

  assert.strictEqual(result.totalRequests, 50);
  assert.strictEqual(result.withCircuitBreakers.cascadingCascadeStopped, true);
  assert.strictEqual(result.withoutCircuitBreakers.cascadingCascadeStopped, false);

  assert.ok(result.withCircuitBreakers.survivingServicesPercent > result.withoutCircuitBreakers.survivingServicesPercent);
  assert.ok(result.withCircuitBreakers.avgLatencyMs < result.withoutCircuitBreakers.avgLatencyMs);
});
