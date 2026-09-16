/* ==== fafa settings.js (redesigned) ==== */
const form = document.querySelector('#settings-form')
const saveState = document.querySelector('#save-state')
// Enter in a text field must not submit the form (that would reload the page and lose unsaved changes).
form.addEventListener('submit', (event) => event.preventDefault())

function escapeAttribute(value) { return String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;') }
function escapeHtml(value) { return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;') }

let config = await window.fafa.config.get()
const actionEntries = (await window.fafa.pet.actions()).filter(a => a.category !== 'transition')
const providerCatalog = await window.fafa.providers.list()
let petPackageEntries = await window.fafa.petPackages?.list?.().catch(() => []) || []

/* ============================================================
   Chinese UI copy
   ============================================================ */
const I18N = {
  zh: {
    'brand.title': '发发控制台',
    'nav.general': '基础设置', 'nav.live': '直播互动', 'nav.ai': '语音与 AI', 'nav.relationship': '关系与成长',
    'nav.avatar': '形象与动捕',
    'nav.schedule': '定时与指令', 'nav.actions': '动作设计预览', 'nav.diagnostics': '运行诊断',
    'nav.shortcut': '切换点击穿透',
    'nav.assign': '动作分配', 'nav.testcenter': '测试中心',
    'save.autosaved': '所有改动都会自动保存', 'save.saved': '已自动保存', 'save.failed': '自动保存失败',
    'panel.overview': '发发概览', 'panel.overview.d': '查看今天的状态，并从常用操作开始。',
    'panel.general': '基础设置', 'panel.general.d': '调整发发在桌面上的尺寸、层级和启动方式。',
    'panel.live': '直播互动', 'panel.live.d': '连接房间事件、控制主播专属指令权限，并在这里测试所有直播反馈。',
    'panel.avatar': '形象与动捕', 'panel.avatar.sub': '管理桌宠的形象来源：继续使用本地视频动作，或者导入 Live2D 模型，或者接入 VTube Studio。', 'panel.avatar.d': '管理桌宠的形象来源：继续使用本地视频动作，或者导入 Live2D 模型，或者接入 VTube Studio。',
    'avatar.mode.video': '视频动作', 'avatar.mode.video.d': '默认方案，桌宠窗口直接播放本地动作视频',
    'avatar.mode.live2d': 'Live2D 模型', 'avatar.mode.live2d.d': '导入 Cubism 模型文件或 ZIP 压缩包，在设置页校验与预览',
    'avatar.mode.vts': 'VTube Studio', 'avatar.mode.vts.d': '通过官方插件 API 连接 VTube Studio，读取模型、表情与快捷键',
    'avatar.live2d.title': 'Live2D 模型库', 'avatar.vts.title': 'VTube Studio 接口',
    'avatar.btn.import': '导入模型或压缩包', 'avatar.btn.folder': '打开模型目录', 'avatar.btn.choose': '选择文件',
    'avatar.btn.validate': '校验当前模型', 'avatar.btn.rescan': '重新扫描', 'avatar.btn.connect': '连接测试',
    'avatar.btn.auth': '请求插件认证', 'avatar.btn.models': '读取模型', 'avatar.btn.expressions': '读取表情',
    'avatar.btn.hotkeys': '读取快捷键', 'avatar.btn.applyModel': '载入选中模型', 'avatar.btn.clear': '清空',
    'avatar.drop.title': '把 .zip / .moc3 / .model3.json 拖到这里', 'avatar.drop.d': '导入后会保存到发发自己的模型目录；支持多文件与多模型压缩包。',
    'avatar.live2d.active': '当前模型', 'avatar.live2d.active.d': '切换后保存，桌宠会读取该模型的预览贴图。',
    'avatar.live2d.preview': '模型预览', 'avatar.live2d.preview.empty': '导入模型后显示第一张贴图',
    'avatar.live2d.note': '当前版本在桌宠窗口使用模型贴图预览；完整 Cubism 动态渲染需要后续接入 SDK，想直接获得完整动捕可切换到 VTube Studio。',
    'avatar.vts.enabled': '启用 VTube Studio 形象', 'avatar.vts.enabled.d': '关闭时只保存接口参数，不会影响视频动作模式。',
    'avatar.vts.host': '主机地址', 'avatar.vts.host.d': '通常保持 127.0.0.1 即可',
    'avatar.vts.port': '端口', 'avatar.vts.port.d': 'VTube Studio 默认插件端口 8001',
    'avatar.vts.pluginName': '插件名', 'avatar.vts.pluginName.d': '认证弹窗里显示的名称',
    'avatar.vts.developer': '开发者名', 'avatar.vts.developer.d': '用于 VTube Studio 插件认证，不是账号密码。',
    'avatar.vts.status.empty': '尚未连接 VTube Studio。点击「连接测试」开始。',
    'avatar.vts.models': '可用模型', 'avatar.vts.hotkeys.title': '当前模型快捷键',
    'label.roomId': '直播间房间号', 'label.roomId.d': '使用直播间地址中的数字房间号',
    'label.broadcasterUid': '主播 UID', 'label.broadcasterUid.d': '只有该 UID 可以执行开奖',
    'label.bilibiliCookie': 'B站 Cookie（选填）', 'label.bilibiliCookie.d': '如果匿名连接一直失败或报 -352，建议填写已登录 B 站的 Cookie；仅用于获取弹幕服务器配置，保存在 Windows 安全存储。',
    'panel.ai': '语音与 AI', 'panel.ai.d': '配置发发的语音合成、语音识别与弹幕对话服务。',
    'panel.relationship': '关系与成长', 'panel.relationship.d': '查看与发发的亲密度、每日互动和短期情绪。',
    'panel.schedule': '定时与指令', 'panel.schedule.d': '整点报时、自定义提醒与直播间弹幕指令编排。',
    'panel.actions': '动作设计预览', 'panel.actions.d': '预览动作并编排发发空闲时的待机动作。',
    'panel.diagnostics': '运行诊断', 'panel.diagnostics.d': '查看各服务状态。',
    'panel.assign': '动作分配', 'panel.assign.d': '按场景分配动作：每个场景可以勾选多个动作，触发时会随机播放一个。',
    'panel.testcenter': '测试中心', 'panel.testcenter.d': '模拟主播语音与观众弹幕，逐项测试指令、AI 对话与点歌。',
    'panel.testcenter.voice': '主播语音测试', 'panel.testcenter.voice.d1': '模拟说话', 'panel.testcenter.voice.d2': '把主播说的话转成文字触发事件。语音指令不需要喊「发发」，直接说「跳舞」「点歌 晴天」即可；不是指令的内容会交给 AI 回复。',
    'panel.testcenter.voice.input': '说话内容', 'panel.testcenter.speak': '桌宠播报',
    'panel.testcenter.danmaku': '观众弹幕测试',
    'panel.testcenter.music': '点歌测试', 'panel.testcenter.music.d1': '真实点歌请求', 'panel.testcenter.music.d2': '输入歌名模拟观众点歌，验证点歌链路；开启「模拟测试模式」时不会真的请求服务。',
    'label.musicBaseUrl': 'AListen 地址', 'label.musicHouseId': '房间号', 'label.musicSource': '音乐源', 'label.musicRequestPath': '请求路径', 'label.musicPassword': 'AListen 密码', 'label.musicPassword.d': '密码只保存到 Windows 安全存储。',
    'opt.musicMock': '模拟点歌', 'opt.musicMock.d': '返回排队成功，不向真实服务发送请求', 'btn.musicGuide': '不知道怎么填？点我看教程',
    'label.llmPersona': '形象提示词', 'label.llmPersona.d': '每次 AI 请求都会带入；最多 200 个字符。AI 输入和输出最多 40 个 Unicode 字符。',
    'label.llmMemory': '本地记忆：最多保存 400 条，只检索最相关的 3 条；模型未加载时不会联网下载。', 'label.commandSearch': '指令目录搜索',
    'btn.micDirectTest': '直接开麦测试',
    'placeholder.musicHouseId': 'AListen houseId', 'placeholder.secretUnchanged': '留空不修改', 'placeholder.llmPersona': '描述发发的性格、说话方式和边界', 'placeholder.commandSearch': '搜索指令或别名',
    'music.source.wy': '网易云', 'music.source.qq': 'QQ 音乐', 'music.source.db': '本地数据库',
    'panel.testcenter.music.input': '歌名', 'panel.testcenter.music.volume': '歌声音量', 'panel.testcenter.music.volume.d': '测试点歌服务音量接口；模拟模式只做演示。',
    'label.assign.idle': '待机动作', 'label.assign.click': '点击互动', 'label.assign.danmaku': '弹幕喊名字', 'label.assign.voice': '主播语音', 'label.assign.special': '特殊事件', 'label.assign.gift': '礼物反馈', 'label.assign.superChat': 'SC 回应', 'label.assign.guard': '上舰庆祝',
    'label.assign.petting': '头部抚摸', 'label.assign.belly': '摸肚子',
    'label.assign.voiceShout': '主播大叫', 'label.assign.voiceNoisy': '持续噪声', 'label.assign.lottery': '抽奖反馈',
    'label.assign.enter': '观众进场', 'label.assign.session': '直播结束总结', 'label.assign.giftMedium': '中等礼物',
    'label.assign.giftBig': '大额礼物', 'label.assign.giftSuper': '豪华礼物', 'label.assign.toss': '甩飞腾空',
    'btn.liveTest': '测试直播连接', 'btn.llmModels': '获取模型列表', 'btn.ttsModels': '获取模型', 'btn.asrModels': '获取模型', 'btn.ttsListen': '试听', 'btn.llmTest': '打开对话测试', 'btn.micTest': '测试麦克风', 'btn.asrTest': '连接测试', 'btn.musicTest': '测试点歌连接', 'btn.ttsVoices': '读取音色列表', 'btn.liveGuide': '不知道怎么填？点我看教程',
    'btn.ttsVoiceImport': '选择文件',
    'label.ttsVoiceImport': '导入自定义音色', 'label.ttsVoiceImport.d': '导入音频文件作为声音参考，适用于支持声音克隆的服务（如 Voicebox）',
    'label.ttsVoiceDrop': '把音频文件拖到这里', 'label.ttsVoiceDrop.d': '支持 .wav / .mp3 / .ogg / .flac / .webm / .m4a / .aac 等格式',
    'label.llmApiKey': 'API 密钥', 'label.ttsApiKey': 'API 密钥', 'label.asrApiKey': 'API 密钥', 'label.ttsModel': '模型', 'label.asrModel': '模型',
    'label.llmApiKey.d': 'Voicebox 本地预设可留空；保存到 Windows 安全存储。',
    'label.ttsApiKey.d': '密钥写入 Windows 安全存储。', 'label.ttsModel.d': 'Edge TTS 固定为 edge-tts；百炼与 Voicebox 可读取模型。',
    'label.asrApiKey.d': 'Voicebox 本地服务可以留空。', 'label.asrModel.d': '预设自带模型列表，也可点击按钮从当前服务读取。',
    'btn.gotoTestcenter': '打开测试中心', 'btn.mockSpeak': '模拟说话', 'btn.testMusic': '测试点歌', 'btn.goConfig': '去配置', 'btn.saveRetry': '保存并重试',
    'btn.addKeyword': '＋ 添加敏感词', 'btn.expand': '展开全部', 'btn.collapse': '收起', 'btn.prev': '上一步', 'btn.next': '下一步', 'btn.done': '完成', 'btn.openLink': '打开链接',
    'test.speakOn': '发发会朗读这条内容', 'test.voiceSent': '已模拟主播说话', 'test.musicSent': '点歌请求已发出',
    'legend.mini': '迷你', 'legend.std': '标准', 'legend.mute': '静音', 'legend.comfy': '舒适', 'legend.loud': '响亮',
    'legend.calm': '稳妥', 'legend.sensitive': '灵敏', 'legend.gentle': '轻柔', 'legend.strong': '强力',
    'prio.low': '低', 'prio.med': '中', 'prio.high': '高',
    'col.time': '时间', 'col.time.hint': '提醒的时间', 'col.lines': '台词', 'col.lines.hint': '提醒台词',
    'col.action': '动作', 'col.action.hint': '触发的动作', 'col.aliases': '触发别名', 'col.aliases.hint': '观众输入的词，逗号分隔',
    'col.reply': '回复台词', 'col.reply.hint': '桌宠要说的话', 'col.priority': '优先级', 'col.priority.hint': '高优先级优先执行',
    'opt.adminOnly': '仅主播',
    'toast.saved': '已自动保存', 'toast.saveFailed': '保存失败', 'toast.testOk': '连接测试通过', 'toast.testFailed': '连接测试失败',
    'toast.modelsFailed': '模型列表获取失败', 'toast.voicesFailed': '音色列表获取失败', 'toast.musicResult': '点歌连接',
    'toast.mockConflictLive': '模拟测试与直播连接不能同时开启，已自动关闭直播连接',
    'toast.mockConflictMock': '直播连接与模拟测试不能同时开启，已自动关闭模拟测试',
    'toast.mockTriggered': '成功触发', 'toast.tempEnabled': '已临时开启，可在语音与AI面板关闭',
    'quick.strip': '快速开启', 'quick.tts': '快速开启：语音合成', 'quick.llm': '快速开启：智能对话'
  },
  en: {
    'brand.title': 'Fafa Console',
    'nav.general': 'Basics', 'nav.live': 'Live', 'nav.ai': 'Voice & AI', 'nav.relationship': 'Relationship',
    'nav.avatar': 'Avatar & Mocap',
    'nav.schedule': 'Schedule & Commands', 'nav.actions': 'Action Preview', 'nav.diagnostics': 'Diagnostics',
    'nav.shortcut': 'Toggle click-through', 'lang.toggle': '中', 'lang.aria': 'Switch language',
    'nav.assign': 'Actions', 'nav.testcenter': 'Test Center',
    'save.autosaved': 'All changes save automatically', 'save.saved': 'Auto-saved', 'save.failed': 'Auto-save failed',
    'panel.general': 'Basics', 'panel.general.d': 'Adjust Fafa\u2019s size, layering and startup.',
    'panel.live': 'Live', 'panel.live.d': 'Connect room events, control host-only commands, and test live feedback here.',
    'panel.avatar': 'Avatar & Mocap', 'panel.avatar.sub': 'Choose how Fafa is displayed: local video actions, an imported Live2D model, or VTube Studio over the plugin API.', 'panel.avatar.d': 'Choose how Fafa is displayed: local video actions, an imported Live2D model, or VTube Studio over the plugin API.',
    'avatar.mode.video': 'Video actions', 'avatar.mode.video.d': 'Default mode; the pet window plays local action videos',
    'avatar.mode.live2d': 'Live2D model', 'avatar.mode.live2d.d': 'Import Cubism files or ZIP archives and validate them here',
    'avatar.mode.vts': 'VTube Studio', 'avatar.mode.vts.d': 'Connect through the official plugin API to read models, expressions and hotkeys',
    'avatar.live2d.title': 'Live2D Model Library', 'avatar.vts.title': 'VTube Studio API',
    'avatar.btn.import': 'Import model or archive', 'avatar.btn.folder': 'Open model folder', 'avatar.btn.choose': 'Choose files',
    'avatar.btn.validate': 'Validate model', 'avatar.btn.rescan': 'Rescan', 'avatar.btn.connect': 'Connection test',
    'avatar.btn.auth': 'Request plugin auth', 'avatar.btn.models': 'Load models', 'avatar.btn.expressions': 'Load expressions',
    'avatar.btn.hotkeys': 'Load hotkeys', 'avatar.btn.applyModel': 'Load selected model', 'avatar.btn.clear': 'Clear',
    'avatar.drop.title': 'Drop .zip / .moc3 / .model3.json here', 'avatar.drop.d': 'Imports are copied to Fafa\u2019s own model folder; multiple files and model archives are supported.',
    'avatar.live2d.active': 'Active model', 'avatar.live2d.active.d': 'Saving switches the model; Fafa loads its preview texture.',
    'avatar.live2d.preview': 'Model preview', 'avatar.live2d.preview.empty': 'The first texture appears after import',
    'avatar.live2d.note': 'The pet window currently shows the model texture as a static preview; full Cubism dynamic rendering needs the SDK later. Switch to VTube Studio for full mocap now.',
    'avatar.vts.enabled': 'Enable VTube Studio avatar', 'avatar.vts.enabled.d': 'When off, the API settings are kept but video mode is unaffected.',
    'avatar.vts.host': 'Host', 'avatar.vts.host.d': 'Usually keep 127.0.0.1',
    'avatar.vts.port': 'Port', 'avatar.vts.port.d': 'VTube Studio default plugin port is 8001',
    'avatar.vts.pluginName': 'Plugin name', 'avatar.vts.pluginName.d': 'Shown in the VTube Studio auth dialog',
    'avatar.vts.developer': 'Developer name', 'avatar.vts.developer.d': 'Used for plugin authentication, not an account password.',
    'avatar.vts.status.empty': 'Not connected yet. Click "Connection test" to start.',
    'avatar.vts.models': 'Available models', 'avatar.vts.hotkeys.title': 'Hotkeys in current model',
    'label.roomId': 'Room ID', 'label.roomId.d': 'Use the numeric room ID from the live URL.',
    'label.broadcasterUid': 'Broadcaster UID', 'label.broadcasterUid.d': 'Only this UID can draw the lottery.',
    'label.bilibiliCookie': 'Bilibili Cookie (optional)', 'label.bilibiliCookie.d': 'If anonymous connection keeps failing or returns -352, paste a cookie from a logged-in Bilibili session. Used only to fetch danmaku server config and stored in Windows secure storage.',
    'panel.ai': 'Voice & AI', 'panel.ai.d': 'Configure TTS, ASR and danmaku chat services.',
    'panel.relationship': 'Relationship', 'panel.relationship.d': 'Intimacy, daily interactions and short-term mood.',
    'panel.schedule': 'Schedule & Commands', 'panel.schedule.d': 'Hourly chime, reminders and danmaku commands.',
    'panel.actions': 'Action Preview', 'panel.actions.d': 'Preview actions and customize the idle routine.',
    'panel.diagnostics': 'Diagnostics', 'panel.diagnostics.d': 'Check each service status.',
    'panel.assign': 'Actions', 'panel.assign.d': 'Assign actions per scenario; pick several and one plays at random.',
    'panel.testcenter': 'Test Center', 'panel.testcenter.d': 'Simulate host voice and viewer danmaku to test every interaction.',
    'panel.testcenter.voice': 'Host Voice Test', 'panel.testcenter.voice.d1': 'Simulate speech', 'panel.testcenter.voice.d2': 'Turn spoken words into text events. Voice commands need no 「发发」 prefix: say 「跳舞」or「点歌 晴天」; other text goes to the AI.',
    'panel.testcenter.voice.input': 'What was said', 'panel.testcenter.speak': 'Fafa speaks',
    'panel.testcenter.danmaku': 'Viewer Danmaku Test',
    'panel.testcenter.music': 'Music Test', 'panel.testcenter.music.d1': 'Real song request', 'panel.testcenter.music.d2': 'Request a song as a test viewer; mock mode skips the real service.',
    'label.musicBaseUrl': 'AListen URL', 'label.musicHouseId': 'Room ID', 'label.musicSource': 'Music source', 'label.musicRequestPath': 'Request path', 'label.musicPassword': 'AListen password', 'label.musicPassword.d': 'Stored only in Windows secure storage.',
    'opt.musicMock': 'Mock song request', 'opt.musicMock.d': 'Return a queued result without contacting the real service', 'btn.musicGuide': 'Need help? Open the guide',
    'label.llmPersona': 'Persona prompt', 'label.llmPersona.d': 'Included with every AI request; up to 200 characters. AI input and output are limited to 40 Unicode characters.',
    'label.llmMemory': 'Local memory: keeps up to 400 entries, recalls the top 3; no model download on first use.', 'label.commandSearch': 'Command catalog search',
    'btn.micDirectTest': 'Test microphone directly',
    'placeholder.musicHouseId': 'AListen houseId', 'placeholder.secretUnchanged': 'Leave blank to keep current', 'placeholder.llmPersona': 'Describe Fafa\u2019s personality, voice and boundaries', 'placeholder.commandSearch': 'Search commands or aliases',
    'music.source.wy': 'NetEase Cloud', 'music.source.qq': 'QQ Music', 'music.source.db': 'Local database',
    'panel.testcenter.music.input': 'Song name', 'panel.testcenter.music.volume': 'Song volume', 'panel.testcenter.music.volume.d': 'Test the bot volume endpoint; mock mode is a demo.',
    'label.assign.idle': 'Idle', 'label.assign.click': 'Click', 'label.assign.danmaku': 'Danmaku mention', 'label.assign.voice': 'Host voice', 'label.assign.special': 'Special events', 'label.assign.gift': 'Gift reactions', 'label.assign.superChat': 'Super Chat', 'label.assign.guard': 'Guard celebration',
    'label.assign.petting': 'Head petting', 'label.assign.belly': 'Belly petting',
    'label.assign.voiceShout': 'Voice shout', 'label.assign.voiceNoisy': 'Voice noisy', 'label.assign.lottery': 'Lottery',
    'label.assign.enter': 'Viewer enter', 'label.assign.session': 'Session summary', 'label.assign.giftMedium': 'Medium gift',
    'label.assign.giftBig': 'Big gift', 'label.assign.giftSuper': 'Super gift', 'label.assign.toss': 'Toss flight',
    'btn.liveTest': 'Test live connection', 'btn.llmModels': 'Fetch models', 'btn.ttsModels': 'Fetch models', 'btn.asrModels': 'Fetch models', 'btn.ttsListen': 'Preview', 'btn.llmTest': 'Chat test', 'btn.micTest': 'Mic test', 'btn.asrTest': 'Connection test', 'btn.musicTest': 'Test music connection', 'btn.ttsVoices': 'Fetch voices', 'btn.liveGuide': 'Not sure? Open setup guide',
    'btn.ttsVoiceImport': 'Choose files',
    'label.ttsVoiceImport': 'Import custom voices', 'label.ttsVoiceImport.d': 'Import audio files as voice references for services that support voice cloning (e.g. Voicebox)',
    'label.ttsVoiceDrop': 'Drop audio files here', 'label.ttsVoiceDrop.d': 'Supports .wav / .mp3 / .ogg / .flac / .webm / .m4a / .aac and more',
    'label.llmApiKey': 'API Key', 'label.ttsApiKey': 'API Key', 'label.asrApiKey': 'API Key', 'label.ttsModel': 'Model', 'label.asrModel': 'Model',
    'label.llmApiKey.d': 'Leave blank for local Voicebox; stored in Windows secure storage.',
    'label.ttsApiKey.d': 'Secrets are stored in Windows secure storage.', 'label.ttsModel.d': 'Edge TTS uses edge-tts; Bailian and Voicebox can list models.',
    'label.asrApiKey.d': 'Leave blank for local Voicebox.', 'label.asrModel.d': 'Presets include model lists; this button reads from the active service.',
    'btn.gotoTestcenter': 'Open Test Center', 'btn.mockSpeak': 'Simulate speech', 'btn.testMusic': 'Test music', 'btn.goConfig': 'Configure', 'btn.saveRetry': 'Save & retry',
    'btn.addKeyword': '＋ Add keyword', 'btn.expand': 'Show all', 'btn.collapse': 'Collapse', 'btn.prev': 'Back', 'btn.next': 'Next', 'btn.done': 'Done', 'btn.openLink': 'Open link',
    'test.speakOn': 'Fafa will read this aloud', 'test.voiceSent': 'Simulated host speech', 'test.musicSent': 'Song request sent',
    'legend.mini': 'Mini', 'legend.std': 'Standard', 'legend.mute': 'Mute', 'legend.comfy': 'Comfy', 'legend.loud': 'Loud',
    'legend.calm': 'Steady', 'legend.sensitive': 'Sensitive', 'legend.gentle': 'Gentle', 'legend.strong': 'Strong',
    'prio.low': 'Low', 'prio.med': 'Medium', 'prio.high': 'High',
    'col.time': 'Time', 'col.time.hint': 'Reminder time', 'col.lines': 'Line', 'col.lines.hint': 'Reminder line',
    'col.action': 'Action', 'col.action.hint': 'Action to play', 'col.aliases': 'Aliases', 'col.aliases.hint': 'Words viewers type, comma separated',
    'col.reply': 'Reply', 'col.reply.hint': 'What Fafa says', 'col.priority': 'Priority', 'col.priority.hint': 'Higher runs first',
    'opt.adminOnly': 'Host only',
    'toast.saved': 'Auto-saved', 'toast.saveFailed': 'Save failed', 'toast.testOk': 'Connection test passed', 'toast.testFailed': 'Connection test failed',
    'toast.modelsFailed': 'Failed to fetch model list', 'toast.voicesFailed': 'Failed to fetch voice list', 'toast.musicResult': 'Music connection',
    'toast.mockConflictLive': 'Simulation and live connection cannot both be on; live connection was turned off',
    'toast.mockConflictMock': 'Live connection and simulation cannot both be on; simulation was turned off',
    'toast.mockTriggered': 'Triggered', 'toast.tempEnabled': 'Temporarily enabled; turn it off in the Voice & AI panel',
    'quick.strip': 'Quick enable', 'quick.tts': 'Quick enable: TTS', 'quick.llm': 'Quick enable: AI chat'
  }
}
function i18n(key) { return I18N.zh[key] ?? key }

function secretVisibilityIcon(visible) {
  return visible
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 3 18 18"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 4.2A10.8 10.8 0 0 1 12 4c6.2 0 9.5 8 9.5 8a17.7 17.7 0 0 1-3 4.2"/><path d="M6.6 6.6A17.3 17.3 0 0 0 2.5 12s3.3 8 9.5 8a9.8 9.8 0 0 0 3.4-.6"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 12S5.8 4 12 4s9.5 8 9.5 8-3.3 8-9.5 8S2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.8"/></svg>'
}

function setSecretVisibility(input, visible) {
  if (!input) return
  const button = input.closest('.secret-input')?.querySelector('.secret-visibility-toggle')
  const fieldName = input.closest('.field')?.querySelector(':scope > span')?.textContent?.trim() || '密钥内容'
  input.type = visible ? 'text' : 'password'
  if (!button) return
  button.innerHTML = secretVisibilityIcon(visible)
  button.title = visible ? '隐藏' : '显示'
  button.setAttribute('aria-pressed', String(visible))
  button.setAttribute('aria-label', (visible ? '隐藏 ' : '显示 ') + fieldName)
}

function bindSecretVisibilityToggles() {
  for (const input of document.querySelectorAll('input[type="password"]')) {
    if (input.closest('.secret-input')) continue
    const slot = document.createElement('div')
    slot.className = 'secret-input'
    input.before(slot)
    slot.append(input)
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'secret-visibility-toggle'
    button.addEventListener('click', () => setSecretVisibility(input, input.type === 'password'))
    input.addEventListener('input', () => { input.dataset.secretDirty = 'true' })
    slot.append(button)
    setSecretVisibility(input, false)
  }
}
bindSecretVisibilityToggles()

const themeToggle = document.querySelector('#theme-toggle')
let currentTheme = 'light'
function setTheme(theme) {
  currentTheme = theme === 'dark' ? 'dark' : 'light'
  document.documentElement.dataset.theme = currentTheme
  document.documentElement.style.colorScheme = currentTheme
  const nextTheme = currentTheme === 'dark' ? '浅色主题' : '深色主题'
  themeToggle.textContent = '切换为' + nextTheme
  themeToggle.setAttribute('aria-label', '切换为' + nextTheme)
  themeToggle.setAttribute('title', '切换为' + nextTheme)
  themeToggle.setAttribute('aria-pressed', String(currentTheme === 'dark'))
}

/* ---- panel titles (7) ---- */
const panelMeta = {
  overview: ['panel.overview', 'panel.overview.d'],
  general: ['panel.general', 'panel.general.d'],
  live: ['panel.live', 'panel.live.d'],
  avatar: ['panel.avatar', 'panel.avatar.d'],
  ai: ['panel.ai', 'panel.ai.d'],
  relationship: ['panel.relationship', 'panel.relationship.d'],
  schedule: ['panel.schedule', 'panel.schedule.d'],
  actions: ['panel.actions', 'panel.actions.d'],
  diagnostics: ['panel.diagnostics', 'panel.diagnostics.d'],
  assign: ['panel.assign', 'panel.assign.d'],
  testcenter: ['panel.testcenter', 'panel.testcenter.d']
}
function applyPanelTitle(tab) {
  const meta = panelMeta[tab] || ['nav.' + tab, '']
  document.querySelector('#page-title').textContent = i18n(meta[0])
  document.querySelector('#page-description').textContent = i18n(meta[1])
}

for (const button of document.querySelectorAll('nav button')) button.addEventListener('click', () => {
  const tab = button.dataset.tab
  const activeButton = document.querySelector('nav button.active')
  activeButton?.classList.remove('active')
  activeButton?.removeAttribute('aria-current')
  button.classList.add('active')
  button.setAttribute('aria-current', 'page')
  document.querySelector('section.active')?.classList.remove('active')
  document.querySelector('[data-panel="' + tab + '"]').classList.add('active')
  applyPanelTitle(tab)
  if (tab === 'live') initConsole()
})

/* ============================================================
   Toast system
   ============================================================ */
const toastRegion = document.querySelector('#toast-region')
function toast(message, tone = 'info', title = '') {
  const el = document.createElement('div')
  el.className = 'toast ' + tone
  el.innerHTML = title ? '<b>' + escapeHtml(title) + '</b><span>' + escapeHtml(message) + '</span>' : '<span>' + escapeHtml(message) + '</span>'
  toastRegion.append(el)
  requestAnimationFrame(() => el.classList.add('show'))
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 250) }, 4000)
}

