# 直播平台适配器

运行时使用统一事件：`status`、`danmaku`、`gift`、`superChat`、`guard` 和 `enter`。平台适配器只负责连接平台并映射数据，动作选择仍由 `AppController` 和动作调度器完成。

## Bilibili

默认平台。配置 `roomId`；匿名配置失败时可选填 Cookie。Cookie 存入 Windows 安全存储，不写入公开配置。

## YouTube

设置页选择 YouTube，然后填写：

- 直播地址或视频 ID：应用通过 `videos.list` 自动读取 `liveStreamingDetails.activeLiveChatId`。
- Live Chat ID（可选）：已知时可直接填写并跳过自动查询。
- YouTube Data API Key：仅存入 Windows 安全存储。

当前第一版通过 `liveChatMessages.list` 按 API 返回的 `pollingIntervalMillis` 轮询，并使用 `nextPageToken` 读取新增事件。首次连接默认跳过已有聊天历史，避免桌宠把旧消息当成新消息批量触发。

| YouTube 类型 | PetWeaver 事件 |
| --- | --- |
| `textMessageEvent` | `danmaku` |
| `superChatEvent` | `superChat` |
| `superStickerEvent` | `gift` |
| `newSponsorEvent` | `guard` |
| `memberMilestoneChatEvent` | `guard` |
| `membershipGiftingEvent` | `gift` |
| `giftMembershipReceivedEvent` | `guard` |
| `giftEvent` | `gift` |

后续版本可把 YouTube 的 `streamList` 作为低延迟实现，但不能绕过统一事件合同。
