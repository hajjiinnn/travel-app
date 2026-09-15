import type { Category } from '../db/schema'
import { distanceKm, type LatLng } from './geo'

/** What a result actually is, which drives how we rank it. */
export type ResultKind = 'poi' | 'address' | 'area'

export interface SearchResult {
  provider: 'google' | 'osm'
  providerId: string
  name: string
  address?: string
  city?: string
  country?: string
  lat: number
  lng: number
  category: Category
  kind: ResultKind
  /** Provider's own confidence, used only to break ties within a group. */
  importance?: number
}

const GOOGLE_KEY: string | undefined = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || undefined

export function searchProviderName(): 'Google Places' | 'OpenStreetMap' {
  return GOOGLE_KEY ? 'Google Places' : 'OpenStreetMap'
}

/**
 * Text search for places.
 *
 * On OpenStreetMap this deliberately does NOT lean on Nominatim alone: Nominatim is an
 * address geocoder that ranks globally by "importance", where a city outranks every
 * restaurant on earth. So when we know roughly where the user is we also ask Overpass for
 * venues whose name matches, near them, and rank those first.
 */
export async function searchPlaces(query: string, near?: LatLng, signal?: AbortSignal): Promise<SearchResult[]> {
  const q = query.trim()
  if (!q) return []
  if (GOOGLE_KEY) return googleTextSearch(q, near, signal)

  const [venues, geocoded] = await Promise.all([
    near ? overpassNameSearch(q, near, signal).catch(() => [] as SearchResult[]) : Promise.resolve([]),
    nominatimSearch(q, near, signal).catch((e: Error) => {
      if (e.name === 'AbortError') throw e
      return [] as SearchResult[]
    }),
  ])
  return rankResults(dedupe([...venues, ...geocoded]), q, near)
}

/** Places within a short walk of `at`, for the "I'm here right now" flow. */
export async function nearbyPlaces(at: LatLng, radiusM = 150, signal?: AbortSignal): Promise<SearchResult[]> {
  return GOOGLE_KEY ? googleNearby(at, radiusM, signal) : overpassNearby(at, radiusM, signal)
}

// ---------- ranking ----------

const KIND_WEIGHT: Record<ResultKind, number> = { poi: 0, address: 1, area: 2 }

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Venues first, then addresses, then cities and regions. Within a group, prefer a closer
 * match on the name, then physical closeness to the user, then the provider's own ranking.
 */
export function rankResults(results: SearchResult[], query: string, near?: LatLng | null): SearchResult[] {
  const q = normalizeName(query)
  const score = (r: SearchResult) => {
    const name = normalizeName(r.name)
    const nameScore = name === q ? 0 : name.startsWith(q) ? 1 : name.includes(q) ? 2 : 3
    const dist = near ? Math.min(distanceKm(near, r), 20000) : 0
    return KIND_WEIGHT[r.kind] * 1e9 + nameScore * 1e6 + dist * 10 - (r.importance ?? 0)
  }
  return [...results].sort((a, b) => score(a) - score(b))
}

/** Drop the same real-world place arriving from both Overpass and Nominatim. */
export function dedupe(results: SearchResult[]): SearchResult[] {
  const out: SearchResult[] = []
  for (const r of results) {
    const dup = out.find(
      (o) =>
        o.providerId === r.providerId ||
        (normalizeName(o.name) === normalizeName(r.name) && distanceKm(o, r) < 0.25),
    )
    if (!dup) out.push(r)
  }
  return out
}

// ---------- OpenStreetMap (no API key) ----------

const OSM_AREA_CLASSES = new Set(['place', 'boundary', 'landuse', 'admin'])
const OSM_ADDRESS_CLASSES = new Set(['highway', 'railway', 'building', 'address'])

export function osmKind(cls: string, type: string): ResultKind {
  if (OSM_AREA_CLASSES.has(cls)) {
    // A named park or square tagged under place/leisure is still somewhere you go.
    if (['square', 'farm', 'islet'].includes(type)) return 'poi'
    return 'area'
  }
  if (OSM_ADDRESS_CLASSES.has(cls)) return 'address'
  return 'poi'
}

interface NominatimRow {
  place_id: number
  osm_type: string
  osm_id: number
  lat: string
  lon: string
  name?: string
  display_name: string
  class: string
  type: string
  importance?: number
  address?: Record<string, string>
}

async function nominatimSearch(q: string, near?: LatLng, signal?: AbortSignal): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    q,
    format: 'jsonv2',
    addressdetails: '1',
    namedetails: '0',
    limit: '20',
  })
  if (near) {
    // Prefer results in a ~40km box around the user, without excluding the rest of the world.
    const d = 0.2
    params.set('viewbox', `${near.lng - d},${near.lat + d},${near.lng + d},${near.lat - d}`)
    params.set('bounded', '0')
  }
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    signal,
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`Search failed (${res.status})`)
  const rows = (await res.json()) as NominatimRow[]
  return rows.map(nominatimToResult)
}