/* ============================================================
   Provider presets + model/voice selects
   ============================================================ */
function presetOptions(service) {
  const presets = providerCatalog?.[service] || []
  return presets.map(p => '<option value="' + escapeAttribute(p.id) + '">' + escapeAttribute(p.label) + '</option>').join('')
}
function findProviderPreset(service, id) {
  return (providerCatalog?.[service] || []).find(p => p.id === id) || null
}
function applyProviderPreset(service) {
  const select = form.elements[service + 'Preset']; if (!select) return
  const preset = findProviderPreset(service, select.value)
  if (!preset || preset.id === 'custom') return
  const fields = preset.fields || {}
  const fieldMap = { tts:{baseUrl:'ttsBaseUrl',model:'ttsModel',voice:'ttsVoice'}, llm:{baseUrl:'llmBaseUrl',model:'llmModel'}, asr:{baseUrl:'asrBaseUrl',model:'asrModel'} }[service] || {}
  for (const [fieldName, inputName] of Object.entries(fieldMap)) {
    if (!fields[fieldName] || !form.elements[inputName]) continue
    form.elements[inputName].value = fields[fieldName]
    if (inputName === 'llmModel') syncModelSelectValue(fields[fieldName])
    if (inputName === 'ttsModel') syncTtsModelValue(fields[fieldName])
    if (inputName === 'asrModel') syncAsrModelValue(fields[fieldName])
    if (inputName === 'ttsVoice') syncVoiceSelectValue(fields[fieldName])
  }
  if (service === 'llm') updateLlmBaseUrlVisibility()
}
let llmModelsCache = []
function populateLlmModelSelect(conf) {
  const select = form.elements.llmModelSelect || form.elements.llmModel; if (!select) return
  const current = (conf && conf.model) || config.llm?.model || ''
  const seen = new Set(); const options = []
  for (const id of (llmModelsCache || [])) { if (seen.has(id)) continue; seen.add(id); options.push({ value:id, label:id }) }
  const def = llmPresetDefaultModel()
  if (def && !options.some(o => o.value === def)) options.unshift({ value:def, label:'预设默认模型：' + def })
  if (current && !seen.has(current)) options.unshift({ value:current, label:'当前已配置模型：' + current })
  select.replaceChildren()
  for (const o of options) select.append(new Option(o.label, o.value))
  if (!options.length) select.append(new Option('尚未获取模型列表，请点击「获取模型列表」', ''))
  if (current && [...select.options].some(o => o.value === current)) select.value = current
}
function llmPresetDefaultModel() {
  const preset = form.elements.llmPreset?.value
  if (preset === 'deepseek') return 'deepseek-chat'
  if (preset === 'aliyun-bailian') return 'qwen-plus'
  return (findProviderPreset('llm', preset)?.fields?.model) || ''
}
function syncModelSelectValue(value) {
  const select = form.elements.llmModelSelect || form.elements.llmModel; if (!select || !value) return
  if (![...select.options].some(o => o.value === value)) select.append(new Option('当前已配置模型：' + value, value))
  select.value = value
}
function resolveLlmModel() { return (form.elements.llmModelSelect || form.elements.llmModel)?.value.trim() || '' }
function updateLlmBaseUrlVisibility() {
  const field = document.querySelector('#llm-baseurl-field'); if (!field) return
  field.hidden = form.elements.llmPreset?.value !== 'custom'
}

let ttsModelsCache = []
function populateTtsModelSelect(conf) {
  const select = form.elements.ttsModelSelect || form.elements.ttsModel; if (!select) return
  const current = (conf && conf.model) || config.tts?.model || ''
  const preset = findProviderPreset('tts', form.elements.ttsPreset?.value || '')
  const seed = preset?.models || []
  select.replaceChildren()
  for (const id of new Set([...seed, ...(ttsModelsCache || [])])) select.append(new Option(id, id))
  if (current && ![...select.options].some((option) => option.value === current)) select.append(new Option('当前模型：' + current, current))
  if (!select.options.length) select.append(new Option('尚未获取模型，请点击「获取模型」', ''))
  if (current && [...select.options].some((option) => option.value === current)) select.value = current
}
function syncTtsModelValue(value) {
  const select = form.elements.ttsModelSelect || form.elements.ttsModel; if (!select || !value) return
  if (![...select.options].some((option) => option.value === value)) select.append(new Option('当前模型：' + value, value))
  select.value = value
}
function resolveTtsModel() { return (form.elements.ttsModelSelect || form.elements.ttsModel)?.value.trim() || '' }

let asrModelsCache = []
function populateAsrModelSelect(conf) {
  const select = form.elements.asrModelSelect || form.elements.asrModel; if (!select) return
  const current = (conf && conf.model) || config.asr?.model || ''
  const preset = findProviderPreset('asr', form.elements.asrPreset?.value || '')
  const seed = preset?.models || []
  select.replaceChildren()
  for (const id of new Set([...seed, ...(asrModelsCache || [])])) select.append(new Option(id, id))
  if (current && ![...select.options].some((option) => option.value === current)) select.append(new Option('当前模型：' + current, current))
  if (!select.options.length) select.append(new Option('尚未获取模型，请点击「获取模型」', ''))
  if (current && [...select.options].some((option) => option.value === current)) select.value = current
}
function syncAsrModelValue(value) {
  const select = form.elements.asrModelSelect || form.elements.asrModel; if (!select || !value) return
  if (![...select.options].some((option) => option.value === value)) select.append(new Option('当前模型：' + value, value))
  select.value = value
}
function resolveAsrModel() { return (form.elements.asrModelSelect || form.elements.asrModel)?.value.trim() || '' }
let ttsVoicesCache = []
function customVoiceNames(conf) {
  const list = (conf && conf.customVoices) || config.tts?.customVoices || []
  return (Array.isArray(list) ? list : []).map((voice) => voice?.name).filter((name) => typeof name === 'string' && name.trim())
}
function populateTtsVoiceSelect(conf) {
  const select = form.elements.ttsVoiceSelect || document.querySelector('#ttsVoiceSelect'); if (!select) return
  const current = (conf && conf.voice) || config.tts?.voice || ''
  const customs = customVoiceNames(conf)
  select.replaceChildren()
  const seen = new Set()
  if (customs.length) {
    const group = document.createElement('optgroup')
    group.label = '导入的自定义音色'
    for (const name of customs) { if (seen.has(name)) continue; seen.add(name); group.append(new Option(name, name)) }
    select.append(group)
  }
  for (const id of (ttsVoicesCache || [])) { if (seen.has(id)) continue; seen.add(id); select.append(new Option(id, id)) }
  if (current && !seen.has(current)) select.append(new Option('当前音色：' + current, current))
  select.append(new Option('自定义音色', '__custom__'))
  syncVoiceSelectValue(current)
}
function syncVoiceSelectValue(value) {
  const select = form.elements.ttsVoiceSelect || document.querySelector('#ttsVoiceSelect')
  const customInput = form.elements.ttsVoiceCustom
  if (!select) return
  if (!value) { select.value = ''; return }
  if (![...select.options].some(o => o.value === value && o.value !== '__custom__')) select.append(new Option('当前音色：' + value, value))
  select.value = value
  if (customInput) customInput.value = value
  updateTtsVoiceCustomVisibility()
}
function resolveTtsVoice() {
  const select = form.elements.ttsVoiceSelect || document.querySelector('#ttsVoiceSelect')
  if (!select) return ''
  return select.value === '__custom__' ? (form.elements.ttsVoiceCustom?.value || '').trim() : select.value
}
function updateTtsVoiceCustomVisibility() {
  const field = document.querySelector('#tts-voice-custom-field'); const select = form.elements.ttsVoiceSelect || document.querySelector('#ttsVoiceSelect')
  if (!field || !select) return
  field.hidden = select.value !== '__custom__'
}
function updateVoiceboxHints() {
  const isVoicebox = (service) => form.elements[service + 'Preset']?.value === 'voicebox'
  const isAliyun = (service) => form.elements[service + 'Preset']?.value === 'aliyun-bailian'
  const dialogIsVoicebox = Boolean(serviceConfigPreset && serviceConfigPreset.value === 'voicebox')
  const dialogIsAliyun = Boolean(serviceConfigPreset && serviceConfigPreset.value === 'aliyun-bailian')
  for (const el of document.querySelectorAll('.voicebox-hint')) {
    const key = el.dataset.voiceboxHint
    let show = false
    if (key === 'ttsBaseUrl' || key === 'ttsVoice') show = isVoicebox('tts')
    else if (key === 'asrBaseUrl') show = isVoicebox('asr')
    else if (key === 'llmBaseUrl') show = isVoicebox('llm')
    else if (key === 'dialogBaseUrl' || key === 'dialogVoice') show = dialogIsVoicebox
    el.hidden = !show
  }
  for (const el of document.querySelectorAll('.aliyun-hint')) {
    const key = el.dataset.aliyunHint
    let show = false
    if (key === 'ttsVoice') show = isAliyun('tts')
    else if (key === 'dialogVoice') show = dialogIsAliyun
    el.hidden = !show
  }
}

