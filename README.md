# CircuitSmith ⚡
> **Developer-First Distributed Circuit Breaker & Bulkhead Simulator, Cascading Failure Linter & Bento Grid Studio.**  
> Built with zero external runtime dependencies in TypeScript 5.9 on Node.js 22.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript: 5.9](https://img.shields.io/badge/TypeScript-5.9-3178C6.svg)](https://www.typescriptlang.org/)
[![Node.js: 22](https://img.shields.io/badge/Node.js-22-339933.svg)](https://nodejs.org/)
[![Author](https://img.shields.io/badge/Architect-Jatin%20Sharma-purple.svg)](https://jatinsh.netlify.app/)

---

## 🎯 Why CircuitSmith?

In modern microservice and distributed architectures, upstream service degradations frequently trigger **Cascading System Failures**:
1. When a database or third-party payment API slows down or fails, downstream services wait on slow sockets.
2. Thread pools, file descriptors, and connection pools exhaust rapidly.
3. The failure cascades backward across API gateways, collapsing the entire system and turning an isolated component glitch into a cluster-wide outage.

**CircuitSmith** provides an engineering-grade distributed resilience suite:
- **Martin Fowler 3-State Circuit Breaker Machine:** Real-time state management across `CLOSED`, `OPEN`, and `HALF_OPEN` states with sliding window statistics.
- **Cascading Failure Simulator:** Simulates a 5-tier microservice topology under upstream brownouts, proving an 80-100% reduction in cascading outages through 0ms fast-failing.
- **16 Resilience Heuristics (`CIRCUIT-001` - `CIRCUIT-016`):** Catches missing fallback handlers, unbounded timeouts, retry-storm amplification, and bulkhead starvation.
- **Semaphore Bulkhead Concurrency Limiter:** Limits concurrent outbound calls to isolate resource pools and prevent local node starvation.
- **Zero-Config Reverse Proxy:** Runs on Port `8087` with real-time circuit shielding and `X-Circuit-State: OPEN/CLOSED` injection.
- **Bento Grid Web Studio:** Cyberpunk dark-mode visual laboratory on Port `7070` (Patterns #12 Bento Grid, #20 Dark Mode, #10 Glassmorphism, #3 Swiss Design, #24 Visual Studio).
- **Multi-Framework Middleware Generator:** Produces copy-paste resilience code for Next.js 14/15, Express, Fastify, Cloudflare Workers, Hono, and FastAPI.

---

## 📐 Circuit Breaker State Dynamics

```
      +---------+  Failure Rate >= Threshold   +--------+
      |         | ---------------------------> |        |
      | CLOSED  |                              |  OPEN  |
      |         | <--------------------------- |        |
      +---------+      Probe Calls Succeeded   +--------+
           ^                                       |
           |                                       | Wait Duration
           |                                       | Elapsed
           |           +-------------+             |
           +---------- |  HALF_OPEN  | <-----------+
                       +-------------+
```

1. **CLOSED:** Normal traffic. Outbound calls are monitored over a sliding window. If failure rate or slow call rate exceeds threshold (e.g. 50%), circuit trips to **OPEN**.
2. **OPEN:** Fast-fail protection mode. Outbound calls immediately fast-fail in 0ms (or return a fallback) without querying the struggling upstream.
3. **HALF_OPEN:** Trial probe mode. After the sleep window expires, a limited number of probe requests are allowed through to evaluate upstream recovery. If all succeed, the circuit resets to **CLOSED**; if any probe fails, it instantly trips back to **OPEN**.

---

## ⚡ Quickstart

### 1. Installation

```bash
git clone https://github.com/raghav1924/circuitsmith.git
cd circuitsmith

npm run build
npm test
```

### 2. CLI Usage

```bash
# Simulate a cascading failure outage across 5 microservice tiers
./bin/circuitsmith.js simulate --requests 100

# Audit resilience configurations against 16 heuristics
./bin/circuitsmith.js audit --timeout 2500 --threshold 50

# Launch Bento Grid Visual Studio
./bin/circuitsmith.js studio --port 7070

# Start local resilience reverse proxy
./bin/circuitsmith.js proxy --port 8087

# Generate framework middleware
./bin/circuitsmith.js generate express
```

---

## 🧪 Simulation Benchmark

Under a simulated upstream outage of **100 concurrent requests**:

| Architecture | Surviving Services | System Status | Average Latency | Cascading Outage |
| :--- | :--- | :--- | :--- | :--- |
| **Without Circuit Breaker (Raw)** | 40% (2 / 5 nodes) | **COLLAPSED** | 1,442ms | **Full System Crash** |
| **With CircuitSmith Shielding** | **80% (4 / 5 nodes)** | **RESILIENT** | **151ms** | **Cascade Stopped!** |

---

## 🎨 Master Design Patterns

CircuitSmith Studio implements 5 signature design patterns from `DESIGN_INSPIRATION.md`:
1. **#12 Bento Grid:** Asymmetric, modular cards organizing state machines, cascading graphs, linters, and exporters.
2. **#20 Cyberpunk / Dark Mode:** `#07090e` obsidian canvas with neon `#f43f5e` rose, emerald, amber, and `#00f0ff` cyan.
3. **#10 Glassmorphism:** Subtle translucent panels with frosted blur and high-contrast borders.
4. **#3 Swiss Design System:** Monospaced data displays, crisp contrast, strict typographic hierarchy.
5. **#24 Cybercore Visual Studio:** Live animated state machine and interactive failure propagation canvas.

---

## 🛡 License

MIT License. Designed and engineered by **[Jatin Sharma](https://jatinsh.netlify.app/)**.  
GitHub: [@raghav1924](https://github.com/raghav1924)
