# PetWeaver 角色包（v0.4 草案）

角色包负责“角色是谁、有哪些素材”，运行时负责窗口、动作调度、直播事件、AI、语音、物理和渲染。ImageGen 只参与产生角色图和动作关键帧，不替代动作注册、帧处理、视频编码或运行时绑定。

## 当前动作契约

当前注册表位于 `src/main/core/action-registry.js`，共有 44 项：40 个规划动作，以及 `state_move`、`state_observe`、`state_talking`、`transition_settle` 四个系统扩展。43 项默认启用，`act_intro` 暂时停用但仍保留兼容标识。

角色包目录：

```text
my-pet/
  pet.json
  references/canonical.png
  videos/idle_breath.webm
  videos/<action-id>.webm
  qa/validation.json
```

最小清单：

```json
{
  "schemaVersion": 1,
  "id": "my-pet",
  "displayName": "My Pet",
  "version": "0.1.0",
  "runtime": { "minimumVersion": "0.4.0" },
  "renderer": {
    "type": "video-actions",
    "width": 384,
    "height": 416,
    "fallbackAction": "idle_breath"
  },
  "persona": { "prompt": "" },
  "expressions": {
    "neutral": "frames/idle_breath/00.png",
    "happy": "frames/idle_breath/00.png"
  },
  "actions": {
    "idle_breath": {
      "asset": "videos/idle_breath.webm",
      "enabled": true,
      "loop": true,
      "fallback": null
    }
  }
}
```

`asset` 和 `expressions` 必须使用角色包内的相对路径；禁止绝对路径和 `..`。`expressions.neutral` 必须存在，其他未声明表情会回退到 neutral。视频动作合同为 384×416、60 fps、1.6–3.2 秒、VP9、透明通道。启用动作应有自己的视频；确实不适用时才显式声明回退，不允许校验器默默把所有缺失动作都回退到待机。

## 安装和切换

1. 打开设置页的“形象与动捕”。
2. 在“PetWeaver 角色包”中点击“打开角色包目录”。
3. 把完整目录复制为 `<角色包目录>/<pet-id>/pet.json`，目录名必须与清单 `id` 相同。
4. 点击“重新扫描”。通过校验的包会出现在下拉列表中；选择后自动保存并立即切换。

运行时只通过受限的 `pet-resource://<pet-id>/...` 协议读取清单声明的动作和表情资源。越界路径、未声明文件、缺失的启用动作、回退循环以及目录名不一致都会被拒绝。所选包失效时，应用回退到内置发发并显示原因。

## 用 Codex 批量制作

仓库内的 `skills/petweaver-pixel-pet` 是完整制作 Skill。它从实际的 `ACTION_REGISTRY` 和现有动作分镜生成 44 个任务，不维护缩水版动作列表：

1. 用 `$imagegen` 生成统一角色参考图和每个动作的八姿势图；默认像素风。
2. 人工检查身份一致性、动作语义、4×2 布局和纯色背景。
3. 脚本抽取八帧，统一到 128×128，并输出预览 GIF。
4. 编码为运行时所需的 VP9 透明 WebM。
5. 校验动作覆盖、路径、分辨率、帧率、时长和透明元数据。

ImageGen 生成结果不直接进入应用；只有通过后续确定性处理和 QA 的素材才能绑定。

## v0.4 当前实现边界

`src/main/core/pet-package.js` 提供清单校验，`src/main/pet-package-service.js` 负责发现外部包与资源隔离，renderer 已能按当前角色包解析动作视频和回退表情，LLM 调用会使用当前角色包的 `persona.prompt`。发发作为内置默认包位于 `src/main/pets/fafa.js`。

接下来仍需完成：ZIP 安装与卸载、角色包签名/来源提示、包版本升级策略、角色人格覆盖规则，以及把第三方包纳入自动化兼容测试。

## English summary

Pet packages own identity, persona and assets; PetWeaver owns runtime behavior. The current contract covers the complete 44-entry registry, not a generic short sprite sheet. `$imagegen` supplies visual source material, while deterministic extraction, encoding, binding and validation remain mandatory.
