# Remote Desk user guide

[Česká verze](navod.md)

Remote Desk lets you control another computer remotely, or let someone control yours. No account and
no server of your own — just an ID and a password, or one click for your favorite computers.

## Contents

1. [What you can do](#what-you-can-do)
2. [Install and updates](#install-and-updates)
3. [Let someone control this computer](#let-someone-control-this-computer)
4. [Control another computer](#control-another-computer)
5. [Favorites: connect without a password](#favorites-connect-without-a-password)
6. [Reach your computer while you are away](#reach-your-computer-while-you-are-away)
7. [Session toolbar](#session-toolbar)
8. [Clipboard and files](#clipboard-and-files)
9. [Settings](#settings)
10. [Safety](#safety)
11. [Troubleshooting](#troubleshooting)

## What you can do

- Control a Windows PC or a Mac from the other system, in both directions.
- Connect with an ID and password, or with one click to computers in your **Favorites**.
- Reach your own computer from anywhere (school, work, mobile data) while it runs in the background
  and doesn't go to sleep.
- A sharp picture (1920 px at up to 60 fps), with the remote **sound**.
- **Several monitors**: one at a time or all side by side.
- **Shared clipboard** and **file transfer** in both directions.
- Built-in safeguards against scammers, a **diagnostics log** and **automatic updates**.
- Czech and English, light and dark theme.

## Install and updates

Download the installer from the [Releases](../../../releases) page.

### Windows

1. Download `Remote-Desk-…-win-x64.exe` (`arm64` for ARM computers).
2. Run it. The app installs in one click and opens right away.
3. The app is not code-signed yet, so Windows SmartScreen may show "Windows protected your PC".
   Click **More info → Run anyway**.

Windows needs no extra permissions.

### macOS

1. Download `Remote-Desk-…-mac-universal.dmg`, open it and drag the app to Applications.
   If you start it from elsewhere, it offers to move itself there (needed for updates).
2. On first launch macOS blocks the app because it is not notarized by Apple yet. Open
   **System Settings → Privacy & Security** and click **Open Anyway**.
3. If this Mac should be controllable, grant on the app's **Permissions** page:
   - **Screen Recording**, so your partner can see the screen,
   - **Accessibility**, so they can use the mouse and keyboard.

   Then click **Restart app**. You only do this once; permissions are kept after updates.
4. The first time this Mac shares its sound (macOS 14.2 or later), macOS asks whether Remote Desk may
   record system audio.

If you only use the Mac to control other computers, no permissions are needed.

### Updates

The app checks for updates by itself. When one is ready, an orange bar appears on the home page and
the **Download update** / **Restart and update** button on the **What's new** page turns orange.
Restarting installs it in place on both Windows and macOS. **Check now** looks for an update right
away, and **What's new** shows the changes in each version.

## Let someone control this computer

1. Open Remote Desk. The **Allow remote control** card shows your **ID** (9 digits) and **password**.
2. Send both to the person who should connect. The copy buttons put them on the clipboard.
3. When they connect, the app shows their name and ID and a scam warning. Choose:
   - **Allow control**: they see the screen and use the mouse and keyboard,
   - **View only**: they only see the screen,
   - **Deny**.

   The tick box below lets that device add this computer to its **favorites**, so next time it
   connects without the password and without asking. If nobody answers within a minute, the
   request is denied.
4. During the session a black panel stays on top of all windows, showing who is connected and for how
   long. **Pause control** temporarily disables their input, **Disconnect** ends the session.
   When you move your own mouse you take priority and their control pauses for a moment.
5. Afterwards, create a new password with the hatched button next to it. The old one stops working.

The ID stays the same; the password changes every time the app starts.

## Control another computer

1. Make sure Remote Desk is running on the other computer.
2. Under **Control remote computer**, enter your partner's ID (it is shown in groups of three as you
   type) and password, and click **Connect**. The eye button shows the password, so you can check it.
3. The app finds your partner and waits for them to allow the connection.
4. You then see their screen. Click into the picture to take over the mouse and keyboard.

Keyboard shortcuts (Cmd+C, Ctrl+V…) are sent to the remote computer. Between a Mac and Windows, Cmd
and Ctrl are swapped automatically so copy and paste work as you expect.

Typed text arrives exactly, accents included, regardless of the keyboard layout on the other side.

Recent connections are listed at the bottom of the home page. **Connect** fills in the ID; add the
password. The star next to a computer asks for it as a favorite.

If your partner allows view only or pauses control, an orange "Control off — set by partner" label appears
in the toolbar.

### Your name

Under **Settings → Your name** you can set the name your partner sees in the connection prompt.
It's optional; without it only your ID is shown.

## Favorites: connect without a password

For your own computers, or people you help often:

1. While connected, click the **star** in the session toolbar. You can also click the star next to
   a computer in **Recent connections** and connect with the password; the request is sent once
   you are connected.
2. Someone at the other computer approves it (**Allow control** or **View only**). Remote control
   is paused while the question is open, so it can't be approved from your side.
3. The star fills in and the computer appears under **Favorites** below the ID field. Click it and
   you are in: no password and no prompt. Typing its ID also hides the password field; **Use a
   password** brings it back. The session panel still shows the connection on the other computer.
4. Favorites work one way. To connect the other way round, add a favorite from the other computer too.
5. To remove a favorite on your side, click the cross next to it or the filled star. To revoke access
   on the other computer, remove the device there in **Settings → Who has this computer as a
   favorite**. **Remove all and replace the key** revokes every device at once.

The connection uses a separate key that the other computer hands to your device. It is stored
encrypted with a key that can't be read out of the app, and on its own it is not enough:
your device also has to prove it holds its own private key.

## Reach your computer while you are away

For example, controlling your home PC from school. On the computer you want to reach:

1. Add it to your **Favorites** (see above) while you are both at home, so you don't need its password.
2. In **Settings**, turn on **Start at login and run in the background**. Remote Desk then starts with
   the system, and closing the window keeps it running in the menu bar (Mac) or the system tray
   (Windows). Quit it from that icon.
3. Turn on **Keep this computer awake**. The computer won't go to sleep, so it stays reachable; the
   screen can still turn off. On a laptop, closing the lid may still put it to sleep.
4. Leave the computer on and logged in. Remote Desk can't wake a computer that is switched off or
   asleep, and on Windows it can't control the sign-in screen.

On the road, connecting over mobile data works too. A sharp picture uses about 3–5 GB per hour;
**Quality → Save data** uses much less.

## Session toolbar

The toolbar sits at the top centre of the window. It hides after a moment and comes back when you
move the mouse to the top edge.

| Button | What it does |
| --- | --- |
| Star | **Add to favorites**: next time you connect without a password. Someone at the other computer approves it. A filled star removes it. |
| Frame | Switches between **fit to window** and **original size**. At original size the picture pans when you reach an edge. |
| Arrows | **Full screen**. |
| Two screens | **Monitor**, shown only when the remote computer has more than one. Show one monitor at a time (sharpest picture) or **all monitors side by side**, arranged as they are on that computer. Side by side, you can drag a window from one monitor to the other; the label above each monitor switches back to just that one. Your choice is remembered for that computer. |
| Gauge | **Quality**. **Automatic** keeps a sharp 1920 px and drops frames (60 → 30 fps) when the network or computer can't keep up. **Optimize smoothness** keeps 60 fps at 1280 px for slow networks. **Maximum sharpness** sends the full resolution at 30 fps. **Save data** keeps 1920 px at up to 30 fps and about 3 Mbit/s, for mobile data. The choice is remembered. |
| Speaker | **Sound** of the remote computer: play it or mute it here. The choice is remembered. Windows always shares its sound; a Mac needs macOS 14.2 or later and asks for permission the first time. |
| Eye | **View only**: you see the screen but mouse and keyboard are not sent. |
| Keyboard | **Send a shortcut** your own system would otherwise catch (Alt+Tab, Win, Cmd+Tab, Spotlight…). |
| Clipboard | **Shared clipboard** on or off. |
| Arrow up | **Send files** to the remote computer. |
| Arrow down | **Get files** from the remote computer. |
| Camera | **Save a screenshot** of the remote screen as PNG. |
| Pin | Keeps the toolbar visible. |
| Cross | **Disconnect**. |

On the left the toolbar shows what actually arrives: round-trip time, resolution, frames per second,
data rate, and whether the connection is **direct** or **relayed**. A green dot means a fast
connection, orange average, red slow.

## Clipboard and files

All of this works only while control is allowed (not in view-only mode or while paused).

- **Clipboard**: text you copy on one computer can be pasted on the other, in both directions. Turn it
  off with the clipboard button in the toolbar.
- **Send files** to the remote computer: drop them onto the remote screen or use the arrow-up button.
  They are saved to Downloads there, and that computer shows a notification. Up to 500 MB per file.
- **Get files** from the remote computer:
  - copy a file there (Ctrl/Cmd+C) and the toolbar offers a **Download** button, or
  - click the arrow-down button and choose the files in the picker that opens on the remote screen.

  They are saved to your Downloads; click the message in the toolbar to show the file.

## Settings

### Your name, language and theme

The name your partner sees, and the language (Czech or English, following the system by default).
The light/dark switch is at the top right.

### Who has this computer as a favorite

Devices that may connect to this computer without the password and without asking. Remove one to
take its access away at once, or use **Remove all and replace the key**.

### Start at login and run in the background, keep awake

See [Reach your computer while you are away](#reach-your-computer-while-you-are-away).

### Network

- **Public network** (default): computers find each other through public Nostr relays. No setup.
  The relays only pass the encrypted connection handshake, never the picture or the password.
- **Own server**: if you'd rather not depend on public relays, run your own
  (see the [README](../README.md#own-server-optional)) and enter its address, e.g. `wss://relay.example.com`.

Both computers must use the same network setting, or they won't find each other.

### TURN relay

Most connections go directly between the computers, even over mobile data. On strict corporate or
school networks that may be impossible; a TURN relay then carries the connection. Enter its address,
username and password on both computers. Use your own (e.g. [coturn](https://github.com/coturn/coturn))
or a hosted service. A relay doesn't make the picture better; it only helps when a direct connection fails.

### Diagnostics

The log of what the app did: connections, their route (direct or via a relay), errors with screen
capture, permissions, sound, updates and file transfers. **Copy** puts it on the clipboard,
**Show file** opens its folder (`~/Library/Logs/Remote Desk` on macOS, `%APPDATA%\Remote Desk\logs`
on Windows). Passwords, keys and clipboard contents are never written there, and partner IDs are
shortened, so you can paste it into a bug report.

### Feedback

On the **What's new** page, **Report a bug** and **Suggest an improvement** open a form on GitHub
with the app version filled in.

## Safety

- **Never give your ID and password to someone who called or messaged you.** Banks, Microsoft, the
  police or your internet provider never ask for remote access. It is a common scam.
- Nobody gets in without you clicking **Allow**, except devices you added to favorites yourself.
- Approving a favorite pauses remote control, so the other side can't click Allow for you.
  Unanswered prompts close by themselves after a minute and count as Deny.
- The session panel always shows who is connected; moving your own mouse takes priority.
- The password is never sent anywhere. It is the key that encrypts the connection handshake.
- Video, sound and input go directly between the computers and are encrypted (WebRTC, DTLS-SRTP).
- Other programs on the computer can't start Remote Desk in a debugging mode to borrow its permissions.
- Only one person can be connected at a time.
- Create a new password after each session.

## Troubleshooting

The exact reason for an error is in **Settings → Diagnostics**; the **Details** link next to an
error message opens it.

**"Could not connect"**
- Check the ID and password. The password changes every time the app starts.
- Make sure Remote Desk is running on the other computer and shows **Online** (Connection card, bottom left).
- Both computers must use the same network in Settings.
- On strict corporate or school networks, set up a TURN relay, or try mobile data.

**A favorite says the computer can't be reached**
- The other computer is off, asleep or Remote Desk isn't running there: see
  [Reach your computer while you are away](#reach-your-computer-while-you-are-away).
- It no longer has you as a favorite: connect with the ID and password and add it again.

**The picture is slow or choppy**
- Choose **Quality → Optimize smoothness** in the toolbar, or **Save data** on mobile data.
- Automatic at 1920 px and 60 fps needs about 8–16 Mbit/s upload on the controlled computer.
- If the status shows "relayed", the connection goes through TURN and is usually slower.

**No sound**
- Check the speaker button in the toolbar.
- On a controlled Mac, sound needs macOS 14.2 or later and the system audio permission. The
  diagnostics log says "sharing system sound" or "system sound not available".

**On a Mac the screen is black or control doesn't work**
- The controlled Mac needs Screen Recording and Accessibility (the **Permissions** page), and the app
  must be restarted after granting them.
- If a permission looks enabled in System Settings but the app says it's missing, click **Fix** on the
  Permissions page. The stale entry is removed and macOS asks again.

**An update doesn't install**
- Quit Remote Desk from its menu bar or tray icon, wait a few seconds and open it again; the downloaded
  update installs when the app quits.

**On Windows, admin windows or the User Account Control prompt can't be controlled**
- This is a known limitation: Windows doesn't let a regular app control windows running as
  administrator, or the sign-in screen.