/* ============================================================
   Action option lists (Chinese + special)
   ============================================================ */
const SPECIAL_ACTIONS = [
  { id:'lottery_join', label:'抽奖（加入）' },
  { id:'lottery_draw', label:'开奖' },
  { id:'game_rps', label:'猜拳' },
  { id:'game_lots', label:'抽签' }
]
function allActionOptions() {
  const reg = (actionEntries || []).filter(a => a.enabled !== false).map(a => ({ id:a.id, label:a.label }))
  const special = SPECIAL_ACTIONS.filter(s => !reg.some(r => r.id === s.id))
  return [...reg, ...special]
}
function actionOptionsHtml(selectedId) {
  return allActionOptions().map(a => '<option value="' + escapeAttribute(a.id) + '"' + (a.id === selectedId ? ' selected' : '') + '>' + escapeAttribute(a.label) + '（' + escapeAttribute(a.id) + '）</option>').join('')
}

/* ============================================================
   fill(c)
   ============================================================ */
function renderPetPackageOptions(c = config) {
  const select = form.elements.petPackageId
  const status = document.querySelector('#pet-package-status small')
  if (!select) return
  select.replaceChildren()
  for (const entry of petPackageEntries) {
    const suffix = entry.source === 'builtin' ? '（内置）' : entry.valid ? '' : '（校验失败）'
    const option = new Option(`${entry.displayName || entry.id}${suffix}`, entry.id)
    option.disabled = entry.valid === false
    select.append(option)
  }
  const activeId = c.pet?.activePackageId || 'fafa'
  if (![...select.options].some((option) => option.value === activeId)) select.append(new Option(`${activeId}（未找到）`, activeId))
  select.value = activeId
  const active = petPackageEntries.find((entry) => entry.id === activeId)
  if (status) status.textContent = active?.valid === false
    ? `角色包校验失败：${active.error || '未知错误'}；运行时会安全回退到内置发发。`
    : active
      ? `${active.displayName} ${active.version || ''} · ${active.source === 'builtin' ? '内置角色包' : '外部角色包已通过校验'}`
      : '未找到所选角色包；运行时会安全回退到内置发发。'
}

function fill(c) {
  renderPetPackageOptions(c)
  const values = {
    scale:c.scale, volume:c.volume, alwaysOnTop:c.alwaysOnTop, clickThrough:c.clickThrough,
    transparentHitThrough:c.interaction.transparentHitThrough, pettingEnabled:c.interaction.pettingEnabled,
    pettingSensitivity:c.interaction.pettingSensitivity, tossEnabled:c.interaction.tossEnabled, tossStrength:c.interaction.tossStrength,
    launchAtLogin:c.launchAtLogin, liveEnabled:c.liveEnabled, liveMock:c.liveMock,
    livePlatform:c.livePlatform || 'bilibili', roomId:c.roomId, broadcasterUid:c.broadcasterUid,
    youtubeVideoId:c.youtube?.videoId || '', youtubeLiveChatId:c.youtube?.liveChatId || '', petPackageId:c.pet?.activePackageId || 'fafa', ttsEnabled:c.tts.enabled,
    ttsModel:c.tts.model, ttsBaseUrl:c.tts.baseUrl, llmEnabled:c.llm.enabled,
    llmBaseUrl:c.llm.baseUrl, llmPersonaPrompt:c.llm.personaPrompt || '', ttsSpeed:c.tts.speed, llmReasoning:c.llm.reasoning,
    ttsPreset:c.tts.preset, llmPreset:c.llm.preset,
    asrEnabled:c.asr.enabled, asrPreset:c.asr.preset, asrBaseUrl:c.asr.baseUrl, asrModel:c.asr.model,
    avatarLive2dModel: c.avatar?.live2d?.activeModelId || '',
    avatarVtsEnabled: false,
    avatarVtsHost: c.avatar?.vtubeStudio?.host || '127.0.0.1',
    avatarVtsPort: c.avatar?.vtubeStudio?.port ?? 8001,
    avatarVtsPluginName: c.avatar?.vtubeStudio?.pluginName || 'fafa-desktop-pet',
    avatarVtsDeveloper: c.avatar?.vtubeStudio?.pluginDeveloper || 'Fafa',
    voiceEnabled:c.voice.enabled, voiceDeviceId:c.voice.deviceId, voicePushToTalkKey:c.voice.pushToTalkKey || 'F8',
    voiceThreshold:c.voice.threshold, voiceSensitivity:c.voice.sensitivity, voiceReactionCooldownMs:c.voice.reactionCooldownMs,
    voiceWakeWordEnabled:c.voice.wakeWordEnabled, nameReact:c.interaction.nameReact,
    dockEnabled:c.dock.enabled, hourlyChime:c.schedule.hourlyChime,
    safetyEnabled: c.safety?.enabled !== false,
    liveDanmaku: c.liveEvents?.danmaku !== false, liveGift: c.liveEvents?.gift !== false,
    liveSuperChat: c.liveEvents?.superChat !== false, liveGuard: c.liveEvents?.guard !== false,
    applauseEnabled: c.applause?.enabled === true
  }
  for (const [name, value] of Object.entries(values)) {
    const input = form.elements[name]; if (!input) continue
    if (input.type === 'checkbox') input.checked = Boolean(value); else input.value = value ?? ''
  }
  const pushToTalkButton = document.querySelector('#push-to-talk-key')
  if (pushToTalkButton) pushToTalkButton.textContent = normalizePushToTalkKey(c.voice?.pushToTalkKey)
  populateLlmModelSelect(c.llm)
  populateTtsVoiceSelect(c.tts)
  populateTtsModelSelect(c.tts)
  populateAsrModelSelect(c.asr)
  renderSafetyKeywords(c.safety?.keywords || [])
  renderAssignGroups(c)
  renderAvatarModels(c)
  const quickTts = form.elements.ttsEnabledQuick; if (quickTts) quickTts.checked = Boolean(c.tts?.enabled)
  const musicVolume = form.elements.musicTestVolume; if (musicVolume) musicVolume.value = Number(c.music?.volume ?? 80)
  const memoryStatus = document.querySelector('#llm-memory-status')
  if (memoryStatus) memoryStatus.textContent = '本地记忆：最多保存 400 条，只检索最相关的 3 条；模型未加载时不会联网下载。'
  syncMusicVolumeOutput()
  updateLlmBaseUrlVisibility(); updateTtsVoiceCustomVisibility(); updateVoiceboxHints()
  for (const name of ['llmInputSource', 'ttsReplyScope', 'avatarMode']) {
    const value = name === 'llmInputSource' ? c.llm.inputSource : name === 'ttsReplyScope' ? c.tts.replyScope : 'video'
    const checked = form.querySelector('input[name="' + name + '"][value="' + value + '"]')
    if (checked) checked.checked = true
  }
  setTheme(c.ui?.theme)
  updateRangeOutputs()
  renderCommands(c.commands)
  renderReminders(c.schedule?.reminders || [])
  renderSignalLights(c)
  syncAvatarModePanels('video')
  syncLivePlatformFields()
}

function syncLivePlatformFields() {
  const platform = form.elements.livePlatform?.value || 'bilibili'
  for (const block of document.querySelectorAll('[data-live-platform-block]')) {
    block.hidden = block.dataset.livePlatformBlock !== platform
  }
}

form.elements.livePlatform?.addEventListener('change', syncLivePlatformFields)

function updateRangeOutputs() {
  setRangeOutput('#scale-output', Math.round(Number(form.elements.scale.value) * 100) + '%')
  setRangeOutput('#volume-output', Math.round(Number(form.elements.volume.value) * 100) + '%')
  setRangeOutput('#petting-output', multiplierLabel(Number(form.elements.pettingSensitivity.value)))
  setRangeOutput('#toss-output', multiplierLabel(Number(form.elements.tossStrength.value)))
  setRangeOutput('#voice-threshold-output', String(Math.round(Number(form.elements.voiceThreshold.value) || 35)))
  setRangeOutput('#voice-sensitivity-output', Number(form.elements.voiceSensitivity.value || 1).toFixed(1) + '×')
  setRangeOutput('#tts-speed-output', 'x' + Number(form.elements.ttsSpeed.value).toFixed(1))
}
function setRangeOutput(selector, value) {
  const output = document.querySelector(selector)
  if (!output) return
  output.value = value
  output.textContent = value
}
function multiplierLabel(value) {
  const label = value < .85 ? '稳妥' : value > 1.25 ? '灵敏' : '标准'
  return (Number(value) || 1).toFixed(1) + '× · ' + label
}
for (const name of ['scale', 'volume', 'pettingSensitivity', 'tossStrength', 'voiceThreshold', 'voiceSensitivity', 'ttsSpeed']) {
  form.elements[name]?.addEventListener('input', updateRangeOutputs)
}

function normalizePushToTalkKey(value) {
  const key = String(value || '').trim().toUpperCase()
  return /^(F(?:[1-9]|1[0-2])|[A-Z]|[0-9]|SPACE)$/.test(key) ? key : 'F8'
}
function keyFromKeyboardEvent(event) {
  if (event.code === 'Space') return 'SPACE'
  if (/^F(?:[1-9]|1[0-2])$/.test(event.key)) return event.key.toUpperCase()
  if (/^[a-z0-9]$/i.test(event.key)) return event.key.toUpperCase()
  return ''
}
const pushToTalkButton = document.querySelector('#push-to-talk-key')
const pushToTalkStatus = document.querySelector('#push-to-talk-status')
let capturingPushToTalkKey = false
pushToTalkButton?.addEventListener('click', () => {
  capturingPushToTalkKey = true
  pushToTalkButton.classList.add('is-capturing')
  pushToTalkButton.textContent = '请按一个键…'
  pushToTalkStatus.textContent = '按 Esc 取消'
  pushToTalkButton.focus()
})
window.addEventListener('keydown', (event) => {
  if (!capturingPushToTalkKey) return
  event.preventDefault()
  event.stopPropagation()
  if (event.key === 'Escape') {
    capturingPushToTalkKey = false
    pushToTalkButton?.classList.remove('is-capturing')
    const key = normalizePushToTalkKey(form.elements.voicePushToTalkKey?.value)
    if (pushToTalkButton) pushToTalkButton.textContent = key
    if (pushToTalkStatus) pushToTalkStatus.textContent = '按住 ' + key + ' 开始识别'
    return
  }
  const key = keyFromKeyboardEvent(event)
  if (!key) return
  capturingPushToTalkKey = false
  form.elements.voicePushToTalkKey.value = key
  pushToTalkButton?.classList.remove('is-capturing')
  if (pushToTalkButton) pushToTalkButton.textContent = key
  if (pushToTalkStatus) pushToTalkStatus.textContent = '按住 ' + key + ' 开始识别'
  scheduleAutoSave(0)
})
window.fafa.voice?.onPushToTalk?.(({ active, key } = {}) => {
  if (!pushToTalkStatus || capturingPushToTalkKey) return
  const currentKey = normalizePushToTalkKey(key || form.elements.voicePushToTalkKey?.value)
  pushToTalkStatus.textContent = active ? '正在识别，松开 ' + currentKey + ' 后发送' : '按住 ' + currentKey + ' 开始识别'
})

/* ============================================================
   Commands / reminders rows (Chinese selects + hints)
   ============================================================ */
/* 停用动作（如自我介绍）不再出现在指令与提醒下拉里，旧配置中的相关行直接隐藏。 */
function commandEnabled(command) {
  const entry = (actionEntries || []).find(a => a.id === command?.actionId)
  return !entry || entry.enabled !== false
}
function commandRow(command = { aliases:['新指令'], actionId:'act_greet', text:'收到啦～', priority:50 }) {
  const row = document.createElement('div')
  row.className = 'command-row'
  const prioVal = Number(command.priority ?? 50)
  row.innerHTML =
    '<div class="row-field"><input data-command="aliases" aria-label="触发别名" value="' + escapeAttribute((command.aliases || []).join('，')) + '" placeholder="触发别名"><small class="row-hint">' + escapeHtml(i18n('col.aliases.hint')) + '</small></div>' +
    '<div class="row-field"><select data-command="actionId" aria-label="动作">' + actionOptionsHtml(command.actionId || 'act_greet') + '</select><small class="row-hint">' + escapeHtml(i18n('col.action.hint')) + '</small></div>' +
    '<div class="row-field"><input data-command="text" aria-label="回复台词" value="' + escapeAttribute(command.text || '') + '" placeholder="回复台词"><small class="row-hint">' + escapeHtml(i18n('col.reply.hint')) + '</small></div>' +
    '<div class="row-field"><select data-command="priority" aria-label="优先级">' +
      '<option value="30"' + (prioVal === 30 ? ' selected' : '') + '>' + escapeHtml(i18n('prio.low')) + '</option>' +
      '<option value="50"' + (prioVal === 50 ? ' selected' : '') + '>' + escapeHtml(i18n('prio.med')) + '</option>' +
      '<option value="80"' + (prioVal === 80 ? ' selected' : '') + '>' + escapeHtml(i18n('prio.high')) + '</option>' +
    '</select><small class="row-hint">' + escapeHtml(i18n('col.priority.hint')) + '</small></div>' +
    '<div class="row-field row-tools"><label class="row-check"><input data-command="adminOnly" type="checkbox"' + (command.adminOnly ? ' checked' : '') + '><span>' + escapeHtml(i18n('opt.adminOnly')) + '</span></label>' +
    '<button class="remove-command" type="button" title="删除指令" aria-label="删除指令">×</button></div>'
  row.querySelector('.remove-command').addEventListener('click', () => { row.remove(); scheduleAutoSave(0) })
  return row
}
function reminderRow(reminder = { time:'', text:'', actionId:'act_greet', id:crypto.randomUUID(), enabled:true }) {
  const row = document.createElement('div')
  row.className = 'reminder-row'
  row.dataset.reminderId = reminder.id || crypto.randomUUID()
  row.dataset.reminderEnabled = reminder.enabled === false ? 'false' : 'true'
  row.innerHTML =
    '<div class="row-field"><input data-reminder="time" type="time" aria-label="时间" value="' + escapeAttribute(reminder.time || '') + '"><small class="row-hint">' + escapeHtml(i18n('col.time.hint')) + '</small></div>' +
    '<div class="row-field"><input data-reminder="text" aria-label="台词" value="' + escapeAttribute(reminder.text || '') + '" placeholder="提醒台词"><small class="row-hint">' + escapeHtml(i18n('col.lines.hint')) + '</small></div>' +
    '<div class="row-field"><select data-reminder="actionId" aria-label="动作">' + actionOptionsHtml(reminder.actionId || 'act_greet') + '</select><small class="row-hint">' + escapeHtml(i18n('col.action.hint')) + '</small></div>' +
    '<div class="row-field"><button class="remove-reminder" type="button" title="删除提醒" aria-label="删除提醒">×</button></div>'
  row.querySelector('.remove-reminder').addEventListener('click', () => { row.remove(); scheduleAutoSave(0) })
  return row
}
function renderCommands(commands) { document.querySelector('#command-list').replaceChildren(...(commands || []).filter(command => commandEnabled(command)).map(commandRow)) }
function renderReminders(reminders) { document.querySelector('#reminder-list').replaceChildren(...(reminders || []).filter(reminder => commandEnabled(reminder)).map(reminderRow)) }

function collectCommands() {
  return [...document.querySelectorAll('.command-row')].map(row => ({
    aliases: row.querySelector('[data-command=aliases]').value.split(/[，,]/).map(v => v.trim()).filter(Boolean),
    actionId: row.querySelector('[data-command=actionId]').value.trim() || 'act_greet',
    text: row.querySelector('[data-command=text]').value.trim(),
    priority: Math.max(0, Math.min(100, Number(row.querySelector('[data-command=priority]').value) || 0)),
    ...(row.querySelector('[data-command=adminOnly]').checked ? { adminOnly:true } : {})
  })).filter(c => c.aliases.length)
}
function collectReminders() {
  return [...document.querySelectorAll('.reminder-row')].map(row => ({
    id: row.dataset.reminderId,
    time: row.querySelector('[data-reminder=time]').value.trim(),
    text: row.querySelector('[data-reminder=text]').value.trim(),
    actionId: row.querySelector('[data-reminder=actionId]').value.trim() || 'act_greet',
    enabled: row.dataset.reminderEnabled !== 'false'
  })).filter(r => r.time && r.text)
}

/* ---- idle set ---- */
function idleActions() { return (actionEntries || []).filter(a => (a.category === 'idle' || a.category === 'random') && a.enabled !== false) }

/* ============================================================
   Long-list collapse: show N items, expand the rest on demand
   ============================================================ */
function capList(container, max, label = '') {
  const items = [...container.children].filter((el) => !el.classList.contains('list-more'))
  if (items.length <= max) return
  items.slice(max).forEach((el) => { el.hidden = true })
  const more = document.createElement('button')
  more.type = 'button'
  more.className = 'secondary list-more'
  more.textContent = (label || i18n('btn.expand')) + '（' + items.length + '）'
  more.addEventListener('click', () => {
    items.forEach((el) => { el.hidden = false })
    more.remove()
  })
  container.append(more)
}

/* ============================================================
   Safety keyword list
   ============================================================ */
const safetyKeywordList = document.querySelector('#safety-keyword-list')
function keywordRow(keyword = '') {
  const row = document.createElement('div')
  row.className = 'keyword-row'
  row.innerHTML = '<input data-keyword type="text" maxlength="50" placeholder="例如：加微信" value="' + escapeAttribute(keyword) + '"><button class="remove-keyword" type="button" title="删除" aria-label="删除敏感词">×</button>'
  row.querySelector('.remove-keyword').addEventListener('click', () => { row.remove(); capList(safetyKeywordList, 8, i18n('btn.expand')); scheduleAutoSave(0) })
  return row
}
function renderSafetyKeywords(keywords) {
  if (!safetyKeywordList) return
  safetyKeywordList.replaceChildren(...(keywords || []).map(keywordRow))
  capList(safetyKeywordList, 8, i18n('btn.expand'))
}
document.querySelector('#add-safety-keyword')?.addEventListener('click', () => {
  if (!safetyKeywordList) return
  safetyKeywordList.append(keywordRow())
  capList(safetyKeywordList, 8, i18n('btn.expand'))
  scheduleAutoSave(0)
})
if (safetyKeywordList) safetyKeywordList.addEventListener('input', (e) => {
  if (e.target.matches('input[data-keyword]')) scheduleAutoSave(450)
})

/* ============================================================
   Action assignment groups
   ============================================================ */
