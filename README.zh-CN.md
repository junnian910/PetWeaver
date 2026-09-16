# PetWeaver（宠织引擎）

> 一个本地优先、可扩展的 Windows 桌宠底层框架，支持可替换角色包、完整 44 动作合同、直播互动、AI 对话、语音和由 Codex 辅助的动画素材生产流程。

[English](README.md) · [角色包规范](docs/pet-packages.zh-CN.md) · [直播适配器](docs/live-adapters.zh-CN.md) · [迁移路线图](PETWEAVER_MIGRATION_AND_RELEASE_PLAN.md)

<p align="center">
  <img src="public/assets/fafa-pet-final.png" width="280" alt="PetWeaver 内置角色发发" />
</p>

## 项目定位

PetWeaver 从已经可以运行的“发发桌宠”中抽取而来。发发继续作为内置默认角色，但角色身份、人格、表情和动画资源正在从应用底层中分离，最终让其他创作者不修改核心代码也能制作自己的桌宠。

当前 `main` 是 **v0.4 alpha 开发线**：

- 应用版本：`0.4.0-alpha.1`
- 平台：Windows 10/11 x64
- 测试：47 个测试文件，共 288 项测试通过
- 内置角色：发发
- 外部角色包：已支持文件夹形式加载和切换
- ZIP 安装、更新、卸载：计划在 v0.4 后续完成
- 界面：目前以中文为主，公开文档默认使用英文

## 它不只是生成图片

ImageGen 只负责产生角色参考图和动作姿势图。完整流程还包括：

1. 从真实 `ACTION_REGISTRY` 读取全部 44 个动作。
2. 为每个动作创建八姿势任务。
3. 人工检查角色一致性、动作语义和布局。
4. 确定性抽帧、裁切和规格统一。
5. 编码透明 VP9 WebM。
6. 校验动作覆盖、路径、分辨率、帧率、时长和透明通道。
7. 通过角色包清单绑定到运行时。

仓库中的 [`skills/petweaver-pixel-pet`](skills/petweaver-pixel-pet/SKILL.md) 提供了这套 Codex 工作流。

## 主要能力

- 透明置顶 Electron 桌宠窗口。
- 点击、双击、拖动、抛掷、重力、停靠、睡眠和唤醒。
- 带优先级、中断规则和冷却时间的动作调度器。
- 44 项动作注册表和显式资源回退链。
- 可替换的角色人格、表情和动作视频。
- Bilibili 与 YouTube 直播互动适配器。
- DeepSeek / OpenAI 兼容对话接口。
- 本地 MiniLM 记忆检索。
- Edge TTS、阿里云百炼、Voicebox、ASR 和按键说话。
- Live2D 与 VTube Studio 接入。
- 离线诊断和直播事件模拟。

## 快速开始

需要 Node.js 20+、pnpm 9+ 和 Windows 10/11 x64。

```powershell
git clone https://github.com/junnian910/PetWeaver.git
cd PetWeaver
pnpm install
pnpm dev
```

第一次启动不需要 API Key。外部直播、AI 和语音服务默认关闭，可以在诊断页面模拟弹幕、礼物、SC 和会员事件。

## 常用操作

- 拖动角色移动窗口。
- 单击或双击触发互动。
- 右键角色或点击齿轮打开设置。
- `Ctrl+Alt+F` 切换点击穿透。
- 使用系统托盘显示桌宠、打开设置或安全退出。

## 自定义角色包

```text
my-pet/
  pet.json
  references/canonical.png
  frames/idle_breath/00.png
  videos/idle_breath.webm
  videos/<action-id>.webm
  qa/validation.json
```

安装文件夹角色包：

1. 打开“设置 → 形象与动捕”。
2. 点击“打开角色包目录”。
3. 复制为 `<角色包根目录>/<pet-id>/pet.json`。
4. 保证目录名和清单 `id` 相同。
5. 点击“重新扫描”并选择角色。

完整格式、安全边界和媒体要求见[角色包规范](docs/pet-packages.zh-CN.md)。

## 开发验证

```powershell
pnpm test
pnpm check
pnpm validate:actions
pnpm build:web
```

## 安全边界

- Renderer 开启 sandbox 和 context isolation。
- Renderer 只能使用 preload 白名单。
- 角色资源通过受限的 `pet-resource://` 协议读取。
- 角色包不能使用绝对路径或 `..` 越界。
- 只有清单声明的动作和表情可以被访问。
- 无效角色包会安全回退到内置发发。
- API Key、Cookie、声音档案和生成的安装包不应提交到仓库。

## v0.4 路线

已经完成：角色包校验、发发内置包、外部包发现、安全资源协议、动作/表情/人格动态绑定、角色选择、YouTube 适配器、44 动作生成 Skill。

仍需完成：ZIP 安装与卸载、来源和签名提示、升级策略、第三方兼容性测试、完整英文界面。

## 许可证

PetWeaver 源代码使用 [Apache License 2.0](LICENSE) 开源许可证。

角色立绘、动画、声音、音乐、字体、模型文件等媒体资源可能使用单独条款。角色包公开分发前必须说明这些资源的权利来源；Apache-2.0 不会自动覆盖角色包中的第三方媒体资源。
