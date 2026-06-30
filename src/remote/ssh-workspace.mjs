import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, posix } from 'node:path';
import { SshTerminalSession } from './ssh-terminal.mjs';

const execFileAsync = promisify(execFile);

export class SshWorkspaceClient {
  constructor({ host, port, user, identityFile, knownHostsFile, extraOptions = [], nodePath = 'node' }) {
    this.host = host;
    this.port = port;
    this.user = user;
    this.identityFile = identityFile;
    this.knownHostsFile = knownHostsFile;
    this.extraOptions = extraOptions;
    this.nodePath = nodePath;
  }

  async run(command, args = [], { timeout = 15_000 } = {}) {
    const remote = this.user ? `${this.user}@${this.host}` : this.host;
    const sshArgs = [
      '-p',
      String(this.port),
      '-i',
      this.identityFile,
      '-o',
      'BatchMode=yes',
      '-o',
      'IdentitiesOnly=yes',
      '-o',
      'StrictHostKeyChecking=no',
      '-o',
      `UserKnownHostsFile=${this.knownHostsFile}`,
      ...this.extraOptions,
      remote,
      shellJoin([command, ...args])
    ];
    const result = await execFileAsync('ssh', sshArgs, {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      timeout
    });
    return result.stdout;
  }

  async ensureWorkspace(workspace) {
    await this.run('mkdir', ['-p', workspace]);
  }

  async writeFile(remotePath, content) {
    const encoded = Buffer.from(content, 'utf8').toString('base64');
    await this.run('mkdir', ['-p', dirname(remotePath)]);
    await this.run(this.nodePath, [
      '-e',
      'require("fs").writeFileSync(process.argv[1], Buffer.from(process.argv[2], "base64"))',
      remotePath,
      encoded
    ]);
  }

  async renamePath(fromRemotePath, toRemotePath) {
    await this.run('mkdir', ['-p', dirname(toRemotePath)]);
    await this.run('mv', ['--', fromRemotePath, toRemotePath]);
  }

  async deletePath(remotePath) {
    await this.run('rm', ['-rf', '--', remotePath]);
  }

  async readFile(remotePath) {
    return this.run(this.nodePath, [
      '-e',
      'process.stdout.write(require("fs").readFileSync(process.argv[1], "utf8"))',
      remotePath
    ]);
  }

  async list(workspace) {
    const output = await this.run(this.nodePath, [
      '-e',
      'const fs=require("fs"); const p=process.argv[1]; process.stdout.write(JSON.stringify(fs.readdirSync(p,{withFileTypes:true}).map(e=>({name:e.name,kind:e.isDirectory()?"directory":"file"})).sort((a,b)=>(a.kind+a.name).localeCompare(b.kind+b.name))))',
      workspace
    ]);
    return JSON.parse(output);
  }

  async search(workspace, query) {
    const output = await this.run(this.nodePath, [
      '-e',
      `const fs=require("fs"); const path=require("path"); const root=process.argv[1]; const q=process.argv[2]; const out=[]; function walk(d){ for(const e of fs.readdirSync(d,{withFileTypes:true})){ const p=path.join(d,e.name); if(e.isDirectory()) walk(p); else { const lines=fs.readFileSync(p,"utf8").split(/\\r?\\n/); lines.forEach((line,i)=>{ const c=line.indexOf(q); if(c>=0) out.push({relativePath:path.relative(root,p),line:i+1,column:c+1,preview:line.trim()}); }); } } } walk(root); process.stdout.write(JSON.stringify(out));`,
      workspace,
      query
    ]);
    return JSON.parse(output);
  }

  async runTerminalCommand(command, args = [], { cwd } = {}) {
    const output = await this.run(this.nodePath, [
      '-e',
      'const {spawnSync}=require("child_process"); const r=spawnSync(process.argv[2], process.argv.slice(3), {cwd:process.argv[1]||undefined,encoding:"utf8"}); process.stdout.write(JSON.stringify({status:r.status, stdout:r.stdout, stderr:r.stderr}));',
      cwd ?? '',
      command,
      ...args
    ]);
    return { command: [command, ...args].join(' '), ...JSON.parse(output) };
  }

  async openTerminal(workspace, { width = 80, height = 24, outputLimit } = {}) {
    const terminal = new SshTerminalSession({
      target: {
        host: this.host,
        port: this.port,
        user: this.user,
        identityFile: this.identityFile,
        knownHostsFile: this.knownHostsFile,
        extraOptions: this.extraOptions
      },
      workspace,
      width,
      height,
      ...(outputLimit ? { outputLimit } : {})
    });
    await terminal.start();
    return terminal;
  }
}

export function workspaceFile(workspace, relativePath) {
  return posix.join(workspace, relativePath);
}

function shellJoin(args) {
  return args.map(shellQuote).join(' ');
}

function shellQuote(value) {
  const text = String(value);
  if (/^[A-Za-z0-9_./:=@%+-]+$/u.test(text)) {
    return text;
  }
  return `'${text.replaceAll("'", "'\\''")}'`;
}
