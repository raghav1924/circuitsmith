/**
 * CircuitSmith Multi-Framework Resilience Code Generator
 * Generates battle-tested circuit breaker and bulkhead middleware for Next.js, Express, Fastify, Cloudflare, Hono, FastAPI.
 * Author: Jatin Sharma (https://jatinsh.netlify.app/)
 */

import { FrameworkType, GeneratedResilienceCode } from '../types.js';

export class ResilienceGenerator {
  static generate(framework: FrameworkType, options: { failureThreshold?: number; openDurationSec?: number; bulkheadLimit?: number } = {}): GeneratedResilienceCode {
    const failureThreshold = options.failureThreshold || 50;
    const openDurationSec = options.openDurationSec || 5;
    const bulkheadLimit = options.bulkheadLimit || 15;

    switch (framework) {
      case 'nextjs':
        return {
          framework: 'nextjs',
          title: 'Next.js 14/15 App Router Resilient Route Handler',
          filename: 'app/api/resilient-upstream/route.ts',
          instructions: 'Place in your Next.js App Router API directory. Protects downstream microservices with circuit breaking and fallback.',
          code: `import { NextRequest, NextResponse } from 'next/server';

interface BreakerState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failures: number;
  lastTrip: number;
}

const breaker: BreakerState = {
  state: 'CLOSED',
  failures: 0,
  lastTrip: 0
};

const FAILURE_THRESHOLD = ${failureThreshold};
const OPEN_DURATION_MS = ${openDurationSec * 1000};

export async function GET(req: NextRequest) {
  const now = Date.now();

  // 1. Check if OPEN circuit should transition to HALF_OPEN
  if (breaker.state === 'OPEN') {
    if (now - breaker.lastTrip > OPEN_DURATION_MS) {
      breaker.state = 'HALF_OPEN';
    } else {
      // Fast-fail with degraded fallback in 0ms!
      return NextResponse.json({
        fallback: true,
        message: 'Upstream circuit is OPEN: returning cached safe default',
        circuitState: 'OPEN'
      }, {
        status: 200, // or 503
        headers: { 'X-Circuit-State': 'OPEN', 'Retry-After': '${openDurationSec}' }
      });
    }
  }

  // 2. Execute Upstream Call
  try {
    const upstreamRes = await fetch('https://api.external-service.com/data', {
      signal: AbortSignal.timeout(2500) // strict timeout
    });

    if (!upstreamRes.ok) {
      throw new Error(\`Upstream HTTP \${upstreamRes.status}\`);
    }

    const data = await upstreamRes.json();

    // Success in HALF_OPEN resets circuit
    if (breaker.state === 'HALF_OPEN') {
      breaker.state = 'CLOSED';
      breaker.failures = 0;
    }

    return NextResponse.json(data, {
      headers: { 'X-Circuit-State': breaker.state }
    });
  } catch (err: any) {
    breaker.failures++;
    if (breaker.failures >= 5) {
      breaker.state = 'OPEN';
      breaker.lastTrip = Date.now();
    }

    return NextResponse.json({
      fallback: true,
      error: err.message,
      circuitState: breaker.state
    }, {
      status: 200,
      headers: { 'X-Circuit-State': breaker.state }
    });
  }
}
`
        };

      case 'express':
        return {
          framework: 'express',
          title: 'Express.js Circuit Breaker & Semaphore Bulkhead Middleware',
          filename: 'middleware/circuitBreaker.js',
          instructions: 'Mount with app.use("/api/upstream", createCircuitBreakerMiddleware({ maxConcurrent: ' + bulkheadLimit + ' }))',
          code: `/**
 * CircuitSmith Express.js Circuit Breaker & Bulkhead Middleware
 * Prevents cascading outages by fast-failing during upstream brownouts.
 */

function createCircuitBreakerMiddleware({
  failureThreshold = ${failureThreshold},
  openDurationMs = ${openDurationSec * 1000},
  maxConcurrent = ${bulkheadLimit}
} = {}) {
  let state = 'CLOSED';
  let failures = 0;
  let calls = 0;
  let lastTripTime = 0;
  let activeConcurrency = 0;

  return function circuitBreakerMiddleware(req, res, next) {
    const now = Date.now();

    // 1. Automatic Half-Open transition
    if (state === 'OPEN' && now - lastTripTime > openDurationMs) {
      state = 'HALF_OPEN';
    }

    // 2. Fast-fail if OPEN
    if (state === 'OPEN') {
      res.setHeader('X-Circuit-State', 'OPEN');
      res.setHeader('Retry-After', Math.ceil(openDurationMs / 1000));
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Circuit is OPEN: request rejected to protect upstream.',
        circuitState: 'OPEN'
      });
    }

    // 3. Bulkhead Concurrency Semaphore
    if (activeConcurrency >= maxConcurrent) {
      res.setHeader('X-Circuit-State', state);
      return res.status(429).json({
        error: 'Too Many Requests',
        message: 'Bulkhead capacity exceeded: max concurrent requests reached.',
        activeConcurrency
      });
    }

    activeConcurrency++;
    res.setHeader('X-Circuit-State', state);

    // Track response status
    res.on('finish', () => {
      activeConcurrency--;
      calls++;

      if (res.statusCode >= 500) {
        failures++;
      }

      if (state === 'HALF_OPEN') {
        if (res.statusCode < 500) {
          state = 'CLOSED';
          failures = 0;
          calls = 0;
        } else {
          state = 'OPEN';
          lastTripTime = Date.now();
        }
      } else if (state === 'CLOSED' && calls >= 10) {
        const failureRate = (failures / calls) * 100;
        if (failureRate >= failureThreshold) {
          state = 'OPEN';
          lastTripTime = Date.now();
        }
      }
    });

    next();
  };
}

module.exports = { createCircuitBreakerMiddleware };
`
        };

      case 'fastify':
        return {
          framework: 'fastify',
          title: 'Fastify High-Performance Circuit Breaker Plugin',
          filename: 'plugins/circuitBreaker.js',
          instructions: 'Register in Fastify instance: fastify.register(circuitBreakerPlugin)',
          code: `const fp = require('fastify-plugin');

async function circuitBreakerPlugin(fastify, options) {
  let state = 'CLOSED';
  let failureCount = 0;
  let lastTrip = 0;
  const timeoutMs = ${openDurationSec * 1000};

  fastify.addHook('onRequest', async (request, reply) => {
    const now = Date.now();
    if (state === 'OPEN') {
      if (now - lastTrip > timeoutMs) {
        state = 'HALF_OPEN';
      } else {
        reply
          .header('X-Circuit-State', 'OPEN')
          .status(503)
          .send({ error: 'Service Unavailable: Circuit is OPEN' });
        return reply;
      }
    }
  });

  fastify.addHook('onResponse', async (request, reply) => {
    if (reply.statusCode >= 500) {
      failureCount++;
      if (failureCount >= 5) {
        state = 'OPEN';
        lastTrip = Date.now();
      }
    } else if (state === 'HALF_OPEN') {
      state = 'CLOSED';
      failureCount = 0;
    }
  });
}

module.exports = fp(circuitBreakerPlugin);
`
        };

      case 'cloudflare':
        return {
          framework: 'cloudflare',
          title: 'Cloudflare Workers Edge Circuit Breaker Worker',
          filename: 'worker.ts',
          instructions: 'Deploy via wrangler deploy. Fast-fails edge requests before sending egress traffic to origin.',
          code: `export interface Env {
  CIRCUIT_KV?: KVNamespace;
}

let edgeState: 'CLOSED' | 'OPEN' = 'CLOSED';
let lastTripTime = 0;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const now = Date.now();

    if (edgeState === 'OPEN') {
      if (now - lastTripTime > ${openDurationSec * 1000}) {
        edgeState = 'CLOSED';
      } else {
        return new Response(JSON.stringify({
          error: 'Edge Circuit OPEN',
          message: 'Origin shielded by Cloudflare Worker edge circuit breaker.'
        }), {
          status: 503,
          headers: { 'Content-Type': 'application/json', 'X-Circuit-State': 'OPEN' }
        });
      }
    }

    try {
      const response = await fetch(request);
      if (response.status >= 500) {
        edgeState = 'OPEN';
        lastTripTime = now;
      }
      return response;
    } catch {
      edgeState = 'OPEN';
      lastTripTime = now;
      return new Response('Upstream Failure', { status: 504 });
    }
  }
};
`
        };

      case 'hono':
        return {
          framework: 'hono',
          title: 'Hono Multi-Runtime Edge Circuit Breaker Middleware',
          filename: 'middleware/circuit.ts',
          instructions: 'Mount with app.use("*", honoCircuitBreaker()) in Bun, Cloudflare, Deno or Node.js',
          code: `import { MiddlewareHandler } from 'hono';

export const honoCircuitBreaker = (): MiddlewareHandler => {
  let state = 'CLOSED';
  let failures = 0;
  let lastTrip = 0;

  return async (c, next) => {
    const now = Date.now();
    if (state === 'OPEN') {
      if (now - lastTrip > ${openDurationSec * 1000}) {
        state = 'HALF_OPEN';
      } else {
        c.header('X-Circuit-State', 'OPEN');
        return c.json({ error: 'Service Unavailable', circuit: 'OPEN' }, 503);
      }
    }

    await next();

    if (c.res.status >= 500) {
      failures++;
      if (failures >= 5) {
        state = 'OPEN';
        lastTrip = now;
      }
    } else if (state === 'HALF_OPEN') {
      state = 'CLOSED';
      failures = 0;
    }

    c.header('X-Circuit-State', state);
  };
};
`
        };

      case 'fastapi':
        return {
          framework: 'fastapi',
          title: 'FastAPI Python Async Circuit Breaker Middleware',
          filename: 'middleware/circuit.py',
          instructions: 'Mount in FastAPI app: app.add_middleware(CircuitBreakerMiddleware)',
          code: `"""
CircuitSmith FastAPI Async Circuit Breaker Middleware
Protects Python microservices from cascading database and service outages.
"""
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
import time

class CircuitBreakerMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, open_duration_sec: int = ${openDurationSec}):
        super().__init__(app)
        self.state = "CLOSED"
        self.open_duration = open_duration_sec
        self.last_trip = 0
        self.failures = 0

    async def dispatch(self, request: Request, call_next):
        now = time.time()

        if self.state == "OPEN":
            if now - self.last_trip > self.open_duration:
                self.state = "HALF_OPEN"
            else:
                return JSONResponse(
                    status_code=503,
                    content={"error": "Circuit OPEN", "message": "Fast-failed by CircuitSmith"},
                    headers={"X-Circuit-State": "OPEN"}
                )

        try:
            response = await call_next(request)
            if response.status_code >= 500:
                self.failures += 1
                if self.failures >= 5:
                    self.state = "OPEN"
                    self.last_trip = now
            elif self.state == "HALF_OPEN":
                self.state = "CLOSED"
                self.failures = 0

            response.headers["X-Circuit-State"] = self.state
            return response
        except Exception as e:
            self.failures += 1
            self.state = "OPEN"
            self.last_trip = now
            raise e
`
        };
    }
  }
}
