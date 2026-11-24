#!/usr/bin/env node
/**
 * CircuitSmith CLI Interface
 * Author: Jatin Sharma (https://jatinsh.netlify.app/)
 */

import { CascadingSimulator } from './core/cascadingSimulator.js';
import { ResilienceLinter } from './linter/resilienceLinter.js';
import { ResilienceProxy } from './proxy/resilienceProxy.js';
import { ResilienceGenerator } from './generators/resilienceGen.js';
import { StudioServer } from './studio/server.js';
import { FrameworkType } from './types.js';

const VERSION = '1.0.0';

function printBanner() {
  console.log(`
\x1b[31m   ______ _                   _  __   _____             _  __     __  \x1b[0m
\x1b[31m  / ____/(_)_____ _____ __  _(_)/ /_ / ___/____ ___   (_)/ /_   / /_ \x1b[0m
\x1b[31m / /    / // ___// ___// / / // // __/ \\__ \\/ __ \`__ \\ / // __/  / __ \\\x1b[0m
\x1b[31m/ /___ / // /   / /__ / /_/ // // /_  ___/ // / / / / // // /_ _ / / / /\x1b[0m
\x1b[31m\\____//_//_/    \\___/ \\__,_//_/ \\__/ /____//_/ /_/ /_//_/ \\__/(_)/_/ /_/ \x1b[0m
\x1b[90m  v${VERSION} | Distributed Circuit Breaker & Cascading Failure Studio\x1b[0m
\x1b[90m  Architect: Jatin Sharma (https://jatinsh.netlify.app/)\x1b[0m
`);
}

function printHelp() {
  printBanner();
  console.log(`\x1b[1mUSAGE:\x1b[0m
  circuitsmith <command> [options]

\x1b[1mCOMMANDS:\x1b[0m
  \x1b[32msimulate\x1b[0m                 Simulate cascading failure propagation across 5 microservice tiers
  \x1b[32maudit\x1b[0m                     Audit resilience & circuit breaker configs against 16 rules
  \x1b[32mproxy\x1b[0m                     Start zero-config resilience reverse proxy (port 8087)
  \x1b[32mgenerate <framework>\x1b[0m      Generate hardened circuit breaker middleware (nextjs, express, etc.)
  \x1b[32mstudio\x1b[0m                    Launch Bento Grid Web Studio on http://localhost:7070
  \x1b[32mversion\x1b[0m                   Print version number
  \x1b[32mhelp\x1b[0m                      Display this help message

\x1b[1mOPTIONS:\x1b[0m
  --port <num>             Port for proxy or studio (default: 8087 / 7070)
  --requests <num>         Request count for cascading failure simulation (default: 100)
  --timeout <ms>           Timeout threshold in ms (default: 2500)
  --threshold <percent>    Failure rate threshold percentage (default: 50)
`);
}

async function handleSimulate(args: string[]) {
  const reqIdx = args.indexOf('--requests');
  const requests = reqIdx !== -1 && args[reqIdx + 1] ? parseInt(args[reqIdx + 1], 10) : 100;

  console.log(`\n\x1b[1mSimulating Cascading Failure with ${requests} concurrent requests across 5 microservice nodes...\x1b[0m\n`);

  const sim = await CascadingSimulator.simulate(requests, 0.9, 1500);

  console.log('\x1b[31m=== SCENARIO 1: WITHOUT CIRCUIT BREAKERS (RAW) ===\x1b[0m');
  console.log(`System Status:        \x1b[31m${sim.withoutCircuitBreakers.systemState}\x1b[0m`);
  console.log(`Surviving Services:   ${sim.withoutCircuitBreakers.survivingServicesPercent}% (Cascading Outage)`);
  console.log(`Average Latency:      ${sim.withoutCircuitBreakers.avgLatencyMs}ms`);
  sim.withoutCircuitBreakers.nodes.forEach((n) => {
    const col = n.state === 'OUTAGE' ? '\x1b[31m' : '\x1b[32m';
    console.log(`  - [Tier ${n.tier}] ${n.name.padEnd(20)}: ${col}${n.state}\x1b[0m (${n.droppedRequests} dropped)`);
  });

  console.log('\n\x1b[32m=== SCENARIO 2: WITH CIRCUITSMITH BREAKERS ===\x1b[0m');
  console.log(`System Status:        \x1b[32m${sim.withCircuitBreakers.systemState}\x1b[0m`);
  console.log(`Surviving Services:   ${sim.withCircuitBreakers.survivingServicesPercent}% (Cascade Halted)`);
  console.log(`Average Latency:      ${sim.withCircuitBreakers.avgLatencyMs}ms`);
  sim.withCircuitBreakers.nodes.forEach((n) => {
    const col = n.state === 'OUTAGE' ? '\x1b[31m' : '\x1b[32m';
    console.log(`  - [Tier ${n.tier}] ${n.name.padEnd(20)}: ${col}${n.state}\x1b[0m`);
  });

  console.log(`\n\x1b[1mOutcome: Circuit breaker fast-failing reduced upstream outage propagation by ${(100 - (sim.withoutCircuitBreakers.survivingServicesPercent / sim.withCircuitBreakers.survivingServicesPercent * 100)).toFixed(1)}%!\x1b[0m\n`);
}

