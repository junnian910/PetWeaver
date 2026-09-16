import { describe, expect, it } from 'vitest'
import { parseCommand, parseDirectCommand } from '../src/main/core/command-parser.js'
import { defaultCommands } from '../src/main/defaults.js'

describe('parseCommand', () => {
  it.each(['发发*跳舞', 'fafa，跳舞', ' FUAfua * 跳舞 ', '发发  跳舞', '发发，跳舞'])('parses alias prefix: %s', (text) => {
    expect(parseCommand(text, defaultCommands)).toMatchObject({ type: 'command', actionId: 'act_dance' })
  })
  it.each(['点歌*夜に駆ける', '点歌 夜に駆ける'])('parses music requests: %s', (text) => {
    expect(parseCommand(text, defaultCommands)).toEqual({ type: 'music', query: '夜に駆ける' })
  })
  it('returns unknown for unlisted commands', () => expect(parseCommand('发发*今天怎么样', defaultCommands)).toEqual({ type: 'unknown', prompt: '今天怎么样' }))
  it('ignores ordinary messages', () => expect(parseCommand('大家好', defaultCommands)).toBeNull())
  it('still requires the 发发 prefix for danmaku', () => expect(parseCommand('跳舞', defaultCommands)).toBeNull())
})

describe('parseDirectCommand (voice transcripts do not need the 发发 prefix)', () => {
  it('matches aliases directly', () => expect(parseDirectCommand('跳舞', defaultCommands)).toMatchObject({ type: 'command', actionId: 'act_dance' }))
  it('strips an optional 发发 prefix', () => expect(parseDirectCommand('发发 跳舞', defaultCommands)).toMatchObject({ type: 'command', actionId: 'act_dance' }))
  it('parses music requests without the prefix', () => expect(parseDirectCommand('点歌 晴天', defaultCommands)).toEqual({ type: 'music', query: '晴天' }))
  it('returns null for ordinary speech', () => expect(parseDirectCommand('今天天气不错', defaultCommands)).toBeNull())
})
