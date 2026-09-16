import { readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const directories = ['src/main', 'src/preload', 'src/renderer', 'scripts']
const extensions = new Set(['.js', '.mjs', '.cjs'])

function collect(directory) {
  const result = []
  for (const entry of readdirSync(join(root, directory), { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) result.push(...collect(path))
    else if (extensions.has(entry.name.slice(entry.name.lastIndexOf('.')))) result.push(path)
  }
  return result
}

const files = directories.flatMap(collect)
const failures = []
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', resolve(root, file)], { encoding: 'utf8', windowsHide: true })
  if (result.status !== 0) failures.push({ file, output: `${result.stdout || ''}${result.stderr || ''}`.trim() })
}
if (failures.length) {
  for (const failure of failures) console.error(`${failure.file}\n${failure.output}`)
  process.exitCode = 1
} else {
  console.log(`JavaScript syntax OK: ${files.length} files`)
}
