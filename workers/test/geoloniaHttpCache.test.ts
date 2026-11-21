import assert from 'node:assert/strict'
import { createServer, type Server } from 'node:http'
import test from 'node:test'
import { config } from '@geolonia/normalize-japanese-addresses'
import { withGuardedAddressFetch } from '../src/geocoding/addressFetchGuard.ts'
import { geocodeAddress } from '../src/geocoding/geocodeAddress.ts'
import { normalizeWithGeolonia } from '../src/geocoding/geoloniaAdapter.ts'

/**
 * 3.1.3 は非2xxや壊れた本文を住所データとしてキャッシュし得る。
 * 公開APIには接続せず、このプロセス内のHTTP応答だけで確認する。
 * ライブラリのキャッシュはプロセス内で残るため、市区町村ごとに一度だけ使う。
 */

const LAT = 34.38552071
const LNG = 132.454471652

const RESIDENTIAL_CSV = [
  'address-data',
  'blk_num,rsdt_num,rsdt_num2,lng,lat',
  `6,34,,${LNG},${LAT}`,
  '',
].join('\n')

type Scripted = { status: number; body: string }

const queues = new Map<string, Scripted[]>()

function city(name: string, code: number) {
  return {
    code,
    city: '広島市',
    ward: name,
    city_k: 'ヒロシマシ',
    city_r: 'Hiroshima',
    ward_k: 'テスト',
    ward_r: 'Test',
    point: [LNG, LAT],
  }
}

const cities = [
  city('中区', 34101),
  city('東区', 34102),
  city('南区', 34103),
  city('西区', 34104),
  city('佐伯区', 34105),
  city('安佐北区', 34106),
  city('安芸区', 34107),
]

const JA = JSON.stringify({
  meta: { updated: 1 },
  data: [{
    code: 34,
    pref: '広島県',
    pref_k: 'ヒロシマケン',
    pref_r: 'Hiroshima',
    point: [LNG, LAT],
    cities,
  }],
})

function townBody(): string {
  return JSON.stringify({
    meta: { updated: 1 },
    data: [{
      machiaza_id: '0001',
      oaza_cho: '国泰寺町',
      chome: '一丁目',
      point: [LNG, LAT],
      rsdt: true,
      csv_ranges: {
        住居表示: { start: 0, length: Buffer.byteLength(RESIDENTIAL_CSV) },
      },
    }],
  })
}

const TOWN = townBody()
const EMPTY_API = JSON.stringify({ meta: { updated: 1 }, data: [] })

function enqueue(path: string, responses: Scripted[]) {
  queues.set(path, responses)
}

function take(path: string): Scripted {
  const queue = queues.get(path)
  if (!queue || queue.length === 0) {
    throw new Error(`応答が未定義です: ${path}`)
  }
  return queue.length === 1 ? queue[0] : queue.shift()!
}

async function listen(): Promise<Server> {
  const server = createServer((request, response) => {
    const path = decodeURIComponent((request.url ?? '/').split('?')[0]).replace(/^\/+/, '/')
    let scripted: Scripted
    try {
      scripted = take(path)
    } catch (error) {
    response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
    response.end(error instanceof Error ? error.message : 'missing')
      return
    }
    response.writeHead(scripted.status, { 'content-type': 'application/json; charset=utf-8' })
    response.end(scripted.body)
  })
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve())
  })
  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('テストサーバーの待受に失敗しました')
  }
  config.japaneseAddressesApi = `http://127.0.0.1:${address.port}/`
  return server
}

function address(ward: string): string {
  return `広島県広島市${ward}国泰寺町一丁目6-34`
}

