# 发发桌宠后续实施交接：编码与资源生产任务

## 你的角色

你是本项目的实施窗口，负责继续写代码、生成或整合动作资源、运行批处理、测试和修复。

当前对话窗口只担任审阅者，不再直接修改代码。请独立完成下面列出的工作；遇到普通实现选择时自行采用最小、可验证的方案，不要把逐条渲染日志发回审阅窗口。完成一个阶段后，报告变更文件、验证命令、结果、剩余问题，交给审阅窗口检查。

项目目录：

```text
C:\Users\zzx17\Desktop\fafa
```

请直接在当前工作目录继续，不要创建新 worktree，不要执行 `git reset --hard`、`git checkout --`，不要覆盖或回滚现有未提交改动。

## 目标

最终实现以下结果：

1. 注册表严格包含 38 个策划动作与 3 个扩展状态。
2. 38 个策划动作各有独立透明 WebM，不共享其他动作的视频路径。
3. 扩展状态 `state_move`、`state_observe`、`state_talking` 有独立视频和播放器行为。
4. 视频统一为 384×416、60 FPS、VP9 Alpha，普通动作时长 1.6–3.2 秒。
5. 中心漂移不超过 3 px，脚底基线漂移不超过 2 px。
6. 设置页可以测试全部动作。
7. 拖动前、拖动中、普通释放后三个阶段尺寸与画面保持一致；真正抛出后才切换抛掷状态。
8. Live2D 本阶段只保留可替换接口和空适配器；缺少 `model3.json` 或 SDK 时自动回退视频，不提供无效开关。
9. 完整测试、Web 构建、动作视频开发 QA 全部通过；发布 QA 只在 38 个策划动作全部完成后通过。

## Git 与当前工作区

- 仓库基线提交：`dfd5c0c chore: establish fafa baseline`
- 当前存在大量已验证但尚未提交的修改和新增文件。
- 不要清理这些未提交内容，不要重新实现已经完成的模块。
- `.gitignore` 已排除 `node_modules`、release、test-build、Remotion 输出工作区、`asset-work/` 等大型生成目录。
- 正式视频位于 `public/assets/videos/`，应纳入项目；图片工作过程位于 `asset-work/`，保持隔离。

开始前运行：

```powershell
git status --short
git diff --stat
```

## 已完成并需要保留的实现

### 动作系统与播放器

- `src/main/core/action-registry.js`
  - 已建立单一动作注册表。
  - 包含 38 个策划动作和 3 个扩展状态。
  - 每项有 ID、分类、标签、视频路径、循环、可打断、触发来源、资源状态与回退。
  - 视频路径唯一。
- `src/renderer/pet-renderer.js`
  - 已实现双 `<video>` 图层切换的 `VideoPetRenderer`。
  - 已定义 `play`、`stop`、`setScale`、`setFacing`、`setLookTarget`、`setExpression`、`setPhysicsPhase`、`destroy`。
  - 已有 `Live2DPetRenderer` 空适配器和渲染器工厂。
  - Live2D 不可用时明确回退视频。
- 设置页通过安全 IPC 动态取得动作清单，不再单独维护动作列表。

### 行为和稳定性修复

- 普通拖动不再切换 `grabbed` PNG，不改变容器比例或构图。
- 只有真正抛出后进入 airborne、impact、landed。
- `pointercancel` 只取消拖动，不计算抛掷速度。
- 鼠标坐标读取失败时停止拖动轮询。
- ActionScheduler 高优先级中断竞态已修复，顺序为：当前动作结束 → 紧急动作 → 原队列动作。
- 睡眠动作保持到唤醒或更高优先级事件。
- 主屏重置、多显示器工作区边界与显示器缝隙处理已修复。
- TTS 延迟到动作真正开始时合成；动作实例 ID 与语义动作 ID 已分离。
- 空闲随机动作有 20–45 秒调度和睡眠、拖动、抛掷门禁。
- 配置支持深合并、版本迁移和命令补全，不覆盖已有用户命令。
- 音乐连接器切换时断开旧实例；WebSocket 和 HTTP 已增加关闭与超时。
- B 站事件去重只使用真实稳定 ID，避免随机 ID 破坏去重。
- 不可达 Pixi 渲染分支已经移除；根依赖中的 `pixi.js` 也已经移除，`pnpm-lock.yaml` 已更新。

