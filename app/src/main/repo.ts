import pkg from '../../package.json';

// GitHub repository the app is published from, taken from package.json at build time.
const match = /github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?$/.exec(pkg.repository?.url ?? '');

// Bundle identifier, e.g. for resetting this app's macOS privacy permissions.
export const appId: string | undefined = pkg.build?.appId;

export const repo = match ? { owner: match[1], name: match[2] } : undefined;

export const repoUrl = (path = '') => (repo ? `https://github.com/${repo.owner}/${repo.name}${path}` : undefined);

export const rawFileUrl = (ref: string, file: string) =>
  repo ? `https://raw.githubusercontent.com/${repo.owner}/${repo.name}/${ref}/${file}` : undefined;
