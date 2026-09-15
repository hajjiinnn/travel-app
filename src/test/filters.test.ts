import { describe, expect, it } from 'vitest'
import { applyFilters, collectCities, collectTags, DEFAULT_FILTERS } from '../lib/filters'
import type { Place } from '../db/schema'

function place(over: Partial<Place> & { name: string }): Place {
  return {
    id: over.name,
    lat: 0,
    lng: 0,
    status: 'been',
    category: 'restaurant',
    tags: [],
    visits: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  }
}

const places: Place[] = [
  place({ name: 'Taco Spot', city: 'Austin', rating: 5, cost: 1, tags: ['tacos', 'cheap'], lat: 30.27, lng: -97.74, updatedAt: '2026-03-01T00:00:00.000Z' }),
  place({ name: 'Fancy Sushi', city: 'Austin', rating: 3, cost: 4, tags: ['date-night'], lat: 30.26, lng: -97.75, updatedAt: '2026-02-01T00:00:00.000Z' }),
  place({ name: 'Tokyo Ramen', city: 'Tokyo', status: 'want', tags: ['ramen'], lat: 35.68, lng: 139.69, orderTips: 'the tonkotsu' }),
]

describe('applyFilters', () => {
  it('returns everything sorted by recency by default', () => {
    expect(applyFilters(places, DEFAULT_FILTERS).map((p) => p.name)).toEqual(['Taco Spot', 'Fancy Sushi', 'Tokyo Ramen'])
  })

  it('filters by status', () => {
    expect(applyFilters(places, { ...DEFAULT_FILTERS, status: 'want' }).map((p) => p.name)).toEqual(['Tokyo Ramen'])
  })

  it('filters by minimum rating', () => {
    expect(applyFilters(places, { ...DEFAULT_FILTERS, minRating: 4 }).map((p) => p.name)).toEqual(['Taco Spot'])
  })

  it('filters by cost', () => {
    expect(applyFilters(places, { ...DEFAULT_FILTERS, costs: [3, 4] }).map((p) => p.name)).toEqual(['Fancy Sushi'])
  })

  it('requires every selected tag', () => {
    expect(applyFilters(places, { ...DEFAULT_FILTERS, tags: ['tacos', 'cheap'] }).map((p) => p.name)).toEqual(['Taco Spot'])
    expect(applyFilters(places, { ...DEFAULT_FILTERS, tags: ['tacos', 'ramen'] })).toEqual([])
  })

  it('filters by city case-insensitively', () => {
    expect(applyFilters(places, { ...DEFAULT_FILTERS, city: 'austin' })).toHaveLength(2)
  })

  it('filters by distance from a point', () => {
    const near = { lat: 30.27, lng: -97.74, radiusKm: 5 }
    expect(applyFilters(places, { ...DEFAULT_FILTERS, near }).map((p) => p.name)).toEqual(['Taco Spot', 'Fancy Sushi'])
  })

  it('searches notes and order tips', () => {
    expect(applyFilters(places, { ...DEFAULT_FILTERS, query: 'tonkotsu' }).map((p) => p.name)).toEqual(['Tokyo Ramen'])
  })

  it('sorts by rating with unrated last', () => {
    expect(applyFilters(places, { ...DEFAULT_FILTERS, sort: 'rating' }).map((p) => p.name)).toEqual(['Taco Spot', 'Fancy Sushi', 'Tokyo Ramen'])
  })

  it('sorts by distance from the user', () => {
    const result = applyFilters(places, { ...DEFAULT_FILTERS, sort: 'distance' }, { lat: 35.6, lng: 139.7 })
    expect(result[0].name).toBe('Tokyo Ramen')
  })
})

describe('collect helpers', () => {
  it('lists cities by frequency', () => {
    expect(collectCities(places)).toEqual(['Austin', 'Tokyo'])
  })
  it('lists tags by frequency including unused ones', () => {
    expect(collectTags(places, ['unused'])).toEqual(['cheap', 'date-night', 'ramen', 'tacos', 'unused'])
  })
})
