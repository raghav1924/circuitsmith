# Resilience Specification & Rules

CircuitSmith audits 16 resilience heuristics:

1. **CIRCUIT-001 (Critical):** Missing fallback strategy handler.
2. **CIRCUIT-002 (Critical):** Unbounded timeout (>10,000ms or none).
3. **CIRCUIT-003 (High):** Missing semaphore bulkhead concurrency limits.
4. **CIRCUIT-004 (High):** Minimum calls < 5 causing premature tripping.
5. **CIRCUIT-005 (High):** Missing slow-call rate thresholds.
6. **CIRCUIT-006 (Medium):** Excessive sleep duration in open state (>60s).
7. **CIRCUIT-007 (Medium):** High failure rate threshold (>70%).
8. **CIRCUIT-008 (Medium):** Missing randomized jitter on half-open probes.
9. **CIRCUIT-009 (Low):** Small sliding window (<5 calls).
10. **CIRCUIT-010 (Low):** Excessive half-open probe count (>10).
11. **CIRCUIT-011 (Critical):** Retry-storm amplification on failing upstream.
12. **CIRCUIT-014 (Low):** Missing state change listener.
13. **CIRCUIT-016 (Info):** Missing `X-Circuit-State` header injection.
