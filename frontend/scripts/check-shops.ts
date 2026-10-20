import assert from 'node:assert/strict'
import test from 'node:test'
import { getShops } from '../src/api/shops.ts'

test('getShops returns five unique Hiroshima shops without sharing the source array', async () => {
  const shops = await getShops()
  assert.equal(shops.length, 5)
  assert.equal(new Set(shops.map((shop) => shop.id)).size, 5)

  for (const shop of shops) {
    assert.ok(shop.name.length > 0)
    assert.ok(shop.address.includes('広島市'))
    assert.ok(Number.isFinite(shop.latitude))
    assert.ok(shop.latitude >= 34.3 && shop.latitude <= 34.5)
    assert.ok(Number.isFinite(shop.longitude))
    assert.ok(shop.longitude >= 132.4 && shop.longitude <= 132.5)
  }

  const first = shops[0]
  assert.ok(first)
  first.name = '変更'
  shops.pop()

  const again = await getShops()
  assert.equal(again.length, 5)
  assert.notEqual(again[0]?.name, '変更')
})