const ASSIGN_GROUPS = [
  { id: 'idle', input: 'idleSet.actions', desc: '' },
  { id: 'click', input: 'actionAssign.click', desc: '' },
  { id: 'petting', input: 'actionAssign.petting', desc: '' },
  { id: 'belly', input: 'actionAssign.belly', desc: '' },
  { id: 'danmaku', input: 'actionAssign.danmaku', desc: '' },
  { id: 'voice', input: 'actionAssign.voice', desc: '' },
  { id: 'voiceShout', input: 'actionAssign.voiceShout', desc: '' },
  { id: 'voiceNoisy', input: 'actionAssign.voiceNoisy', desc: '' },
  { id: 'special', input: 'actionAssign.special', desc: '' },
  { id: 'lottery', input: 'actionAssign.lottery', desc: '' },
  { id: 'enter', input: 'actionAssign.enter', desc: '' },
  { id: 'session', input: 'actionAssign.session', desc: '' },
  { id: 'gift', input: 'actionAssign.gift', desc: '' },
  { id: 'giftMedium', input: 'actionAssign.giftMedium', desc: '' },
  { id: 'giftBig', input: 'actionAssign.giftBig', desc: '' },
  { id: 'giftSuper', input: 'actionAssign.giftSuper', desc: '' },
  { id: 'superChat', input: 'actionAssign.superChat', desc: '' },
  { id: 'guard', input: 'actionAssign.guard', desc: '' },
  { id: 'toss', input: 'actionAssign.toss', desc: '' }
]
function assignGroupValue(c, group) {
  if (group === 'idle') return c.idleSet?.actions || []
  if (group === 'click') {
    const assigned = c.actionAssign?.click
    if (Array.isArray(assigned) && assigned.length) return assigned
    return c.interaction?.clickActions || []
  }
  return c.actionAssign?.[group] || []
}
function renderAssignGroups(c) {
  for (const group of ASSIGN_GROUPS) {
    const list = document.querySelector('#assign-' + group.id)
    if (!list) continue
    const pool = group.id === 'idle' ? idleActions() : (actionEntries || []).filter((a) => a.enabled !== false && a.category !== 'state')
    const selected = new Set(assignGroupValue(c, group))
    list.replaceChildren(...pool.map((a) => {
      const label = document.createElement('label')
      label.className = 'idle-check'
      label.innerHTML = '<input type="checkbox" data-assign="' + escapeAttribute(group.id) + '" value="' + escapeAttribute(a.id) + '"' + (selected.has(a.id) ? ' checked' : '') + '><i></i><span>' + escapeHtml(a.label) + '</span>'
      return label
    }))
    capList(list, 8, i18n('btn.expand'))
  }
}
function collectAssignGroup(group) {
  const list = document.querySelector('#assign-' + group)
  if (!list) return []
  return [...list.querySelectorAll('input[data-assign="' + group + '"]:checked')].map((i) => i.value)
}
for (const group of ASSIGN_GROUPS) {
  const list = document.querySelector('#assign-' + group.id)
  list?.addEventListener('change', () => scheduleAutoSave(0))
  document.querySelector('#assign-' + group.id + '-all')?.addEventListener('click', () => {
    list?.querySelectorAll('input[data-assign]').forEach((i) => { i.checked = true })
    scheduleAutoSave(0)
  })
  document.querySelector('#assign-' + group.id + '-none')?.addEventListener('click', () => {
    list?.querySelectorAll('input[data-assign]').forEach((i) => { i.checked = false })
    scheduleAutoSave(0)
  })
}

/* ============================================================
   Avatar panel: Live2D model library + VTube Studio API
   ============================================================ */
async function refreshPetPackages() {
  const button = document.querySelector('#pet-package-rescan')
  if (button) button.disabled = true
  try {
    petPackageEntries = await window.fafa.petPackages.list()
    renderPetPackageOptions(config)
    toast('角色包目录已重新扫描', 'success')
  } catch (error) {
    toast('角色包扫描失败：' + error.message, 'error')
  } finally {
    if (button) button.disabled = false
  }
}

document.querySelector('#pet-package-rescan')?.addEventListener('click', refreshPetPackages)
document.querySelector('#pet-package-open-folder')?.addEventListener('click', async () => {
  const error = await window.fafa.petPackages.openFolder()
  if (error) toast('无法打开角色包目录：' + error, 'error')
})
form.elements.petPackageId?.addEventListener('change', () => renderPetPackageOptions({ ...config, pet: { activePackageId: form.elements.petPackageId.value } }))

let avatarModels = []
function syncAvatarModePanels(mode = collectRadioValue('avatarMode') || 'video') {
  const normalized = 'video'
  for (const [selector, visible] of [['#live2d-panel', normalized === 'live2d'], ['#vts-panel', normalized === 'vts']]) {
    const panel = document.querySelector(selector)
    if (!panel) continue
    panel.hidden = !visible
    panel.setAttribute('aria-hidden', String(!visible))
  }
}
const avatarUnavailableDialog = document.querySelector('#avatar-unavailable-dialog')
for (const card of document.querySelectorAll('[data-avatar-unavailable]')) {
  card.addEventListener('click', () => avatarUnavailableDialog?.showModal())
}
function setAvatarResult(box, message, tone = '') {
  if (!box) return
  box.textContent = message
  box.className = 'dialog-reply ' + tone
}
function avatarModelLabel(model) {
  const bits = []
  if (model?.modelJson) bits.push('model3.json')
  if (model?.moc3) bits.push('moc3')
  bits.push((model?.textureCount || 0) + ' 贴图')
  bits.push((model?.motionCount || 0) + ' 动作')
  bits.push((model?.expressionCount || 0) + ' 表情')
  return bits.join(' · ')
}
function renderAvatarModels(c = config) {
  avatarModels = Array.isArray(c.avatar?.live2d?.models) ? c.avatar.live2d.models : []
  const select = form.elements.avatarLive2dModel
  if (select) {
    const activeId = c.avatar?.live2d?.activeModelId || ''
    select.replaceChildren()
    if (!avatarModels.length) select.append(new Option('尚未导入模型', ''))
    for (const model of avatarModels) select.append(new Option(model.name + '（' + model.id + '）', model.id))
    if (activeId && [...select.options].some((option) => option.value === activeId)) select.value = activeId
  }
  const list = document.querySelector('#avatar-model-list')
  const vtsSelect = document.querySelector('#avatar-vts-model-select')
  if (vtsSelect && vtsSelect.options.length) {
    const vtsModelId = c.avatar?.vtubeStudio?.modelId || ''
    if (vtsModelId && [...vtsSelect.options].some((option) => option.value === vtsModelId)) vtsSelect.value = vtsModelId
  }
  if (list) {
    list.replaceChildren()
    for (const model of avatarModels) {
      const row = document.createElement('div')
      row.className = 'avatar-model-card'
      row.dataset.modelId = model.id
      row.innerHTML =
        '<div class="avatar-model-card-main"><b>' + escapeHtml(model.name) + '</b><small>' + escapeHtml(model.id) + '</small><span class="avatar-model-meta">' + escapeHtml(avatarModelLabel(model)) + '</span></div>' +
        '<div class="avatar-model-card-actions"><button class="secondary" type="button" data-avatar-action="select">设为当前</button><button class="secondary danger" type="button" data-avatar-action="remove">删除</button></div>'
      row.querySelector('[data-avatar-action=select]').addEventListener('click', () => {
        if (select) select.value = model.id
        scheduleAutoSave(0)
        toast('已切换当前模型：' + model.name, 'success')
        refreshAvatarPreview()
      })
      row.querySelector('[data-avatar-action=remove]').addEventListener('click', async () => {
        row.querySelector('[data-avatar-action=remove]').disabled = true
        try {
          const models = await window.fafa.avatar.removeModel(model.id)
          config = await window.fafa.config.get()
          renderAvatarModels(config)
          refreshAvatarPreview()
          toast('模型已删除', 'success')
        } catch (error) {
          toast('删除失败：' + error.message, 'error')
        }
      })
      list.append(row)
    }
  }
  refreshAvatarPreview()
  renderSignalLights()
}
async function refreshAvatarModels() {
  config = await window.fafa.config.get()
  renderAvatarModels(config)
}
async function refreshAvatarPreview() {
  const box = document.querySelector('#avatar-preview-box')
  if (!box) return
  try {
    const preview = await window.fafa.avatar.previewImage()
    if (!preview?.dataUrl) {
      box.innerHTML = '<span>' + escapeHtml(i18n('avatar.live2d.preview.empty')) + '</span>'
      return
    }
    box.innerHTML = '<img alt="' + escapeAttribute(preview.name) + '" src="' + escapeAttribute(preview.dataUrl) + '">'
  } catch {
    box.innerHTML = '<span>' + escapeHtml(i18n('avatar.live2d.preview.empty')) + '</span>'
  }
}
document.querySelector('#avatar-import-open')?.addEventListener('click', async () => {
  const btn = document.querySelector('#avatar-import-open'); btn.disabled = true
  try {
    const result = await window.fafa.avatar.importDialog()
    if (result?.canceled) return
    config = await window.fafa.config.get()
    renderAvatarModels(config)
    toast('已导入 ' + (result?.models?.length || 0) + ' 个模型', 'success')
  } catch (error) {
    toast('导入失败：' + error.message, 'error')
  } finally { btn.disabled = false }
})
document.querySelector('#avatar-drop-open')?.addEventListener('click', () => document.querySelector('#avatar-import-open')?.click())
document.querySelector('#avatar-open-folder')?.addEventListener('click', async () => {
  const result = await window.fafa.avatar.openFolder().catch((error) => ({ ok: false, message: error.message }))
  if (!result?.ok) toast('打开目录失败：' + result?.message || '未知错误', 'error')
})
const avatarDropZone = document.querySelector('#avatar-drop-zone')
for (const eventName of ['dragenter', 'dragover']) avatarDropZone?.addEventListener(eventName, (event) => {
  event.preventDefault()
  avatarDropZone.classList.add('drag-over')
})
for (const eventName of ['dragleave', 'drop']) avatarDropZone?.addEventListener(eventName, (event) => {
  event.preventDefault()
  avatarDropZone.classList.remove('drag-over')
})
avatarDropZone?.addEventListener('drop', async (event) => {
  const files = [...(event.dataTransfer?.files || [])]
  const paths = files.length ? window.fafa.avatar.filePaths(files) : []
  if (!paths.length) { setAvatarResult(document.querySelector('#avatar-live2d-result'), '无法读取拖入的文件路径，请使用「选择文件」按钮。', 'error'); return }
  try {
    await window.fafa.avatar.importPaths(paths)
    config = await window.fafa.config.get()
    renderAvatarModels(config)
    toast('已导入 ' + paths.length + ' 个文件', 'success')
  } catch (error) {
    setAvatarResult(document.querySelector('#avatar-live2d-result'), '导入失败：' + error.message, 'error')
  }
})
document.querySelector('#avatar-test-live2d')?.addEventListener('click', async () => {
  const result = await window.fafa.avatar.test('live2d').catch((error) => ({ ok: false, message: error.message }))
  setAvatarResult(document.querySelector('#avatar-live2d-result'), (result?.ok ? '✓ ' : '✗ ') + result?.message, result?.ok ? 'success' : 'error')
})
document.querySelector('#avatar-rescan')?.addEventListener('click', async () => {
  await refreshAvatarModels()
  setAvatarResult(document.querySelector('#avatar-live2d-result'), '已重新扫描模型目录。', 'success')
})
form.elements.avatarLive2dModel?.addEventListener('change', () => refreshAvatarPreview())

async function vtsRun(action, button, message, boxSelector = '#avatar-vts-result') {
  const btn = document.querySelector(button)
  if (btn) { btn.disabled = true; btn.textContent = '处理中…' }
  try {
    const result = await action()
    setAvatarResult(document.querySelector(boxSelector), (result?.ok === false ? '✗ ' : '✓ ') + (result?.message || message), result?.ok === false ? 'error' : 'success')
    renderSignalLights()
    return result
  } catch (error) {
    setAvatarResult(document.querySelector(boxSelector), '✗ ' + error.message, 'error')
    renderSignalLights()
    return { ok: false, message: error.message }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label || message }
  }
}
function storeButtonLabels() {
  for (const button of document.querySelectorAll('#vts-panel button')) button.dataset.label = button.textContent
}
function setVtsStatus(message, tone = '') {
  const note = document.querySelector('#avatar-vts-status')
  if (!note) return
  const small = document.createElement('small')
  if (tone) small.className = tone
  small.textContent = message
  note.replaceChildren(small)
}
document.querySelector('#avatar-vts-test')?.addEventListener('click', async () => {
  const result = await window.fafa.avatar.vtsTest().catch((error) => ({ ok: false, authenticated: false, message: error.message }))
  setAvatarResult(document.querySelector('#avatar-vts-result'), (result?.ok ? '✓ ' : '✗ ') + result.message, result?.ok ? 'success' : 'error')
  setVtsStatus(result.message, result?.ok ? 'success' : 'error')
  const tone = !result?.ok ? 'bad' : result.authenticated ? 'good' : 'warn'
  const label = !result?.ok ? '连接失败' : result.authenticated ? '已连接并认证' : '已连接，等待插件认证'
  setSignalLight('avatar-vts-panel-light', tone, label)
  if (form.querySelector('input[name="avatarMode"]:checked')?.value === 'vts') setSignalLight('avatar-vts-light', tone, label)
  else renderSignalLights(config)
})
document.querySelector('#avatar-vts-auth')?.addEventListener('click', async () => {
  const result = await vtsRun(() => window.fafa.avatar.vtsAuthenticate(), '#avatar-vts-auth', '请求插件认证')
  if (result?.ok) {
    // A successful auth is also the refresh boundary for all protected VTS lists.
    document.querySelector('#avatar-vts-reload-models')?.click()
    document.querySelector('#avatar-vts-reload-expressions')?.click()
    document.querySelector('#avatar-vts-reload-hotkeys')?.click()
  }
})
document.querySelector('#avatar-vts-reload-models')?.addEventListener('click', async () => {
  const result = await vtsRun(() => window.fafa.avatar.vtsModels(), '#avatar-vts-reload-models', '读取模型')
  const select = document.querySelector('#avatar-vts-model-select')
  const models = Array.isArray(result) ? result : result?.models
  if (select && Array.isArray(models)) {
    select.replaceChildren(...models.map((model) => new Option(model.name + (model.loaded ? '（已载入）' : ''), model.id)))
    renderAvatarModels(config)
  }
})
document.querySelector('#avatar-vts-reload-expressions')?.addEventListener('click', async () => {
  const expressions = await vtsRun(() => window.fafa.avatar.vtsExpressions(), '#avatar-vts-reload-expressions', '读取表情')
  const list = document.querySelector('#avatar-vts-expression-list')
  if (list && Array.isArray(expressions)) {
    list.replaceChildren(...expressions.map((expression) => {
      const row = document.createElement('div')
      row.className = 'vts-item'
      row.innerHTML = '<span class="vts-item-name">' + escapeHtml(expression.name || expression.file) + '</span><small>' + escapeHtml(expression.file || '') + '</small><button class="secondary" type="button">测试表情</button>'
      row.querySelector('button').addEventListener('click', async () => {
        const result = await window.fafa.avatar.vtsActivateExpression(expression.file).catch((error) => ({ ok: false, message: error.message }))
        setVtsStatus((result?.ok ? '已发送表情：' : '表情发送失败：') + (result?.message || expression.name), result?.ok ? 'success' : 'error')
      })
      return row
    }))
    if (!expressions.length) list.innerHTML = '<div class="vts-empty">未读取到表情文件</div>'
  }
})
document.querySelector('#avatar-vts-reload-hotkeys')?.addEventListener('click', async () => {
  const hotkeys = await vtsRun(() => window.fafa.avatar.vtsHotkeys(), '#avatar-vts-reload-hotkeys', '读取快捷键')
  const list = document.querySelector('#avatar-vts-hotkey-list')
  if (list && Array.isArray(hotkeys)) {
    list.replaceChildren(...hotkeys.map((hotkey) => {
      const row = document.createElement('div')
      row.className = 'vts-item'
      row.innerHTML = '<span class="vts-item-name">' + escapeHtml(hotkey.name || hotkey.file) + '</span><small>' + escapeHtml(hotkey.id || '') + '</small><button class="secondary" type="button">触发</button>'
      row.querySelector('button').addEventListener('click', async () => {
        const result = await window.fafa.avatar.vtsTriggerHotkey(hotkey.id).catch((error) => ({ ok: false, message: error.message }))
        setVtsStatus((result?.ok ? '已触发快捷键：' : '快捷键触发失败：') + (result?.message || hotkey.name), result?.ok ? 'success' : 'error')
      })
      return row
    }))
    if (!hotkeys.length) list.innerHTML = '<div class="vts-empty">未读取到快捷键</div>'
  }
})
document.querySelector('#avatar-vts-clear-hotkeys')?.addEventListener('click', () => {
  const list = document.querySelector('#avatar-vts-hotkey-list')
  if (list) list.innerHTML = '<div class="vts-empty">已清空，点击「读取快捷键」重新获取</div>'
})
document.querySelector('#avatar-vts-apply-model')?.addEventListener('click', () => vtsRun(
  () => window.fafa.avatar.vtsLoadModel(document.querySelector('#avatar-vts-model-select')?.value || ''), '#avatar-vts-apply-model', '载入选中模型'
))
document.querySelector('#avatar-vts-model-select')?.addEventListener('change', () => scheduleAutoSave(0))
for (const radio of form.querySelectorAll('input[name="avatarMode"]')) {
  radio.addEventListener('change', () => {
    syncAvatarModePanels(radio.value)
    renderSignalLights()
    scheduleAutoSave(0)
  })
}

/* ============================================================
   Save / collect / auto-save
   ============================================================ */
