import assert from 'node:assert/strict'
import { spawn, type ChildProcess } from 'node:child_process'
import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const workersDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const frontendDist = path.resolve(workersDir, '../frontend/dist')
const port = 8791
const origin = `http://127.0.0.1:${port}`

async function distExists(): Promise<boolean> {
  try {
    await access(path.join(frontendDist, 'index.html'))
    return true
  } catch {
    return false
  }
}

function startWrangler(): ChildProcess {
  const wranglerJs = path.join(workersDir, 'node_modules', 'wrangler', 'bin', 'wrangler.js')
  return spawn(process.execPath, [
    wranglerJs,
    'dev',
    '--local',
    '--ip',
    '127.0.0.1',
    '--port',
    String(port),
    '--persist-to',
    path.join(workersDir, '.wrangler', 'integration'),
  ], {
    cwd: workersDir,
    env: {
      ...process.env,
      WRANGLER_SEND_METRICS: 'false',
      CI: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

/**
 * 起動した Wrangler を止める。
 * 引数は `wrangler dev` の子プロセスで、すでに終了していれば何もしない。
 * Windows では taskkill でプロセスツリーを終了し、taskkill が失敗しても例外にしない。
 * それ以外は SIGTERM を送る。戻り値はない。
 */
async function stopWrangler(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.pid === undefined) {
    return
  }
  if (process.platform === 'win32') {
    await new Promise<void>((resolve) => {
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
      killer.on('exit', () => resolve())
      killer.on('error', () => resolve())
    })
    return
  }
  child.kill('SIGTERM')
}

async function waitForReady(child: ChildProcess): Promise<void> {
  let logs = ''
  const ready = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`wrangler dev が制限時間内に起動しませんでした。\n${logs}`))
    }, 90_000)
    const onData = (chunk: Buffer) => {
      logs += chunk.toString()
      if (logs.includes(`http://127.0.0.1:${port}`) || logs.includes('Ready on')) {
        clearTimeout(timeout)
        resolve()
      }
    }
    child.stdout?.on('data', onData)
    child.stderr?.on('data', onData)
    child.on('exit', (code) => {
      clearTimeout(timeout)
      reject(new Error(`wrangler dev が終了しました。code=${code}\n${logs}`))
    })
  })
  await ready
}

test('local Workers serves the Vite build and a schema-free D1 health check', async (t) => {
  if (!(await distExists())) {
    assert.fail('frontend/dist がありません。frontend で npm run build してから workers の npm test を実行してください。')
  }

  const child = startWrangler()
  t.after(async () => {
    await stopWrangler(child)
  })

  try {
    await waitForReady(child)
  } catch (error) {
    await stopWrangler(child)
    throw error
  }

  const htmlResponse = await fetch(origin)
  assert.equal(htmlResponse.status, 200)
  const html = await htmlResponse.text()
  assert.match(html, /<div id="app"><\/div>/)
  const assetPath = html.match(/\/assets\/[^"]+\.js/)?.[0]
  assert.ok(assetPath, 'HTML から JavaScript アセットのパスを読めませんでした。')

  const assetResponse = await fetch(`${origin}${assetPath}`)
  assert.equal(assetResponse.status, 200)
  const assetType = assetResponse.headers.get('content-type') ?? ''
  assert.match(assetType, /javascript/)
  const asset = await assetResponse.text()
  assert.ok(asset.length > 100)
  assert.match(asset, /地域割引SNSアプリ/)

  const cssPath = html.match(/\/assets\/[^"]+\.css/)?.[0]
  if (cssPath) {
    const cssResponse = await fetch(`${origin}${cssPath}`)
    assert.equal(cssResponse.status, 200)
    assert.ok((await cssResponse.text()).length > 0)
  }

  const favicon = await fetch(`${origin}/favicon.svg`)
  assert.equal(favicon.status, 200)

  const healthResponse = await fetch(`${origin}/__health`)
  assert.equal(healthResponse.status, 200)
  assert.deepEqual(await healthResponse.json(), {
    status: 'ok',
    database: 'connected',
  })

  const builtHtml = await readFile(path.join(frontendDist, 'index.html'), 'utf8')
  assert.match(builtHtml, /\/assets\//)
})
