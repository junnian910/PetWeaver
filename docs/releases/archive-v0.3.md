# Fafa v0.3 Series Archive

This release preserves the final role-specific Fafa Desktop Pet installer
before the PetWeaver v0.4 framework migration. It is a historical snapshot,
not a new build made on the GitHub publication date.

The `archive-v0.3` tag marks this archive manifest in the cleaned public
history; it is not the original source revision used to produce the binary.

## Artifact

| File | Original version | SHA-256 |
| --- | --- | --- |
| `Fafa-Desktop-Pet-v0.3.0-Windows-Setup.exe` | 0.3.0 | `C990C4FAE07F10C520D725524F870FD17BE17DBEB2A7A5A4FA2F9E3A3A2D6BF8` |
| `Fafa-Desktop-Pet-v0.3.0-Windows-Portable.zip` | 0.3.0 | `B95FDAD914CDE23432A9BDC8C9D6565D7E6AFC8A9B401141CC9371287A3FEE22` |

## Verification status

- Windows file metadata reports product version 0.3.0.
- The SHA-256 checksum was calculated immediately before upload.
- The portable ZIP was rebuilt from the archived `win-unpacked` directory;
  log, cache, and user-data paths were excluded and the resulting archive
  listing was checked before upload.
- The packaged application archive was scanned for common API-key, token,
  credential, voice-profile, and local-user-path patterns. No concrete secret
  value was identified; generic cookie-handling code is present as expected for
  live-platform integration.
- The installer is **not code-signed**. Windows may display a SmartScreen
  warning.
- A local Microsoft Defender custom scan could not be started on the release
  workstation. The file has not been certified malware-free.
- Clean-VM startup and byte-for-byte reproducible builds have not been
  established.

## License and compatibility

This is a historical binary snapshot, not a current PetWeaver build. The
Apache-2.0 license covers the current framework source code; bundled character
media and third-party components retain their own terms. Current documentation
and support target the v0.4 development line.