### 测试状态

在首批视频接入前，完整测试为 18 个测试文件、80 个测试全部通过，Web 构建通过。之后新增了视频 QA 测试：

- `tests/action-video-qa.test.js`：4 个测试通过。
- `tests/action-registry.test.js`：6 个测试通过。
- 两者合计 10/10 通过。
- `pnpm run check` 已改为递归检查 `src/main`、`src/preload`、`src/renderer`、`scripts` 中所有 `.js`、`.mjs`、`.cjs`。

请重新运行完整测试，不能只依赖旧结果。

## 当前动作资源状态

### 已有并继续保留的 5 个独立视频

```text
idle_breath  -> public/assets/videos/idle.webm
act_greet    -> public/assets/videos/waving-real.webm
act_sing     -> public/assets/videos/singing.webm
act_sleep    -> public/assets/videos/sleeping.webm
act_wake     -> public/assets/videos/waking.webm
```

### 本轮新完成并已通过 Alpha QA 的 5 个视频

```text
idle_blink -> public/assets/videos/actions/idle_blink.webm
idle_stare -> public/assets/videos/actions/idle_stare.webm
emo_happy  -> public/assets/videos/actions/emo_happy.webm
emo_shy    -> public/assets/videos/actions/emo_shy.webm
emo_angry  -> public/assets/videos/actions/emo_angry.webm
```

对应已审图片位于：

```text
asset-work/action-batches/idle_blink/selected.png
asset-work/action-batches/idle_stare/selected.png
asset-work/action-batches/emo_happy/selected.png
asset-work/action-batches/emo_shy/selected.png
asset-work/action-batches/emo_angry/selected.png
```

联系表和清单位于：

```text
asset-work/action-batches/contact-sheet.png
asset-work/action-batches/batch-manifest.json
```

这 5 张均为 384×416 RGBA，透明角、中心与脚底基线已经人工审阅。`idle_blink` 必须使用同构图的 `idle_stare` 作为睁眼基准层，不能改回原始标准立绘，否则眨眼瞬间会变大。

### 当前真实视频 QA 结果

运行：

```powershell
pnpm run validate:actions
```

当前 10 个 available 视频全部通过：

```text
PASS idle_breath center=0.5x2.5 foot=2.0
PASS idle_blink center=0.0x0.0 foot=0.0
PASS idle_stare center=3.0x0.5 foot=1.0
PASS emo_happy center=1.0x1.5 foot=1.0
PASS emo_shy center=3.0x1.5 foot=2.0
PASS emo_angry center=3.0x1.0 foot=1.0
PASS act_sing center=0.0x1.5 foot=0.0
PASS act_sleep center=1.5x1.0 foot=0.0
PASS act_wake center=0.0x1.0 foot=0.0
PASS act_greet center=2.5x0.0 foot=0.0
```

QA 工具位于：

```text
scripts/validate-action-videos.mjs
scripts/analyze-alpha-frames.py
scripts/check-javascript.mjs
tests/action-video-qa.test.js
```

工具自动定位 Remotion 内置 `ffmpeg.exe`、`ffprobe.exe`，用 `-c:v libvpx-vp9` 解码 Alpha。不要删除这个显式解码器参数，否则透明层会被错误解码为整张不透明画布，稳定性检查会产生全部为 0 的假阳性。

## Remotion 当前实现

重要文件：

```text
remotion-pet/src/Root.jsx
remotion-pet/src/ActionMotion.jsx
remotion-pet/src/PetMotion.jsx
remotion-pet/src/action-specs.js
remotion-pet/render-utils.mjs
remotion-pet/render-action.mjs
remotion-pet/render-actions.mjs
```

已有通用组合 `Fafa-Action`，384×416、60 FPS、120 帧。动作由 input props 中的 `action` 驱动。

单动作渲染：

```powershell
pnpm --dir remotion-pet run render:action -- idle_blink
```

当前批准批次渲染：

```powershell
pnpm --dir remotion-pet run render:actions
```

透明视频参数必须保留：

```text
--codec=vp9
--image-format=png
--pixel-format=yuva420p
--crf=12
--overwrite
```

动画只能使用 Remotion 的 `useCurrentFrame`、`interpolate`、`Easing` 等帧驱动方式；禁止 CSS `animation` 和 `transition`。

