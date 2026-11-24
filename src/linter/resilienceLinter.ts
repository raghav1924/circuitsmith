/**
 * CircuitSmith Resilience & Circuit Breaker Configuration Linter
 * Evaluates production microservice circuit breaker configs against 16 resilience heuristics.
 * Author: Jatin Sharma (https://jatinsh.netlify.app/)
 */

import { CircuitBreakerConfig, ResilienceAuditResult, ResilienceIssue } from '../types.js';

export interface AuditInput {
  circuitConfig: CircuitBreakerConfig;
  timeoutMs?: number;
  hasFallback?: boolean;
  hasRetry?: boolean;
  retryCount?: number;
  hasStateListener?: boolean;
  injectHeader?: boolean;
}

export class ResilienceLinter {
  static audit(input: AuditInput): ResilienceAuditResult {
    const issues: ResilienceIssue[] = [];
    const cfg = input.circuitConfig;

    // 1. CIRCUIT-001: Missing Fallback Handler
    if (!input.hasFallback) {
      issues.push({
        code: 'CIRCUIT-001',
        severity: 'CRITICAL',
        section: 'FALLBACK',
        message: 'No fallback strategy configured. When the circuit trips OPEN, all incoming requests will throw unhandled exceptions or 503 errors to users.',
        recommendation: 'Provide a graceful fallback handler (e.g. cached data, stale response, or degraded safe default).'
      });
    }

    // 2. CIRCUIT-002: Unbounded Timeout
    const timeout = input.timeoutMs ?? 0;
    if (timeout <= 0 || timeout > 10000) {
      issues.push({
        code: 'CIRCUIT-002',
        severity: 'CRITICAL',
        section: 'TIMEOUT',
        message: `Client timeout is ${timeout <= 0 ? 'disabled' : timeout + 'ms (excessive)'}. Slow upstream responses will exhaust thread and socket pools before circuit evaluation.`,
        recommendation: 'Set strict request timeouts between 500ms and 3000ms.'
      });
    }

    // 3. CIRCUIT-003: Missing Bulkhead
    if (!cfg.maxConcurrentCalls || cfg.maxConcurrentCalls > 100) {
      issues.push({
        code: 'CIRCUIT-003',
        severity: 'HIGH',
        section: 'BULKHEAD',
        message: 'Missing or excessive Bulkhead concurrency limit. Unlimited concurrent requests can overwhelm the local node before the circuit trips.',
        recommendation: 'Configure "maxConcurrentCalls" (semaphore bulkhead) between 10 and 50 to isolate resource pools.'
      });
    }

    // 4. CIRCUIT-004: Low Minimum Number of Calls
    if (cfg.minimumNumberOfCalls !== undefined && cfg.minimumNumberOfCalls < 5) {
      issues.push({
        code: 'CIRCUIT-004',
        severity: 'HIGH',
        section: 'CIRCUIT',
        message: `"minimumNumberOfCalls" is set to ${cfg.minimumNumberOfCalls}. A single isolated network glitch during low-traffic periods will prematurely trip the circuit.`,
        recommendation: 'Set "minimumNumberOfCalls" >= 5 (typically 10-20) to ensure statistical significance.'
      });
    }

    // 5. CIRCUIT-005: Missing Slow-Call Threshold
    if (!cfg.slowCallRateThreshold || !cfg.slowCallDurationThresholdMs) {
      issues.push({
        code: 'CIRCUIT-005',
        severity: 'HIGH',
        section: 'CIRCUIT',
        message: 'Slow-call monitoring is not configured. The circuit will only trip on hard exceptions, ignoring slow upstream degradations that exhaust connection pools.',
        recommendation: 'Configure "slowCallRateThreshold" (e.g. 50%) and "slowCallDurationThresholdMs" (e.g. 1000ms).'
      });
    }

    // 6. CIRCUIT-006: Excessive Wait Duration in Open State
    if (cfg.waitDurationInOpenStateMs && cfg.waitDurationInOpenStateMs > 60000) {
      issues.push({
        code: 'CIRCUIT-006',
        severity: 'MEDIUM',
        section: 'CIRCUIT',
        message: `"waitDurationInOpenStateMs" is ${cfg.waitDurationInOpenStateMs}ms (>60s). Service will remain disconnected for minutes even if upstream recovered immediately.`,
        recommendation: 'Set open state wait duration between 3000ms and 15000ms.'
      });
    }

    // 7. CIRCUIT-007: High Failure Rate Threshold
    if (cfg.failureRateThreshold && cfg.failureRateThreshold > 70) {
      issues.push({
        code: 'CIRCUIT-007',
        severity: 'MEDIUM',
        section: 'CIRCUIT',
        message: `Failure rate threshold (${cfg.failureRateThreshold}%) is too forgiving. Service will tolerate massive failure bursts before shielding the upstream.`,
        recommendation: 'Set "failureRateThreshold" between 40% and 60%.'
      });
    }

    // 8. CIRCUIT-008: Missing Half-Open Jitter
    if (cfg.enableHalfOpenJitter === false) {
      issues.push({
        code: 'CIRCUIT-008',
        severity: 'MEDIUM',
        section: 'CIRCUIT',
        message: 'Half-Open jitter is disabled. When open duration expires, simultaneous client requests will hit the recovering upstream at the exact same millisecond.',
        recommendation: 'Enable randomized jitter on waitDuration to desynchronize probing traffic.'
      });
    }

    // 9. CIRCUIT-009: Small Sliding Window
    if (cfg.slidingWindowSize && cfg.slidingWindowSize < 5) {
      issues.push({
        code: 'CIRCUIT-009',
        severity: 'LOW',
        section: 'CIRCUIT',
        message: `Sliding window size (${cfg.slidingWindowSize}) is too small, causing frequent state flapping.`,
        recommendation: 'Set sliding window size to at least 10 calls.'
      });
    }

    // 10. CIRCUIT-010: High Half-Open Permitted Calls
    if (cfg.permittedNumberOfCallsInHalfOpenState && cfg.permittedNumberOfCallsInHalfOpenState > 10) {
      issues.push({
        code: 'CIRCUIT-010',
        severity: 'LOW',
        section: 'CIRCUIT',
        message: `High half-open probe count (${cfg.permittedNumberOfCallsInHalfOpenState}). Overloads a newly recovering upstream service.`,
        recommendation: 'Set "permittedNumberOfCallsInHalfOpenState" between 2 and 5.'
      });
    }

    // 11. CIRCUIT-011: Retry-Storm Amplification
    if (input.hasRetry && (input.retryCount || 0) > 3) {
      issues.push({
        code: 'CIRCUIT-011',
        severity: 'CRITICAL',
        section: 'RETRY',
        message: `Dangerous retry amplification (${input.retryCount} retries). Retrying failed requests against an already struggling upstream multiplies load and accelerates cascading collapse.`,
        recommendation: 'Cap retries at 1-2 with exponential backoff and disable retries when circuit is OPEN.'
      });
    }

    // 12. CIRCUIT-014: Missing State Change Telemetry
    if (!input.hasStateListener) {
      issues.push({
        code: 'CIRCUIT-014',
        severity: 'LOW',
        section: 'CIRCUIT',
        message: 'No state transition listener registered. Circuit state changes (CLOSED -> OPEN) will occur silently without alerting observability systems.',
        recommendation: 'Attach an event listener to report state transitions to Prometheus/Datadog or trigger pager alerts.'
      });
    }

    // 13. CIRCUIT-016: Missing Circuit State Header
    if (!input.injectHeader) {
      issues.push({
        code: 'CIRCUIT-016',
        severity: 'INFO',
        section: 'CIRCUIT',
        message: 'Response does not include "X-Circuit-State" header. Downstream callers cannot distinguish between origin 503 errors and fast-failed circuit protection.',
        recommendation: 'Inject "X-Circuit-State: CLOSED | OPEN | HALF_OPEN" header on all outbound HTTP responses.'
      });
    }

    // Calculate score
    let penalty = 0;
    for (const issue of issues) {
      if (issue.severity === 'CRITICAL') penalty += 35;
      else if (issue.severity === 'HIGH') penalty += 20;
      else if (issue.severity === 'MEDIUM') penalty += 10;
      else if (issue.severity === 'LOW') penalty += 4;
      else if (issue.severity === 'INFO') penalty += 1;
    }

    const score = Math.max(0, 100 - penalty);
    let grade: 'A+' | 'A' | 'B' | 'C' | 'F' = 'F';
    if (score >= 95) grade = 'A+';
    else if (score >= 85) grade = 'A';
    else if (score >= 70) grade = 'B';
    else if (score >= 50) grade = 'C';
    else grade = 'F';

    return {
      score,
      grade,
      issues,
      isProductionReady: score >= 85 && Boolean(input.hasFallback) && timeout > 0 && timeout <= 5000,
      summary: {
        hasBulkhead: Boolean(cfg.maxConcurrentCalls && cfg.maxConcurrentCalls <= 50),
        hasFallback: Boolean(input.hasFallback),
        hasTimeout: timeout > 0 && timeout <= 5000,
        hasJitter: cfg.enableHalfOpenJitter ?? true,
        windowType: cfg.slidingWindowType ?? 'COUNT_BASED',
        failureThreshold: cfg.failureRateThreshold ?? 50
      }
    };
  }
}
