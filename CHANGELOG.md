# Changelog

Each release has a `## [version] - date` heading. The app shows these notes in
"What's new", and the release workflow uses them as the GitHub release notes.

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