## 剩余资源工作

现在有 10/38 个策划动作拥有独立可用视频，还剩 28 个策划动作。三个扩展状态也仍未完成，因此待制作视频总数为 31。

### A 批剩余 5 个情绪动作

```text
emo_sleepy
emo_sad
emo_excited
emo_surprise
emo_aggrieved
```

### B 批 12 个随机动作

```text
act_stretch
act_spin
act_scratch
act_flip_hair
act_yawn
act_table
act_lookaround
act_roll
act_hop
act_chin
act_rub_eye
act_sneeze
```

### C 批 11 个命令、礼物与特殊动作

```text
act_dance
act_work
act_ink
act_firework
act_intro
act_joke
gift_thanks
gift_sc
gift_guard
special_hourly
special_lottery
```

### D 批 3 个扩展状态

```text
state_move
state_observe
state_talking
```

每次只处理 4–6 个动作。每批流程必须是：

1. 以现有标准立绘和已批准图片为唯一角色基准。
2. 生成透明关键姿势到 `asset-work/action-batches/<actionId>/`。
3. 简单动作 1 个关键姿势；翻滚、旋转、喷嚏、烟花、泼墨等复杂动作 2–4 个连续关键姿势。
4. 生成 `prompt.md`、`metadata.json` 和该批联系表。
5. 先让审阅窗口检查角色一致性、动作辨识度、透明边缘、中心点、脚底基线。
6. 审阅通过后才复制到 `remotion-pet/public/action-poses/` 并渲染 WebM。
7. 更新 `remotion-pet/src/action-specs.js` 和批量渲染列表。
8. 视频通过 `pnpm run validate:actions` 后，再把注册表对应项从 `pending` 改为 `available`。
9. 同步更新注册表测试中的 available 数量与路径。

不要把旧的 29 张 192×208 低清帧接入当前播放器。抛掷已有 `grabbed/airborne/landed` PNG 状态，继续保留，不重复制作视频。

## 下一阶段代码任务

按以下顺序完成。

### 1. 先做完整回归

运行：

```powershell
pnpm run check
pnpm test
pnpm run build:web
pnpm run validate:actions
```

如果 Vite 或 Vitest 在 Codex 沙箱内报 `Access is denied`，在获得权限后到沙箱外运行同一命令；不要因为沙箱错误修改业务代码。

### 2. 修复运行冒烟脚本的旧播放器假设

`scripts/runtime-actions-smoke.mjs` 仍按旧结构查找：

```text
[data-state="waving-real"]
[data-state="singing"]
[data-state="sleeping"]
[data-state="waking"]
```

新播放器只有两个复用 video 层，并使用 `data-action-id`。请把冒烟脚本改为测试当前架构：

- 动态触发 `act_greet`、`act_sing`、`act_sleep`、`act_wake`、本轮 5 个新动作。
- 每次确认恰好一个 `.pet-video-layer.visible`。
- 确认该层 `data-action-id` 等于请求的语义动作 ID。
- 确认 `readyState >= 2`、`videoWidth=384`、`videoHeight=416`。
- 快速连续切换动作，确认不会黑屏、不会同时显示两个 video 层。
- 拖动开始和普通释放前后记录可见层矩形、`--pet-scale` 和 `src/currentTime`，确认尺寸与画面不被替换。
- `pointercancel` 不得触发 toss。
- 真正 toss 仍按 airborne、landed 流程工作。

`scripts/runtime-smoke.mjs` 中的中文如果 PowerShell 显示乱码，先用 Node 以 UTF-8 检查真实文件内容；不要仅凭终端显示重写字符串。

### 3. 审阅并补齐 Live2D 空适配器测试

确认测试覆盖：

- 缺少 `model3.json` 时 `Live2DPetRenderer.isAvailable()` 为 false。
- 工厂稳定返回 `VideoPetRenderer`。
- 回退原因明确。
- 不安装 SDK，不添加设置开关。

### 4. 检查 TTS 与 `state_talking`

当前 `state_talking` 资源仍是 pending，因此会回退 `idle_breath`。视频完成后确认：

- 只有没有更具体说话动作时才使用 `state_talking`。
- 音频只在相同 scheduler instance ID 的动作真正开始后播放。
- 被丢弃或仍在队列的动作不提前消耗 TTS。

### 5. 发布检查

开发检查：

