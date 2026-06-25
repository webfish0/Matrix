export function evaluateHandshake({ client, agent }) {
  const mismatches = [];
  if (client.smithVersion !== agent.smithVersion) {
    mismatches.push(`Smith version mismatch: client ${client.smithVersion}, agent ${agent.smithVersion}`);
  }
  if (client.upstreamCommit !== agent.upstreamCommit) {
    mismatches.push(`Code OSS commit mismatch: client ${client.upstreamCommit}, agent ${agent.upstreamCommit}`);
  }
  if (client.protocolVersion !== agent.protocolVersion) {
    mismatches.push(`Protocol version mismatch: client ${client.protocolVersion}, agent ${agent.protocolVersion}`);
  }
  return {
    accepted: mismatches.length === 0,
    mismatches,
    correctiveAction:
      mismatches.length === 0
        ? 'none'
        : 'Install or select a Smith remote agent built from the same Smith version, Code OSS commit, and protocol version as the client.'
  };
}
