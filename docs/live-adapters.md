# PetWeaver Live Adapters

> [简体中文](live-adapters.zh-CN.md)

PetWeaver uses one normalized live-event contract across streaming platforms. Adapters connect to a platform and translate its data; they do not choose animations or bypass runtime scheduling.

The current normalized event types are:

- `status`
- `danmaku`
- `gift`
- `superChat`
- `guard`
- `enter`

`AppController` applies command parsing, safety rules, event deduplication, AI responses, priorities, and action selection after normalization.

## Adapter boundary

An adapter is responsible for:

- Connection and reconnection.
- Platform authentication inputs.
- Polling or socket lifecycle.
- Mapping user, amount, message, and membership data.
- Emitting normalized events.

An adapter is not responsible for:

- Selecting a character action.
- Calling the renderer directly.
- Persisting public secrets.
- Implementing character-specific behavior.

The adapter factory lives at `src/main/live/adapter-factory.js`.

## Bilibili

Bilibili is the original adapter. Configure a `roomId`; anonymous read-only access is preferred. An optional cookie can be supplied when anonymous configuration fails.

Cookies and other secrets are stored separately from public configuration through the application's secure storage boundary.

## YouTube

In settings, select YouTube and provide:

- A livestream URL or video ID. PetWeaver calls `videos.list` and reads `liveStreamingDetails.activeLiveChatId`.
- A Live Chat ID, when already known. This skips video lookup.
- A YouTube Data API key, stored outside public configuration.

The initial implementation uses `liveChatMessages.list`:

- It follows the API-provided `pollingIntervalMillis`.
- It advances with `nextPageToken`.
- It skips existing history on the first successful connection so old messages do not trigger a burst of actions.
- It retries transient failures with bounded scheduling.

## YouTube event mapping

| YouTube message type | PetWeaver event |
| --- | --- |
| `textMessageEvent` | `danmaku` |
| `superChatEvent` | `superChat` |
| `superStickerEvent` | `gift` |
| `newSponsorEvent` | `guard` |
| `memberMilestoneChatEvent` | `guard` |
| `membershipGiftingEvent` | `gift` |
| `giftMembershipReceivedEvent` | `guard` |
| `giftEvent` | `gift` |

A future adapter may use YouTube's streaming live-chat interface for lower latency, but it must preserve the same normalized event contract.

## Adding a platform

A new adapter should:

1. Implement the same start/stop lifecycle as existing adapters.
2. Emit only normalized events.
3. Keep platform-specific fields in event metadata when useful.
4. Accept injectable timers or fetch functions where tests need deterministic control.
5. Add adapter tests for connection, mapping, pagination/reconnect behavior, and duplicate prevention.
6. Register through the adapter factory rather than branching throughout `AppController`.

This boundary keeps platform work independent from the 44-action character contract.