```powershell
pnpm run validate:actions
```

发布检查：

```powershell
pnpm run validate:actions:release
```

当前发布检查应失败，因为仍有 28 个策划动作处于 pending。这是正确行为。不要放宽规则，也不要把缺资源动作虚假标记为 available。只有 38 个策划动作全部拥有独立文件后，发布检查才能通过。

## 已确认但需要继续关注的问题

### 高优先级

- 必须做真实 Electron 拖动回归。单元测试已经覆盖计算逻辑，但还未完成最终人工拖动验收。
- 快速动作切换要检查黑屏、旧层残留和旧音频。
- 睡眠、唤醒、说话、移动、观察、拖动、抛掷之间不能互相覆盖。
- `state_move` 左右共用一条视频，由 `setFacing` 镜像。
- `state_observe` 接收归一化视线目标；它与自主动作 `act_lookaround` 不同。

### 无用或过时代码检查

已经确认并处理：

- 不可达 Pixi 播放分支已删除。
- `pixi.js` 根依赖已删除。
- `preferVideoRenderer` 不可达分支已删除。

继续检查并只报告真实仍存在的项目：

- 未被播放器使用的低清帧源。
- 没有动作路由的旧 `waving.webm`。
- 抛掷落地判断是否仍有被前一条件覆盖的重复分支。
- 设置页是否仍有重复的愤怒、难过测试按钮。
- `release`、`test-build`、Remotion 历史输出只写入清理报告，未经用户明确确认不得删除。

注意：`src/renderer/pet.js` 中的 fallback 图片层仍用于视频加载失败和抛掷 PNG，不是全部无用代码，不要整段删除。

## OpenCode Go / DeepSeek Flash 使用方式

本机已经安装并配置 OpenCode 桌面端，提供方 `opencode-go` 可用，模型 ID 为 `deepseek-v4-flash`。可以让它辅助写候选补丁和重复性代码，但必须遵守：

- API key 已存在本机 OpenCode 凭据文件中，绝对不要打印、复制到项目或写入日志。
- 只把必要的非敏感源码和任务要求发送给模型。
- 要求返回 unified diff 或完整目标文件。
- 在应用前人工审阅补丁。
- DeepSeek 不直接获得终端写权限。
- 网络中断时把请求拆小，不把它设成构建和测试的硬依赖。

如果 OpenCode Go 暂时断线，继续本地工作；不要循环重试长请求造成卡顿。

## 最终验收命令

完成一个代码阶段后运行：

```powershell
pnpm run check
pnpm test
pnpm run build:web
pnpm run validate:actions
```

38 个策划动作全部完成后额外运行：

```powershell
pnpm run validate:actions:release
```

Remotion 组合检查：

```powershell
node remotion-pet/node_modules/@remotion/cli/remotion-cli.js compositions remotion-pet/src/index.jsx --browser-executable="C:\Program Files\Google\Chrome\Application\chrome.exe"
```

验收报告必须包含：

1. 修改文件清单。
2. 每项需求对应的实现位置。
3. 所有验证命令和退出码。
4. 测试文件数与测试数。
5. Web 构建产物大小。
6. 每个新增 WebM 的 codec、尺寸、FPS、时长、Alpha、中心漂移、脚底漂移。
7. 发布检查是否通过；未通过时列出全部 pending 动作。
8. 仍存在的 bug、无用代码和风险，按优先级排序。
9. 不要提交或推送，先交给审阅窗口检查 diff 和产物。

## 本次接手的第一组具体行动

请直接执行以下工作，不需要再次询问背景：

1. 阅读本文件和 `src/main/core/action-registry.js`。
2. 查看 `git status --short`，保留所有现有改动。
3. 运行完整 `check`、测试、Web 构建和开发视频 QA。
4. 修复 `scripts/runtime-actions-smoke.mjs` 对旧硬编码 video 标签的假设。
5. 运行 Electron 运行冒烟测试，验证双视频层、快速切换、拖动不变大、普通释放不 toss、真正 toss 正常。
6. 把失败项修到通过，不放宽测试阈值。
7. 检查 Live2D 空适配器测试是否完整并补齐。
8. 生成 A 批剩余 5 个情绪动作的关键姿势和联系表，停在“等待审图”阶段，不提前渲染。
9. 将完整结果交回审阅窗口，不提交 Git。
