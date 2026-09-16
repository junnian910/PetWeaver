import { describe, expect, it, vi } from 'vitest'
import { VTubeStudioClient } from '../src/main/providers/vtube-studio.js'

function createFakeSocket() {
  const listeners = new Map()
  return {
    readyState: 1,
    sent: [],
    closed: false,
    on(event, handler) { listeners.set(event, handler) },
    off(event, handler) { if (listeners.get(event) === handler) listeners.delete(event) },
    emit(event, ...args) { listeners.get(event)?.(...args) },
    send(frame) { this.sent.push(frame) },
    close() { this.closed = true }
  }
}

function fakeWsFactory() {
  const socket = createFakeSocket()
  const open = () => socket.emit('open')
  return {
    socket,
    Ctor: function () { return socket },
    open
  }
}

async function openClient() {
  const fake = fakeWsFactory()
  const client = new VTubeStudioClient({ host: '127.0.0.1', port: 8001 }, { WebSocketImpl: fake.Ctor })
  const connecting = client.connect()
  fake.open()
  await connecting
  return { client, fake }
}

describe('VTubeStudioClient', () => {
  it('connects to the default plugin websocket url and sends API envelope', async () => {
    const fake = fakeWsFactory()
    const client = new VTubeStudioClient({}, { WebSocketImpl: fake.Ctor })
    const connecting = client.connect()
    fake.open()
    await connecting
    const pending = client.request('APIStateRequest')
    const payload = JSON.parse(fake.socket.sent[0])
    expect(payload).toMatchObject({ apiName: 'VTubeStudioPublicAPI', apiVersion: '1.0', messageType: 'APIStateRequest' })
    fake.socket.emit('message', JSON.stringify({ requestID: payload.requestID, messageType: 'APIStateResponse', data: { active: true, currentSessionAuthenticated: false } }))
    const result = await pending
    expect(result.data.currentSessionAuthenticated).toBe(false)
    client.disconnect()
  })

  it('reports unauthenticated-but-online state without failing the probe', async () => {
    const { client, fake } = await openClient()
    const pending = client.test()
    const payload = JSON.parse(fake.socket.sent[0])
    fake.socket.emit('message', JSON.stringify({ requestID: payload.requestID, messageType: 'APIStateResponse', data: { active: true, vTubeStudioVersion: '1.29.0', currentSessionAuthenticated: false } }))
    const result = await pending
    expect(result).toMatchObject({ ok: true, authenticated: false })
    expect(result.message).toContain('允许')
    client.disconnect()
  })

  it('authenticates with token request then authentication request', async () => {
    const { client, fake } = await openClient()
    const pending = client.authenticate()
    const tokenPayload = JSON.parse(fake.socket.sent[0])
    fake.socket.emit('message', JSON.stringify({ requestID: tokenPayload.requestID, messageType: 'AuthenticationTokenResponse', data: { authenticationToken: 'token-1' } }))
    await new Promise((resolve) => setTimeout(resolve, 0))
    const authPayload = JSON.parse(fake.socket.sent[1])
    expect(authPayload.messageType).toBe('AuthenticationRequest')
    expect(authPayload.data.authenticationToken).toBe('token-1')
    fake.socket.emit('message', JSON.stringify({ requestID: authPayload.requestID, messageType: 'AuthenticationResponse', data: { authenticated: true } }))
    expect(await pending).toMatchObject({ ok: true, message: '插件认证成功' })
    client.disconnect()
  })

  it('reuses a persisted token without requesting a new token', async () => {
    const { client, fake } = await openClient()
    const pending = client.authenticate('saved-token')
    const authPayload = JSON.parse(fake.socket.sent[0])
    expect(authPayload.messageType).toBe('AuthenticationRequest')
    expect(fake.socket.sent).toHaveLength(1)
    fake.socket.emit('message', JSON.stringify({ requestID: authPayload.requestID, messageType: 'AuthenticationResponse', data: { authenticated: true } }))
    await expect(pending).resolves.toMatchObject({ ok: true, token: 'saved-token' })
    expect(client.authenticationToken).toBe('saved-token')
    client.disconnect()
  })

  it('normalizes model, expression and hotkey lists from the public API', async () => {
    const { client, fake } = await openClient()
    const modelsPending = client.availableModels()
    let payload = JSON.parse(fake.socket.sent[0])
    fake.socket.emit('message', JSON.stringify({ requestID: payload.requestID, messageType: 'AvailableModelsResponse', data: { availableModels: [{ modelID: 'm1', modelName: '模型A' }] } }))
    expect(await modelsPending).toEqual([{ id: 'm1', name: '模型A', loaded: false }])

    const expressionsPending = client.expressions()
    payload = JSON.parse(fake.socket.sent.at(-1))
    fake.socket.emit('message', JSON.stringify({ requestID: payload.requestID, messageType: 'ExpressionStateResponse', data: { expressions: [{ name: '开心', file: 'happy.exp3.json', active: false }] } }))
    expect(await expressionsPending).toEqual([{ name: '开心', file: 'happy.exp3.json', active: false, deactivateWhenKeyReleased: false, usedInHotkeys: [] }])

    const hotkeysPending = client.hotkeys()
    payload = JSON.parse(fake.socket.sent.at(-1))
    fake.socket.emit('message', JSON.stringify({ requestID: payload.requestID, messageType: 'HotkeysInCurrentModelResponse', data: { hotkeys: [{ hotkeyID: 'h1', name: '挥手' }] } }))
    expect(await hotkeysPending).toEqual([{ id: 'h1', name: '挥手', file: '', type: '' }])
    client.disconnect()
  })

  it('surfaces APIError as a readable rejection', async () => {
    const { client, fake } = await openClient()
    const pending = client.availableModels()
    const payload = JSON.parse(fake.socket.sent[0])
    fake.socket.emit('message', JSON.stringify({ requestID: payload.requestID, messageType: 'APIError', data: { message: '模型未载入' } }))
    await expect(pending).rejects.toThrow('模型未载入')
    client.disconnect()
  })
})
