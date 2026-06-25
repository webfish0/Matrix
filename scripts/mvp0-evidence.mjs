import { execFileSync } from 'node:child_process';
import { hostname, platform, arch, release } from 'node:os';
import { readJson, sha256File, writeJson } from './lib.mjs';

const upstream = await readJson('smith/baseline/upstream.json');
const product = await readJson('smith/product.json');
const client = await readJson('artifacts/dev/smith-client-dev.json');
const agent = await readJson('artifacts/dev/smith-agent-dev.json');
const results = await readJson('test-evidence/mvp-0-foundation/results.json');

const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const status = execFileSync('git', ['status', '--short'], { encoding: 'utf8' }).trim();

await writeJson('test-evidence/mvp-0-foundation/manifest.json', {
  schema: 'smith.evidence-manifest.v1',
  runId: 'mvp-0-foundation',
  slice: 'MVP-0 Engineering foundation',
  generatedAt: new Date().toISOString(),
  repository: {
    commit,
    dirty: status.length > 0
  },
  smith: {
    version: product.version,
    productName: product.name
  },
  upstream: {
    repository: upstream.upstream.repository,
    commit: upstream.upstream.commit,
    licence: upstream.upstream.licence
  },
  environment: {
    host: hostname(),
    platform: platform(),
    arch: arch(),
    release: release(),
    node: process.version
  },
  artifacts: [
    {
      kind: 'client',
      path: 'artifacts/dev/smith-client-dev.json',
      hash: client.artifactHash,
      fileHash: `sha256:${await sha256File('artifacts/dev/smith-client-dev.json')}`
    },
    {
      kind: 'agent',
      path: 'artifacts/dev/smith-agent-dev.json',
      hash: agent.artifactHash,
      fileHash: `sha256:${await sha256File('artifacts/dev/smith-agent-dev.json')}`
    }
  ],
  tests: results.results.map((result) => ({
    id: result.id,
    name: result.name,
    status: result.status,
    durationMs: result.durationMs
  })),
  requirements: [
    'BR-002',
    'BR-003',
    'BR-005',
    'FR-017',
    'FR-018',
    'NFR-010',
    'NFR-011',
    'NFR-012'
  ],
  issues: [
    'SMITH-001',
    'SMITH-002',
    'SMITH-003',
    'SMITH-004'
  ],
  redaction: {
    credentialsIncluded: false,
    privateKeysIncluded: false,
    sourceSecretsIncluded: false,
    unrestrictedSourceDumpIncluded: false
  },
  knownDeviations: [
    'MVP-0 produces deterministic Smith foundation metadata artifacts. Full Code OSS compilation is intentionally deferred to the next implementation slice after the downstream composition boundary is proven.'
  ]
});

console.log('Wrote test-evidence/mvp-0-foundation/manifest.json');
