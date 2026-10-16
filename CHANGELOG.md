# Changelog

Each release has a `## [version] - date` heading. The app shows these notes in
"What's new", and the release workflow uses them as the GitHub release notes.

## [0.1.17] - 2026-10-17

### Changed

- The app moves: panels and cards glide in at start-up and when switching pages, buttons lift and press, the light/dark switch fades, a new password rolls in like a departures board, copy buttons turn into a tick, the Online dot breathes, and a new favorite pops in with a spinning star.
- Connecting shows a light sweeping across the Connect button, and the remote screen opens out of the window. The session toolbar, its menus and messages slide in smoothly.
- With "Reduce motion" turned on in the system, animations are switched off.

## [0.1.16] - 2026-10-17

### Added

- Privacy screen (Windows): a favorite device can black out the monitors of the computer it controls, so people there don't see what it does. Only when the owner allows it in Settings; moving the mouse there always shows the screen again.
- Connections to this computer: Settings lists who connected, when, for how long and how, and a notification appears whenever someone connects.
- remotedesk://connect/<ID> links: right-click a favorite to copy one. Opening it connects at once, so it works from Shortcuts, Siri, Raycast, Alfred, a Stream Deck or a desktop shortcut.

## [0.1.15] - 2026-10-17

### Changed

- The menu bar icon is now the Remote Desk logo (cursor and dot) instead of a generic monitor.

## [0.1.14] - 2026-10-17

### Added

- Menu bar / system tray menu: connect to a favorite with one click, copy your ID or password, see the current session and disconnect. On a Mac the favorites are also in the Dock menu.
- Settings → Show the icon in the menu bar / system tray, also when the app isn't running in the background.

## [0.1.13] - 2026-10-16

### Added

- Sound: you hear the remote computer. The speaker button in the toolbar mutes it on your side, and the choice is remembered. Windows shares its sound; a Mac needs macOS 14.2 or later and asks for permission the first time.
- Keep this computer awake (Settings): the computer doesn't go to sleep, so you can reach it while you are away. The screen can still turn off. While someone is connected, the screen stays on.

## [0.1.12] - 2026-10-16

### Changed

- Automatic quality keeps a sharp 1920 px and drops frames (60 → 30 fps) when the network or computer can't keep up, instead of shrinking the picture. It may now use up to 16 Mbit/s.
- The quality menu names what each option does, and your choice is remembered for the next session.

### Added

- Save data quality: 1920 px at up to 30 fps and about 3 Mbit/s, for mobile data.
- The toolbar shows the resolution that actually arrives, next to latency, fps and data rate.

## [0.1.11] - 2026-10-16

### Fixed

- macOS: favorites were not saved, because the app couldn't use the Keychain. Favorite keys are now encrypted with a key kept inside the app, which needs no Keychain access and keeps working after updates. Favorites added before this version have to be added again.
- "Added to favorites" now appears only once the favorite is really saved; otherwise the toolbar says it couldn't be saved.
- File paths in the diagnostics log are no longer hidden as if they were keys.

### Security

- Other programs on the computer can no longer start Remote Desk in Node or debugging mode (ELECTRON_RUN_AS_NODE, NODE_OPTIONS, --inspect). That could have been used to borrow its screen recording and accessibility permissions.

## [0.1.10] - 2026-10-16

### Fixed

- macOS: with "run in the background" on, Restart and update only hid the window and the update never installed. To get this version, quit Remote Desk from the menu bar icon once; the update installs when the app quits.

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