function setSaveState(message, tone = '') {
  saveState.className = 'save-state ' + tone
  saveState.innerHTML = '<i></i><span>' + escapeHtml(message) + '</span>'
}
function mergePresetFields(section, service) {
  const preset = findProviderPreset(service, form.elements[service + 'Preset'].value)
  if (!preset || preset.id === 'custom') return section
  // 预设字段只在用户切换预设时由 applyProviderPreset 填入；
  // 自动保存不再回写模型/音色，保证“获取模型”选中的值不会被预设覆盖。
  return { ...section, preset: preset.id }
}
function collectRadioValue(name) { const c = form.querySelector('input[name="' + name + '"]:checked'); return c ? c.value : null }
function normalizeCooldown(v) { const n = Number(v); return Number.isFinite(n) ? Math.max(500, Math.round(n)) : 500 }
function collectSafetyKeywords() {
  const seen = new Set(), out = []
  for (const input of document.querySelectorAll('#safety-keyword-list input[data-keyword]')) {
    const kw = input.value.trim(); if (!kw || seen.has(kw.toLowerCase())) continue
    seen.add(kw.toLowerCase()); out.push(kw); if (out.length >= 200) break
  }
  return out
}
async function saveSecrets() {
  for (const name of ['ttsApiKey','llmApiKey','asrApiKey','bilibiliCookie','youtubeApiKey','musicPassword']) {
    if (form.elements[name] && form.elements[name].value && form.elements[name].dataset.secretDirty === 'true') {
      await window.fafa.config.setSecret(name, form.elements[name].value)
      form.elements[name].dataset.secretDirty = 'false'
    }
  }
}
function collectConfigPatch() {
  const reminders = collectReminders()
  const hhmm = /^([01]\d|2[0-3]):[0-5]\d$/
  for (const r of reminders) if (!hhmm.test(r.time)) throw new Error('提醒时间格式错误：' + r.time + '（应为 HH:MM）')
  return {
    scale:Number(form.elements.scale.value), volume:Number(form.elements.volume.value),
    alwaysOnTop:form.elements.alwaysOnTop.checked, clickThrough:form.elements.clickThrough.checked,
    launchAtLogin:form.elements.launchAtLogin.checked, liveEnabled:form.elements.liveEnabled.checked,
    liveMock:form.elements.liveMock.checked, livePlatform:form.elements.livePlatform.value,
    roomId:form.elements.roomId.value.trim(),
    youtube:{ ...config.youtube, videoId:form.elements.youtubeVideoId.value.trim(), liveChatId:form.elements.youtubeLiveChatId.value.trim() },
    pet:{ ...config.pet, activePackageId:form.elements.petPackageId?.value || 'fafa' },
    broadcasterUid:form.elements.broadcasterUid.value.trim(), commands:collectCommands(),
    interaction:{
      transparentHitThrough:form.elements.transparentHitThrough.checked,
      pettingEnabled:form.elements.pettingEnabled.checked, pettingSensitivity:Number(form.elements.pettingSensitivity.value),
      tossEnabled:form.elements.tossEnabled.checked, tossStrength:Number(form.elements.tossStrength.value),
      nameReact:form.elements.nameReact.checked,
      clickActions: collectAssignGroup('click')
    },
    actionAssign:{
      click:collectAssignGroup('click'), danmaku:collectAssignGroup('danmaku'), voice:collectAssignGroup('voice'),
      special:collectAssignGroup('special'), gift:collectAssignGroup('gift'), superChat:collectAssignGroup('superChat'),
      guard:collectAssignGroup('guard'), petting:collectAssignGroup('petting'), belly:collectAssignGroup('belly'),
      toss:collectAssignGroup('toss'), enter:collectAssignGroup('enter'),
      session:collectAssignGroup('session'), lottery:collectAssignGroup('lottery'), giftMedium:collectAssignGroup('giftMedium'),
      giftBig:collectAssignGroup('giftBig'), giftSuper:collectAssignGroup('giftSuper'), voiceShout:collectAssignGroup('voiceShout'),
      voiceNoisy:collectAssignGroup('voiceNoisy')
    },
    tts:mergePresetFields({ ...config.tts, enabled:form.elements.ttsEnabled.checked, baseUrl:form.elements.ttsBaseUrl.value.trim(), model:resolveTtsModel(), voice:resolveTtsVoice(), speed:Math.max(0.5, Math.min(1.5, Number(form.elements.ttsSpeed.value) || 1)), replyScope:collectRadioValue('ttsReplyScope') || config.tts.replyScope }, 'tts'),
    llm:mergePresetFields({ ...config.llm, enabled:form.elements.llmEnabled.checked, baseUrl:form.elements.llmBaseUrl.value.trim(), model:resolveLlmModel(), personaPrompt:form.elements.llmPersonaPrompt.value.slice(0, 200), reasoning:form.elements.llmReasoning.value || 'none', inputSource:collectRadioValue('llmInputSource') || config.llm.inputSource }, 'llm'),
    asr:mergePresetFields({ ...config.asr, enabled:form.elements.asrEnabled.checked, baseUrl:form.elements.asrBaseUrl.value.trim(), model:resolveAsrModel() }, 'asr'),
    voice:{ ...config.voice, enabled:form.elements.voiceEnabled.checked, deviceId:form.elements.voiceDeviceId.value, threshold:Math.max(1, Math.min(95, Math.round(Number(form.elements.voiceThreshold.value) || 35))), sensitivity:Math.max(0.5, Math.min(2, Number(form.elements.voiceSensitivity.value) || 1)), reactionCooldownMs:normalizeCooldown(form.elements.voiceReactionCooldownMs.value), wakeWordEnabled:form.elements.voiceWakeWordEnabled.checked, pushToTalkKey:normalizePushToTalkKey(form.elements.voicePushToTalkKey.value) },
    dock:{ ...config.dock, enabled:form.elements.dockEnabled.checked },
    schedule:{ ...config.schedule, hourlyChime:form.elements.hourlyChime.checked, reminders:reminders },
    music:{ ...config.music, enabled:false, mock:true },
    avatar: {
      ...(config.avatar || {}),
      mode: 'video',
      live2d: { ...(config.avatar?.live2d || {}), activeModelId: form.elements.avatarLive2dModel?.value || '' },
      vtubeStudio: {
        ...(config.avatar?.vtubeStudio || {}),
        enabled: false,
        host: form.elements.avatarVtsHost.value.trim() || '127.0.0.1',
        port: Math.max(1, Math.min(65535, Math.round(Number(form.elements.avatarVtsPort.value) || 8001))),
        pluginName: form.elements.avatarVtsPluginName.value.trim() || 'fafa-desktop-pet',
        pluginDeveloper: form.elements.avatarVtsDeveloper.value.trim() || 'Fafa',
        modelId: document.querySelector('#avatar-vts-model-select')?.value || config.avatar?.vtubeStudio?.modelId || ''
      }
    },
    liveEvents:{ ...(config.liveEvents || {}), danmaku:form.elements.liveDanmaku.checked, gift:form.elements.liveGift.checked, superChat:form.elements.liveSuperChat.checked, guard:form.elements.liveGuard.checked },
    safety:{ ...(config.safety || {}), enabled:form.elements.safetyEnabled.checked, keywords:collectSafetyKeywords() },
    applause:{ ...(config.applause || {}), enabled:form.elements.applauseEnabled.checked },
    ui:{ theme: currentTheme },
    idleSet:{ actions: collectAssignGroup('idle') }
  }
}
let autoSaveTimer = null, autoSaveChain = Promise.resolve()
function scheduleAutoSave(delay = 0) { clearTimeout(autoSaveTimer); autoSaveTimer = setTimeout(() => { void runAutoSave() }, delay) }
function runAutoSave() {
  autoSaveChain = autoSaveChain.then(async () => {
    try {
      await saveSecrets()
      config = await window.fafa.config.update(collectConfigPatch())
      setSaveState(i18n('toast.saved'), 'success')
      renderSignalLights(config)
    } catch (error) {
      setSaveState('自动保存失败：' + error.message, 'error')
      toast(i18n('save.failed') + ' ' + error.message, 'error', i18n('toast.saveFailed'))
    }
  }).catch(() => {})
  return autoSaveChain
}
function isEditableControl(t) { return t instanceof HTMLInputElement || t instanceof HTMLSelectElement || t instanceof HTMLTextAreaElement }
function shouldSkipAutoSave(t) { return Boolean(t.closest('dialog, .custom-action-test, .test-inputs')) }
form.addEventListener('change', (e) => {
  const t = e.target; if (!isEditableControl(t) || shouldSkipAutoSave(t)) return
  if (t.type === 'password' && !t.value) return
  scheduleAutoSave(0)
})
form.addEventListener('change', (e) => {
  const t = e.target; if (!isEditableControl(t)) return
  if (!t.closest('#command-list, #reminder-list')) return
  scheduleAutoSave(0)
})
form.addEventListener('input', (e) => {
  const t = e.target; if (!isEditableControl(t) || shouldSkipAutoSave(t)) return
  if (t.closest('#command-list, #reminder-list')) return
  if (t.type === 'range' || t.type === 'number') scheduleAutoSave(450)
})

/* ============================================================
   Collapse sections
   ============================================================ */
function bindCollapse(name, selector) {
  const input = form.elements[name]; const content = document.querySelector(selector)
  if (!input || !content) return
  const sync = () => content.classList.toggle('open', Boolean(input.checked))
  input.addEventListener('change', sync)
  sync()
}
function bindPanelDisclosure(buttonId, detailId) {
  const button = document.querySelector(buttonId)
  const detail = document.querySelector(detailId)
  if (!button || !detail) return
  button.addEventListener('click', () => {
    const expanded = button.getAttribute('aria-expanded') !== 'true'
    button.setAttribute('aria-expanded', String(expanded))
    button.textContent = expanded ? '收起' : '展开测试'
    detail.hidden = !expanded
  })
}

/* ============================================================
   Live mock / liveEnabled mutual exclusion
   ============================================================ */
function mutualExclusion() {
  const liveEnabled = form.elements.liveEnabled; const liveMock = form.elements.liveMock
  if (!liveEnabled || !liveMock) return
  liveEnabled.addEventListener('change', () => {
    if (liveEnabled.checked && liveMock.checked) {
      liveMock.checked = false
      toast(i18n('toast.mockConflictMock'), 'warn')
      scheduleAutoSave(0)
    }
  })
  liveMock.addEventListener('change', () => {
    if (liveMock.checked && liveEnabled.checked) {
      liveEnabled.checked = false
      toast(i18n('toast.mockConflictLive'), 'warn')
      scheduleAutoSave(0)
    }
  })
}
/* ============================================================
   Quick enable strip (test center)
   ============================================================ */
function refreshQuickStrip() {
  const strip = document.querySelector('#test-center-quick'); if (!strip) return
  const ttsOn = form.elements.ttsEnabled?.checked; const llmOn = form.elements.llmEnabled?.checked
  if (ttsOn && llmOn) { strip.hidden = true; strip.replaceChildren(); return }
  strip.hidden = false
  strip.replaceChildren()
  const label = document.createElement('span'); label.className = 'quick-strip-label'; label.textContent = i18n('quick.strip') + '：'
  strip.append(label)
  if (!ttsOn) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'secondary'; b.textContent = i18n('quick.tts')
    b.addEventListener('click', () => { form.elements.ttsEnabled.checked = true; form.elements.ttsEnabled.dispatchEvent(new Event('change')); scheduleAutoSave(0); toast('已临时开启语音合成，可在语音与AI面板关闭', 'success'); refreshQuickStrip() })
    strip.append(b)
  }
  if (!llmOn) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'secondary'; b.textContent = i18n('quick.llm')
    b.addEventListener('click', () => { form.elements.llmEnabled.checked = true; form.elements.llmEnabled.dispatchEvent(new Event('change')); scheduleAutoSave(0); toast('已临时开启智能对话，可在语音与AI面板关闭', 'success'); refreshQuickStrip() })
    strip.append(b)
  }
}

/* ============================================================
   Test center (mock events → toast)
   ============================================================ */
const mockLabel = { gift: '礼物', superChat: 'SC', guard: '上舰', enter: '进场' }
async function sendMockEvent(type, extra = {}) {
  try {
    const base = {
      type,
      id: crypto.randomUUID(),
      user: { id: 'mock-' + Date.now(), name: '测试观众' }
    }
    const result = await window.fafa.services.mock({ ...base, ...extra })
    if (result === false || result === undefined) {
      toast('测试触发失败：服务未就绪', 'error')
      return
    }
    toast(i18n('toast.mockTriggered') + '：' + (mockLabel[type] || '弹幕'), 'success')
  } catch (error) {
    toast('测试触发失败：' + error.message, 'error')
  }
}
const mockSend = document.querySelector('#mock-send-danmaku')
mockSend?.addEventListener('click', async () => {
  const input = document.querySelector('#mock-danmaku-input')
  const text = (input?.value || '').trim() || '发发*跳舞'
  mockSend.disabled = true
  try { await sendMockEvent('danmaku', { text }) } finally { mockSend.disabled = false }
})
for (const button of document.querySelectorAll('[data-mock]')) button.addEventListener('click', async () => {
  button.disabled = true
  const type = button.dataset.mock
  const extra = {
    gift: { giftName: '测试礼物', count: 1, price: 0 },
    superChat: { text: '测试 SC 留言', price: 30 },
    guard: { level: 3 },
    enter: {}
  }[type] || {}
  try { await sendMockEvent(type, extra) } finally { setTimeout(() => { button.disabled = false }, 500) }
})

/* ---- Test center command catalog: searchable, categorized and paginated. ---- */
const commandCatalog = document.querySelector('#test-command-catalog')
const commandSearch = document.querySelector('#test-command-search')
const commandPrev = document.querySelector('#test-command-prev')
const commandNext = document.querySelector('#test-command-next')
const commandPage = document.querySelector('#test-command-page')
let commandCatalogPage = 0
let commandCatalogCategory = ''
const COMMAND_CATEGORIES_PER_PAGE = 4
function commandCategory(command) {
  return actionEntries.find((action) => action.id === command.actionId)?.category || '指令'
}
function renderCommandCatalog() {
  if (!commandCatalog) return
  const query = String(commandSearch?.value || '').trim().toLowerCase()
  const commands = (config.commands || []).filter((command) => !query || command.actionId.toLowerCase().includes(query) || command.aliases.some((alias) => alias.toLowerCase().includes(query)))
  const groups = new Map()
  for (const command of commands) { const group = commandCategory(command); if (!groups.has(group)) groups.set(group, []); groups.get(group).push(command) }
  const categories = [...groups.keys()].sort((a, b) => a.localeCompare(b, 'zh-CN'))
  const pageCount = Math.max(1, Math.ceil(categories.length / COMMAND_CATEGORIES_PER_PAGE))
  commandCatalogPage = Math.max(0, Math.min(commandCatalogPage, pageCount - 1))
  const pageCategories = categories.slice(commandCatalogPage * COMMAND_CATEGORIES_PER_PAGE, (commandCatalogPage + 1) * COMMAND_CATEGORIES_PER_PAGE)
  if (!pageCategories.includes(commandCatalogCategory)) commandCatalogCategory = pageCategories[0] || ''
  if (commandPage) commandPage.textContent = (commandCatalogPage + 1) + ' / ' + pageCount
  if (commandPrev) commandPrev.disabled = commandCatalogPage === 0
  if (commandNext) commandNext.disabled = commandCatalogPage >= pageCount - 1
  commandCatalog.replaceChildren()
  const categoryBar = document.createElement('div'); categoryBar.className = 'command-catalog-tabs'
  for (const category of pageCategories) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'secondary' + (category === commandCatalogCategory ? ' active' : ''); button.textContent = category + '（' + groups.get(category).length + '）'; button.setAttribute('aria-expanded', String(category === commandCatalogCategory)); button.addEventListener('click', () => { commandCatalogCategory = category; renderCommandCatalog() }); categoryBar.append(button)
  }
  commandCatalog.append(categoryBar)
  const list = document.createElement('div'); list.className = 'command-catalog-list'
  for (const command of groups.get(commandCatalogCategory) || []) {
    const row = document.createElement('div'); row.className = 'command-catalog-row'
    row.innerHTML = '<b>' + escapeHtml(command.aliases.join(' / ')) + '</b><span>' + escapeHtml(command.actionId) + '</span><small>' + escapeHtml(command.text || '无固定台词') + '</small>'
    list.append(row)
  }
  if (!list.children.length) list.innerHTML = '<div class="vts-empty">没有匹配的指令</div>'
  commandCatalog.append(list)
}
commandSearch?.addEventListener('input', () => { commandCatalogPage = 0; commandCatalogCategory = ''; renderCommandCatalog() })
commandPrev?.addEventListener('click', () => { commandCatalogPage -= 1; renderCommandCatalog() })
commandNext?.addEventListener('click', () => { commandCatalogPage += 1; renderCommandCatalog() })

/* ============================================================
   Test center: host voice + TTS speak + music request/volume
   ============================================================ */
const voiceSimResult = document.querySelector('#voice-sim-result')
const musicTestResult = document.querySelector('#music-test-result')
const voiceTestSend = document.querySelector('#voice-test-send')
const voiceTestInput = document.querySelector('#voice-test-input')
const musicTestSend = document.querySelector('#music-test-send')
const musicTestInput = document.querySelector('#music-test-input')
const voicePipelineAsr = document.querySelector('#voice-pipeline-asr')
const voicePipelineAi = document.querySelector('#voice-pipeline-ai')
const voicePipelineTts = document.querySelector('#voice-pipeline-tts')
const voicePipelineAsrDialog = document.querySelector('#voice-pipeline-asr-dialog')
const voicePipelineAiDialog = document.querySelector('#voice-pipeline-ai-dialog')
const voicePipelineTtsDialog = document.querySelector('#voice-pipeline-tts-dialog')

function setResultBox(box, message, tone = '') {
  if (!box) return
  box.textContent = message
  box.className = 'dialog-reply ' + tone
}
function setVoicePipeline({ asr = null, ai = null, tts = null } = {}) {
  if (asr !== null) for (const output of [voicePipelineAsr, voicePipelineAsrDialog]) if (output) output.textContent = asr
  if (ai !== null) for (const output of [voicePipelineAi, voicePipelineAiDialog]) if (output) output.textContent = ai
  if (tts !== null) for (const output of [voicePipelineTts, voicePipelineTtsDialog]) if (output) output.textContent = tts
}
function describeVoicePipeline(text, result) {
  const recognized = text ? '识别到：' + text : '未得到有效转写'
  if (!result) return { asr:recognized, ai:'本次内容未进入 AI 或指令链路', tts:'未生成播报内容' }
  if (result.kind === 'llm') return { asr:recognized, ai:'AI 回复：' + (result.text || '无内容'), tts:voiceTtsStatus(result.text) }
  if (result.kind === 'fallback') return { asr:recognized, ai:'默认回复：' + (result.text || '我听见啦！'), tts:voiceTtsStatus(result.text || '我听见啦！') }
  if (result.kind === 'command') return { asr:recognized, ai:'识别为指令：' + (result.actionId || '已触发'), tts:voiceTtsStatus(result.text || '') }
  if (result.kind === 'music') return { asr:recognized, ai:result.ok ? '点歌结果：已处理《' + (result.title || '') + '》' : '点歌失败：' + (result.reason || '未知原因'), tts:'本次没有 AI 播报文本' }
  return { asr:recognized, ai:'处理完成', tts:'未生成播报内容' }
}
function voiceTtsStatus(text) {
  if (!text) return '本次没有需要播报的文本'
  const scope = config.tts?.replyScope || 'all'
  if (!config.tts?.enabled || !['all', 'voice'].includes(scope)) return '未播报：TTS 未开启或不接收语音回复'
  if (typeof SERVICE_META !== 'undefined' && !SERVICE_META.tts.ready()) return '未播报：TTS 服务未就绪'
  return '准备播报：' + text
}

async function speakTestText(text) {
  const next = await commitServiceConfig().catch(() => null)
  if (next) renderSignalLights(next)
  const payload = await window.fafa.providers.ttsSynthesize(String(text || '').slice(0, 100)).catch(() => null)
  if (!payload || !payload.value) return false
  // data:audio/pcm 为裸 PCM（不可直接播放）；data:audio/mpeg 等格式可直接交给 Audio
  if (payload.type === 'data' && !/^data:audio\/(?!pcm\b)/i.test(payload.value)) return false
  try { await new Audio(payload.value).play(); return true } catch { return false }
}

async function runVoiceTest() {
  const text = (voiceTestInput?.value || '').trim()
  if (!text) { setResultBox(voiceSimResult, '请输入要说的话', 'error'); return }
  if (form.elements.ttsEnabledQuick?.checked && !SERVICE_META.tts.ready()) {
    requireService('tts', runVoiceTest)
    return
  }
  voiceTestSend.disabled = true
  try {
    const result = await window.fafa.services.voiceTranscript(text)
    if (!result) { setResultBox(voiceSimResult, '内容被拦截或为空', 'error'); return }
    let line = ''
    if (result.kind === 'command') line = '✓ 触发指令「' + result.actionId + '」' + (result.text ? '：' + result.text : '')
    else if (result.kind === 'music') line = result.ok ? '✓ 点歌成功：《' + result.title + '》已进入队列' : '✗ 点歌失败：' + (result.reason || '未知原因')
    else if (result.kind === 'llm') line = '✓ AI 回复：' + (result.text || '')
    else if (result.kind === 'fallback') line = '— AI 输入源未包含语音，使用默认回应：' + (result.text || '')
    else line = '— 无反应'
    setResultBox(voiceSimResult, line, result.kind === 'command' || result.ok === true || result.kind === 'llm' ? 'success' : 'error')
    setVoicePipeline(describeVoicePipeline(text, result))
    if (form.elements.ttsEnabledQuick?.checked && SERVICE_META.tts.ready()) {
      const speakText = result.kind === 'llm' || result.kind === 'fallback' ? (result.text || '') : (result.kind === 'command' ? (result.text || text) : text)
      const ok = await speakTestText(speakText).catch(() => false)
      if (ok) setResultBox(voiceSimResult, line + '（已播报）', 'success')
    }
  } catch (error) {
    setResultBox(voiceSimResult, '测试失败：' + error.message, 'error')
  } finally { voiceTestSend.disabled = false }
}
voiceTestSend?.addEventListener('click', runVoiceTest)
voiceTestInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); runVoiceTest() } })

