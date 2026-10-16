# Changelog

Each release has a `## [version] - date` heading. The app shows these notes in
"What's new", and the release workflow uses them as the GitHub release notes.

## [0.1.9] - 2026-10-16

### Added

- Favorites: click the star in the session toolbar (or next to a computer in Recent) to ask for a favorite. Someone at the other computer approves it, and remote control is paused while they decide. Favorites sit right below the ID field and connect with one click, without a password.

### Changed

- "My devices" is now Favorites inside the connect card, and Trusted devices is now "Who has this computer as a favorite".
- An unanswered connection or favorite prompt closes by itself after a minute and counts as Deny.

## [0.1.8] - 2026-10-16

### Changed

- Typing the ID of a computer that trusts this device hides the password field and connects without it. "Use a password" brings the field back, and it also comes back by itself if the password-free connection fails.
- Clearer texts on which way trust works: Trusted devices are the ones that may connect to this computer; My devices are the ones you can connect to from here.

## [0.1.7] - 2026-10-16

### Added

- Diagnostics log in Settings: connections and their route (direct or relay), why a connection failed, and errors with screen capture, permissions, updates and file transfers. Copy it into a bug report; passwords, keys and clipboard contents are never logged and partner IDs are shortened.
- A Details link next to error messages opens the log.

## [0.1.6] - 2026-10-16

### Added

- Connect without a password: a computer that remembers your device appears under My devices on the home page. One click connects, with no password and no prompt. Remove the device on that computer, or use "Remove all and replace the key", to revoke access.
- Start at login and run in the background (Settings): closing the window keeps Remote Desk in the menu bar or system tray, so trusted devices can connect while you are away.
- Show the password you typed with the eye button, and the partner ID is shown in groups of three as you type.
- Download update button next to Check now. It turns orange when an update is available.

### Changed

- Drop-down menus (such as Language) now match the app's style.

## [0.1.5] - 2026-10-16

### Added

- Multiple monitors: when the remote computer has more than one, the Monitor button in the toolbar shows any one of them or all side by side, arranged as they are on that computer. Side by side, you can drag windows between monitors, then switch back to one monitor for a sharper picture. The choice is remembered per computer.
- Get files from the remote computer: copy a file there (Ctrl/Cmd+C) and the toolbar offers a Download button, or use Get files to open a file picker on the remote screen. Files are saved to your Downloads.

### Changed

- Windows: the window title bar now matches the app's light or dark theme instead of a plain white frame.

## [0.1.4] - 2026-10-16

### Added

- Shared clipboard: text copied on one computer can be pasted on the other while remote control is allowed. Turn it off in the session toolbar.
- File transfer: drop files onto the remote screen or use Send files in the toolbar. They are saved to Downloads on the controlled computer, which shows a notification. Up to 500 MB per file; refused in view-only mode.
- macOS: a Fix button on the Permissions page removes a stale permission entry and asks again, so there's no need to remove it by hand in System Settings.

## [0.1.3] - 2026-10-16

### Fixed

- The Close button in "What's new" no longer shows an arrow as if it opened something.

## [0.1.2] - 2026-10-15

### Added

- Trusted devices: tick "Remember this device" when allowing a connection and that device connects without asking next time. Manage them in Settings. Devices are recognised by a cryptographic key, not by their ID.

### Changed

- macOS installs updates by itself (Restart and update), and keeps Screen Recording and Accessibility permissions after updating. This works from 0.1.2 on; updating to 0.1.2 is the last manual install.

## [0.1.1] - 2026-10-15

### Changed

- Smoother, lower-latency remote screen: up to 60 fps, large screens are downscaled to 1920 px in Automatic quality and 1280 px in Optimize speed, and the viewer no longer buffers frames.
- Original size shows the remote screen pixel for pixel even when the stream is downscaled.

## [0.1.0] - 2026-10-15

### Added

- Remote control between Windows and macOS with an ID and password, no account or server needed.
- Connection prompt with Allow control, View only or Deny, and a warning about phone scams.
- Always-on-top session panel with Pause control and Disconnect.
- Session toolbar: fit or original size, full screen, quality, view only, shortcuts, screenshot and connection info.
- Optional own relay server and TURN relay.
- Czech and English, light and dark theme.
- Update checks, What's new and a way to report bugs or suggest improvements.
