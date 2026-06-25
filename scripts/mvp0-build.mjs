import { execFileSync } from 'node:child_process';
import { readJson, sha256Text, stableJson, writeJson } from './lib.mjs';

const upstream = await readJson('smith/baseline/upstream.json');
const product = await readJson('smith/product.json');
const inventory = await readJson('smith/inventory/module-inventory.json');

const gitCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const generatedFrom = {
  repositoryCommit: gitCommit,
  upstreamRepository: upstream.upstream.repository,
  upstreamCommit: upstream.upstream.commit,
  smithVersion: product.version
};

function artifact(kind) {
  const payload = {
    schema: `smith.${kind}-artifact.v1`,
    kind,
    name: kind === 'client' ? 'Smith MVP foundation client artifact' : 'Smith MVP foundation remote-agent artifact',
    product: {
      name: product.name,
      applicationName: product.applicationName,
      version: product.version,
      quality: product.quality
    },
    upstream: {
      name: upstream.upstream.name,
      repository: upstream.upstream.repository,
      commit: upstream.upstream.commit,
      licence: upstream.upstream.licence
    },
    distribution: product.distribution,
    inventory: {
      schema: inventory.schema,
      groupCount: inventory.groups.length,
      upstreamCommit: inventory.upstreamCommit
    },
    generatedFrom
  };
  const digest = sha256Text(stableJson(payload));
  return {
    ...payload,
    artifactHash: `sha256:${digest}`
  };
}

await writeJson('artifacts/dev/smith-client-dev.json', artifact('client'));
await writeJson('artifacts/dev/smith-agent-dev.json', artifact('agent'));

const client = await readJson('artifacts/dev/smith-client-dev.json');
const agent = await readJson('artifacts/dev/smith-agent-dev.json');
await writeJson('artifacts/dev/manifest.json', {
  schema: 'smith.dev-artifact-manifest.v1',
  generatedFrom,
  artifacts: [
    {
      kind: 'client',
      path: 'artifacts/dev/smith-client-dev.json',
      hash: client.artifactHash
    },
    {
      kind: 'agent',
      path: 'artifacts/dev/smith-agent-dev.json',
      hash: agent.artifactHash
    }
  ]
});

console.log(`Built MVP-0 artifacts for Code OSS ${upstream.upstream.commit}`);
