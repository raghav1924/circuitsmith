# Cascading Failure Dynamics in Microservices

## The Propagation Mechanism
When downstream service $A$ calls upstream dependency $B$:
1. If $B$ degrades, $A$'s worker threads block waiting for socket read responses.
2. The arrival rate of incoming requests to $A$ exceeds the completion rate.
3. Thread pools in $A$ saturate, causing memory spikes and eventual process crashes.
4. Callers to $A$ (such as the API Gateway) experience the exact same socket exhaustion.
5. A single partial outage in a tier-3 dependency collapses the entire tier-1 gateway.

## Circuit Breaker Fast-Failing
CircuitSmith intercepts this cascade by flipping to `OPEN`:
- Calls to $B$ are rejected immediately in $0\text{ms}$.
- No socket or thread resources are blocked.
- $A$ remains healthy and responsive to other endpoints.
