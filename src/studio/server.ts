/**
 * CircuitSmith Bento Grid Web Studio Server
 * Embedded visual dashboard featuring real-time 3-state Circuit Breaker State Machine,
 * Cascading Failure Canvas Simulator, Resilience Linter, and Multi-Framework Code Generator.
 * Author: Jatin Sharma (https://jatinsh.netlify.app/)
 */

import http from 'http';
import { CascadingSimulator } from '../core/cascadingSimulator.js';
import { CircuitBreaker } from '../core/circuitBreaker.js';
import { ResilienceGenerator } from '../generators/resilienceGen.js';
import { ResilienceLinter } from '../linter/resilienceLinter.js';
import { FrameworkType } from '../types.js';

export class StudioServer {
  private server: http.Server | null = null;
  private breaker = new CircuitBreaker('studio-demo-breaker', {
    failureRateThreshold: 50,
    minimumNumberOfCalls: 5,
    waitDurationInOpenStateMs: 4000,
    maxConcurrentCalls: 10
  });

  constructor(private port = 7070) {}

  start(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer(async (req, res) => {
        // Enable CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }

        const url = new URL(req.url || '/', `http://localhost:${this.port}`);

        // API: Simulate Cascading Outage
        if (req.method === 'POST' && url.pathname === '/api/simulate-cascading') {
          let body = '';
          req.on('data', (c) => (body += c));
          req.on('end', async () => {
            try {
              const data = body ? JSON.parse(body) : {};
              const requests = Number(data.requests) || 100;
              const failProb = Number(data.failureProbability) ?? 0.9;
              const result = await CascadingSimulator.simulate(requests, failProb, 1500);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(result));
            } catch (err: any) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        // API: Audit Resilience Config
        if (req.method === 'POST' && url.pathname === '/api/audit-config') {
          let body = '';
          req.on('data', (c) => (body += c));
          req.on('end', () => {
            try {
              const data = JSON.parse(body || '{}');
              const audit = ResilienceLinter.audit({
                circuitConfig: {
                  failureRateThreshold: Number(data.failureRateThreshold) || 50,
                  slowCallRateThreshold: Number(data.slowCallRateThreshold) || 50,
                  slowCallDurationThresholdMs: Number(data.slowCallDurationMs) || 1000,
                  minimumNumberOfCalls: Number(data.minimumCalls) || 5,
                  maxConcurrentCalls: Number(data.maxConcurrent) || 10,
                  waitDurationInOpenStateMs: Number(data.openWaitMs) || 5000,
                  enableHalfOpenJitter: Boolean(data.enableJitter)
                },
                timeoutMs: Number(data.timeoutMs) || 2000,
                hasFallback: Boolean(data.hasFallback),
                hasRetry: Boolean(data.hasRetry),
                retryCount: Number(data.retryCount) || 0,
                hasStateListener: Boolean(data.hasStateListener),
                injectHeader: Boolean(data.injectHeader)
              });
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(audit));
            } catch (err: any) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        // API: Generate Middleware
        if (req.method === 'POST' && url.pathname === '/api/generate-middleware') {
          let body = '';
          req.on('data', (c) => (body += c));
          req.on('end', () => {
            try {
              const data = JSON.parse(body || '{}');
              const fw = (data.framework || 'nextjs') as FrameworkType;
              const result = ResilienceGenerator.generate(fw, {
                failureThreshold: Number(data.failureThreshold) || 50,
                openDurationSec: Number(data.openDurationSec) || 5,
                bulkheadLimit: Number(data.bulkheadLimit) || 15
              });
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(result));
            } catch (err: any) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        // API: Live Metrics
        if (req.method === 'GET' && url.pathname === '/api/metrics') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(this.breaker.getMetrics()));
          return;
        }

        // HTML Dashboard
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(this.renderHtml());
      });

      this.server.listen(this.port, () => resolve(this.port));
      this.server.on('error', reject);
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) this.server.close(() => resolve());
      else resolve();
    });
  }

  private renderHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CircuitSmith Studio | Distributed Circuit Breaker & Cascading Failure Simulator</title>
  <style>
    :root {
      --bg: #07090e;
      --card-bg: rgba(15, 23, 42, 0.75);
      --border: rgba(255, 255, 255, 0.08);
      --border-accent: rgba(0, 240, 255, 0.25);
      --cyan: #00f0ff;
      --emerald: #10b981;
      --amber: #f59e0b;
      --rose: #f43f5e;
      --purple: #a855f7;
      --text: #f1f5f9;
      --text-muted: #94a3b8;
      --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      background-image: 
        radial-gradient(circle at 15% 15%, rgba(0, 240, 255, 0.04) 0%, transparent 40%),
        radial-gradient(circle at 85% 85%, rgba(244, 63, 94, 0.04) 0%, transparent 40%);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      min-height: 100vh;
      padding: 24px;
    }

    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--border);
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .logo-badge {
      background: linear-gradient(135deg, var(--rose), var(--amber));
      color: #000;
      font-weight: 900;
      font-size: 18px;
      padding: 6px 14px;
      border-radius: 8px;
      letter-spacing: -0.5px;
      box-shadow: 0 0 15px rgba(244, 63, 94, 0.4);
    }

