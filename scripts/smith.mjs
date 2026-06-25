#!/usr/bin/env node
import { readJson, stableJson } from './lib.mjs';
import { buildAgentInstallPlan } from '../src/remote/agent-plan.mjs';
import { evaluateHandshake } from '../src/remote/handshake.mjs';
import { resolveSshTarget } from '../src/remote/ssh-config.mjs';

const [command, ...args] = process.argv.slice(2);

try {
  if (command === 'connect-plan') {
    const [host, workspace = '~'] = args;
    const product = await readJson('smith/product.json');
    const upstream = await readJson('smith/baseline/upstream.json');
    const sshTarget = await resolveSshTarget({ host, workspace });
    const agentPlan = buildAgentInstallPlan({ host, workspace, product, upstream });
    console.log(stableJson({
      schema: 'smith.connect-plan.v1',
      state: 'ready-to-connect',
      sshTarget,
      agentPlan
    }));
  } else if (command === 'handshake-check') {
    const product = await readJson('smith/product.json');
    const upstream = await readJson('smith/baseline/upstream.json');
    const expected = {
      smithVersion: product.version,
      upstreamCommit: upstream.upstream.commit,
      protocolVersion: 'mvp-1'
    };
    console.log(stableJson(evaluateHandshake({ client: expected, agent: expected })));
  } else {
    console.error('Usage: npm run smith -- connect-plan <ssh-host> [workspace]');
    console.error('       npm run smith -- handshake-check');
    process.exitCode = 2;
  }
} catch (error) {
  console.error(`smith: ${error.message}`);
  process.exitCode = 1;
}
