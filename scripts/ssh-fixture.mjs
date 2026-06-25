import { execFile, spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir, userInfo } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function withSshFixture(fn) {
  const root = await mkdtemp(join(tmpdir(), 'smith-sshd-'));
  const port = 22000 + Math.floor(Math.random() * 20000);
  const user = userInfo().username;
  const hostKey = join(root, 'host_key');
  const clientKey = join(root, 'client_key');
  const authorizedKeys = join(root, 'authorized_keys');
  const knownHosts = join(root, 'known_hosts');
  const config = join(root, 'sshd_config');
  const workspace = join(root, 'workspace');

  let server;
  try {
    await execFileAsync('ssh-keygen', ['-q', '-t', 'ed25519', '-N', '', '-f', hostKey]);
    await execFileAsync('ssh-keygen', ['-q', '-t', 'ed25519', '-N', '', '-f', clientKey]);
    await writeFile(authorizedKeys, await readFile(`${clientKey}.pub`, 'utf8'), 'utf8');
    await writeFile(
      config,
      [
        `Port ${port}`,
        'ListenAddress 127.0.0.1',
        `HostKey ${hostKey}`,
        `AuthorizedKeysFile ${authorizedKeys}`,
        'PasswordAuthentication no',
        'KbdInteractiveAuthentication no',
        'ChallengeResponseAuthentication no',
        'UsePAM no',
        'PermitRootLogin no',
        `PidFile ${join(root, 'sshd.pid')}`,
        'StrictModes no',
        'LogLevel ERROR',
        'Subsystem sftp /usr/libexec/sftp-server',
        ''
      ].join('\n'),
      'utf8'
    );

    server = spawn('/usr/sbin/sshd', ['-D', '-e', '-f', config], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    await waitForSsh({ port, user, clientKey, knownHosts });

    return await fn({
      root,
      workspace,
      target: {
        host: '127.0.0.1',
        port,
        user,
        identityFile: clientKey,
        knownHostsFile: knownHosts,
        nodePath: process.execPath
      }
    });
  } finally {
    if (server) {
      server.kill('SIGTERM');
    }
    await rm(root, { recursive: true, force: true });
  }
}

async function waitForSsh({ port, user, clientKey, knownHosts }) {
  let lastError;
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      await execFileAsync(
        'ssh',
        [
          '-p',
          String(port),
          '-i',
          clientKey,
          '-o',
          'BatchMode=yes',
          '-o',
          'IdentitiesOnly=yes',
          '-o',
          'StrictHostKeyChecking=no',
          '-o',
          `UserKnownHostsFile=${knownHosts}`,
          `${user}@127.0.0.1`,
          'true'
        ],
        { encoding: 'utf8', timeout: 2000 }
      );
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error(`Disposable sshd did not become ready: ${lastError?.message ?? 'unknown error'}`);
}
