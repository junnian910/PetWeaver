# Fafa v0.2 Series Archive

This release preserves the verified installer artifacts available for the
original Fafa Desktop Pet v0.2 series. Intermediate portable directories were
not uploaded because they contained development logs or could not pass the
same privacy gate as the installers.

The `archive-v0.2` tag marks this archive manifest in the cleaned public
history; it is not the original source revision used to produce the binaries.

## Artifacts

| File | Original version | SHA-256 |
| --- | --- | --- |
| `Fafa-Desktop-Pet-v0.2.1-Windows-Setup.exe` | 0.2.1 | `554D59F7FD9B3B7933C0891C4826F5CF83A27807B3C51BE221EB59FDFD1196D5` |
| `Fafa-Desktop-Pet-v0.2.6-Windows-Setup.exe` | 0.2.6 | `DC1B0FE88EF37C2767F24B06364D679E811AFC2C379282B729C1E1EA84F766EC` |

## Verification status

- Windows file metadata reports product versions 0.2.1 and 0.2.6.
- SHA-256 checksums were calculated immediately before upload.
- The packaged application archives were scanned for common API-key, token,
  credential, voice-profile, and local-user-path patterns. No concrete secret
  value was identified; generic cookie-handling code is present as expected for
  live-platform integration.
- The installers are **not code-signed**. Windows may display a SmartScreen
  warning.
- A local Microsoft Defender custom scan could not be started on the release
  workstation. The files have not been certified malware-free.
- Clean-VM startup and byte-for-byte reproducible builds have not been
  established.

## License and compatibility

These are historical binary snapshots, not current PetWeaver builds. The
Apache-2.0 license covers the current framework source code; bundled character
media and third-party components retain their own terms. Current documentation
and support target the v0.4 development line.
