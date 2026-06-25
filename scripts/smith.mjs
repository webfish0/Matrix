#!/usr/bin/env node
import { readJson, stableJson } from './lib.mjs';
import { buildAgentInstallPlan } from '../src/remote/agent-plan.mjs';
import { evaluateHandshake } from '../src/remote/handshake.mjs';
import { resolveSshTarget } from '../src/remote/ssh-config.mjs';
import { SshWorkspaceClient } from '../src/remote/ssh-workspace.mjs';
import { IdeSession } from '../src/ide/session.mjs';
import { withSshFixture } from './ssh-fixture.mjs';
import { parseOptions, requireOption } from '../src/cli/options.mjs';

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
  } else if (command === 'ide-demo') {
    await withSshFixture(async ({ target, workspace }) => {
      const client = new SshWorkspaceClient(target);
      const session = new IdeSession({ client, workspace, remoteLabel: 'ssh:fixture' });
      await session.initialize({ seedDemo: true });
      await session.runInteractive();
    });
  } else if (command === 'ide') {
    const { options } = parseOptions(args);
    const usage = 'npm run smith -- ide --host <host> --workspace <path> --identity <key> [--port 22] [--user user] [--known-hosts file] [--node node]';
    const host = requireOption(options, 'host', usage);
    const workspace = requireOption(options, 'workspace', usage);
    const identityFile = requireOption(options, 'identity', usage);
    const target = {
      host,
      port: Number(options.port ?? 22),
      user: options.user ? String(options.user) : undefined,
      identityFile,
      knownHostsFile: options['known-hosts'] ? String(options['known-hosts']) : '/dev/null',
      nodePath: options.node ? String(options.node) : 'node'
    };
    const client = new SshWorkspaceClient(target);
    const session = new IdeSession({ client, workspace, remoteLabel: `ssh:${host}` });
    await session.initialize({ seedDemo: false });
    await session.runInteractive();
  } else {
    console.error('Usage: npm run smith -- connect-plan <ssh-host> [workspace]');
    console.error('       npm run smith -- handshake-check');
    console.error('       npm run smith -- ide-demo');
    console.error('       npm run smith -- ide --host <host> --workspace <path> --identity <key> [--port 22] [--user user]');
    process.exitCode = 2;
  }
} catch (error) {
  console.error(`smith: ${error.message}`);
  process.exitCode = 1;
}
