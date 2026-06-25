import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { validateRemoteWorkspace, validateSshHost } from './validation.mjs';

const execFileAsync = promisify(execFile);

export async function resolveSshTarget({ host, workspace = '~', ssh = 'ssh' }) {
  const safeHost = validateSshHost(host);
  const safeWorkspace = validateRemoteWorkspace(workspace);
  const { stdout } = await execFileAsync(ssh, ['-G', safeHost], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
    timeout: 10_000
  });
  const config = parseSshG(stdout);
  return {
    host: safeHost,
    workspace: safeWorkspace,
    resolved: {
      hostname: config.hostname ?? safeHost,
      user: config.user ?? null,
      port: Number(config.port ?? 22),
      proxyJump: config.proxyjump ?? null,
      identityFiles: collect(config, 'identityfile'),
      strictHostKeyChecking: config.stricthostkeychecking ?? null,
      userKnownHostsFile: collect(config, 'userknownhostsfile')
    },
    command: {
      executable: ssh,
      args: ['-G', safeHost],
      shell: false
    }
  };
}

export function parseSshG(output) {
  const config = {};
  for (const rawLine of output.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const index = line.indexOf(' ');
    if (index <= 0) {
      continue;
    }
    const key = line.slice(0, index).toLowerCase();
    const value = line.slice(index + 1).trim();
    if (config[key] === undefined) {
      config[key] = value;
    } else if (Array.isArray(config[key])) {
      config[key].push(value);
    } else {
      config[key] = [config[key], value];
    }
  }
  return config;
}

function collect(config, key) {
  const value = config[key];
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}