async function runMusicTest() {
  const query = (musicTestInput?.value || '').trim()
  if (!query) { setResultBox(musicTestResult, '请输入歌名', 'error'); return }
  if (!SERVICE_META.music.ready()) {
    requireService('music', runMusicTest)
    return
  }
  musicTestSend.disabled = true
  try {
    const result = await window.fafa.services.musicRequest(query)
    setResultBox(musicTestResult, result?.ok ? '✓ 《' + (result.title || query) + '》' + result.message : '✗ ' + (result?.message || '点歌失败'), result?.ok ? 'success' : 'error')
  } catch (error) {
    setResultBox(musicTestResult, '点歌测试失败：' + error.message, 'error')
  } finally { musicTestSend.disabled = false }
}
musicTestSend?.addEventListener('click', runMusicTest)
musicTestInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); runMusicTest() } })

function syncMusicVolumeOutput() {
  const slider = form.elements.musicTestVolume
  const out = document.querySelector('#music-volume-output')
  if (slider && out) out.value = String(slider.value)
}
form.elements.musicTestVolume?.addEventListener('input', () => {
  syncMusicVolumeOutput()
  clearTimeout(musicVolumeTimer)
  musicVolumeTimer = setTimeout(async () => {
    const v = Number(form.elements.musicTestVolume.value) || 80
    const result = await window.fafa.services.musicVolume(v).catch(() => null)
    if (result && !result.ok) setResultBox(musicTestResult, result.message || '音量调节失败', 'error')
    else setResultBox(musicTestResult, '✓ ' + (result?.message || '音量已设为 ' + v), 'success')
    scheduleAutoSave(0)
  }, 600)
})
let musicVolumeTimer = null

/* ============================================================
   Test center: TTS speak toggle (synced with the AI panel switch)
   ============================================================ */
const ttsEnabledQuick = form.elements.ttsEnabledQuick
ttsEnabledQuick?.addEventListener('change', () => {
  const main = form.elements.ttsEnabled
  if (!main) return
  main.checked = ttsEnabledQuick.checked
  main.dispatchEvent(new Event('change'))
  if (ttsEnabledQuick.checked && (!config.tts?.enabled || !SERVICE_META.tts.ready())) {
    requireService('tts', () => {})
  }
})
form.elements.ttsEnabled?.addEventListener('change', () => { if (ttsEnabledQuick) ttsEnabledQuick.checked = Boolean(form.elements.ttsEnabled.checked) })

/* ============================================================
   Config-not-ready prompt + floating config dialog
   ============================================================ */
const configPromptDialog = document.querySelector('#config-prompt-dialog')
const configPromptText = document.querySelector('#config-prompt-text')
const serviceConfigDialog = document.querySelector('#service-config-dialog')
const serviceConfigTitle = document.querySelector('#service-config-title')
const serviceConfigKicker = document.querySelector('#service-config-kicker')
const serviceConfigPreset = document.querySelector('#service-config-preset')
const serviceConfigBaseUrl = document.querySelector('#service-config-baseurl')
const serviceConfigModel = document.querySelector('#service-config-model')
const serviceConfigVoice = document.querySelector('#service-config-voice')
const serviceConfigKey = document.querySelector('#service-config-key')
let pendingConfigAction = null
const voiceboxTtsReady = () => Boolean(config.tts?.enabled && config.tts?.preset === 'voicebox' && (config.tts?.baseUrl || '').trim() && (config.tts?.voice || '').trim())
const edgeTtsReady = () => Boolean(config.tts?.enabled && config.tts?.preset === 'edge-tts')
const voiceboxLlmReady = () => Boolean(config.llm?.enabled && config.llm?.preset === 'voicebox' && (config.llm?.baseUrl || '').trim())
const voiceboxAsrReady = () => Boolean(config.asr?.enabled && config.asr?.preset === 'voicebox' && (config.asr?.baseUrl || '').trim())
const SERVICE_META = {
  tts: { label: '语音合成 TTS', ready: () => voiceboxTtsReady() || edgeTtsReady() || Boolean(config.tts?.enabled && config.tts?.hasKey), hasVoice: true, hasSecret: true, hasPreset: true, baseLabel: '接口地址', modelLabel: '模型', voiceLabel: '音色' },
  llm: { label: '弹幕对话 AI', ready: () => voiceboxLlmReady() || Boolean(config.llm?.enabled && (config.llm?.preset === 'custom' ? Boolean(config.llm?.baseUrl) : config.llm?.hasKey)), hasVoice: false, hasSecret: true, hasPreset: true, baseLabel: '接口地址', modelLabel: '模型', voiceLabel: '' },
  asr: { label: '语音识别 ASR', ready: () => voiceboxAsrReady() || Boolean(config.asr?.enabled && (config.asr?.hasKey || config.tts?.hasKey)), hasVoice: false, hasSecret: true, hasPreset: true, baseLabel: '接口地址', modelLabel: '模型', voiceLabel: '' },
  music: { label: '点歌服务', ready: () => Boolean(config.music?.enabled), hasVoice: false, hasSecret: false, hasPreset: false, baseLabel: '服务地址', modelLabel: '请求路径', voiceLabel: '' }
}
function requireService(service, action) {
  if (SERVICE_META[service]?.ready()) { action(); return }
  pendingConfigAction = action
  if (configPromptText) configPromptText.textContent = '「' + SERVICE_META[service].label + '」尚未配置好，测试结果可能不完整。是否现在配置？'
  configPromptDialog?.showModal()
}
document.querySelector('#config-prompt-yes')?.addEventListener('click', () => {
  configPromptDialog?.close()
  openServiceConfigDialog(promptService || 'tts')
})
let promptService = 'tts'
function openServiceConfigDialog(service) {
  promptService = service
  const meta = SERVICE_META[service]
  const svc = config[service] || {}
  serviceConfigKicker.textContent = service.toUpperCase() + ' CONFIG'
  serviceConfigTitle.textContent = '配置' + meta.label
  serviceConfigPreset.closest('.field').hidden = !meta.hasPreset
  if (meta.hasPreset) {
    serviceConfigPreset.innerHTML = presetOptions(service)
    serviceConfigPreset.value = svc.preset || ''
  }
  document.querySelector('#service-config-baseurl-wrap .field-label').textContent = meta.baseLabel
  document.querySelector('#service-config-model-wrap .field-label').textContent = meta.modelLabel
  serviceConfigBaseUrl.value = svc.baseUrl || ''
  serviceConfigModel.value = svc.requestPath || svc.model || ''
  serviceConfigVoice.value = svc.voice || ''
  serviceConfigVoice.closest('.field').hidden = !meta.hasVoice
  serviceConfigKey.closest('.field').hidden = !meta.hasSecret
  serviceConfigKey.value = ''
  setSecretVisibility(serviceConfigKey, false)
  serviceConfigDialog.dataset.service = service
  updateVoiceboxHints()
  serviceConfigDialog.showModal()
}
document.querySelector('#service-config-save')?.addEventListener('click', async () => {
  const service = serviceConfigDialog.dataset.service
  const btn = document.querySelector('#service-config-save')
  btn.disabled = true
  try {
    const meta = SERVICE_META[service]
    const preset = findProviderPreset(service, serviceConfigPreset.value)
    const fields = preset && preset.id !== 'custom' ? (preset.fields || {}) : {}
    const patch = {}
    if (service === 'music') {
      patch.music = { ...config.music, enabled: true, baseUrl: serviceConfigBaseUrl.value.trim() || config.music.baseUrl, requestPath: serviceConfigModel.value.trim() || config.music.requestPath }
    } else {
      patch[service] = {
        ...config[service],
        enabled: true,
        preset: serviceConfigPreset.value,
        baseUrl: (serviceConfigBaseUrl.value.trim() || fields.baseUrl || '').trim(),
        model: (serviceConfigModel.value.trim() || fields.model || '').trim()
      }
      if (service === 'tts') patch[service].voice = (serviceConfigVoice.value.trim() || fields.voice || config.tts.voice || '').trim()
      if (meta.hasSecret && serviceConfigKey.value) await window.fafa.config.setSecret(service + 'ApiKey', serviceConfigKey.value)
    }
    config = await window.fafa.config.update(patch)
    fill(config)
    serviceConfigDialog.close()
    setSaveState(i18n('toast.saved'), 'success')
    const retry = pendingConfigAction; pendingConfigAction = null
    if (retry) retry()
  } catch (error) {
    toast('保存失败：' + error.message, 'error', i18n('toast.saveFailed'))
  } finally { btn.disabled = false }
})

/* ============================================================
   Stepper guides (live setup / music setup)
   ============================================================ */
const GUIDE_STEPS = {
  live: [
    { title: '打开你的 B 站直播间', desc: '在浏览器打开 bilibili.com 并进入自己的直播间。', links: [{ label: '打开 bilibili.com', url: 'https://www.bilibili.com' }] },
    { title: '找到房间号', desc: '看浏览器地址栏，形如 live.bilibili.com/123456 —— 里面的数字就是房间号。直接填在下面，会自动同步到设置里。', fields: [{ name: 'roomId', label: '直播间房间号', placeholder: '例如 123456' }] },
    { title: '找到主播 UID', desc: '点右上角头像进入「个人空间」，地址栏 space.bilibili.com/ 后面的数字就是 UID。直接填在下面，会自动同步。', fields: [{ name: 'broadcasterUid', label: '主播 UID', placeholder: '例如 987654' }] },
    { title: '开启直播连接', desc: '回到「直播互动」面板，打开「开启直播连接」开关；确认「测试中心」的模拟测试模式是关闭的。', links: [] },
    { title: '完成', desc: '改动会自动保存。可以到「测试中心」用弹幕/礼物按钮验证连接。', links: [] }
  ],
  music: [
    { title: '准备 AListen 服务', desc: '发发只把解析后的点歌请求发送给本机 AListen；AListen 不随发发安装包捆绑。', links: [{ label: '查看 AListen 接口说明', url: 'https://pkg.go.dev/github.com/bihua-university/alisten' }] },
    { title: '运行并确认接口', desc: '启动 AListen 服务，确认它监听的地址和 POST /music/pick 接口可用。', links: [] },
    { title: '填写房间与音乐源', desc: '在点歌服务里填 AListen 地址、houseId、音乐源和请求路径；密码会单独保存到 Windows 安全存储。', fields: [{ name: 'musicBaseUrl', label: 'AListen 地址', placeholder: 'http://127.0.0.1:8080' }, { name: 'musicHouseId', label: '房间号', placeholder: 'houseId' }, { name: 'musicRequestPath', label: '请求路径', placeholder: '/music/pick' }] },
    { title: '暂时不想部署？', desc: '勾选「模拟点歌」能离线验证发发的弹幕解析和动作反馈；取消后才会请求 AListen。', links: [] },
    { title: '完成', desc: '到「测试中心」→「点歌测试」输入歌名；直播间里使用「点歌 歌名」即可由发发统一转发。', links: [] }
  ]
}
function bindGuide(kind) {
  const dialog = document.querySelector('#' + kind + '-guide-dialog')
  if (!dialog) return
  const stepsEl = document.querySelector('#' + kind + '-guide-steps')
  const dotsEl = document.querySelector('#' + kind + '-guide-dots')
  const countEl = document.querySelector('#' + kind + '-guide-count')
  const prev = document.querySelector('#' + kind + '-guide-prev')
  const next = document.querySelector('#' + kind + '-guide-next')
  const close = document.querySelector('#' + kind + '-guide-close')
  const steps = GUIDE_STEPS[kind]
  let index = 0
  function render() {
    const step = steps[index]
    const links = (step.links || []).map((l) => '<button class="secondary guide-link" type="button" data-url="' + escapeAttribute(l.url) + '">' + escapeHtml(l.label) + '</button>').join('')
    const fields = (step.fields || []).map((f) => '<label class="guide-field"><span>' + escapeHtml(f.label) + '</span><input type="text" data-guide-field="' + escapeAttribute(f.name) + '" placeholder="' + escapeAttribute(f.placeholder || '') + '" value="' + escapeAttribute(form.elements[f.name]?.value || '') + '"></label>').join('')
    stepsEl.innerHTML = '<div class="guide-step active"><span class="guide-step-num">' + (index + 1) + '</span><div><b>' + escapeHtml(step.title) + '</b><p>' + escapeHtml(step.desc) + '</p>' + (fields ? '<div class="guide-fields">' + fields + '</div>' : '') + '<div class="guide-links">' + links + '</div></div></div>'
    dotsEl.innerHTML = steps.map((_, i) => '<button type="button" class="step-dot' + (i === index ? ' active' : '') + (i < index ? ' done' : '') + '" data-index="' + i + '" aria-label="第 ' + (i + 1) + ' 步">' + (i + 1) + '</button>').join('')
    countEl.textContent = (index + 1) + ' / ' + steps.length
    prev.disabled = index === 0
    next.textContent = index === steps.length - 1 ? i18n('btn.done') : i18n('btn.next')
    for (const link of stepsEl.querySelectorAll('.guide-link')) link.addEventListener('click', () => { window.fafa.shell?.openExternal(link.dataset.url) })
    for (const dot of dotsEl.querySelectorAll('.step-dot')) dot.addEventListener('click', () => { index = Number(dot.dataset.index); render() })
    // 教程里的输入框实时同步到设置表单（并触发自动保存）
    for (const input of stepsEl.querySelectorAll('[data-guide-field]')) {
      input.addEventListener('input', () => {
        const target = form.elements[input.dataset.guideField]
        if (!target) return
        target.value = input.value
        target.dispatchEvent(new Event('input', { bubbles: true }))
        scheduleAutoSave(0)
      })
    }
  }
  prev.addEventListener('click', () => { if (index > 0) { index -= 1; render() } })
  next.addEventListener('click', () => {
    if (index < steps.length - 1) { index += 1; render() }
    else dialog.close()
  })
  close.addEventListener('click', () => dialog.close())
  return { open: () => { index = 0; render(); dialog.showModal() } }
}
const liveGuide = bindGuide('live')
const musicGuide = bindGuide('music')
document.querySelector('#live-guide-open')?.addEventListener('click', () => liveGuide.open())
document.querySelector('#music-guide-open')?.addEventListener('click', () => musicGuide.open())

/* ============================================================
   Test center navigation shortcut
   ============================================================ */
document.querySelector('#goto-testcenter')?.addEventListener('click', () => {
  document.querySelector('nav button[data-tab="testcenter"]')?.click()
})

/* ============================================================
   Action grid + custom action + idle set
   ============================================================ */
function renderActionTests(actions) {
  const grid = document.querySelector('#action-test-grid')
  grid.replaceChildren(...actions.map(action => {
    const button = document.createElement('button')
    button.type = 'button'
    button.dataset.testAction = action.id
    button.dataset.testText = testTextForAction(action)
    button.dataset.assetStatus = action.assetStatus
    // 停用的动作保留占位，但预览置黑且不可点击。
    if (action.enabled === false) {
      button.disabled = true
      button.dataset.disabled = 'true'
      button.title = '该动作已停用'
    }
    button.innerHTML = '<span class="action-label">' + escapeHtml(action.label) + '</span><span class="action-play" aria-hidden="true"></span>'
    return button
  }))
}
function testTextForAction(action) {
  const text = { idle_breath:'回到待机状态。', act_greet:'你好呀～', act_sing:'来一首！', act_sleep:'呼噜……', act_wake:'早呀！', emo_happy:'今天超开心！', emo_angry:'哼！', emo_sad:'陪陪我嘛……' }[action.id]
  return text || action.label + '测试。'
}
function bindActionTests() {
  for (const button of document.querySelectorAll('[data-test-action]')) button.addEventListener('click', async () => {
    const active = document.querySelector('[data-test-action].playing')
    active?.classList.remove('playing')
    button.classList.add('playing')
    try {
      await window.fafa.pet.test(button.dataset.testAction, button.dataset.testText, 2600)
      setSaveState('正在测试：' + button.dataset.testAction, 'success')
    } finally {
      setTimeout(() => button.classList.remove('playing'), 2600)
    }
  })
}
document.querySelector('#stop-action').addEventListener('click', async () => {
  await window.fafa.pet.stop()
  document.querySelector('[data-test-action].playing')?.classList.remove('playing')
  setSaveState('动作已停止，发发回到待机', 'success')
})
/* ============================================================
   Add command / reminder / reset position bindings
   ============================================================ */
document.querySelector('#add-command')?.addEventListener('click', () => {
  document.querySelector('#command-list')?.append(commandRow())
  scheduleAutoSave(0)
})
document.querySelector('#add-reminder')?.addEventListener('click', () => {
  document.querySelector('#reminder-list')?.append(reminderRow())
  scheduleAutoSave(0)
})
document.querySelector('#reset-position')?.addEventListener('click', async () => {
  try {
    await window.fafa.window.resetPosition()
    setSaveState('已把发发移回主屏幕', 'success')
  } catch (error) {
    toast('移动失败：' + error.message, 'error', i18n('toast.saveFailed'))
  }
})

/* ============================================================
   Custom action (select from allActionOptions, ids only)
   ============================================================ */
const customActionSelect = document.querySelector('#custom-action-id')
if (customActionSelect) {
  customActionSelect.innerHTML = allActionOptions().map(a => '<option value="' + escapeAttribute(a.id) + '">' + escapeHtml(a.label) + '</option>').join('')
}
document.querySelector('#run-custom-action')?.addEventListener('click', async () => {
  const id = customActionSelect?.value?.trim() || 'act_greet'
  const text = document.querySelector('#custom-action-text').value.trim()
  await window.fafa.pet.test(id, text, 2600)
  setSaveState('正在测试：' + id, 'success')
})

/* ============================================================
   Service buttons: save current form + secret first, then fetch
   ============================================================ */
