/**
 * CircuitSmith Zero-Config Resilience Reverse Proxy
 * Sits in front of flaky microservices, intercepting traffic with real-time circuit breaking and fast-fails.
 * Author: Jatin Sharma (https://jatinsh.netlify.app/)
 */

import http from 'http';
import { CircuitBreaker } from '../core/circuitBreaker.js';
import { CircuitBreakerConfig, CircuitMetrics } from '../types.js';

export interface ProxyOptions {
  port?: number;
  targetUrl?: string;
  circuitConfig?: CircuitBreakerConfig;
  mockFailureProbability?: number; // 0.0 to 1.0 (for built-in mock mode)
}

export class ResilienceProxy {
  private server: http.Server | null = null;
  public readonly breaker: CircuitBreaker;
  private port: number;

  constructor(private options: ProxyOptions = {}) {
    this.port = options.port || 8087;
    this.breaker = new CircuitBreaker('proxy-shield', options.circuitConfig || {
      failureRateThreshold: 50,
      minimumNumberOfCalls: 4,
      waitDurationInOpenStateMs: 4000,
      maxConcurrentCalls: 15
    });
  }

  getMetrics(): CircuitMetrics {
    return this.breaker.getMetrics();
  }

  start(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer(async (req, res) => {
        // Internal metrics endpoint
        if (req.url === '/__circuitsmith/metrics') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(this.getMetrics(), null, 2));
          return;
        }

        // Internal manual controls
        if (req.url === '/__circuitsmith/trip') {
          this.breaker.trip();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'tripped', state: this.breaker.getState() }));
          return;
        }

        if (req.url === '/__circuitsmith/reset') {
          this.breaker.reset();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'reset', state: this.breaker.getState() }));
          return;
        }

        // Protected request execution
        const exec = await this.breaker.execute(
          async () => {
            return await this.forwardRequest(req);
          },
          async () => {
            // Safe fallback response when circuit is OPEN or Bulkhead full
            return {
              statusCode: 503,
              headers: {
                'Content-Type': 'application/json',
                'Retry-After': '5'
              },
              body: JSON.stringify({
                error: 'Service Unavailable',
                message: `Upstream shielded by CircuitSmith. Circuit state is ${this.breaker.getState()}. Fast-failing to prevent cascading outage.`,
                state: this.breaker.getState(),
                author: 'Jatin Sharma (https://jatinsh.netlify.app/)'
              })
            };
          }
        );

        const state = exec.circuitState;
        res.setHeader('X-Circuit-State', state);
        res.setHeader('X-Circuit-Outcome', exec.outcome);
        res.setHeader('X-Circuit-Duration-Ms', String(exec.durationMs));

        if (exec.value) {
          res.writeHead(exec.value.statusCode, {
            ...exec.value.headers,
            'X-Circuit-State': state
          });
          res.end(exec.value.body);
        } else {
          res.writeHead(503, { 'Content-Type': 'application/json', 'X-Circuit-State': state });
          res.end(JSON.stringify({ error: exec.error, state }));
        }
      });

      this.server.listen(this.port, () => resolve(this.port));
      this.server.on('error', reject);
    });
  }

  private async forwardRequest(req: http.IncomingMessage): Promise<{ statusCode: number; headers: Record<string, string>; body: string }> {
    // If external targetUrl is configured, proxy over network
    if (this.options.targetUrl) {
      return new Promise((resolve, reject) => {
        const fullUrl = new URL(req.url || '/', this.options.targetUrl);
        http.get(fullUrl.toString(), (resp: http.IncomingMessage) => {
          let data = '';
          resp.on('data', (c: any) => (data += c));
          resp.on('end', () => {
            const headers: Record<string, string> = {};
            for (const [k, v] of Object.entries(resp.headers)) {
              if (v !== undefined) headers[k] = Array.isArray(v) ? v.join(', ') : String(v);
            }
            if ((resp.statusCode || 200) >= 500) {
              reject(new Error(`Upstream HTTP ${resp.statusCode}`));
            } else {
              resolve({ statusCode: resp.statusCode || 200, headers, body: data });
            }
          });
        }).on('error', reject);
      });
    }

    // Default built-in simulated upstream
    const failProb = this.options.mockFailureProbability ?? 0.0;
    if (failProb > 0 && Math.random() < failProb) {
      throw new Error('Simulated upstream HTTP 500 Internal Server Error');
    }

    await new Promise((r) => setTimeout(r, 20)); // simulated 20ms processing
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: 'CircuitSmith Mock Upstream',
        shield: 'Active'
      })
    };
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }
}
