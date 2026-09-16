# Fafa v0.1 Series Archive

This release preserves the two verified installer artifacts found for the
original Fafa Desktop Pet v0.1 series. They were built before the PetWeaver
repository was published and are provided for historical reference.

The `archive-v0.1` tag marks this archive manifest in the cleaned public
history; it is not the original source revision used to produce the binaries.

## Artifacts

| File | Original version | SHA-256 |
| --- | --- | --- |
| `Fafa-Desktop-Pet-v0.1.1-Windows-Setup.exe` | 0.1.1 | `19560E637E25E0F9F84526704881E6A381E3F8213F393D04EB75610BA3CA449A` |
| `Fafa-Desktop-Pet-v0.1.2-Windows-Setup.exe` | 0.1.2 | `9136F858BB13098C2E2CE0C78A1DA83D93027D23BF5CDBD2FCC47077813768B1` |

## Verification status

- Windows file metadata reports product versions 0.1.1 and 0.1.2.
- SHA-256 checksums were calculated immediately before upload.
- The packaged application archives were scanned for common API-key, token,
  credential, voice-profile, and local-user-path patterns; none were found.
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
