import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { deflateRawSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { importAvatarFile, importAvatarFiles, isZipBuffer, sanitizeEntryName, scanModelDir } from '../src/main/providers/live2d-assets.js'

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return (crc ^ 0xffffffff) >>> 0
}

function makeZip(entries) {
  const localParts = []
  const centralParts = []
  let offset = 0
  for (const [name, content] of Object.entries(entries)) {
    const buffer = Buffer.from(content)
    const nameBuffer = Buffer.from(name)
    const crc = crc32(buffer)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0, 6)
    local.writeUInt16LE(0, 8)
    local.writeUInt16LE(0, 10)
    local.writeUInt16LE(0, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(buffer.length, 18)
    local.writeUInt32LE(buffer.length, 22)
    local.writeUInt16LE(nameBuffer.length, 26)
    local.writeUInt16LE(0, 28)
    localParts.push(local, nameBuffer, buffer)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0, 8)
    central.writeUInt16LE(0, 10)
    central.writeUInt16LE(0, 12)
    central.writeUInt16LE(0, 14)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(buffer.length, 20)
    central.writeUInt32LE(buffer.length, 24)
    central.writeUInt16LE(nameBuffer.length, 28)
    central.writeUInt16LE(0, 30)
    central.writeUInt16LE(0, 32)
    central.writeUInt16LE(0, 34)
    central.writeUInt16LE(0, 36)
    central.writeUInt32LE(0, 38)
    central.writeUInt32LE(offset, 42)
    centralParts.push(central, nameBuffer)
    offset += local.length + nameBuffer.length + buffer.length
  }
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(Object.keys(entries).length, 8)
  end.writeUInt16LE(Object.keys(entries).length, 10)
  end.writeUInt32LE(centralSize, 12)
  end.writeUInt32LE(offset, 16)
  end.writeUInt16LE(0, 20)
  return Buffer.concat([...localParts, ...centralParts, end])
}

describe('Live2D asset importer', () => {
  it('detects ZIP signatures and rejects unsafe entry paths', () => {
    expect(isZipBuffer(Buffer.from('PK\x03\x04'))).toBe(true)
    expect(sanitizeEntryName('folder/model.model3.json')).toContain('model.model3.json')
    expect(sanitizeEntryName('../escape.model3.json')).toBe('')
    expect(sanitizeEntryName('C:/absolute.model3.json')).toBe('')
  })

  it('extracts a ZIP archive and imports it as a model record', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fafa-live2d-'))
    try {
      const manifest = JSON.stringify({ Version: 3, Name: '小墨鱼', FileReferences: { Moc: 'fafa.moc3', Textures: ['fafa.png'], Motions: { idle: [{ File: 'idle.motion3.json' }] } } })
      const zip = makeZip({
        'fafa/fafa.model3.json': manifest,
        'fafa/fafa.moc3': 'MOC',
        'fafa/fafa.png': 'PNGDATA',
        'fafa/motions/idle.motion3.json': '{}'
      })
      const zipPath = join(dir, 'fafa.zip')
      writeFileSync(zipPath, zip)
      const model = importAvatarFile({ filePath: zipPath, destRoot: join(dir, 'models') })
      expect(model.modelJson).toContain('fafa.model3.json')
      expect(model.moc3).toContain('fafa.moc3')
      expect(model.textureCount).toBe(1)
      expect(model.motionCount).toBe(1)
      expect(model.manifest.name).toBe('小墨鱼')
      expect(readFileSync(join(model.path, 'fafa', 'fafa.moc3'), 'utf8')).toBe('MOC')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('imports a single moc3 file even when no manifest exists', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fafa-live2d-'))
    try {
      const file = join(dir, 'single.moc3')
      writeFileSync(file, 'MOC3')
      const model = importAvatarFile({ filePath: file, destRoot: join(dir, 'models') })
      expect(model.moc3).toContain('single.moc3')
      expect(model.modelJson).toBe('')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('groups multiple selected files from one folder into a single model', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fafa-live2d-'))
    try {
      writeFileSync(join(dir, 'a.moc3'), 'MOC3')
      writeFileSync(join(dir, 'a.model3.json'), JSON.stringify({ Version: 3, Name: '组合模型', FileReferences: { Moc: 'a.moc3', Textures: ['a.png'], Motions: {} } }))
      writeFileSync(join(dir, 'a.png'), 'PNG')
      const model = importAvatarFiles({ filePaths: [join(dir, 'a.moc3'), join(dir, 'a.model3.json'), join(dir, 'a.png')], destRoot: join(dir, 'models') })
      expect(model.manifest.name).toBe('组合模型')
      expect(model.textureCount).toBe(1)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('scans model dirs and reads manifest references', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fafa-live2d-'))
    try {
      writeFileSync(join(dir, 'a.moc3'), 'M')
      writeFileSync(join(dir, 'a.model3.json'), JSON.stringify({ Version: 3, FileReferences: { Moc: 'a.moc3', Textures: ['a.png'], Motions: {} } }))
      writeFileSync(join(dir, 'a.png'), 'P')
      const scanned = scanModelDir(dir)
      expect(scanned.moc3).toBe('a.moc3')
      expect(scanned.textureCount).toBe(1)
      expect(scanned.manifest.model).toBe('a.moc3')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
