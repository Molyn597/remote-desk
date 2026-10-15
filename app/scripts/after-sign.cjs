// Signs the final macOS bundle ourselves (electron-builder 26 can't sign with a
// self-signed identity). Release builds use the stable "Remote Desk Signing"
// certificate so macOS keeps permissions across updates and Squirrel accepts
// updates; without RD_SIGN_IDENTITY (local builds) the app is signed ad hoc.
const { execFileSync } = require('node:child_process');
const path = require('node:path');

exports.default = async function afterSign(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  const args = ['--force', '--deep', '--sign', process.env.RD_SIGN_IDENTITY || '-'];
  if (process.env.RD_SIGN_KEYCHAIN) args.push('--keychain', process.env.RD_SIGN_KEYCHAIN);
  execFileSync('codesign', [...args, appPath], { stdio: 'inherit' });
};
