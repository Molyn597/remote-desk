// Signs the macOS app right after packaging (afterPack), so electron-builder's own
// signing stays off (mac.identity: null) and never auto-picks a certificate.
// Release builds use the stable "Remote Desk Signing" certificate so macOS keeps
// permissions across updates and Squirrel accepts in-place updates; without
// RD_SIGN_IDENTITY (local builds) the app is signed ad hoc.
// electron-builder runs its own afterPack steps (e.g. writing app-update.yml) first.
const { execFileSync } = require('node:child_process');
const path = require('node:path');

exports.default = async function signMac(context) {
  if (context.electronPlatformName !== 'darwin') return;
  // Universal builds pack x64 and arm64 halves into *-temp dirs; only the merged app is shipped.
  if (context.appOutDir.endsWith('-temp')) return;
  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  const args = ['--force', '--deep', '--sign', process.env.RD_SIGN_IDENTITY || '-'];
  if (process.env.RD_SIGN_KEYCHAIN) args.push('--keychain', process.env.RD_SIGN_KEYCHAIN);
  execFileSync('codesign', [...args, appPath], { stdio: 'inherit' });
};