    .brand h1 {
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.5px;
    }

    .brand p {
      font-size: 13px;
      color: var(--text-muted);
    }

    .author-badge {
      font-size: 12px;
      color: var(--text-muted);
      background: rgba(255, 255, 255, 0.03);
      padding: 6px 12px;
      border-radius: 20px;
      border: 1px solid var(--border);
    }

    .author-badge a {
      color: var(--cyan);
      text-decoration: none;
      font-weight: 600;
    }

    /* Bento Grid */
    .bento-grid {
      display: grid;
      grid-template-columns: repeat(12, 1fr);
      gap: 20px;
    }

    .bento-card {
      background: var(--card-bg);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 24px;
      position: relative;
      overflow: hidden;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    .bento-card:hover {
      border-color: var(--border-accent);
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
    }

    .card-cascading { grid-column: span 8; }
    .card-state { grid-column: span 4; }
    .card-linter { grid-column: span 7; }
    .card-bulkhead { grid-column: span 5; }
    .card-generator { grid-column: span 12; }

    .card-title {
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--cyan);
      font-weight: 700;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .card-desc {
      font-size: 13px;
      color: var(--text-muted);
      margin-bottom: 20px;
    }

    /* State Machine Visualizer */
    .state-machine-box {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #000;
      padding: 18px 12px;
      border-radius: 12px;
      border: 1px solid var(--border);
      margin-bottom: 16px;
    }

    .state-pill {
      padding: 8px 16px;
      border-radius: 8px;
      font-family: var(--font-mono);
      font-size: 12px;
      font-weight: 800;
      opacity: 0.35;
      transition: opacity 0.3s, transform 0.3s, box-shadow 0.3s;
    }

    .state-pill.active {
      opacity: 1;
      transform: scale(1.08);
    }

    .pill-closed { background: rgba(16, 185, 129, 0.2); color: var(--emerald); border: 1px solid var(--emerald); }
    .pill-closed.active { box-shadow: 0 0 15px rgba(16, 185, 129, 0.4); }

    .pill-open { background: rgba(244, 63, 94, 0.2); color: var(--rose); border: 1px solid var(--rose); }
    .pill-open.active { box-shadow: 0 0 15px rgba(244, 63, 94, 0.4); }

    .pill-half { background: rgba(245, 158, 11, 0.2); color: var(--amber); border: 1px solid var(--amber); }
    .pill-half.active { box-shadow: 0 0 15px rgba(245, 158, 11, 0.4); }

    /* Node Canvas */
    .nodes-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 10px;
      margin-top: 16px;
    }

    .node-item {
      background: #000;
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 12px 8px;
      text-align: center;
    }

    .node-name {
      font-size: 11px;
      font-weight: 700;
      color: #fff;
      margin-bottom: 6px;
    }

