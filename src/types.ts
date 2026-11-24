/**
 * CircuitSmith Core Type Definitions
 * Distributed Circuit Breaker, Bulkhead & Cascading Failure Resilience Engine
 * Author: Jatin Sharma (https://jatinsh.netlify.app/)
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';
export type SlidingWindowType = 'COUNT_BASED' | 'TIME_BASED';

export interface CircuitBreakerConfig {
  failureRateThreshold?: number; // percentage (e.g. 50%)
  slowCallRateThreshold?: number; // percentage (e.g. 50%)
  slowCallDurationThresholdMs?: number; // ms considered slow (default 1000ms)
  slidingWindowType?: SlidingWindowType;
  slidingWindowSize?: number; // call count or time window ms (default 10)
  minimumNumberOfCalls?: number; // minimum calls before evaluating rates (default 5)
  waitDurationInOpenStateMs?: number; // sleep duration before entering HALF_OPEN (default 5000ms)
  permittedNumberOfCallsInHalfOpenState?: number; // probe count in HALF_OPEN (default 3)
  maxConcurrentCalls?: number; // bulkhead semaphore limit (default 10)
  enableHalfOpenJitter?: boolean;
}

export type CallOutcome = 'SUCCESS' | 'FAILURE' | 'SLOW' | 'REJECTED_OPEN' | 'REJECTED_BULKHEAD';

export interface CallRecord {
  timestamp: number;
  durationMs: number;
  success: boolean;
  slow: boolean;
}

export interface CircuitMetrics {
  state: CircuitState;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  slowCalls: number;
  rejectedCalls: number;
  failureRate: number; // 0 - 100
  slowCallRate: number; // 0 - 100
  currentConcurrentCalls: number;
  maxConcurrentCalls: number;
  lastStateChangeTimestamp: number;
}

export interface ExecuteResult<T = any> {
  outcome: CallOutcome;
  value: T | null;
  durationMs: number;
  error?: string;
  fallbackUsed: boolean;
  circuitState: CircuitState;
}

export interface ServiceDependency {
  id: string;
  name: string;
  tier: number; // 1 = edge/gateway, 2 = service, 3 = db/ext api
  failureProbability: number;
  latencyMs: number;
  dependsOn: string[];
}

export interface CascadingNodeStatus {
  id: string;
  name: string;
  tier: number;
  state: 'HEALTHY' | 'DEGRADED' | 'OUTAGE';
  activeRequests: number;
  droppedRequests: number;
  circuitBreakerActive: boolean;
}

export interface CascadingSimulationResult {
  step: number;
  totalRequests: number;
  withCircuitBreakers: {
    systemState: 'HEALTHY' | 'RESILIENT' | 'DEGRADED' | 'COLLAPSED';
    nodes: CascadingNodeStatus[];
    survivingServicesPercent: number;
    cascadingCascadeStopped: boolean;
    avgLatencyMs: number;
  };
  withoutCircuitBreakers: {
    systemState: 'HEALTHY' | 'RESILIENT' | 'DEGRADED' | 'COLLAPSED';
    nodes: CascadingNodeStatus[];
    survivingServicesPercent: number;
    cascadingCascadeStopped: boolean;
    avgLatencyMs: number;
  };
}

export type IssueSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
export type ResilienceSection = 'CIRCUIT' | 'BULKHEAD' | 'TIMEOUT' | 'FALLBACK' | 'RETRY';

export interface ResilienceIssue {
  code: string;
  severity: IssueSeverity;
  section: ResilienceSection;
  message: string;
  recommendation: string;
}

export interface ResilienceAuditResult {
  score: number; // 0 - 100
  grade: 'A+' | 'A' | 'B' | 'C' | 'F';
  issues: ResilienceIssue[];
  isProductionReady: boolean;
  summary: {
    hasBulkhead: boolean;
    hasFallback: boolean;
    hasTimeout: boolean;
    hasJitter: boolean;
    windowType: SlidingWindowType;
    failureThreshold: number;
  };
}

export type FrameworkType = 'nextjs' | 'express' | 'fastify' | 'cloudflare' | 'hono' | 'fastapi';

export interface GeneratedResilienceCode {
  framework: FrameworkType;
  title: string;
  filename: string;
  code: string;
  instructions: string;
}
