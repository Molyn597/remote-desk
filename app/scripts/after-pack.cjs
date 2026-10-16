// Runs right after packaging (afterPack), before electron-builder would sign anything.
//
// 1. Electron fuses: turn off ways to run arbitrary code as Remote Desk (ELECTRON_RUN_AS_NODE,
//    NODE_OPTIONS, --inspect). Otherwise any local program could borrow the app's Screen
//    Recording and Accessibility permissions. This must happen before signing, because it
//    changes the binary; electron-builder's own electronFuses option flips them after afterPack.
//
// 2. macOS signing: electron-builder's own signing stays off (mac.identity: null) and never
//    auto-picks a certificate. Release builds use the stable "Remote Desk Signing" certificate
//    so macOS keeps permissions across updates and Squirrel accepts in-place updates; without
//    RD_SIGN_IDENTITY (local builds) the app is signed ad hoc.
// electron-builder runs its own afterPack steps (e.g. writing app-update.yml) first.
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { flipFuses, FuseVersion, FuseV1Options } = require('@electron/fuses');

exports.default = async function afterPack(context) {
  const platform = context.electronPlatformName;
  // Universal builds pack x64 and arm64 halves into *-temp dirs; only the merged app is shipped.
  if (platform === 'darwin' && context.appOutDir.endsWith('-temp')) return;
  const name = context.packager.appInfo.productFilename;
  const target = platform === 'darwin' ? path.join(context.appOutDir, `${name}.app`) : path.join(context.appOutDir, `${name}.exe`);

  await flipFuses(target, {
    version: FuseVersion.V1,
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
  });

  if (platform !== 'darwin') return;
  const args = ['--force', '--deep', '--sign', process.env.RD_SIGN_IDENTITY || '-'];
  if (process.env.RD_SIGN_KEYCHAIN) args.push('--keychain', process.env.RD_SIGN_KEYCHAIN);
  execFileSync('codesign', [...args, target], { stdio: 'inherit' });
};