    .node-status {
      font-size: 10px;
      font-family: var(--font-mono);
      font-weight: 800;
      padding: 3px 6px;
      border-radius: 4px;
      display: inline-block;
    }

    .status-HEALTHY { background: rgba(16, 185, 129, 0.2); color: var(--emerald); }
    .status-OUTAGE { background: rgba(244, 63, 94, 0.2); color: var(--rose); }

    /* Inputs & Buttons */
    input, textarea, select {
      width: 100%;
      background: rgba(0, 0, 0, 0.35);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 10px 14px;
      color: var(--text);
      font-family: var(--font-mono);
      font-size: 13px;
      margin-bottom: 12px;
      transition: border-color 0.2s;
    }

    input:focus, textarea:focus, select:focus {
      outline: none;
      border-color: var(--cyan);
    }

    button {
      background: linear-gradient(135deg, var(--rose), var(--amber));
      color: #000;
      border: none;
      border-radius: 8px;
      padding: 10px 18px;
      font-weight: 700;
      font-size: 13px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: transform 0.15s, opacity 0.15s;
    }

    button:hover {
      opacity: 0.9;
      transform: translateY(-1px);
    }

    .issue-item {
      background: rgba(0, 0, 0, 0.4);
      border-left: 4px solid var(--rose);
      padding: 10px 14px;
      margin-bottom: 8px;
      border-radius: 0 6px 6px 0;
      font-size: 12px;
    }

    pre code {
      display: block;
      background: #000;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
      font-family: var(--font-mono);
      font-size: 12px;
      color: #cbd5e1;
      overflow-x: auto;
      max-height: 280px;
    }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <div class="logo-badge">CS</div>
      <div>
        <h1>CircuitSmith Studio</h1>
        <p>Distributed Circuit Breaker & Cascading Failure Resilience Simulator</p>
      </div>
    </div>
    <div class="author-badge">
      Engineered by <a href="https://jatinsh.netlify.app/" target="_blank">Jatin Sharma</a>
    </div>
  </header>

  <div class="bento-grid">
    <!-- Card 1: Cascading Failure Simulator -->
    <div class="bento-card card-cascading">
      <div class="card-title">⚡ Cascading Failure Outage Simulator</div>
      <p class="card-desc">Simulate 100 concurrent requests across a 5-tier microservice graph with Payment Gateway outage.</p>
      
      <div style="display: flex; gap: 12px; margin-bottom: 16px;">
        <button id="btnRunSim" onclick="runSimulation()">▶ Simulate Outage Cascade</button>
        <span id="simStatus" style="font-size: 12px; color: var(--text-muted); align-self: center;">Ready to benchmark</span>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
        <!-- Left: Unshielded -->
        <div style="background: rgba(244, 63, 94, 0.05); border: 1px solid rgba(244, 63, 94, 0.2); border-radius: 10px; padding: 14px;">
          <div style="font-size: 12px; font-weight: 800; color: var(--rose); margin-bottom: 4px;">WITHOUT Circuit Breakers (Raw)</div>
          <div style="font-size: 11px; color: var(--text-muted);">Thread pool exhaustion propagates upstream</div>
          <div class="nodes-grid" id="nodesWithout"></div>
          <div style="margin-top: 12px; font-size: 12px; font-family: var(--font-mono);">
            Surviving: <span id="surviveWithout" style="color: var(--rose);">40%</span> | Latency: <span id="latWithout" style="color: var(--rose);">1500ms</span>
          </div>
        </div>

        <!-- Right: CircuitSmith Protected -->
        <div style="background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 10px; padding: 14px;">
          <div style="font-size: 12px; font-weight: 800; color: var(--emerald); margin-bottom: 4px;">WITH CircuitSmith Breakers</div>
          <div style="font-size: 11px; color: var(--text-muted);">Fast-fail isolates failure, cascade halted!</div>
          <div class="nodes-grid" id="nodesWith"></div>
          <div style="margin-top: 12px; font-size: 12px; font-family: var(--font-mono);">
            Surviving: <span id="surviveWith" style="color: var(--emerald);">80%</span> | Latency: <span id="latWith" style="color: var(--cyan);">1ms</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Card 2: 3-State Machine Visualizer -->
    <div class="bento-card card-state">
      <div class="card-title">🔄 Circuit State Machine</div>
      <p class="card-desc">Martin Fowler 3-state transitions.</p>
      