function nominatimToResult(row: NominatimRow): SearchResult {
  const addr = row.address ?? {}
  const name = row.name || row.display_name.split(',')[0]
  const street = [addr.house_number, addr.road].filter(Boolean).join(' ')
  const city = addr.city || addr.town || addr.village || addr.suburb || addr.county
  return {
    provider: 'osm',
    providerId: `${row.osm_type}/${row.osm_id}`,
    name,
    address: [street, addr.neighbourhood || addr.suburb, city].filter(Boolean).join(', ') || row.display_name,
    city,
    country: addr.country,
    lat: parseFloat(row.lat),
    lng: parseFloat(row.lon),
    category: osmCategory(row.class, row.type),
    kind: osmKind(row.class, row.type),
    importance: row.importance,
  }
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

async function overpass(query: string, signal?: AbortSignal): Promise<OverpassElement[]> {
  let lastError: Error | undefined
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        signal,
      })
      if (!res.ok) throw new Error(`Lookup failed (${res.status})`)
      const data = (await res.json()) as { elements: OverpassElement[] }
      return data.elements
    } catch (e) {
      const err = e as Error
      if (err.name === 'AbortError') throw err
      lastError = err
    }
  }
  throw lastError ?? new Error('Lookup failed')
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Find named venues near the user whose name matches the query. This is the good one. */
async function overpassNameSearch(q: string, near: LatLng, signal?: AbortSignal): Promise<SearchResult[]> {
  // A bounding box is far cheaper for Overpass than a large `around:` radius.
  const d = 0.35 // roughly 35-40 km
  const bbox = `${near.lat - d},${near.lng - d},${near.lat + d},${near.lng + d}`
  const re = escapeRegex(q)
  const query = `[out:json][timeout:20];(
    nwr["name"~"${re}",i]["amenity"](${bbox});
    nwr["name"~"${re}",i]["shop"](${bbox});
    nwr["name"~"${re}",i]["tourism"](${bbox});
    nwr["name"~"${re}",i]["leisure"](${bbox});
    nwr["name"~"${re}",i]["historic"](${bbox});
  );out center tags 40;`
  const elements = await overpass(query, signal)
  return elements.map(overpassToResult).filter((r): r is SearchResult => r !== null)
}

