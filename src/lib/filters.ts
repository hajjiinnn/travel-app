import type { Category, Cost, Place, PlaceStatus } from '../db/schema'
import { distanceKm, type LatLng } from './geo'

export type SortKey = 'recent' | 'rating' | 'distance' | 'name'

export interface Filters {
  query: string
  status: 'all' | PlaceStatus
  minRating: number
  costs: Cost[]
  tags: string[]
  categories: Category[]
  city: string | null
  /** Only places within radiusKm of `near`. */
  near: (LatLng & { radiusKm: number }) | null
  sort: SortKey
}

export const DEFAULT_FILTERS: Filters = {
  query: '',
  status: 'all',
  minRating: 0,
  costs: [],
  tags: [],
  categories: [],
  city: null,
  near: null,
  sort: 'recent',
}

export function isFilterActive(f: Filters): boolean {
  return (
    f.status !== 'all' ||
    f.minRating > 0 ||
    f.costs.length > 0 ||
    f.tags.length > 0 ||
    f.categories.length > 0 ||
    f.city !== null ||
    f.near !== null
  )
}

export function activeFilterCount(f: Filters): number {
  let n = 0
  if (f.status !== 'all') n++
  if (f.minRating > 0) n++
  if (f.costs.length) n++
  if (f.tags.length) n++
  if (f.categories.length) n++
  if (f.city) n++
  if (f.near) n++
  return n
}

function matchesQuery(p: Place, q: string): boolean {
  if (!q) return true
  const hay = [p.name, p.address, p.city, p.notes, p.orderTips, p.avoidTips, p.recommendedBy, ...p.tags]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => hay.includes(term))
}

export function applyFilters(places: Place[], f: Filters, userLocation?: LatLng | null): Place[] {
  const q = f.query.trim()
  const out = places.filter((p) => {
    if (f.status !== 'all' && p.status !== f.status) return false
    if (f.minRating > 0 && (p.rating ?? 0) < f.minRating) return false
    if (f.costs.length && (!p.cost || !f.costs.includes(p.cost))) return false
    if (f.categories.length && !f.categories.includes(p.category)) return false
    if (f.tags.length && !f.tags.every((t) => p.tags.includes(t))) return false
    if (f.city && (p.city ?? '').toLowerCase() !== f.city.toLowerCase()) return false
    if (f.near && distanceKm(f.near, p) > f.near.radiusKm) return false
    return matchesQuery(p, q)
  })
  return sortPlaces(out, f.sort, userLocation ?? f.near ?? null)
}

export function sortPlaces(places: Place[], sort: SortKey, origin: LatLng | null): Place[] {
  const arr = [...places]
  switch (sort) {
    case 'name':
      return arr.sort((a, b) => a.name.localeCompare(b.name))
    case 'rating':
      return arr.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1) || b.updatedAt.localeCompare(a.updatedAt))
    case 'distance':
      if (!origin) return arr.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      return arr.sort((a, b) => distanceKm(origin, a) - distanceKm(origin, b))
    case 'recent':
    default:
      return arr.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }
}

export function collectCities(places: Place[]): string[] {
  const counts = new Map<string, number>()
  for (const p of places) {
    if (p.city) counts.set(p.city, (counts.get(p.city) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([c]) => c)
}

export function collectTags(places: Place[], extra: string[] = []): string[] {
  const counts = new Map<string, number>()
  for (const t of extra) counts.set(t, 0)
  for (const p of places) for (const t of p.tags) counts.set(t, (counts.get(t) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t)
}
