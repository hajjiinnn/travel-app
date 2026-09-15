import { describe, expect, it } from 'vitest'
import { buildPayload, decodePayload, encodePayload, formatPlaceText, readShareFromLocation } from '../lib/share'
import type { Place } from '../db/schema'

const place: Place = {
  id: '1',
  name: 'Taco Spot',
  address: '123 Main St, Austin',
  city: 'Austin',
  lat: 30.2711111111,
  lng: -97.7411111111,
  status: 'been',
  category: 'restaurant',
  rating: 5,
  cost: 1,
  tags: ['tacos'],
  orderTips: 'al pastor',
  avoidTips: 'the queso',
  notes: 'cash only',
  visits: [],
  source: { provider: 'osm', id: 'node/1' },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

describe('share payload', () => {
  it('round-trips through the URL-safe encoding', () => {
    const payload = buildPayload([place], { kind: 'rec', from: 'Connie' })
    const decoded = decodePayload(encodePayload(payload))
    expect(decoded).toEqual(payload)
    expect(decoded!.places[0]).toMatchObject({ n: 'Taco Spot', r: 5, $: 1, t: ['tacos'], y: 'al pastor', x: 'the queso' })
    expect(decoded!.places[0].la).toBe(30.271111)
  })

  it('rejects garbage', () => {
    expect(decodePayload('not-a-payload')).toBeNull()
    expect(readShareFromLocation('#nothing')).toBeNull()
  })

  it('reads a payload out of the location hash', () => {
    const payload = buildPayload([place], { kind: 'list', title: 'Austin' })
    expect(readShareFromLocation(`#s=${encodePayload(payload)}`)).toEqual(payload)
  })

  it('formats a readable text rec', () => {
    const text = formatPlaceText(place)
    expect(text).toContain('Taco Spot · ★★★★★ · $')
    expect(text).toContain('Order: al pastor')
    expect(text).toContain('Skip: the queso')
    expect(text).toContain('#tacos')
  })
})
