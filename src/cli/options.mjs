export function parseOptions(args) {
  const options = {};
  const positional = [];
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = args[index + 1];
      if (value === undefined || value.startsWith('--')) {
        options[key] = true;
      } else {
        options[key] = value;
        index += 1;
      }
    } else {
      positional.push(arg);
    }
  }
  return { options, positional };
}

export function requireOption(options, key, usage) {
  if (!options[key]) {
    throw new Error(`Missing --${key}. Usage: ${usage}`);
  }
  return String(options[key]);
}
