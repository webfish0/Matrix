import { createHash } from 'node:crypto';
import { validateRemoteWorkspace, validateSshHost } from './validation.mjs';

export function buildAgentInstallPlan({ host, workspace, product, upstream, platform = 'linux', arch = 'x64' }) {
  const safeHost = validateSshHost(host);
  const safeWorkspace = validateRemoteWorkspace(workspace);
  const versionKey = `${product.version}-${upstream.upstream.commit.slice(0, 12)}-${platform}-${arch}`;
  const installRoot = `~/.smith/agents/${versionKey}`;
  const tokenSeed = `${safeHost}\n${safeWorkspace}\n${versionKey}`;
  const connectionTokenPreview = createHash('sha256').update(tokenSeed).digest('hex').slice(0, 12);
  return {
    schema: 'smith.agent-install-plan.v1',
    host: safeHost,
    workspace: safeWorkspace,
    platform,
    arch,
    versionKey,
    installRoot,
    executable: `${installRoot}/bin/smith-agent`,
    manifestPath: `${installRoot}/agent-manifest.json`,
    endpoint: {
      kind: 'unix-socket',
      path: `${installRoot}/run/agent.sock`,
      forwardedOverSsh: true
    },
    verification: {
      upstreamCommit: upstream.upstream.commit,
      smithVersion: product.version,
      hashRequired: true,
      permissions: 'user-owned, not group/world writable',
      connectionTokenPreview
    },
    lifecycle: {
      installMode: 'side-by-side',
      interruptedInstallPolicy: 'never select partial install as active',
      rollbackPolicy: 'select previous complete version directory'
    }
  };
}
