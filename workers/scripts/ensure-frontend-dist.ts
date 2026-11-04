import { access } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const distIndex = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../frontend/dist/index.html')

try {
  await access(distIndex)
} catch {
  console.error(
    'frontend/dist/index.html がありません。先に frontend で npm run build を実行してください。',
  )
  process.exit(1)
}