interface OverpassElement {
  type: string
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

function overpassToResult(el: OverpassElement): SearchResult | null {
  const tags = el.tags ?? {}
  const lat = el.lat ?? el.center?.lat
  const lng = el.lon ?? el.center?.lon
  if (!tags.name || lat == null || lng == null) return null
  const [cls, type] = tags.amenity
    ? ['amenity', tags.amenity]
    : tags.shop
      ? ['shop', tags.shop]
      : tags.tourism
        ? ['tourism', tags.tourism]
        : tags.historic
          ? ['historic', tags.historic]
          : ['leisure', tags.leisure ?? '']
  const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ')
  const city = tags['addr:city']
  return {
    provider: 'osm',
    providerId: `${el.type}/${el.id}`,
    name: tags.name,
    address: [street, city].filter(Boolean).join(', ') || undefined,
    city,
    lat,
    lng,
    category: osmCategory(cls, type),
    kind: 'poi',
  }
}

async function overpassNearby(at: LatLng, radiusM: number, signal?: AbortSignal): Promise<SearchResult[]> {
  const around = `(around:${radiusM},${at.lat},${at.lng})`
  const query = `[out:json][timeout:15];(
    nwr${around}["amenity"]["name"];
    nwr${around}["shop"]["name"];
    nwr${around}["tourism"]["name"];
    nwr${around}["leisure"]["name"];
    nwr${around}["historic"]["name"];
  );out center tags 40;`
  const elements = await overpass(query, signal)
  return elements.map(overpassToResult).filter((r): r is SearchResult => r !== null)
}

export function osmCategory(cls: string, type: string): Category {
  const t = type.toLowerCase()
  if (cls === 'amenity') {
    if (['restaurant', 'fast_food', 'food_court', 'biergarten'].includes(t)) return 'restaurant'
    if (t === 'cafe') return 'cafe'
    if (['bar', 'pub', 'nightclub', 'wine_bar'].includes(t)) return 'bar'
    if (t === 'ice_cream') return 'dessert'
    if (['theatre', 'cinema', 'arts_centre'].includes(t)) return 'activity'
    if (['museum', 'gallery'].includes(t)) return 'museum'
    return 'other'
  }
  if (cls === 'shop') {
    if (['bakery', 'pastry'].includes(t)) return 'bakery'
    if (['confectionery', 'chocolate', 'ice_cream'].includes(t)) return 'dessert'
    if (t === 'coffee') return 'cafe'
    if (['deli', 'greengrocer', 'butcher', 'supermarket'].includes(t)) return 'shop'
    return 'shop'
  }
  if (cls === 'tourism') {
    if (['hotel', 'hostel', 'guest_house', 'motel', 'apartment'].includes(t)) return 'hotel'
    if (['museum', 'gallery'].includes(t)) return 'museum'
    if (['attraction', 'viewpoint', 'artwork', 'theme_park', 'zoo', 'aquarium'].includes(t)) return 'sight'
    return 'sight'
  }
  if (cls === 'leisure') {
    if (['park', 'garden', 'nature_reserve', 'beach_resort'].includes(t)) return 'park'
    return 'activity'
  }
  if (cls === 'historic') return 'sight'
  if (cls === 'natural') return 'park'
  if (cls === 'place') return 'other'
  return 'other'
}

// ---------- Google Places (New) ----------

interface GooglePlace {
  id: string
  displayName?: { text: string }
  formattedAddress?: string
  location?: { latitude: number; longitude: number }
  types?: string[]
  addressComponents?: { longText: string; types: string[] }[]
}

const GOOGLE_FIELDS =
  'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.addressComponents'

async function googleFetch(path: string, body: unknown, signal?: AbortSignal): Promise<GooglePlace[]> {
  const res = await fetch(`https://places.googleapis.com/v1/places:${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_KEY!,
      'X-Goog-FieldMask': GOOGLE_FIELDS,
    },
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok) throw new Error(`Google Places error (${res.status})`)
  const data = (await res.json()) as { places?: GooglePlace[] }
  return data.places ?? []
}

async function googleTextSearch(q: string, near?: LatLng, signal?: AbortSignal): Promise<SearchResult[]> {
  const body: Record<string, unknown> = { textQuery: q, pageSize: 15 }
  if (near) {
    body.locationBias = { circle: { center: { latitude: near.lat, longitude: near.lng }, radius: 20000 } }
  }
  const places = await googleFetch('searchText', body, signal)
  return rankResults(
    places.map(googleToResult).filter((r): r is SearchResult => r !== null),
    q,
    near,
  )
}

async function googleNearby(at: LatLng, radiusM: number, signal?: AbortSignal): Promise<SearchResult[]> {
  const places = await googleFetch(
    'searchNearby',
    {
      maxResultCount: 20,
      rankPreference: 'DISTANCE',
      locationRestriction: { circle: { center: { latitude: at.lat, longitude: at.lng }, radius: radiusM } },
    },
    signal,
  )
  return places.map(googleToResult).filter((r): r is SearchResult => r !== null)
}

const GOOGLE_AREA_TYPES = [
  'locality',
  'political',
  'administrative_area_level_1',
  'administrative_area_level_2',
  'administrative_area_level_3',
  'country',
  'postal_code',
  'neighborhood',
  'sublocality',
]

export function googleKind(types: string[]): ResultKind {
  if (types.includes('street_address') || types.includes('route') || types.includes('premise')) return 'address'
  if (types.some((t) => GOOGLE_AREA_TYPES.includes(t))) return 'area'
  return 'poi'
}

function googleToResult(p: GooglePlace): SearchResult | null {
  if (!p.location || !p.displayName) return null
  const comp = (type: string) => p.addressComponents?.find((c) => c.types.includes(type))?.longText
  const types = p.types ?? []
  return {
    provider: 'google',
    providerId: p.id,
    name: p.displayName.text,
    address: p.formattedAddress,
    city: comp('locality') || comp('postal_town') || comp('sublocality') || comp('administrative_area_level_2'),
    country: comp('country'),
    lat: p.location.latitude,
    lng: p.location.longitude,
    category: googleCategory(types),
    kind: googleKind(types),
  }
}

export function googleCategory(types: string[]): Category {
  const has = (...t: string[]) => t.some((x) => types.includes(x))
  if (has('bakery')) return 'bakery'
  if (has('ice_cream_shop', 'dessert_shop', 'dessert_restaurant', 'candy_store', 'chocolate_shop')) return 'dessert'
  if (has('cafe', 'coffee_shop', 'tea_house')) return 'cafe'
  if (has('bar', 'pub', 'night_club', 'wine_bar')) return 'bar'
  if (has('restaurant', 'meal_takeaway', 'meal_delivery', 'food')) return 'restaurant'
  if (has('lodging', 'hotel', 'hostel', 'motel', 'bed_and_breakfast')) return 'hotel'
  if (has('museum', 'art_gallery')) return 'museum'
  if (has('park', 'national_park', 'garden', 'hiking_area', 'beach')) return 'park'
  if (has('tourist_attraction', 'landmark', 'historical_landmark', 'monument', 'church', 'place_of_worship'))
    return 'sight'
  if (has('store', 'shopping_mall', 'clothing_store', 'book_store', 'market')) return 'shop'
  if (has('amusement_park', 'movie_theater', 'spa', 'gym', 'stadium', 'zoo', 'aquarium', 'bowling_alley'))
    return 'activity'
  return 'other'
}