async function commitServiceConfig() {
  await saveSecrets()
  config = await window.fafa.config.update(collectConfigPatch())
  return config
}
document.querySelector('#llm-models-open')?.addEventListener('click', async () => {
  const btn = document.querySelector('#llm-models-open'); btn.disabled = true; btn.textContent = '保存并获取…'
  try {
    const next = await commitServiceConfig()
    const models = await window.fafa.providers.llmModels()
    llmModelsCache = [...new Set(Array.isArray(models) ? models : [])]
    populateLlmModelSelect(next.llm)
    toast('已获取 ' + llmModelsCache.length + ' 个模型', 'success')
    renderSignalLights(next)
  } catch (error) {
    toast(i18n('toast.modelsFailed') + '：' + error.message, 'error', i18n('toast.modelsFailed'))
  } finally { btn.textContent = i18n('btn.llmModels'); btn.disabled = false }
})
document.querySelector('#tts-models-open')?.addEventListener('click', async () => {
  const btn = document.querySelector('#tts-models-open'); btn.disabled = true; btn.textContent = '保存并获取…'
  try {
    const next = await commitServiceConfig()
    const models = await window.fafa.providers.ttsModels()
    ttsModelsCache = [...new Set(Array.isArray(models) ? models : [])]
    populateTtsModelSelect(next.tts)
    toast('已获取 ' + ttsModelsCache.length + ' 个 TTS 模型', 'success')
    renderSignalLights(next)
  } catch (error) {
    toast(i18n('toast.modelsFailed') + '：' + error.message, 'error', i18n('toast.modelsFailed'))
  } finally { btn.textContent = i18n('btn.ttsModels'); btn.disabled = false }
})
document.querySelector('#asr-models-open')?.addEventListener('click', async () => {
  const btn = document.querySelector('#asr-models-open'); btn.disabled = true; btn.textContent = '保存并获取…'
  try {
    const next = await commitServiceConfig()
    const models = await window.fafa.providers.asrModels()
    asrModelsCache = [...new Set(Array.isArray(models) ? models : [])]
    populateAsrModelSelect(next.asr)
    toast('已获取 ' + asrModelsCache.length + ' 个 ASR 模型', 'success')
    renderSignalLights(next)
  } catch (error) {
    toast(i18n('toast.modelsFailed') + '：' + error.message, 'error', i18n('toast.modelsFailed'))
  } finally { btn.textContent = i18n('btn.asrModels'); btn.disabled = false }
})
document.querySelector('#tts-voices-open')?.addEventListener('click', async () => {
  const btn = document.querySelector('#tts-voices-open'); btn.disabled = true; btn.textContent = '保存并读取…'
  try {
    const next = await commitServiceConfig()
    const voices = await window.fafa.providers.ttsVoices()
    ttsVoicesCache = [...new Set(Array.isArray(voices) ? voices : [])]
    populateTtsVoiceSelect(next.tts)
    toast('已获取 ' + ttsVoicesCache.length + ' 个音色', 'success')
    renderSignalLights(next)
  } catch (error) {
    toast(i18n('toast.voicesFailed') + '：' + error.message, 'error', i18n('toast.voicesFailed'))
  } finally { btn.textContent = i18n('btn.ttsVoices'); btn.disabled = false }
})

/* ---- 自定义音色导入（文件选择 + 拖拽） ---- */
function renderVoiceSampleStatus(voices) {
  const box = document.querySelector('#tts-voice-import-status')
  if (!box) return
  const list = Array.isArray(voices) ? voices : []
  if (!list.length) { box.hidden = true; return }
  box.hidden = false
  const small = box.querySelector('small')
  small.replaceChildren('已导入音色（点击删除）：')
  for (const voice of list) {
    const chip = document.createElement('button')
    chip.type = 'button'
    chip.className = 'voice-sample-chip'
    chip.title = voice?.path || ''
    chip.textContent = (voice?.name || '未命名') + ' ×'
    chip.addEventListener('click', async () => {
      chip.disabled = true
      try {
        const next = await window.fafa.voiceSamples.remove(voice.id)
        config = await window.fafa.config.get()
        populateTtsVoiceSelect(config.tts)
        renderVoiceSampleStatus(next)
      } catch (error) {
        toast('删除失败：' + error.message, 'error')
        chip.disabled = false
      }
    })
    small.append(chip)
  }
}
async function importVoiceSamples(paths) {
  if (!paths?.length) { toast('没有可导入的文件', 'error'); return }
  try {
    const voices = await window.fafa.voiceSamples.importPaths(paths)
    config = await window.fafa.config.get()
    populateTtsVoiceSelect(config.tts)
    renderVoiceSampleStatus(voices)
    toast('已导入 ' + paths.length + ' 个音色文件', 'success')
  } catch (error) {
    toast('导入失败：' + error.message, 'error')
  }
}
document.querySelector('#tts-voice-import-open')?.addEventListener('click', async () => {
  const btn = document.querySelector('#tts-voice-import-open'); btn.disabled = true
  try {
    const result = await window.fafa.voiceSamples.importDialog()
    if (!result?.canceled) renderVoiceSampleStatus(result?.voices || [])
  } catch (error) {
    toast('导入失败：' + error.message, 'error')
  } finally { btn.disabled = false }
})
const voiceDropZone = document.querySelector('#tts-voice-drop-zone')
for (const eventName of ['dragenter', 'dragover']) voiceDropZone?.addEventListener(eventName, (event) => {
  event.preventDefault()
  voiceDropZone.classList.add('drag-over')
})
for (const eventName of ['dragleave', 'drop']) voiceDropZone?.addEventListener(eventName, (event) => {
  event.preventDefault()
  voiceDropZone.classList.remove('drag-over')
})
voiceDropZone?.addEventListener('drop', async (event) => {
  const files = [...(event.dataTransfer?.files || [])]
  const paths = files.length ? window.fafa.voiceSamples.filePaths(files) : []
  if (!paths.length) { toast('无法读取拖入的文件路径，请使用「选择文件」按钮。', 'error'); return }
  await importVoiceSamples(paths)
})
document.querySelector('#live-test-open')?.addEventListener('click', async () => {
  const btn = document.querySelector('#live-test-open'); btn.disabled = true; btn.textContent = '测试中…'
  try {
    await commitServiceConfig()
    const result = await window.fafa.services.test('live')
    toast(result?.message || '直播连接测试完成', result?.ok === false ? 'error' : 'success', i18n('btn.liveTest'))
    renderSignalLights(config)
  } catch (error) {
    toast(i18n('toast.testFailed') + '：' + error.message, 'error', i18n('toast.testFailed'))
  } finally { btn.textContent = i18n('btn.liveTest'); btn.disabled = false }
})
// data-test-service (music) → toast
for (const button of document.querySelectorAll('[data-test-service]')) button.addEventListener('click', async () => {
  button.disabled = true; const original = button.textContent; button.textContent = '测试中…'
  try {
    await commitServiceConfig()
    const result = await window.fafa.services.test(button.dataset.testService)
    toast(result?.message || '连接测试通过', result?.ok === false ? 'error' : 'success', i18n('toast.musicResult'))
  } catch (error) {
    toast(i18n('toast.testFailed') + '：' + error.message, 'error', i18n('toast.testFailed'))
  } finally { button.textContent = original; button.disabled = false }
})

/* ============================================================
   console / timeline / diagnostics / relationship
   ============================================================ */
const consoleLiveStatus = document.querySelector('#console-live-status')
const consoleTrack = document.querySelector('#console-track')
const consoleLivePaused = document.querySelector('#console-live-paused')
const consoleNote = document.querySelector('#console-note')
const consoleTimeline = document.querySelector('#console-timeline')
const consoleTogglePause = document.querySelector('#console-toggle-pause')
const consoleReconnect = document.querySelector('#console-reconnect')
const consoleClearActions = document.querySelector('#console-clear-actions')
const consoleToggleWidget = document.querySelector('#console-toggle-widget')
const consoleRefreshTimeline = document.querySelector('#console-refresh-timeline')

const liveStatusLabel = { connected:'已连接', connecting:'连接中', reconnecting:'重连中', mock:'模拟测试模式', disabled:'未开启', disconnected:'未连接', error:'连接出错', ready:'就绪', offline:'离线' }
const liveStatusTone = (v) => v === 'connected' ? 'good' : (v === 'mock' || v === 'reconnecting' || v === 'connecting') ? 'warn' : (v === 'error') ? 'bad' : 'off'
const timelineTypeLabel = { danmaku:'弹幕', gift:'礼物', superChat:'SC', guard:'上舰', enter:'进场' }
const timelineOutcomeLabel = { processed:'已处理', paused:'已暂停', disabled:'已关闭', blocked:'已过滤', 'rate-limited':'限流', notified:'已通知' }
const overviewSummary = document.querySelector('#overview-summary')
const overviewLive = document.querySelector('#overview-live-status')
const overviewAi = document.querySelector('#overview-ai-status')
const overviewRelationship = document.querySelector('#overview-relationship-status')
const overviewLiveAction = document.querySelector('#overview-live-action')
const overviewNextTitle = document.querySelector('#overview-next-title')
const overviewNextDescription = document.querySelector('#overview-next-description')
const overviewNextAction = document.querySelector('#overview-next-action')
let latestRelationshipState = {}

function setOverviewStatus(element, tone, title, description) {
  if (!element) return
  element.dataset.tone = tone
  element.querySelector('strong').textContent = title
  element.querySelector('span').textContent = description
}
function renderOverviewRelationship(state = latestRelationshipState) {
  latestRelationshipState = state || {}
  const daily = Math.max(0, Math.min(50, Math.round(Number(latestRelationshipState.dailyInteractions) || 0)))
  const stage = latestRelationshipState.stage || '初见'
  const mood = Math.max(0, Math.min(100, Math.round(Number(latestRelationshipState.mood) || 0)))
  setOverviewStatus(overviewRelationship, daily > 0 ? 'good' : 'off', daily + ' 次互动', stage + ' · 心情 ' + mood)
}
function renderOverview(status = {}) {
  const live = status.live || 'disconnected'
  const liveConnected = live === 'connected' || live === 'mock'
  const livePaused = Boolean(status.livePaused)
  const serviceValues = [status.tts, status.llm, status.asr]
  const serviceReady = serviceValues.filter((value) => value === 'ready').length
  const serviceError = serviceValues.some((value) => value === 'error')
  const serviceBusy = serviceValues.some((value) => value === 'connecting' || value === 'reconnecting')

  setOverviewStatus(overviewLive, livePaused ? 'warn' : liveStatusTone(live), livePaused ? '互动已暂停' : (liveStatusLabel[live] || live), livePaused ? '恢复后继续接收直播互动' : (liveConnected ? '悬浮组件会显示新的互动' : '配置房间后即可开始'))
  const aiTone = serviceError ? 'bad' : serviceBusy ? 'warn' : serviceReady ? 'good' : 'off'
  const aiTitle = serviceError ? '需要检查' : serviceBusy ? '正在连接' : serviceReady ? (serviceReady === serviceValues.length ? '服务就绪' : '部分服务就绪') : '尚未启用'
  setOverviewStatus(overviewAi, aiTone, aiTitle, 'TTS · AI · 语音识别')
  renderOverviewRelationship()

  if (overviewSummary) overviewSummary.textContent = liveConnected
    ? (livePaused ? '直播互动已暂停；恢复后，新的互动会继续显示。' : '直播连接正常，新的互动会同步到桌面悬浮组件。')
    : '先完成直播互动配置，发发就能接收弹幕、礼物和其他互动。'
  if (overviewLiveAction) overviewLiveAction.textContent = liveConnected ? '查看直播状态' : '配置直播互动'
  if (overviewNextTitle) overviewNextTitle.textContent = liveConnected ? (livePaused ? '恢复直播互动' : '打开桌面悬浮组件') : '从直播互动开始'
  if (overviewNextDescription) overviewNextDescription.textContent = liveConnected
    ? (livePaused ? '当前不会处理新的直播互动；可在直播页面恢复。' : '实时事件、AI 回答和触发动作会显示在独立的桌面组件中。')
    : '配置直播间后，发发就能接收弹幕、礼物和其他互动。'
  if (overviewNextAction) overviewNextAction.textContent = liveConnected && !livePaused ? '打开悬浮组件' : '前往直播互动'
}
function setConsoleNote(message, tone = '') {
  if (!consoleNote) return
  const note = document.createElement('small'); if (tone) note.className = tone; note.textContent = message
  consoleNote.replaceChildren(note)
}
function renderConsoleStatus(status) {
  if (!consoleLiveStatus) return
  consoleLiveStatus.textContent = liveStatusLabel[status.live] || status.live || '—'
  consoleLiveStatus.dataset.tone = liveStatusTone(status.live)
  consoleTrack.textContent = status.currentTrack ? String(status.currentTrack) : '—'
  const paused = Boolean(status.livePaused)
  consoleLivePaused.textContent = paused ? '已暂停' : '运行中'
  consoleLivePaused.dataset.tone = paused ? 'warn' : 'good'
  if (consoleTogglePause) consoleTogglePause.textContent = paused ? '恢复直播互动' : '暂停直播互动'
}
function formatTimelineTime(at) {
  const t = new Date(Number(at) || 0); if (!Number.isFinite(t.getTime()) || t.getTime() === 0) return '--:--:--'
  return [t.getHours(), t.getMinutes(), t.getSeconds()].map(p => String(p).padStart(2, '0')).join(':')
}
function renderTimeline(entries) {
  if (!consoleTimeline) return
  consoleTimeline.replaceChildren(...(entries || []).slice(0, 200).map(e => {
    const row = document.createElement('div'); row.className = 'timeline-row'
    row.innerHTML =
      '<time>' + escapeHtml(formatTimelineTime(e.at)) + '</time>' +
      '<span class="timeline-type" data-type="' + escapeAttribute(e.type) + '">' + escapeHtml(timelineTypeLabel[e.type] || e.type || '事件') + '</span>' +
      '<span class="timeline-text">' + escapeHtml(e.text || '') + '</span>' +
      '<span class="timeline-outcome" data-outcome="' + escapeAttribute(e.outcome) + '">' + escapeHtml(timelineOutcomeLabel[e.outcome] || e.outcome || '') + '</span>'
    return row
  }))
}
async function reloadTimeline() {
  if (!consoleRefreshTimeline) return
  consoleRefreshTimeline.disabled = true; consoleRefreshTimeline.textContent = '读取中…'
  try { const entries = await window.fafa.live.timeline(); renderTimeline(entries); setConsoleNote('已读取 ' + (entries?.length || 0) + ' 条事件。') }
  catch (error) { setConsoleNote('读取时间线失败：' + error.message, 'error') }
  finally { consoleRefreshTimeline.textContent = i18n('btn.refresh'); consoleRefreshTimeline.disabled = false }
}
let consoleInitialized = false
async function initConsole() {
  try {
    const status = await window.fafa.services.status()
    renderConsoleStatus(status)
    renderDiagnostics(status)
  } catch {}
  if (!consoleInitialized) {
    consoleInitialized = true
    reloadTimeline()
  }
}
window.fafa.services.onStatus((status) => { renderConsoleStatus(status); renderDiagnostics(status) })
consoleTogglePause?.addEventListener('click', async () => {
  consoleTogglePause.disabled = true
  try {
    const status = await window.fafa.services.status()
    if (status.livePaused) { await window.fafa.live.resume(); setConsoleNote('已恢复直播互动。') }
    else { await window.fafa.live.pause(); setConsoleNote('已暂停直播互动。') }
  } catch (error) { setConsoleNote('操作失败：' + error.message, 'error') }
  finally { consoleTogglePause.disabled = false }
})
consoleReconnect?.addEventListener('click', async () => {
  consoleReconnect.disabled = true
  setConsoleNote('正在重连直播…')
  try { const status = await window.fafa.live.reconnect(); renderConsoleStatus(status); setConsoleNote('已重连直播。', 'success'); toast('已重连直播', 'success') }
  catch (error) { setConsoleNote('重连失败：' + error.message, 'error'); toast('重连失败：' + error.message, 'error') }
  finally { consoleReconnect.disabled = false }
})
consoleClearActions?.addEventListener('click', async () => {
  consoleClearActions.disabled = true
  try { const count = await window.fafa.live.clearActions(); const msg = '已清空 ' + (Number(count) || 0) + ' 条直播待播动作。'; setConsoleNote(msg); toast(msg, 'success') }
  catch (error) { setConsoleNote('清空失败：' + error.message, 'error'); toast('清空失败：' + error.message, 'error') }
  finally { consoleClearActions.disabled = false }
})
consoleToggleWidget?.addEventListener('click', () => {
  if (typeof window.fafa.live.toggleWidget === 'function') { window.fafa.live.toggleWidget(); toast('已切换桌面悬浮组件', 'success') }
  else { toast('桌面悬浮组件不可用', 'warn') }
})
consoleRefreshTimeline?.addEventListener('click', reloadTimeline)
function openSettingsPanel(tab) { document.querySelector('nav button[data-tab="' + tab + '"]')?.click() }
overviewLiveAction?.addEventListener('click', () => openSettingsPanel('live'))
overviewNextAction?.addEventListener('click', () => {
  if (latestServiceStatus.live === 'connected' || latestServiceStatus.live === 'mock') consoleToggleWidget?.click()
  else openSettingsPanel('live')
})
for (const button of document.querySelectorAll('[data-overview-action]')) button.addEventListener('click', () => {
  const action = button.dataset.overviewAction
  if (action === 'reset-position') document.querySelector('#reset-position')?.click()
  else openSettingsPanel(action)
})

/* ---- diagnostics ---- */
const diagLabels = { live:'直播', tts:'TTS', llm:'AI', asr:'ASR', music:'点歌' }
const diagTones = (v) => v === 'ready' ? 'good' : (['mock','connecting','reconnecting'].includes(v)) ? 'warn' : v === 'error' ? 'bad' : 'off'
function renderDiagnostics(status) {
  const panel = document.querySelector('#diagnostics'); if (!panel) return
  const keys = ['live', 'tts', 'llm', 'asr', 'music']
  panel.innerHTML = keys.map(k => '<article class="status" data-tone="' + diagTones(status[k]) + '"><b>' + escapeHtml(diagLabels[k]) + '</b><span>' + escapeHtml(String(status[k] || 'off')) + '</span></article>').join('')
  latestServiceStatus = { ...(latestServiceStatus || {}), ...status }
  renderOverview(latestServiceStatus)
  renderSignalLights(config)
}

