# Security

Remote Desk gives another person control of your computer. Only share your ID and password
with people you trust.

## Current safeguards

- Every session needs the correct password **and** an explicit **Allow** on the controlled computer.
- The password is the key that encrypts the connection handshake. It is never sent to relays or
  servers; a wrong password simply cannot establish a connection.
- A red bar is shown on the controlled computer for the whole session; it can disconnect at any time.
- Only one viewer at a time. Input is accepted only from the approved viewer and only during a session.
- Video and input travel directly between the computers over WebRTC (DTLS-SRTP encrypted).

## Known limitations

- The ID is a random number stored on the device. Anyone who knows an ID can attempt to connect;
  the password and the Allow prompt are the protection. Generate a new password after sharing it.
- Public Nostr relays can see that two peers exchanged encrypted handshakes for a room.
  Use your own relay (see README) if that matters to you.
- Installers are not code-signed or notarized yet.

## Reporting a vulnerability

Please report vulnerabilities privately via GitHub Security Advisories on this repository
rather than opening a public issue.