function handleAudit(args: string[]) {
  const timeoutIdx = args.indexOf('--timeout');
  const timeoutMs = timeoutIdx !== -1 && args[timeoutIdx + 1] ? parseInt(args[timeoutIdx + 1], 10) : 2500;
  const threshIdx = args.indexOf('--threshold');
  const failureRateThreshold = threshIdx !== -1 && args[threshIdx + 1] ? parseInt(args[threshIdx + 1], 10) : 50;

  const result = ResilienceLinter.audit({
    circuitConfig: {
      failureRateThreshold,
      slowCallRateThreshold: 50,
      slowCallDurationThresholdMs: 1000,
      minimumNumberOfCalls: 5,
      maxConcurrentCalls: 15,
      waitDurationInOpenStateMs: 5000,
      enableHalfOpenJitter: true
    },
    timeoutMs,
    hasFallback: true,
    hasRetry: false,
    hasStateListener: true,
    injectHeader: true
  });

  console.log('\n\x1b[1m=== RESILIENCE CONFIGURATION AUDIT ===\x1b[0m\n');
  console.log(`Grade:            \x1b[32m${result.grade}\x1b[0m (${result.score}/100)`);
  console.log(`Production Ready: ${result.isProductionReady ? '✔ Yes' : '✖ No'}\n`);

  if (result.issues.length === 0) {
    console.log('\x1b[32m✔ Excellent! Zero resilience issues detected.\x1b[0m\n');
  } else {
    result.issues.forEach((iss) => {
      const col = iss.severity === 'CRITICAL' ? '\x1b[31m' : iss.severity === 'HIGH' ? '\x1b[33m' : '\x1b[36m';
      console.log(`${col}[${iss.code}] ${iss.severity}:\x1b[0m ${iss.message}`);
      console.log(`  \x1b[90m↳ ${iss.recommendation}\x1b[0m\n`);
    });
  }
}

async function handleProxy(args: string[]) {
  const portIdx = args.indexOf('--port');
  const port = portIdx !== -1 && args[portIdx + 1] ? parseInt(args[portIdx + 1], 10) : 8087;
  const proxy = new ResilienceProxy({ port });
  await proxy.start();
  printBanner();
  console.log(`\x1b[32m✔ ResilienceProxy listening on http://localhost:${port}\x1b[0m`);
  console.log(`  - Metrics endpoint: http://localhost:${port}/__circuitsmith/metrics`);
  console.log(`  - Trip endpoint:    POST http://localhost:${port}/__circuitsmith/trip`);
  console.log(`  - Reset endpoint:   POST http://localhost:${port}/__circuitsmith/reset`);
  console.log('Press Ctrl+C to stop.\n');
}

function handleGenerate(args: string[]) {
  const fw = (args[1] || 'nextjs').toLowerCase() as FrameworkType;
  const validFw: FrameworkType[] = ['nextjs', 'express', 'fastify', 'cloudflare', 'hono', 'fastapi'];
  if (!validFw.includes(fw)) {
    console.error(`\x1b[31mError: Unknown framework "${fw}". Valid: ${validFw.join(', ')}\x1b[0m`);
    process.exit(1);
  }

  const mw = ResilienceGenerator.generate(fw, { failureThreshold: 50, openDurationSec: 5 });
  console.log(`\n\x1b[1m${mw.title}\x1b[0m (${mw.filename})\n`);
  console.log(`\x1b[90m# ${mw.instructions}\x1b[0m\n`);
  console.log(mw.code);
}

async function handleStudio(args: string[]) {
  const portIdx = args.indexOf('--port');
  const port = portIdx !== -1 && args[portIdx + 1] ? parseInt(args[portIdx + 1], 10) : 7070;
  const studio = new StudioServer(port);
  await studio.start();
  printBanner();
  console.log(`\x1b[32m✔ CircuitSmith Bento Grid Studio active!\x1b[0m`);
  console.log(`\x1b[1mOpen in browser:\x1b[0m \x1b[36mhttp://localhost:${port}\x1b[0m\n`);
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';

  switch (command) {
    case 'simulate':
      await handleSimulate(args);
      break;
    case 'audit':
      handleAudit(args);
      break;
    case 'proxy':
      await handleProxy(args);
      break;
    case 'generate':
      handleGenerate(args);
      break;
    case 'studio':
      await handleStudio(args);
      break;
    case 'version':
    case '-v':
    case '--version':
      console.log(`v${VERSION}`);
      break;
    case 'help':
    case '--help':
    case '-h':
    default:
      printHelp();
      break;
  }
}

main().catch((err) => {
  console.error('\x1b[31mFatal error:\x1b[0m', err);
  process.exit(1);
});
