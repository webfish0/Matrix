export function validateSshHost(input) {
  if (!input || typeof input !== 'string') {
    throw new Error('SSH host is required.');
  }
  if (input.length > 255) {
    throw new Error('SSH host is too long.');
  }
  if (/[\u0000-\u001f\u007f]/u.test(input)) {
    throw new Error('SSH host contains control characters.');
  }
  if (/[;&|`$<>(){}[\]\n\r]/u.test(input)) {
    throw new Error('SSH host contains shell metacharacters. Smith passes SSH arguments without a shell; remove shell syntax from the host value.');
  }
  return input;
}

export function validateRemoteWorkspace(input = '~') {
  if (typeof input !== 'string' || input.length === 0) {
    throw new Error('Workspace path is required.');
  }
  if (input.length > 4096) {
    throw new Error('Workspace path is too long.');
  }
  if (/[\u0000-\u001f\u007f]/u.test(input)) {
    throw new Error('Workspace path contains control characters.');
  }
  return input;
}
