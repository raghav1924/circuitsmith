/**
 * CircuitSmith Middleware Generator Tests
 * Author: Jatin Sharma (https://jatinsh.netlify.app/)
 */

import test from 'node:test';
import assert from 'node:assert';
import { ResilienceGenerator } from '../generators/resilienceGen.js';
import { FrameworkType } from '../types.js';

test('ResilienceGenerator: produces valid production code for all 6 frameworks', () => {
  const frameworks: FrameworkType[] = ['nextjs', 'express', 'fastify', 'cloudflare', 'hono', 'fastapi'];

  for (const fw of frameworks) {
    const res = ResilienceGenerator.generate(fw, { failureThreshold: 40, openDurationSec: 8, bulkheadLimit: 20 });
    assert.strictEqual(res.framework, fw);
    assert.ok(res.code.length > 50, `Framework ${fw} generated empty code`);
    assert.ok(res.title.length > 0);
    assert.ok(res.filename.length > 0);
    assert.ok(res.code.includes('40') || res.code.includes('8') || res.code.includes('20'), `Config values reflected in ${fw}`);
  }
});
