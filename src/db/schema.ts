import Dexie, { type EntityTable } from 'dexie'

export type PlaceStatus = 'been' | 'want'
export type Cost = 1 | 2 | 3 | 4

export const CATEGORIES = [
  'restaurant',
  'cafe',
  'bar',
  'bakery',
  'dessert',
  'shop',
  'sight',
  'park',
  'museum',
  'hotel',
  'activity',
  'other',
] as const
export type Category = (typeof CATEGORIES)[number]

export interface Place {
  id: string
  name: string
  address?: string
  city?: string
  country?: string
  lat: number
  lng: number
  status: PlaceStatus
  category: Category
  /** 1–5. Only meaningful when status is "been". */
  rating?: number
  /** 1–4, shown as $ to $$$$. */
  cost?: Cost
  tags: string[]
  notes?: string
  /** What to order / do here. */
  orderTips?: string
  /** What to skip. */
  avoidTips?: string
  wouldReturn?: boolean
  /** ISO dates of visits, newest last. */
  visits: string[]
  /** Who told you about it, if it came from a shared rec. */
  recommendedBy?: string
  source?: { provider: 'google' | 'osm' | 'manual'; id?: string }
  createdAt: string
  updatedAt: string
}

export interface Photo {
  id: string
  placeId: string
  blob: Blob
  width: number
  height: number
  createdAt: string
}

export interface PlaceList {
  id: string
  name: string
  description?: string
  placeIds: string[]
  createdAt: string
  updatedAt: string
}

export interface Tag {
  name: string
  createdAt: string
}

export interface Setting {
  key: string
  value: string
}

export class TravelDB extends Dexie {
  places!: EntityTable<Place, 'id'>
  photos!: EntityTable<Photo, 'id'>
  lists!: EntityTable<PlaceList, 'id'>
  tags!: EntityTable<Tag, 'name'>
  settings!: EntityTable<Setting, 'key'>

  constructor(name = 'travel-app') {
    super(name)
    this.version(1).stores({
      places: 'id, status, city, category, rating, cost, *tags, updatedAt, createdAt',
      photos: 'id, placeId',
      lists: 'id, name, updatedAt',
      tags: 'name',
      settings: 'key',
    })
  }
}

export const db = new TravelDB()

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function costLabel(cost?: Cost): string {
  return cost ? '$'.repeat(cost) : ''
}

export function categoryLabel(c: Category): string {
  return c.charAt(0).toUpperCase() + c.slice(1)
}