      <div class="state-machine-box">
        <div class="state-pill pill-closed active" id="pillClosed">CLOSED</div>
        <div style="color: var(--text-muted); font-size: 11px;">→</div>
        <div class="state-pill pill-open" id="pillOpen">OPEN</div>
        <div style="color: var(--text-muted); font-size: 11px;">→</div>
        <div class="state-pill pill-half" id="pillHalf">HALF_OPEN</div>
      </div>

      <div style="display: flex; gap: 8px;">
        <button style="flex: 1; padding: 8px; font-size: 11px;" onclick="setManualState('CLOSED')">Reset (CLOSED)</button>
        <button style="flex: 1; padding: 8px; font-size: 11px; background: linear-gradient(135deg, var(--rose), #e11d48);" onclick="setManualState('OPEN')">Trip (OPEN)</button>
        <button style="flex: 1; padding: 8px; font-size: 11px; background: linear-gradient(135deg, var(--amber), #d97706);" onclick="setManualState('HALF_OPEN')">Probe (HALF)</button>
      </div>
    </div>

    <!-- Card 3: Resilience Configuration Linter -->
    <div class="bento-card card-linter">
      <div class="card-title">🔍 Resilience Configuration Linter</div>
      <p class="card-desc">Audit circuit breaker configs against 16 distributed resilience rules.</p>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
        <div>
          <label style="font-size: 11px; color: var(--text-muted);">Timeout (ms)</label>
          <input type="number" id="inTimeout" value="2500" />
        </div>
        <div>
          <label style="font-size: 11px; color: var(--text-muted);">Failure Threshold (%)</label>
          <input type="number" id="inFailThreshold" value="50" />
        </div>
      </div>
      <button onclick="auditConfig()">Audit Resilience Config</button>
      <div id="linterResult" style="margin-top: 16px;"></div>
    </div>

    <!-- Card 4: Bulkhead Semaphore Limits -->
    <div class="bento-card card-bulkhead">
      <div class="card-title">🛡 Bulkhead Isolation Limits</div>
      <p class="card-desc">Prevent node resource exhaustion.</p>
      <div style="background: #000; padding: 16px; border-radius: 10px; border: 1px solid var(--border);">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span style="font-size: 12px; color: var(--text-muted);">Bulkhead Max Concurrency:</span>
          <span style="font-size: 13px; font-weight: 800; color: var(--cyan);">15 slots</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span style="font-size: 12px; color: var(--text-muted);">Active Requests:</span>
          <span style="font-size: 13px; font-weight: 800; color: var(--emerald);">0 in flight</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="font-size: 12px; color: var(--text-muted);">Fast-Fail Duration:</span>
          <span style="font-size: 13px; font-weight: 800; color: var(--emerald);">0ms (instant)</span>
        </div>
      </div>
    </div>

    <!-- Card 5: Multi-Framework Generator -->
    <div class="bento-card card-generator">
      <div class="card-title">⚡ Production Resilience Middleware Generator</div>
      <p class="card-desc">Generate production-hardened circuit breaker & bulkhead code.</p>
      <div style="display: flex; gap: 12px; margin-bottom: 12px; max-width: 400px;">
        <select id="genFw" onchange="generateCode()">
          <option value="nextjs">Next.js 14/15 App Router</option>
          <option value="express">Express.js (Bulkhead + Breaker)</option>
          <option value="fastify">Fastify Plugin</option>
          <option value="cloudflare">Cloudflare Workers Edge</option>
          <option value="hono">Hono Multi-Runtime</option>
          <option value="fastapi">FastAPI Python</option>
        </select>
        <button onclick="generateCode()">Generate</button>
      </div>
      <pre><code id="genCode">// Code will appear here...</code></pre>
    </div>
  </div>

