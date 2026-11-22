import assert from 'node:assert/strict'
import { spawn, type ChildProcess } from 'node:child_process'
import { access, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const workersDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const frontendDist = path.resolve(workersDir, '../frontend/dist')
const persistDir = path.join(workersDir, '.wrangler', 'integration')
const port = 8791
const origin = `http://127.0.0.1:${port}`
const PUBLIC_SHOP = '11111111-1111-4111-8111-111111111111'
const NULL_COORD_SHOP = '44444444-4444-4444-8444-444444444444'
const EMPTY_ADDRESS_SHOP = '33333333-3333-4333-8333-333333333333'
const BLANK_DISCOUNT = '55555555-5555-4555-8555-555555555508'

/** Vite の成果物 `index.html` があるかを返す。無いときは false で、例外にはしない。 */
async function distExists(): Promise<boolean> {
  try {
    await access(path.join(frontendDist, 'index.html'))
    return true
  } catch {
    return false
  }
}

function runWrangler(args: string[]): Promise<void> {
  const wranglerJs = path.join(workersDir, 'node_modules', 'wrangler', 'bin', 'wrangler.js')
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [wranglerJs, ...args], {
      cwd: workersDir,
      env: { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let logs = ''
    child.stdout?.on('data', (chunk: Buffer) => {
      logs += chunk.toString()
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      logs += chunk.toString()
    })
    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(`wrangler ${args.join(' ')} が失敗しました。code=${code}\n${logs}`))
    })
  })
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

/**
 * Wrangler のログに待受 URL が出るまで待つ。
 * 制限時間内に起動しない、またはプロセスが先に終わったときは例外にする。
 */
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

test('local Workers serves the Vite build, health check, and seeded read API', async (t) => {
  if (!(await distExists())) {
    assert.fail('frontend/dist がありません。frontend で npm run build してから workers の npm test を実行してください。')
  }

  await rm(persistDir, { recursive: true, force: true })
  await runWrangler(['d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', persistDir])
  await runWrangler(['d1', 'execute', 'DB', '--local', '--persist-to', persistDir, '--file', 'seeds/development.sql'])

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

  const shopList = await fetch(`${origin}/api/v1/shops`)
  assert.equal(shopList.status, 200)
  const shopPayload = (await shopList.json()) as { items: Array<{ id: string }>; total: number }
  assert.equal(shopPayload.total, 3)
  assert.equal(
    shopPayload.items.some((item) => item.id === NULL_COORD_SHOP),
    false,
  )
  assert.equal(JSON.stringify(shopPayload).includes('name_search'), false)

  const searched = await fetch(`${origin}/api/v1/shops?q=${encodeURIComponent('ＣＡＦＥ')}`)
  assert.equal(searched.status, 200)
  const searchedPayload = (await searched.json()) as { items: Array<{ id: string }>; total: number }
  assert.equal(searchedPayload.total, 1)
  assert.equal(searchedPayload.items[0]?.id, '22222222-2222-4222-8222-222222222222')

  const injected = await fetch(`${origin}/api/v1/shops?q=${encodeURIComponent("' OR 1=1 --")}`)
  assert.equal(injected.status, 200)
  assert.equal(((await injected.json()) as { total: number }).total, 0)

  const shopDetail = await fetch(`${origin}/api/v1/shops/${PUBLIC_SHOP}`)
  assert.equal(shopDetail.status, 200)
  const hiddenShop = await fetch(`${origin}/api/v1/shops/${NULL_COORD_SHOP}`)
  assert.equal(hiddenShop.status, 404)

  const discounts = await fetch(`${origin}/api/v1/discounts`)
  assert.equal(discounts.status, 200)
  const discountPayload = (await discounts.json()) as { items: unknown[]; total: number }
  assert.equal(Array.isArray(discountPayload.items), true)
  assert.equal(JSON.stringify(discountPayload).includes('created_at'), false)
  assert.equal(JSON.stringify(discountPayload).includes('name_search'), false)

  const blank = await fetch(`${origin}/api/v1/discounts/${BLANK_DISCOUNT}`)
  assert.equal(blank.status, 404)
  const missingDiscount = await fetch(`${origin}/api/v1/discounts/missing-discount`)
  assert.equal(missingDiscount.status, 404)

  const nested = await fetch(`${origin}/api/v1/shops/${EMPTY_ADDRESS_SHOP}/discounts`)
  assert.equal(nested.status, 200)
  const nestedPayload = (await nested.json()) as { items: unknown[]; total: number }
  assert.deepEqual(nestedPayload.items, [])
  assert.equal(nestedPayload.total, 0)
  const hiddenNested = await fetch(`${origin}/api/v1/shops/${NULL_COORD_SHOP}/discounts`)
  assert.equal(hiddenNested.status, 404)

  const shopPost = await fetch(`${origin}/api/v1/shops`, { method: 'POST' })
  assert.equal(shopPost.status, 405)
  assert.equal(shopPost.headers.get('allow'), 'GET')

  const builtHtml = await readFile(path.join(frontendDist, 'index.html'), 'utf8')
  assert.match(builtHtml, /\/assets\//)
})
