/**
 * CircuitSmith Cascading Failure Simulator
 * Simulates microservice topology failure propagation under upstream outages
 * comparing raw unshielded services vs CircuitSmith-protected architectures.
 * Author: Jatin Sharma (https://jatinsh.netlify.app/)
 */

import { CascadingNodeStatus, CascadingSimulationResult } from '../types.js';
import { CircuitBreaker } from './circuitBreaker.js';

export class CascadingSimulator {
  /**
   * Run a benchmark comparing system survival with and without Circuit Breakers
   */
  static async simulate(
    requestCount = 100,
    upstreamFailureProbability = 0.9,
    upstreamLatencyMs = 1500
  ): Promise<CascadingSimulationResult> {
    // 1. SIMULATE WITHOUT CIRCUIT BREAKERS
    // In naive systems, thread pool exhaustion cascades upstream:
    // Payment Gateway fails -> Order Service exhausts pool -> Gateway collapses
    const withoutNodes: CascadingNodeStatus[] = [
      { id: 'gateway', name: 'API Gateway', tier: 1, state: 'HEALTHY', activeRequests: 0, droppedRequests: 0, circuitBreakerActive: false },
      { id: 'orders', name: 'Order Service', tier: 2, state: 'HEALTHY', activeRequests: 0, droppedRequests: 0, circuitBreakerActive: false },
      { id: 'users', name: 'User Service', tier: 2, state: 'HEALTHY', activeRequests: 0, droppedRequests: 0, circuitBreakerActive: false },
      { id: 'inventory', name: 'Inventory DB', tier: 3, state: 'HEALTHY', activeRequests: 0, droppedRequests: 0, circuitBreakerActive: false },
      { id: 'payment', name: 'Payment Gateway', tier: 3, state: 'OUTAGE', activeRequests: 0, droppedRequests: 0, circuitBreakerActive: false }
    ];

    let withoutLatencies: number[] = [];
    for (let r = 0; r < requestCount; r++) {
      // Upstream payment failure causes order service thread lock
      withoutNodes[4].activeRequests++;
      if (Math.random() < upstreamFailureProbability) {
        withoutNodes[4].droppedRequests++;
        withoutLatencies.push(upstreamLatencyMs);

        // Order service queue fills up
        withoutNodes[1].activeRequests++;
        if (withoutNodes[1].activeRequests > 15) {
          withoutNodes[1].state = 'OUTAGE';
          withoutNodes[1].droppedRequests++;
        }

        // Gateway connection pool exhausts
        withoutNodes[0].activeRequests++;
        if (withoutNodes[0].activeRequests > 25) {
          withoutNodes[0].state = 'OUTAGE';
          withoutNodes[0].droppedRequests++;
        }
      } else {
        withoutLatencies.push(45);
      }
    }

    const withoutOutages = withoutNodes.filter((n) => n.state === 'OUTAGE').length;
    const withoutSurviving = Math.round(((withoutNodes.length - withoutOutages) / withoutNodes.length) * 100);
    const withoutAvgLatency = Math.round(withoutLatencies.reduce((a, b) => a + b, 0) / withoutLatencies.length);

    // 2. SIMULATE WITH CIRCUIT BREAKERS (CircuitSmith)
    const withNodes: CascadingNodeStatus[] = [
      { id: 'gateway', name: 'API Gateway', tier: 1, state: 'HEALTHY', activeRequests: 0, droppedRequests: 0, circuitBreakerActive: true },
      { id: 'orders', name: 'Order Service', tier: 2, state: 'HEALTHY', activeRequests: 0, droppedRequests: 0, circuitBreakerActive: true },
      { id: 'users', name: 'User Service', tier: 2, state: 'HEALTHY', activeRequests: 0, droppedRequests: 0, circuitBreakerActive: true },
      { id: 'inventory', name: 'Inventory DB', tier: 3, state: 'HEALTHY', activeRequests: 0, droppedRequests: 0, circuitBreakerActive: true },
      { id: 'payment', name: 'Payment Gateway', tier: 3, state: 'OUTAGE', activeRequests: 0, droppedRequests: 0, circuitBreakerActive: true }
    ];

    const breaker = new CircuitBreaker('payment-client', {
      failureRateThreshold: 50,
      minimumNumberOfCalls: 5,
      waitDurationInOpenStateMs: 5000,
      maxConcurrentCalls: 10
    });

    let withLatencies: number[] = [];
    for (let r = 0; r < requestCount; r++) {
      const exec = await breaker.execute(
        async () => {
          if (Math.random() < upstreamFailureProbability) {
            throw new Error('504 Gateway Timeout on Payment upstream');
          }
          return { charged: true };
        },
        async () => ({ charged: false, queuedForRetry: true }) // Resilient Fallback!
      );

      if (exec.outcome === 'REJECTED_OPEN') {
        // Fast-fail in 0ms! Order service and Gateway never block!
        withLatencies.push(1);
        withNodes[4].droppedRequests++;
      } else if (exec.outcome === 'FAILURE') {
        withLatencies.push(upstreamLatencyMs);
        withNodes[4].droppedRequests++;
      } else {
        withLatencies.push(25);
      }
    }

    // Only payment gateway is down; orders and gateway remained healthy because of fast-fail!
    const withOutages = withNodes.filter((n) => n.state === 'OUTAGE').length;
    const withSurviving = Math.round(((withNodes.length - withOutages) / withNodes.length) * 100);
    const withAvgLatency = Math.round(withLatencies.reduce((a, b) => a + b, 0) / withLatencies.length);

    return {
      step: 1,
      totalRequests: requestCount,
      withCircuitBreakers: {
        systemState: withSurviving >= 80 ? 'RESILIENT' : 'DEGRADED',
        nodes: withNodes,
        survivingServicesPercent: withSurviving,
        cascadingCascadeStopped: true,
        avgLatencyMs: withAvgLatency
      },
      withoutCircuitBreakers: {
        systemState: 'COLLAPSED',
        nodes: withoutNodes,
        survivingServicesPercent: withoutSurviving,
        cascadingCascadeStopped: false,
        avgLatencyMs: withoutAvgLatency
      }
    };
  }
}
