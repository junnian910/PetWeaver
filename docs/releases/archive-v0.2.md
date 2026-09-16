# Fafa v0.2 Series Archive

This release preserves the installer and portable artifacts available for the
original Fafa Desktop Pet v0.2 series. Portable ZIPs were rebuilt from archived
directories after excluding logs, caches, and user-data paths.

The `archive-v0.2` tag marks this archive manifest in the cleaned public
history; it is not the original source revision used to produce the binaries.

## Artifacts

| File | Original version | SHA-256 |
| --- | --- | --- |
| `Fafa-Desktop-Pet-v0.2.1-Windows-Setup.exe` | 0.2.1 | `554D59F7FD9B3B7933C0891C4826F5CF83A27807B3C51BE221EB59FDFD1196D5` |
| `Fafa-Desktop-Pet-v0.2.1-Windows-Portable.exe` | 0.2.1 | `A65A49BF998F82D3D38F8358AF90CDC49EA803C9A5FDFA94DD4472B76C908E30` |
| `Fafa-Desktop-Pet-v0.2.1-Windows-Portable.zip` | 0.2.1 | `56D9123324DC8C4B8DE66B44ADD1C686DD803B71A31DD66A52A8A200291A8C46` |
| `Fafa-Desktop-Pet-v0.2.2-Snapshot-internal-v0.2.3-Windows-Portable.zip` | directory label 0.2.2; internal metadata 0.2.3 | `E2E16C7850106F4C769C60E64DE65D5798ABB5F69C6F91D5A0773B2FE3567B4F` |
| `Fafa-Desktop-Pet-v0.2.3-Windows-Portable.zip` | 0.2.3 | `5B2E8E28CB988F253119BCCD0C2F77D325B2BDDE06D159A4A7E23DC43D33612C` |
| `Fafa-Desktop-Pet-v0.2.4-Snapshot-internal-v0.2.3-Windows-Portable.zip` | directory label 0.2.4; internal metadata 0.2.3 | `A7F488E99A69124F64E4814910B34559381AD5FD4D6799B3A56DDB925E30AF15` |
| `Fafa-Desktop-Pet-v0.2.5-Windows-Portable.zip` | 0.2.5 | `668DB864BE994F956F80ED95075AEDFB0ECE33F2BAB129BB8A7CC6D0EE669515` |
| `Fafa-Desktop-Pet-v0.2.6-Windows-Setup.exe` | 0.2.6 | `DC1B0FE88EF37C2767F24B06364D679E811AFC2C379282B729C1E1EA84F766EC` |
| `Fafa-Desktop-Pet-v0.2.6-Windows-Portable.zip` | 0.2.6 | `A1148EB691A2BE171A8E25ABBC8DD3CFCC7068D88400D9436ED3479EF79B9ECD` |

## Verification status

- Windows file metadata reports product versions 0.2.1, 0.2.3, 0.2.5,
  and 0.2.6 for the corresponding artifacts.
- SHA-256 checksums were calculated immediately before upload.
- Portable archive listings were checked after logs, caches, and user-data
  paths were excluded.
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

## Version-label caveat

The directories historically named `portable-v0.2.2` and
`portable-v0.2.4` both contain an executable whose internal product version is
0.2.3. They are retained because the directory snapshots differ, but their
asset names expose the mismatch and they must not be treated as verified 0.2.2
or 0.2.4 builds.

## License and compatibility

These are historical binary snapshots, not current PetWeaver builds. The
Apache-2.0 license covers the current framework source code; bundled character
media and third-party components retain their own terms. Current documentation
and support target the v0.4 development line.
