<p align="center"><img src="app/build/icon.png" width="96" alt="" /></p>

# Remote Desk

Open-source remote desktop for Windows and macOS. Install, share your ID and password, and let
someone control your computer — or control theirs. No account, no server to run.

> Early development. See [SECURITY.md](SECURITY.md) before using it on computers you care about.

<p align="center">
  <img src="docs/screenshots/app-home.png" width="800" alt="Remote Desk home screen with your ID and password, the connect form and recent connections" />
</p>

<p align="center">
  <img src="docs/screenshots/app-home-dark.png" width="395" alt="Home screen in dark mode" />
  <img src="docs/screenshots/app-whats-new.png" width="395" alt="What's new page with updates, feedback and changelog" />
</p>

## Install

Download the installer for your system from [Releases](../../releases):

- **Windows** — `Remote-Desk-…-win-x64.exe` (or `arm64`). Runs and installs in one click.
  The app is not code-signed yet, so Windows SmartScreen may warn: click **More info → Run anyway**.
- **macOS** — `Remote-Desk-…-mac-universal.dmg`. Drag the app to Applications.
  The app is not notarized yet, so on first launch macOS blocks it: open
  **System Settings → Privacy & Security** and click **Open Anyway**.

## Use

1. On the computer that should be controlled, open Remote Desk and send its **ID** and
   **password** to your partner.
2. Your partner enters them under **Control remote computer** and clicks **Connect**.
3. You click **Allow**. A red bar shows the session is active; **Disconnect** ends it any time.

On macOS the controlled Mac needs two permissions, granted once (the app guides you under
**Permissions**): **Screen Recording** and **Accessibility**. Windows needs no permissions.

Full user guide: [docs/guide.md](docs/guide.md) (also [in Czech](docs/navod.md)). A short version is also built
into the app under **How to use**.

## How it works

- Computers find each other through **public Nostr relays** (via [Trystero](https://github.com/dmotz/trystero)).
  The relays only pass the encrypted connection handshake; the password is the encryption key
  and never leaves your computer.
- Video and input then flow **directly** between the two computers over WebRTC (DTLS-SRTP encrypted).
- The screen is captured with Electron's `desktopCapturer`; mouse and keyboard are injected with
  [`@jitsi/robotjs`](https://github.com/jitsi/robotjs).

Some networks (mobile data, strict corporate firewalls) block direct connections. For those, add a
TURN relay under **Settings → TURN relay** (e.g. your own [coturn](https://github.com/coturn/coturn)
or a hosted TURN service).

## Own server (optional)

Prefer not to depend on public relays? Run your own tiny relay and select
**Settings → Network → Own server** on **both** computers.

**On a home server or VPS with Docker:**

```bash
git clone https://github.com/Molyn597/remote-desk.git
cd remote-desk/server
docker build -t remote-desk-relay .
docker run -d --restart unless-stopped -p 8080:8080 remote-desk-relay
```

Use `ws://<server-ip>:8080` inside your local network.

**Over the internet with HTTPS** — point a domain at the server, then:

```bash
cd remote-desk/server
DOMAIN=relay.example.com docker compose up -d
```

Caddy obtains a certificate automatically. Use `wss://relay.example.com` in the app.

**Without Docker** (Node.js 24+): `npm install && npm run server`.

## Development

Requires Node.js 24+.

```bash
npm install
npm run app            # build and start the app
npm -w app run dist    # build installers into app/release
npm run server         # optional relay on ws://localhost:8080
```

Run a second instance on the same machine with its own profile:
`RD_USER_DATA=/tmp/rd-2 npm run app`.

## Releasing a new version

1. Describe the changes under a new `## [0.2.0] - date` heading in [CHANGELOG.md](CHANGELOG.md).
   The app shows this text in **What's new** and it becomes the release notes.
2. Set the new version (here `0.2.0`) and commit it:

   ```bash
   npm -w app version 0.2.0 --no-git-tag-version
   git commit -am "Release 0.2.0"
   ```

3. Tag and push:

   ```bash
   git tag v0.2.0
   git push origin main v0.2.0
   ```

GitHub Actions then checks that the tag matches the app version and has a changelog entry, builds the Windows installer and
the macOS DMG/ZIP, uploads them to a draft release and publishes it when all builds succeed.

Installed apps check for updates at start-up and every 4 hours:

downloads the update in the background and offers **Restart and update** on both Windows and macOS.

### macOS signing

Every macOS release is signed with the same self-signed certificate ("Remote Desk Signing"), so
macOS keeps Screen Recording and Accessibility permissions across updates and accepts in-place
updates. It is not an Apple Developer ID, so the very first install still needs
**System Settings → Privacy & Security → Open Anyway**.

The release workflow reads the certificate from two repository secrets:

- `MAC_CERT_P12_BASE64`: the certificate and private key (`.p12`), base64-encoded
- `MAC_CERT_PASSWORD`: its password

Keep a backup of the `.p12` and its password. Releases signed with a different certificate lose
permissions and can't update in place, so users would have to reinstall once.

## Feedback

Found a bug or have an idea? Use **What's new → Report a bug / Suggest an improvement** in the app,
or open an [issue](../../issues/new/choose). Security problems: see [SECURITY.md](SECURITY.md).

## Roadmap

- [ ] Clipboard sync and file transfer
- [ ] Multiple monitors
- [ ] Unattended access and a Windows service (UAC prompts, lock screen)
- [ ] Code signing (Windows) and Apple notarization (macOS) to remove first-install warnings
- [ ] Signed update manifests (Ed25519) once electron-builder 27 is released

## License

[MIT](LICENSE)