test('非2xxと不正な本文を住所データとしてキャッシュしない', async (t) => {
  enqueue('/.json', [{ status: 200, body: JA }])
  enqueue('/広島県/広島市中区.json', [
    { status: 503, body: EMPTY_API },
    { status: 200, body: TOWN },
  ])
  enqueue('/広島県/広島市中区-住居表示.txt', [
    { status: 200, body: RESIDENTIAL_CSV },
  ])
  enqueue('/広島県/広島市東区.json', [
    { status: 429, body: EMPTY_API },
    { status: 200, body: TOWN },
  ])
  enqueue('/広島県/広島市東区-住居表示.txt', [
    { status: 200, body: RESIDENTIAL_CSV },
  ])
  enqueue('/広島県/広島市南区.json', [
    { status: 404, body: EMPTY_API },
    { status: 200, body: TOWN },
  ])
  enqueue('/広島県/広島市南区-住居表示.txt', [
    { status: 200, body: RESIDENTIAL_CSV },
  ])
  enqueue('/広島県/広島市西区.json', [
    { status: 200, body: TOWN },
  ])
  enqueue('/広島県/広島市西区-住居表示.txt', [
    { status: 200, body: RESIDENTIAL_CSV },
  ])
  enqueue('/広島県/広島市佐伯区.json', [
    { status: 200, body: TOWN },
  ])
  enqueue('/広島県/広島市佐伯区-住居表示.txt', [
    { status: 200, body: 'not a csv' },
    { status: 200, body: RESIDENTIAL_CSV },
  ])
  enqueue('/広島県/広島市安佐北区.json', [
    { status: 503, body: '' },
    { status: 200, body: TOWN },
  ])
  enqueue('/広島県/広島市安佐北区-住居表示.txt', [
    { status: 200, body: RESIDENTIAL_CSV },
  ])
  enqueue('/広島県/広島市安芸区.json', [
    { status: 200, body: '{' },
    { status: 200, body: TOWN },
  ])
  enqueue('/広島県/広島市安芸区-住居表示.txt', [
    { status: 200, body: RESIDENTIAL_CSV },
  ])

  const server = await listen()
  t.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve())
  }))

  const recovered = await geocodeAddress(address('中区'), normalizeWithGeolonia)
  const after503 = await geocodeAddress(address('中区'), normalizeWithGeolonia)
  assert.equal(recovered.status, 'service_error', '503の空JSONは住所として確定しない')
  assert.equal(recovered.failure?.kind, 'upstream')
  assert.equal(recovered.failure?.retryable, true)
  assert.equal(recovered.acceptedPoint, null)
  assert.equal(after503.status, 'accepted_candidate', '503のあと同じ住所を正常な200で解決できる')
  assert.equal(after503.referencePoint, null)
  assert.deepEqual(after503.acceptedPoint, { latitude: LAT, longitude: LNG })

  const limited = await geocodeAddress(address('東区'), normalizeWithGeolonia)
  const after429 = await geocodeAddress(address('東区'), normalizeWithGeolonia)
  assert.equal(limited.status, 'service_error')
  assert.equal(limited.failure?.retryable, true)
  assert.equal(after429.status, 'accepted_candidate')

  const missing = await geocodeAddress(address('南区'), normalizeWithGeolonia)
  const after404 = await geocodeAddress(address('南区'), normalizeWithGeolonia)
  assert.equal(missing.status, 'service_error')
  assert.equal(missing.failure?.retryable, false)
  assert.equal(after404.status, 'accepted_candidate')

  const endpoint = config.japaneseAddressesApi
  config.japaneseAddressesApi = 'http://127.0.0.1:1/'
  const offline = await geocodeAddress(address('西区'), normalizeWithGeolonia)
  config.japaneseAddressesApi = endpoint
  const afterOffline = await geocodeAddress(address('西区'), normalizeWithGeolonia)
  assert.equal(offline.status, 'service_error')
  assert.equal(offline.acceptedPoint, null)
  assert.equal(offline.normalized, null)
  assert.equal(afterOffline.status, 'accepted_candidate')

  const broken = await geocodeAddress(address('佐伯区'), normalizeWithGeolonia)
  const afterBroken = await geocodeAddress(address('佐伯区'), normalizeWithGeolonia)
  assert.equal(broken.status, 'service_error', '200でもCSV本文が不正なら住所データにしない')
  assert.equal(broken.acceptedPoint, null)
  assert.equal(afterBroken.status, 'accepted_candidate')

  const empty503 = await geocodeAddress(address('安佐北区'), normalizeWithGeolonia)
  const afterEmpty = await geocodeAddress(address('安佐北区'), normalizeWithGeolonia)
  assert.equal(empty503.status, 'service_error')
  assert.equal(afterEmpty.status, 'accepted_candidate')

  const brokenJson = await geocodeAddress(address('安芸区'), normalizeWithGeolonia)
  const afterBrokenJson = await geocodeAddress(address('安芸区'), normalizeWithGeolonia)
  assert.equal(brokenJson.status, 'service_error')
  assert.equal(brokenJson.acceptedPoint, null)
  assert.equal(afterBrokenJson.status, 'accepted_candidate')

  const side = createServer((request, response) => {
    const addressData = (request.url ?? '').startsWith('/api/ja')
    response.writeHead(addressData ? 503 : 200)
    response.end(addressData ? '' : 'ok')
  })
  await new Promise<void>((resolve) => {
    side.listen(0, '127.0.0.1', () => resolve())
  })
  t.after(() => new Promise<void>((resolve, reject) => {
    side.close((error) => error ? reject(error) : resolve())
  }))
  const sideAddress = side.address()
  if (!sideAddress || typeof sideAddress === 'string') {
    throw new Error('テストサーバーの待受に失敗しました')
  }
  config.japaneseAddressesApi = `http://127.0.0.1:${sideAddress.port}/api/ja`
  const originalFetch = globalThis.fetch
  await withGuardedAddressFetch(async () => {
    await assert.rejects(
      fetch(`http://127.0.0.1:${sideAddress.port}/api/ja/.json`),
      /503/,
    )
    const other = await fetch(`http://127.0.0.1:${sideAddress.port}/health`)
    assert.equal(other.status, 200)
    assert.equal(await other.text(), 'ok')
  })
  assert.equal(globalThis.fetch, originalFetch)
})
