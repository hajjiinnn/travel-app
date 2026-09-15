import { describe, expect, it } from 'vitest'
import { dedupe, escapeRegex, googleKind, osmCategory, osmKind, rankResults, type SearchResult } from '../lib/search'

const AUSTIN = { lat: 30.2672, lng: -97.7431 }

function result(over: Partial<SearchResult> & { name: string }): SearchResult {
  return {
    provider: 'osm',
    providerId: over.name,
    lat: AUSTIN.lat,
    lng: AUSTIN.lng,
    category: 'restaurant',
    kind: 'poi',
    ...over,
  }
}

describe('rankResults', () => {
  it('puts venues ahead of cities even when the city scores higher with the geocoder', () => {
    // This is the exact failure users saw: Nominatim ranks a city far above any restaurant.
    const results = [
      result({ name: 'Austin', kind: 'area', category: 'other', importance: 0.9 }),
      result({ name: 'Austin Java', kind: 'poi', category: 'cafe', importance: 0.2 }),
    ]
    expect(rankResults(results, 'austin', AUSTIN).map((r) => r.name)).toEqual(['Austin Java', 'Austin'])
  })

  it('orders venue, then street address, then area', () => {
    const results = [
      result({ name: 'Congress Avenue', kind: 'address' }),
      result({ name: 'Congress County', kind: 'area' }),
      result({ name: 'Congress Cafe', kind: 'poi' }),
    ]
    expect(rankResults(results, 'congress', AUSTIN).map((r) => r.kind)).toEqual(['poi', 'address', 'area'])
  })

  it('prefers an exact name match over a partial one', () => {
    const results = [
      result({ name: 'Franklin Barbecue Annex', providerId: 'b' }),
      result({ name: 'Franklin Barbecue', providerId: 'a' }),
    ]
    expect(rankResults(results, 'franklin barbecue', AUSTIN)[0].name).toBe('Franklin Barbecue')
  })

  it('prefers the closer venue when names match equally well', () => {
    const far = result({ name: 'Taco Place', providerId: 'far', lat: 32.7767, lng: -96.797 })
    const near = result({ name: 'Taco Place', providerId: 'near' })
    expect(rankResults([far, near], 'taco place', AUSTIN)[0].providerId).toBe('near')
  })

  it('still works with no user location', () => {
    const results = [
      result({ name: 'Paris', kind: 'area', importance: 0.95 }),
      result({ name: 'Paris Bakery', kind: 'poi', category: 'bakery', importance: 0.1 }),
    ]
    expect(rankResults(results, 'paris', null)[0].name).toBe('Paris Bakery')
  })
})

describe('dedupe', () => {
  it('collapses the same venue seen by both providers', () => {
    const fromOverpass = result({ name: "Jo's Coffee", providerId: 'node/1' })
    const fromNominatim = result({ name: "Jo's  Coffee", providerId: 'node/2', lat: AUSTIN.lat + 0.0005 })
    expect(dedupe([fromOverpass, fromNominatim])).toHaveLength(1)
  })

  it('keeps two branches of the same chain that are far apart', () => {
    const a = result({ name: 'Veracruz', providerId: 'node/1' })
    const b = result({ name: 'Veracruz', providerId: 'node/2', lat: AUSTIN.lat + 0.05 })
    expect(dedupe([a, b])).toHaveLength(2)
  })
})

describe('classification', () => {
  it('treats cities and boundaries as areas, venues as places to go', () => {
    expect(osmKind('place', 'city')).toBe('area')
    expect(osmKind('boundary', 'administrative')).toBe('area')
    expect(osmKind('amenity', 'restaurant')).toBe('poi')
    expect(osmKind('leisure', 'park')).toBe('poi')
    expect(osmKind('highway', 'residential')).toBe('address')
  })

  it('maps OSM tags to app categories', () => {
    expect(osmCategory('amenity', 'restaurant')).toBe('restaurant')
    expect(osmCategory('amenity', 'museum')).toBe('museum')
    expect(osmCategory('leisure', 'park')).toBe('park')
    expect(osmCategory('tourism', 'hotel')).toBe('hotel')
    expect(osmCategory('shop', 'bakery')).toBe('bakery')
  })

  it('classifies Google types', () => {
    expect(googleKind(['restaurant', 'food'])).toBe('poi')
    expect(googleKind(['locality', 'political'])).toBe('area')
    expect(googleKind(['street_address'])).toBe('address')
  })
})

describe('escapeRegex', () => {
  it('escapes characters that would break an Overpass regex', () => {
    expect(escapeRegex("Mother's Cafe (North)")).toBe("Mother's Cafe \\(North\\)")
    expect(escapeRegex('BBQ + Beer')).toBe('BBQ \\+ Beer')
  })
})
