# Changelog

Each release has a `## [version] - date` heading. The app shows these notes in
"What's new", and the release workflow uses them as the GitHub release notes.

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
