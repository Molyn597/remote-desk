# Remote Desk user guide

[Česká verze](navod.md)

Remote Desk lets you control another computer remotely, or let someone control yours. No account and
no server of your own — just an ID and a password.

## Contents

1. [Install](#install)
2. [Let someone control this computer](#let-someone-control-this-computer)
3. [Control another computer](#control-another-computer)
4. [Session toolbar](#session-toolbar)
5. [Settings](#settings)
6. [Safety](#safety)
7. [Troubleshooting](#troubleshooting)

## Install

Download the installer from the [Releases](../../../releases) page.

### Windows

1. Download `Remote-Desk-…-win-x64.exe` (`arm64` for ARM computers).
2. Run it. The app installs in one click and opens right away.
3. The app is not code-signed yet, so Windows SmartScreen may show "Windows protected your PC".
   Click **More info → Run anyway**.

Windows needs no extra permissions.

### macOS

1. Download `Remote-Desk-…-mac-universal.dmg`, open it and drag the app to Applications.
2. On first launch macOS blocks the app because it is not notarized by Apple yet. Open
   **System Settings → Privacy & Security** and click **Open Anyway**.
3. If this Mac should be controllable, grant on the app's **Permissions** page:
   - **Screen Recording**, so your partner can see the screen,
   - **Accessibility**, so they can use the mouse and keyboard.

   Then click **Restart app**. You only do this once.

If you only use the Mac to control other computers, no permissions are needed.

## Let someone control this computer

1. Open Remote Desk. The **Allow remote control** card shows your **ID** (9 digits) and **password**.
2. Send both to the person who should connect. The copy buttons put them on the clipboard.
3. When they connect, the app shows their name and ID and a scam warning. Choose:
   - **Allow control**: they see the screen and use the mouse and keyboard,
   - **View only**: they only see the screen,
   - **Deny**.
4. During the session a black panel stays on top of all windows, showing who is connected and for how
   long. **Pause control** temporarily disables their input, **Disconnect** ends the session.
   When you move your own mouse you take priority and their control pauses for a moment.
5. Afterwards, create a new password with the hatched button next to it. The old one stops working.

The ID stays the same; the password changes every time the app starts.

## Control another computer

1. Make sure Remote Desk is running on the other computer.
2. Under **Control remote computer**, enter your partner's ID and password and click **Connect**.
3. The app finds your partner and waits for them to allow the connection.
4. You then see their screen. Click into the picture to take over the mouse and keyboard.

Keyboard shortcuts (Cmd+C, Ctrl+V…) are sent to the remote computer. Between a Mac and Windows, Cmd
and Ctrl are swapped automatically so copy and paste work as you expect.

Typed text arrives exactly, accents included, regardless of the keyboard layout on the other side.

Recent connections are listed at the bottom of the home page. **Connect** fills in the ID; add the password.

If your partner allows view only or pauses control, an orange "Control off — set by partner" label appears
in the toolbar.

### Your name

Under **Settings → Your name** you can set the name your partner sees in the connection prompt.
It's optional; without it only your ID is shown.

## Session toolbar

The toolbar sits at the top centre of the window. It hides after a moment and comes back when you
move the mouse to the top edge.

| Button | What it does |
| --- | --- |
| Frame | Switches between **fit to window** and **original size**. At original size the picture pans when you reach an edge. |
| Arrows | **Full screen**. |
| Gauge | **Quality**: automatic, optimize speed (slow networks) or optimize quality. |
| Eye | **View only**: you see the screen but mouse and keyboard are not sent. |
| Keyboard | **Send a shortcut** your own system would otherwise catch (Alt+Tab, Win, Cmd+Tab, Spotlight…). |
| Clipboard | **Shared clipboard** on or off. While on, text you copy on one computer can be pasted on the other (only when control is allowed). |
| Arrow up | **Send files** to the remote computer. You can also drop files onto the remote screen. They are saved to Downloads there (up to 500 MB each). |
| Camera | **Save a screenshot** of the remote screen as PNG. |
| Pin | Keeps the toolbar visible. |
| Cross | **Disconnect**. |

On the left the toolbar shows the connection: round-trip time, frames per second, bitrate, and whether
the connection is **direct** or **relayed**. A green dot means a fast connection, orange average, red slow.

## Settings

### Language and theme

Czech or English, following the system by default. The light/dark switch is at the top right.

### Network

- **Public network** (default): computers find each other through public Nostr relays. No setup.
  The relays only pass the encrypted connection handshake, never the picture or the password.
- **Own server**: if you'd rather not depend on public relays, run your own
  (see the [README](../README.md#own-server-optional)) and enter its address, e.g. `wss://relay.example.com`.

Both computers must use the same network setting, or they won't find each other.

### TURN relay

Most connections go directly between the computers. On mobile data or strict corporate networks that
may be impossible; a TURN relay then carries the connection. Enter its address, username and password.
Use your own (e.g. [coturn](https://github.com/coturn/coturn)) or a hosted service.

## Safety

- **Never give your ID and password to someone who called or messaged you.** Banks, Microsoft, the
  police or your internet provider never ask for remote access. It is a common scam.
- Nobody gets in without you clicking **Allow**.
- The password is never sent anywhere. It is the key that encrypts the connection handshake.
- Video and input go directly between the computers and are encrypted (WebRTC, DTLS-SRTP).
- Only one person can be connected at a time.
- Create a new password after each session.

## Troubleshooting

**"Could not connect"**
- Check the ID and password. The password changes every time the app starts.
- Make sure Remote Desk is running on the other computer and shows **Online** (Connection card, bottom left).
- Both computers must use the same network in Settings.
- On mobile data or corporate networks, set up a TURN relay.

**The picture is slow or choppy**
- Choose **Quality → Optimize speed** in the toolbar.
- If the status shows "relayed", the connection goes through TURN and is usually slower.

**On a Mac the screen is black or control doesn't work**
- The controlled Mac needs Screen Recording and Accessibility (the **Permissions** page), and the app
  must be restarted after granting them.
- If a permission looks enabled in System Settings but the app says it's missing, click **Fix** on the
  Permissions page. The stale entry is removed and macOS asks again.

**On Windows, admin windows or the User Account Control prompt can't be controlled**
- This is a known limitation: Windows doesn't let a regular app control windows running as administrator.
