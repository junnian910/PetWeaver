import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const appRoot = resolve(here, '..')
const publicDir = join(here, 'public')
const outputDir = join(appRoot, 'public', 'assets', 'videos')
mkdirSync(publicDir, { recursive:true })
mkdirSync(outputDir, { recursive:true })
copyFileSync(join(appRoot, 'public', 'assets', 'fafa-pet-final.png'), join(publicDir, 'fafa-pet-final.png'))
copyFileSync(join(appRoot, 'public', 'assets', 'expressions', 'happy.png'), join(publicDir, 'happy.png'))
copyFileSync(join(appRoot, 'public', 'assets', 'expressions', 'sad.png'), join(publicDir, 'sad.png'))

const browserExecutable = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

for (const motion of ['idle', 'waving', 'jumping', 'failed', 'waiting']) {
  execFileSync(
    process.execPath,
    [
      join(here, 'node_modules', '@remotion', 'cli', 'remotion-cli.js'),
      'render', join(here, 'src', 'index.jsx'), `Fafa-${motion}`, join(outputDir, `${motion}.webm`),
      '--codec=vp9', '--image-format=png', '--pixel-format=yuva420p', '--crf=12', '--concurrency=50%',
      `--browser-executable=${browserExecutable}`, '--overwrite',
    ],
    { cwd:here, stdio:'inherit' },
  )
}
