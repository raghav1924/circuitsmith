# CircuitSmith Architecture

CircuitSmith provides distributed resilience mechanisms for modern microservice architectures.

```
Incoming Request
       │
       ▼
┌──────────────────────────────────────────────┐
│ Semaphore Bulkhead (Concurrency Limiter)     │
└──────────────────────┬───────────────────────┘
                       │ Allowed (< Max Concurrency)
                       ▼
┌──────────────────────────────────────────────┐
│ Circuit Breaker State Machine                │
│  - CLOSED: Forward & monitor sliding window  │
│  - OPEN: Fast-fail in 0ms (or Fallback)      │
│  - HALF_OPEN: Limited probe execution        │
└──────────────────────┬───────────────────────┘
                       │
         ┌─────────────┴─────────────┐
         ▼                           ▼
   Origin Upstream            Fallback Handler
```

## Core Modules
1. `CircuitBreaker`: Martin Fowler state machine with Count and Time-based sliding windows.
2. `CascadingSimulator`: 5-node microservice graph evaluating failure propagation.
3. `ResilienceLinter`: 16 rules evaluating timeouts, retry storms, and bulkheads.
4. `ResilienceProxy`: Local reverse proxy on port 8087.
5. `StudioServer`: Bento Grid visual laboratory on port 7070.
