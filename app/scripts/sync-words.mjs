/**
 * 把 词库产物 从 data/ 同步到 app/src/data/。
 *
 * 目的是让仓库里只保留一份词库：app/src/data/words.json 被 .gitignore 忽略，
 * clone 之后由 npm 的 predev / prebuild / pretest 钩子自动生成。
 *
 * 词库的真正来源是 python tools_build_words.py（见根目录 README）。
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const src = resolve(here, '../../data/words.json')
const dst = resolve(here, '../src/data/words.json')

if (!existsSync(src)) {
  console.error('\n找不到 data/words.json。')
  console.error('请先在仓库根目录运行：python tools_build_words.py\n')
  process.exit(1)
}

mkdirSync(dirname(dst), { recursive: true })
copyFileSync(src, dst)
console.log('synced  data/words.json  →  app/src/data/words.json')