/* ---- status signal lights: green connected / yellow connecting / red disconnected ---- */
let latestServiceStatus = {}
function setSignalLight(id, tone, label) {
  const light = document.getElementById(id)
  if (!light) return
  light.dataset.tone = tone
  light.title = label
  light.innerHTML = '<i aria-hidden="true"></i><span>' + escapeHtml(label) + '</span>'
}
function toneForServiceReady(ready) {
  return ready ? 'good' : 'bad'
}
function renderSignalLights(c = config) {
  const status = latestServiceStatus || {}
  const live = status.live || (c.liveEnabled ? (c.liveMock ? 'mock' : 'connecting') : 'disabled')
  const liveTone = live === 'connected' ? 'good' : (['mock', 'connecting', 'reconnecting'].includes(live)) ? 'warn' : 'bad'
  setSignalLight('live-light', liveTone, { connected:'已连接', mock:'模拟模式', connecting:'连接中', reconnecting:'重连中', disabled:'未开启', error:'连接出错' }[live] || '未连接')
  const musicState = status.music
  setSignalLight('music-light', musicState === 'ready' ? 'good' : musicState === 'mock' ? 'warn' : c.music?.enabled ? (c.music?.mock ? 'warn' : 'good') : 'bad', musicState === 'ready' ? '点歌服务连接成功' : musicState === 'mock' ? '模拟模式' : c.music?.enabled ? (c.music?.mock ? '模拟模式' : '服务已启用') : '未连接')
  setSignalLight('voice-light', c.voice?.enabled ? 'good' : 'bad', c.voice?.enabled ? '麦克风已启用' : '麦克风未开启')

  const ttsReady = c.tts?.enabled && (c.tts?.preset === 'edge-tts' ? true : c.tts?.preset === 'voicebox' ? Boolean(c.tts?.baseUrl && c.tts?.voice) : Boolean(c.tts?.hasKey))
  const ttsState = status.tts
  const ttsTone = ttsState === 'ready' ? 'good' : ttsState === 'error' ? 'bad' : !c.tts?.enabled ? 'bad' : ttsReady ? 'good' : 'warn'
  setSignalLight('tts-light', ttsTone, ttsState === 'ready' ? 'TTS 连接成功' : ttsState === 'error' ? 'TTS 连接失败' : !c.tts?.enabled ? '未连接' : ttsReady ? 'TTS 已就绪' : '已开启但缺少配置')
  const llmReady = c.llm?.enabled && (c.llm?.preset === 'voicebox' ? Boolean(c.llm?.baseUrl) : c.llm?.preset === 'custom' ? Boolean(c.llm?.baseUrl) : Boolean(c.llm?.hasKey))
  const llmState = status.llm
  const llmTone = llmState === 'ready' ? 'good' : llmState === 'error' ? 'bad' : !c.llm?.enabled ? 'bad' : llmReady ? 'good' : 'warn'
  setSignalLight('llm-light', llmTone, llmState === 'ready' ? 'AI 连接成功' : llmState === 'error' ? 'AI 连接失败' : !c.llm?.enabled ? '未连接' : llmReady ? 'AI 已就绪' : '已开启但缺少配置')
  const asrReady = c.asr?.enabled && (c.asr?.preset === 'voicebox' ? Boolean(c.asr?.baseUrl) : Boolean(c.asr?.hasKey))
  const asrState = status.asr
  const asrTone = asrState === 'ready' ? 'good' : asrState === 'error' ? 'bad' : !c.asr?.enabled ? 'bad' : asrReady ? 'good' : 'warn'
  setSignalLight('asr-light', asrTone, asrState === 'ready' ? 'ASR 连接成功' : asrState === 'error' ? 'ASR 连接失败' : !c.asr?.enabled ? '未连接' : asrReady ? 'ASR 已就绪' : '已开启但缺少配置')

  const avatarMode = c.avatar?.mode || 'video'
  const live2dActive = avatarMode === 'live2d' && Boolean(c.avatar?.live2d?.activeModelId)
  const vtsEnabled = avatarMode === 'vts' && c.avatar?.vtubeStudio?.enabled !== false
  setSignalLight('avatar-video-light', avatarMode === 'video' ? 'good' : 'bad', avatarMode === 'video' ? '视频动作已启用' : '未使用')
  setSignalLight('avatar-live2d-light', avatarMode === 'live2d' ? (live2dActive ? 'good' : 'warn') : 'bad', avatarMode === 'live2d' ? (live2dActive ? 'Live2D 模型已选择' : '尚未选择模型') : '未连接')
  setSignalLight('avatar-vts-light', avatarMode === 'vts' ? (vtsEnabled ? 'warn' : 'bad') : 'bad', avatarMode === 'vts' ? (vtsEnabled ? 'VTube Studio 已启用' : '未启用') : '未连接')
  setSignalLight('avatar-live2d-panel-light', live2dActive ? 'good' : (avatarModels?.length ? 'warn' : 'bad'), live2dActive ? '当前模型已就绪' : (avatarModels?.length ? '有模型但未选择' : '未导入模型'))
  setSignalLight('avatar-vts-panel-light', vtsEnabled ? 'warn' : 'bad', vtsEnabled ? '等待连接测试' : '未启用')
}

/* ---- relationship ---- */
const relationshipGrid = document.querySelector('#relationship-status')
function renderRelationship(state = {}) {
  latestRelationshipState = state || {}
  const intimacy = Math.max(0, Math.round(Number(state.intimacy) || 0))
  const daily = Math.max(0, Math.min(50, Math.round(Number(state.dailyInteractions) || 0)))
  const mood = Math.max(0, Math.min(100, Math.round(Number(state.mood) || 0)))
  const stage = state.stage || '初见'
  const stages = [
    ['初见', '0'],
    ['熟悉', '100'],
    ['亲密', '300'],
    ['家人', '700']
  ]
  const stageTrack = '<article class="relationship-card relationship-stage-track"><small>阶段路径</small><b>关系阶段</b><ol>' + stages.map(([name, threshold]) =>
    '<li class="' + (name === stage ? 'current' : '') + '"><span>' + escapeHtml(name) + '</span><small>' + escapeHtml(threshold) + '+</small></li>'
  ).join('') + '</ol></article>'
  const cards = [
    '<article class="relationship-card"><small>亲密</small><b>亲密度</b><span class="rel-value"><output>' + escapeHtml(String(intimacy)) + '</output><span class="rel-unit">/ 1000</span></span><div class="rel-meter"><div class="rel-meter-fill" style="width:' + Math.min(100, intimacy / 10) + '%"></div></div></article>',
    '<article class="relationship-card"><small>今日</small><b>今日互动</b><span class="rel-value"><output>' + escapeHtml(String(daily)) + '</output><span class="rel-unit">/ 50</span></span><div class="rel-meter"><div class="rel-meter-fill mood" style="width:' + (daily / 50 * 100) + '%"></div></div></article>',
    '<article class="relationship-card"><small>心情</small><b>心情</b><span class="rel-value"><output>' + escapeHtml(String(mood)) + '</output><span class="rel-unit">/ 100</span></span><div class="rel-meter"><div class="rel-meter-fill mood" style="width:' + mood + '%"></div></div></article>',
    stageTrack
  ]
  relationshipGrid.innerHTML = cards.join('')
  renderOverviewRelationship(latestRelationshipState)
}

/* ============================================================
   Dialogs
   ============================================================ */
for (const dialog of document.querySelectorAll('dialog')) dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close() })
for (const dlg of document.querySelectorAll('dialog')) dlg.addEventListener('close', () => { if (dlg.id === 'voice-test-dialog') stopVoiceCapture() })
for (const dialog of document.querySelectorAll('dialog')) {
  const handle = dialog.querySelector('.dialog-head')
  if (!handle) continue
  let drag = null
  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || event.target.closest('button, input, select, textarea, a')) return
    const rect = dialog.getBoundingClientRect()
    drag = { pointerId:event.pointerId, offsetX:event.clientX - rect.left, offsetY:event.clientY - rect.top }
    dialog.classList.add('is-dragging')
    dialog.style.left = rect.left + 'px'
    dialog.style.top = rect.top + 'px'
    dialog.style.transform = 'none'
    handle.setPointerCapture?.(event.pointerId)
    event.preventDefault()
  })
  window.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return
    const rect = dialog.getBoundingClientRect()
    const x = Math.max(8, Math.min(window.innerWidth - rect.width - 8, event.clientX - drag.offsetX))
    const y = Math.max(8, Math.min(window.innerHeight - rect.height - 8, event.clientY - drag.offsetY))
    dialog.style.left = x + 'px'
    dialog.style.top = y + 'px'
  })
  const finish = (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return
    drag = null
    dialog.classList.remove('is-dragging')
    try { handle.releasePointerCapture?.(event.pointerId) } catch {}
  }
  window.addEventListener('pointerup', finish)
  window.addEventListener('pointercancel', finish)
}

/* ---- LLM chat test ---- */
const llmDialog = document.querySelector('#llm-test-dialog'); const llmReplyBox = document.querySelector('#llm-test-reply')
document.querySelector('#llm-test-dialog-open')?.addEventListener('click', () => { if (llmReplyBox) { llmReplyBox.textContent = ''; llmReplyBox.className = 'dialog-reply' } llmDialog.showModal() })
document.querySelector('#llm-test-send')?.addEventListener('click', async () => {
  const input = document.querySelector('#llm-test-input'); const text = input.value.trim(); if (!text) return
  const btn = document.querySelector('#llm-test-send'); btn.disabled = true
  llmReplyBox.textContent = '发发思考中…'; llmReplyBox.className = 'dialog-reply'
  try {
    const next = await commitServiceConfig()
    const reply = await window.fafa.providers.llmReply(text)
    llmReplyBox.innerHTML = '<div class="dialog-model-line">使用模型：' + escapeHtml(next.llm?.model || resolveLlmModel()) + '</div>' + '<div class="dialog-reply-body">' + escapeHtml(reply || '发发没有回应。') + '</div>'
    llmReplyBox.className = 'dialog-reply success'
    renderSignalLights(next)
  } catch (error) {
    llmReplyBox.innerHTML = '<div class="dialog-model-line">使用模型：' + escapeHtml(resolveLlmModel()) + '</div>' + '<div class="dialog-reply-body">' + escapeHtml('对话失败：' + error.message) + '</div>'
    llmReplyBox.className = 'dialog-reply error'
  } finally { btn.disabled = false }
})

/* ---- TTS listen ---- */
const ttsDialog = document.querySelector('#tts-listen-dialog'); const ttsResult = document.querySelector('#tts-listen-result')
document.querySelector('#tts-listen-open')?.addEventListener('click', () => { ttsResult.textContent = ''; ttsResult.className = 'dialog-reply'; ttsDialog.showModal() })
document.querySelector('#tts-listen-play')?.addEventListener('click', async () => {
  const text = document.querySelector('#tts-listen-input').value.trim(); if (!text) return
  const btn = document.querySelector('#tts-listen-play'); btn.disabled = true
  ttsResult.textContent = '正在合成…'; ttsResult.className = 'dialog-reply'
  try {
    const next = await commitServiceConfig()
    const payload = await window.fafa.providers.ttsSynthesize(text)
    if (!payload || !payload.value) { ttsResult.textContent = '当前离线，无法合成语音。'; ttsResult.className = 'dialog-reply error'; return }
    // Edge TTS 等返回 data:audio/mpeg 可直接试听；仅裸 PCM（data:audio/pcm）无法直接播放
    if (payload.type === 'data' && !/^data:audio\/(?!pcm\b)/i.test(payload.value)) { ttsResult.textContent = '当前音色返回的格式无法试听。'; ttsResult.className = 'dialog-reply error'; return }
    const audio = new Audio(payload.value)
    await audio.play()
    ttsResult.textContent = '正在播放试听…'; ttsResult.className = 'dialog-reply success'
    renderSignalLights(next)
  } catch (error) { ttsResult.textContent = '试听失败：' + error.message; ttsResult.className = 'dialog-reply error' }
  finally { btn.disabled = false }
})

/* ---- ASR connection test ---- */
const asrDialog = document.querySelector('#asr-test-dialog'); const asrResult = document.querySelector('#asr-test-result')
document.querySelector('#asr-test-dialog-open')?.addEventListener('click', async () => {
  asrResult.textContent = '正在保存配置并测试连接…'; asrResult.className = 'dialog-reply'; asrDialog.showModal()
  try {
    const next = await commitServiceConfig()
    renderSignalLights(next)
    const result = await window.fafa.services.test('asr')
    asrResult.innerHTML = result?.ok === false
      ? '<span class="tone-bad">连接失败</span>：' + escapeHtml(result?.message || '')
      : '<span class="tone-good">连接成功</span>：' + escapeHtml(result?.message || '连接测试通过')
    asrResult.className = result?.ok === false ? 'dialog-reply error' : 'dialog-reply'
  } catch (error) { asrResult.textContent = '测试失败：' + error.message; asrResult.className = 'dialog-reply error' }
})

/* ---- relationship reset ---- */
const resetDialog = document.querySelector('#reset-relationship-dialog')
document.querySelector('#reset-relationship')?.addEventListener('click', () => resetDialog.showModal())
document.querySelector('#reset-relationship-confirm')?.addEventListener('click', async (e) => {
  e.preventDefault()
  const btn = e.currentTarget; btn.disabled = true; btn.textContent = '正在重置…'
  try {
    const state = await window.fafa.relationship.reset()
    renderRelationship(state)
    resetDialog.close('confirm')
    toast('关系已重置', 'success')
  } catch (error) { toast('重置失败：' + error.message, 'error') }
  finally { btn.textContent = i18n('dlg.confirmReset'); btn.disabled = false }
})

/* ============================================================
   Microphone devices + voice capture (voice-capture.js)
   ============================================================ */
let stopVoiceCapture = () => {}
async function refreshVoiceDevices() {
  const select = form.elements.voiceDeviceId; const note = document.querySelector('#voice-device-note')
  const current = select.value
  select.replaceChildren()
  try {
    const mod = await import('./voice-capture.js')
    const devices = await mod.enumerateMicDevices()
    if (!devices.length) {
      select.append(new Option('未检测到麦克风', ''))
      if (note) note.textContent = '未检测到麦克风设备。'
    } else {
      for (const mic of devices) select.append(new Option(mic.label || ('麦克风 ' + String(mic.deviceId).slice(0, 6)), mic.deviceId))
      if (note) note.textContent = '已找到 ' + devices.length + ' 个设备。'
    }
    if ([...select.options].some(o => o.value === current)) select.value = current
  } catch (error) {
    if (note) note.textContent = '请允许麦克风权限：' + error.message
  }
  if (current && ![...select.options].some(o => o.value === current)) { select.append(new Option('麦克风 ' + String(current).slice(0, 6), current)); select.value = current }
}
document.querySelector('#voice-refresh')?.addEventListener('click', refreshVoiceDevices)

/* ---- voice test dialog ---- */
const voiceDialog = document.querySelector('#voice-test-dialog')
const meterFill = document.querySelector('#voice-level-meter'); const meterValue = document.querySelector('#voice-level-value')
const voiceTestResult = document.querySelector('#voice-test-result')
document.querySelector('#voice-test-open')?.addEventListener('click', async () => {
  voiceTestResult.textContent = ''; voiceTestResult.className = 'dialog-reply'
  meterFill.style.width = '0%'; meterValue.value = 0
  setVoicePipeline({ asr:'正在采集麦克风音频…', ai:'等待 ASR 完成一句转写', tts:'等待 AI 或指令结果' })
  voiceDialog.showModal()
  try {
    const mod = await import('./voice-capture.js')
    const deviceId = form.elements.voiceDeviceId.value
    const capture = await mod.createVoiceCapture({
      deviceId: deviceId || '',
      onLevel: (level) => {
        const pct = Math.max(0, Math.min(100, Number(level) * 100 || 0))
        meterFill.style.width = pct + '%'; meterFill.setAttribute('aria-valuenow', String(Math.round(pct))); meterValue.value = Math.round(pct)
      },
      onPcm16k: config.asr?.enabled ? (chunk) => window.fafa.voice.testPcm(chunk) : null,
      onError: (error) => {
        voiceTestResult.textContent = '无法采集麦克风：' + error.message
        voiceTestResult.className = 'dialog-reply error'
        setVoicePipeline({ asr:'采集失败：' + error.message, ai:'未运行', tts:'未运行' })
      }
    })
    await capture.start()
    stopVoiceCapture = () => { try { capture.stop() } catch {} ; window.fafa.voice.testPcmEnd?.() }
  } catch (error) {
    voiceTestResult.textContent = '无法采集麦克风：' + error.message; voiceTestResult.className = 'dialog-reply error'
    setVoicePipeline({ asr:'采集失败：' + error.message, ai:'未运行', tts:'未运行' })
  }
})
window.fafa.voice.onTestResult?.(({ text, result, error } = {}) => {
  if (error) {
    voiceTestResult.textContent = 'ASR 识别失败：' + error
    voiceTestResult.className = 'dialog-reply error'
    setVoicePipeline({ asr:'识别失败：' + error, ai:'未运行', tts:'未运行' })
    return
  }
  const line = result?.kind === 'llm' ? '识别到「' + text + '」；AI 回复：' + (result.text || '') : '识别到「' + text + '」' + (result?.kind === 'command' ? '，已触发指令：' + result.actionId : '')
  voiceTestResult.textContent = line
  voiceTestResult.className = 'dialog-reply success'
  setResultBox(voiceSimResult, line, 'success')
  setVoicePipeline(describeVoicePipeline(text, result))
})
document.querySelector('#voice-test-mic-open')?.addEventListener('click', async () => {
  const button = document.querySelector('#voice-test-mic-open')
  button.disabled = true
  try {
    await commitServiceConfig()
    if (document.querySelector('#voice-test-open')) document.querySelector('#voice-test-open').dispatchEvent(new MouseEvent('click'))
    const state = document.querySelector('#voice-test-mic-state')
    if (state) state.textContent = config.asr?.enabled ? '麦克风与 ASR 链路已启动，请直接说话；下方会显示每一步结果。' : '麦克风已启动；要测试识别，请先开启 ASR。'
  } catch (error) {
    const state = document.querySelector('#voice-test-mic-state')
    if (state) state.textContent = '启动失败：' + error.message
  } finally { button.disabled = false }
})
document.querySelector('#voice-shout-sim')?.addEventListener('click', () => { window.fafa.voice.level(90); voiceTestResult.textContent = '已模拟大叫。'; voiceTestResult.className = 'dialog-reply success' })

/* ============================================================
   Theme toggle
   ============================================================ */
themeToggle.addEventListener('click', () => {
  setTheme(currentTheme === 'light' ? 'dark' : 'light')
  scheduleAutoSave(0)
})


/* ============================================================
   Init finale
   ============================================================ */
for (const service of ['tts', 'llm', 'asr']) { const s = form.elements[service + 'Preset']; if (s) s.innerHTML = presetOptions(service) }
fill(config)
renderCommandCatalog()
renderActionTests(actionEntries)
bindActionTests()
for (const [name, selector] of [['liveEnabled','#live-detail'],['voiceEnabled','#voice-detail'],['asrEnabled','#asr-detail'],['llmEnabled','#llm-detail'],['ttsEnabled','#tts-detail'],['safetyEnabled','#safety-detail']]) bindCollapse(name, selector)
bindPanelDisclosure('#voice-test-collapse', '#voice-test-detail')
mutualExclusion()
refreshQuickStrip()
// preset change wiring
for (const name of ['ttsPreset','llmPreset','asrPreset']) {
  const service = name.replace('Preset', '')
  form.elements[name]?.addEventListener('change', () => {
    applyProviderPreset(service)
    if (service === 'llm') { updateLlmBaseUrlVisibility(); populateLlmModelSelect(config.llm) }
    if (service === 'tts') { updateTtsVoiceCustomVisibility(); populateTtsModelSelect(config.tts) }
    if (service === 'asr') populateAsrModelSelect(config.asr)
    updateVoiceboxHints()
    scheduleAutoSave(0)
  })
}
const ttsVoiceSelect = form.elements.ttsVoiceSelect || document.querySelector('#ttsVoiceSelect')
ttsVoiceSelect?.addEventListener('change', () => { updateTtsVoiceCustomVisibility(); scheduleAutoSave(0) })
serviceConfigPreset?.addEventListener('change', () => updateVoiceboxHints())
form.elements.scale?.addEventListener('input', () => { const v = Number(form.elements.scale.value) || 0.52; window.fafa.window.previewScale(v / 0.52) })
form.elements.ttsEnabled?.addEventListener('change', refreshQuickStrip)
form.elements.llmEnabled?.addEventListener('change', refreshQuickStrip)
refreshVoiceDevices()
initConsole()
try { renderRelationship(await window.fafa.relationship.get()) } catch {}
try { window.fafa.relationship.onChanged(renderRelationship) } catch {}
try { renderVoiceSampleStatus(await window.fafa.voiceSamples.list()) } catch {}
storeButtonLabels()
setSaveState(i18n('save.autosaved'))
applyPanelTitle(document.querySelector('nav button.active')?.dataset.tab || 'overview')
