# 发发桌宠

> 本仓库正在从角色专用应用迁移为可复用的 **PetWeaver** 桌宠框架。迁移目标与发布策略见 [`PETWEAVER_MIGRATION_AND_RELEASE_PLAN.md`](PETWEAVER_MIGRATION_AND_RELEASE_PLAN.md)，第三方角色接入草案见 [`docs/pet-packages.md`](docs/pet-packages.md)。

Windows 10/11 x64 桌面宠物，使用 `fafa-pet-final.png` 作为正式角色资产。支持透明置顶窗口、Pixi 动画、鼠标互动、B站直播事件、抽奖、阿里云百炼 TTS、DeepSeek 对话和可配置点歌适配器。

## 开发

需要 Node.js 20+ 与 pnpm。

```powershell
pnpm install
pnpm dev
```

离线使用不需要 API Key。首次启动默认关闭外部服务，可在“诊断”页模拟弹幕、礼物、SC 和上舰事件。

自定义角色包可放入设置页“形象与动捕”中打开的角色包目录；重新扫描并选择后，运行时会切换整套动作视频和表情资源。格式与完整 44 项动作合同见 [`docs/pet-packages.md`](docs/pet-packages.md)。

## 操作

- 拖动角色移动窗口；单击和双击触发动作。
- 右键角色或点击齿轮打开设置。
- `Ctrl+Alt+F` 切换点击穿透。
- 托盘菜单可显示桌宠、打开设置或安全退出。

## 外部服务

- B站：关闭模拟模式并填写房间号后匿名只读连接。
- YouTube：选择 YouTube，填写 Live Chat ID 与 Data API Key；事件映射见 [`docs/live-adapters.md`](docs/live-adapters.md)。
- TTS：支持阿里云百炼、Edge TTS（免 Key）、Voicebox 本地声音克隆；API Key 使用 Windows 安全存储加密。
- DeepSeek / OpenAI 兼容 AI：设置 API Key 后可从服务端读取并选择模型。
- ASR：阿里云百炼实时识别或 Voicebox 本地转写，模型可下拉选择。
- 点歌：默认模拟；接入 AwooMusicBot 后填写服务地址和请求路径。
- 形象：支持默认视频动作、导入 Live2D 模型（ZIP / moc3 / model3.json）与 VTube Studio 插件 API（连接、认证、表情和快捷键测试）。

## 验证与打包

```powershell
pnpm test
pnpm check
pnpm build:web
pnpm build
```

`pnpm build` 在 `release/` 生成 NSIS 安装包。OBS 中使用“窗口捕获”选择“发发桌宠”窗口。

## 安全边界

渲染页启用 sandbox 和 context isolation，只能调用 preload 白名单。API Key 不写入普通配置文件。