  <script>
    function renderNodes(containerId, nodes) {
      const container = document.getElementById(containerId);
      container.innerHTML = nodes.map(n => \`
        <div class="node-item">
          <div class="node-name">\${n.name}</div>
          <span class="node-status status-\${n.state}">\${n.state}</span>
        </div>
      \`).join('');
    }

    async function runSimulation() {
      const btn = document.getElementById('btnRunSim');
      const status = document.getElementById('simStatus');
      btn.disabled = true;
      status.innerText = 'Simulating cascading failure...';

      try {
        const res = await fetch('/api/simulate-cascading', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requests: 100, failureProbability: 0.9 })
        });
        const data = await res.json();

        renderNodes('nodesWithout', data.withoutCircuitBreakers.nodes);
        renderNodes('nodesWith', data.withCircuitBreakers.nodes);

        document.getElementById('surviveWithout').innerText = data.withoutCircuitBreakers.survivingServicesPercent + '%';
        document.getElementById('latWithout').innerText = data.withoutCircuitBreakers.avgLatencyMs + 'ms';

        document.getElementById('surviveWith').innerText = data.withCircuitBreakers.survivingServicesPercent + '%';
        document.getElementById('latWith').innerText = data.withCircuitBreakers.avgLatencyMs + 'ms';

        status.innerText = 'Simulation completed: Cascading outage prevented!';
      } catch (e) {
        status.innerText = 'Simulation error.';
      } finally {
        btn.disabled = false;
      }
    }

    function setManualState(state) {
      document.getElementById('pillClosed').classList.remove('active');
      document.getElementById('pillOpen').classList.remove('active');
      document.getElementById('pillHalf').classList.remove('active');

      if (state === 'CLOSED') document.getElementById('pillClosed').classList.add('active');
      if (state === 'OPEN') document.getElementById('pillOpen').classList.add('active');
      if (state === 'HALF_OPEN') document.getElementById('pillHalf').classList.add('active');
    }

    async function auditConfig() {
      const timeout = document.getElementById('inTimeout').value;
      const failThresh = document.getElementById('inFailThreshold').value;

      const res = await fetch('/api/audit-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timeoutMs: Number(timeout),
          failureRateThreshold: Number(failThresh),
          hasFallback: true,
          hasRetry: false,
          hasStateListener: true,
          injectHeader: true
        })
      });
      const data = await res.json();

      let html = '<div style="display:flex; justify-content:space-between; margin-bottom:12px;">';
      html += '<div><strong>Grade: ' + data.grade + '</strong> (' + data.score + '/100)</div>';
      html += '</div>';

      if (data.issues.length === 0) {
        html += '<p style="color:var(--emerald);">✔ Excellent resilience architecture! No vulnerabilities detected.</p>';
      } else {
        data.issues.forEach(iss => {
          const color = iss.severity === 'CRITICAL' ? 'var(--rose)' : iss.severity === 'HIGH' ? 'var(--amber)' : 'var(--cyan)';
          html += '<div class="issue-item" style="border-left-color:' + color + ';">';
          html += '<strong>[' + iss.code + ' ' + iss.severity + ']</strong> ' + iss.message + '<br>';
          html += '<span style="color:var(--text-muted);">' + iss.recommendation + '</span>';
          html += '</div>';
        });
      }
      document.getElementById('linterResult').innerHTML = html;
    }

    async function generateCode() {
      const fw = document.getElementById('genFw').value;
      const res = await fetch('/api/generate-middleware', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ framework: fw, failureThreshold: 50, openDurationSec: 5 })
      });
      const data = await res.json();
      document.getElementById('genCode').innerText = data.code;
    }

    window.addEventListener('DOMContentLoaded', () => {
      runSimulation();
      auditConfig();
      generateCode();
    });
  </script>
</body>
</html>
`;
  }
}
