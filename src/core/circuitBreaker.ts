/**
 * CircuitSmith Core Circuit Breaker & Bulkhead Engine
 * Implements Martin Fowler Circuit Breaker State Machine with Count/Time Sliding Window,
 * Slow-Call Thresholds, Half-Open Probing, and Semaphore Bulkhead Isolation.
 * Author: Jatin Sharma (https://jatinsh.netlify.app/)
 */

import {
  CallOutcome,
  CallRecord,
  CircuitBreakerConfig,
  CircuitMetrics,
  CircuitState,
  ExecuteResult
} from '../types.js';

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private slidingWindow: CallRecord[] = [];
  private lastStateChangeTimestamp: number = Date.now();
  private halfOpenProbeCount = 0;
  private halfOpenSuccessCount = 0;
  private currentConcurrentCalls = 0;

  // Lifetime metrics
  private totalCalls = 0;
  private successfulCalls = 0;
  private failedCalls = 0;
  private slowCalls = 0;
  private rejectedCalls = 0;

  private config: Required<CircuitBreakerConfig>;

  constructor(
    public readonly name: string,
    config: CircuitBreakerConfig = {}
  ) {
    this.config = {
      failureRateThreshold: config.failureRateThreshold ?? 50,
      slowCallRateThreshold: config.slowCallRateThreshold ?? 50,
      slowCallDurationThresholdMs: config.slowCallDurationThresholdMs ?? 1000,
      slidingWindowType: config.slidingWindowType ?? 'COUNT_BASED',
      slidingWindowSize: config.slidingWindowSize ?? 10,
      minimumNumberOfCalls: config.minimumNumberOfCalls ?? 5,
      waitDurationInOpenStateMs: config.waitDurationInOpenStateMs ?? 5000,
      permittedNumberOfCallsInHalfOpenState: config.permittedNumberOfCallsInHalfOpenState ?? 3,
      maxConcurrentCalls: config.maxConcurrentCalls ?? 10,
      enableHalfOpenJitter: config.enableHalfOpenJitter ?? true
    };
  }

  getState(): CircuitState {
    this.evaluateAutomaticTransition();
    return this.state;
  }

  getMetrics(): CircuitMetrics {
    this.evaluateAutomaticTransition();
    const rates = this.calculateRates();
    return {
      state: this.state,
      totalCalls: this.totalCalls,
      successfulCalls: this.successfulCalls,
      failedCalls: this.failedCalls,
      slowCalls: this.slowCalls,
      rejectedCalls: this.rejectedCalls,
      failureRate: rates.failureRate,
      slowCallRate: rates.slowCallRate,
      currentConcurrentCalls: this.currentConcurrentCalls,
      maxConcurrentCalls: this.config.maxConcurrentCalls,
      lastStateChangeTimestamp: this.lastStateChangeTimestamp
    };
  }

  reset(): void {
    this.state = 'CLOSED';
    this.slidingWindow = [];
    this.lastStateChangeTimestamp = Date.now();
    this.halfOpenProbeCount = 0;
    this.halfOpenSuccessCount = 0;
    this.currentConcurrentCalls = 0;
  }

  trip(): void {
    this.transitionTo('OPEN');
  }

  halfOpen(): void {
    this.transitionTo('HALF_OPEN');
  }

  private transitionTo(newState: CircuitState): void {
    if (this.state === newState) return;
    this.state = newState;
    this.lastStateChangeTimestamp = Date.now();
    this.halfOpenProbeCount = 0;
    this.halfOpenSuccessCount = 0;
    if (newState === 'CLOSED' || newState === 'OPEN') {
      this.slidingWindow = [];
    }
  }

  private evaluateAutomaticTransition(): void {
    if (this.state === 'OPEN') {
      const elapsed = Date.now() - this.lastStateChangeTimestamp;
      const jitter = this.config.enableHalfOpenJitter ? Math.floor(Math.random() * 500) : 0;
      if (elapsed >= (this.config.waitDurationInOpenStateMs + jitter)) {
        this.transitionTo('HALF_OPEN');
      }
    }
  }

  private pruneSlidingWindow(): void {
    if (this.config.slidingWindowType === 'COUNT_BASED') {
      while (this.slidingWindow.length > this.config.slidingWindowSize) {
        this.slidingWindow.shift();
      }
    } else {
      const cutoff = Date.now() - this.config.slidingWindowSize;
      this.slidingWindow = this.slidingWindow.filter((c) => c.timestamp >= cutoff);
    }
  }

  private calculateRates(): { failureRate: number; slowCallRate: number } {
    this.pruneSlidingWindow();
    const count = this.slidingWindow.length;
    if (count === 0) return { failureRate: 0, slowCallRate: 0 };

    const fails = this.slidingWindow.filter((c) => !c.success).length;
    const slows = this.slidingWindow.filter((c) => c.slow).length;

    return {
      failureRate: Math.round((fails / count) * 100),
      slowCallRate: Math.round((slows / count) * 100)
    };
  }

  /**
   * Execute an operation protected by the Circuit Breaker & Bulkhead
   */
  async execute<T>(
    operation: () => Promise<T>,
    fallback?: () => T | Promise<T>
  ): Promise<ExecuteResult<T>> {
    this.totalCalls++;
    this.evaluateAutomaticTransition();

    // 1. Check Circuit State
    if (this.state === 'OPEN') {
      this.rejectedCalls++;
      if (fallback) {
        const fbVal = await fallback();
        return {
          outcome: 'REJECTED_OPEN',
          value: fbVal,
          durationMs: 0,
          fallbackUsed: true,
          circuitState: this.state
        };
      }
      return {
        outcome: 'REJECTED_OPEN',
        value: null,
        durationMs: 0,
        error: `CircuitBreaker "${this.name}" is OPEN: fast-failing to protect upstream service`,
        fallbackUsed: false,
        circuitState: this.state
      };
    }

    // 2. Check Half-Open permitted calls
    if (this.state === 'HALF_OPEN') {
      if (this.halfOpenProbeCount >= this.config.permittedNumberOfCallsInHalfOpenState) {
        this.rejectedCalls++;
        if (fallback) {
          const fbVal = await fallback();
          return {
            outcome: 'REJECTED_OPEN',
            value: fbVal,
            durationMs: 0,
            fallbackUsed: true,
            circuitState: this.state
          };
        }
        return {
          outcome: 'REJECTED_OPEN',
          value: null,
          durationMs: 0,
          error: `CircuitBreaker "${this.name}" is HALF_OPEN: probe quota reached`,
          fallbackUsed: false,
          circuitState: this.state
        };
      }
      this.halfOpenProbeCount++;
    }

    // 3. Check Bulkhead Concurrent Limit
    if (this.currentConcurrentCalls >= this.config.maxConcurrentCalls) {
      this.rejectedCalls++;
      if (fallback) {
        const fbVal = await fallback();
        return {
          outcome: 'REJECTED_BULKHEAD',
          value: fbVal,
          durationMs: 0,
          fallbackUsed: true,
          circuitState: this.state
        };
      }
      return {
        outcome: 'REJECTED_BULKHEAD',
        value: null,
        durationMs: 0,
        error: `CircuitBreaker "${this.name}" Bulkhead full: max ${this.config.maxConcurrentCalls} concurrent calls exceeded`,
        fallbackUsed: false,
        circuitState: this.state
      };
    }

    // 4. Perform protected execution
    this.currentConcurrentCalls++;
    const startTime = Date.now();
    let isSuccess = false;
    let isSlow = false;
    let resultValue: T | null = null;
    let errorMsg: string | undefined;

    try {
      resultValue = await operation();
      isSuccess = true;
      this.successfulCalls++;
    } catch (err: any) {
      isSuccess = false;
      this.failedCalls++;
      errorMsg = err?.message || String(err);
    } finally {
      this.currentConcurrentCalls--;
    }

    const durationMs = Date.now() - startTime;
    isSlow = durationMs >= this.config.slowCallDurationThresholdMs;
    if (isSlow) this.slowCalls++;

    // 5. Update Sliding Window
    this.slidingWindow.push({
      timestamp: Date.now(),
      durationMs,
      success: isSuccess,
      slow: isSlow
    });
    this.pruneSlidingWindow();

    // 6. State Machine Evaluation
    if (this.state === 'HALF_OPEN') {
      if (isSuccess && !isSlow) {
        this.halfOpenSuccessCount++;
        if (this.halfOpenSuccessCount >= this.config.permittedNumberOfCallsInHalfOpenState) {
          // All probes passed! Reset circuit to CLOSED
          this.transitionTo('CLOSED');
        }
      } else {
        // Any probe failure in HALF_OPEN immediately trips back to OPEN!
        this.transitionTo('OPEN');
      }
    } else if (this.state === 'CLOSED') {
      if (this.slidingWindow.length >= this.config.minimumNumberOfCalls) {
        const { failureRate, slowCallRate } = this.calculateRates();
        if (
          failureRate >= this.config.failureRateThreshold ||
          slowCallRate >= this.config.slowCallRateThreshold
        ) {
          this.transitionTo('OPEN');
        }
      }
    }

    // 7. Fallback handling if execution failed
    if (!isSuccess && fallback) {
      const fbVal = await fallback();
      return {
        outcome: 'FAILURE',
        value: fbVal,
        durationMs,
        error: errorMsg,
        fallbackUsed: true,
        circuitState: this.state
      };
    }

    return {
      outcome: !isSuccess ? 'FAILURE' : isSlow ? 'SLOW' : 'SUCCESS',
      value: resultValue,
      durationMs,
      error: errorMsg,
      fallbackUsed: false,
      circuitState: this.state
    };
  }
}
