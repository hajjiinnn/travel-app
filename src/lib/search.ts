import type { Category } from '../db/schema'
import type { LatLng } from './geo'

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
}

const GOOGLE_KEY: string | undefined = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || undefined

export function searchProviderName(): 'Google Places' | 'OpenStreetMap' {
  return GOOGLE_KEY ? 'Google Places' : 'OpenStreetMap'
}

/** Text search for places, biased toward `near` when given. */
export async function searchPlaces(query: string, near?: LatLng, signal?: AbortSignal): Promise<SearchResult[]> {
  const q = query.trim()
  if (!q) return []
  return GOOGLE_KEY ? googleTextSearch(q, near, signal) : nominatimSearch(q, near, signal)
}

/** Places within a short walk of `at`, for the "I'm here right now" flow. */
export async function nearbyPlaces(at: LatLng, radiusM = 150, signal?: AbortSignal): Promise<SearchResult[]> {
  return GOOGLE_KEY ? googleNearby(at, radiusM, signal) : overpassNearby(at, radiusM, signal)
}

// ---------- OpenStreetMap (no API key) ----------

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
  address?: Record<string, string>
}

async function nominatimSearch(q: string, near?: LatLng, signal?: AbortSignal): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    q,
    format: 'jsonv2',
    addressdetails: '1',
    namedetails: '0',
    limit: '10',
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
  }
}

export function osmCategory(cls: string, type: string): Category {
  const t = type.toLowerCase()
  if (cls === 'amenity') {
    if (['restaurant', 'fast_food', 'food_court', 'biergarten'].includes(t)) return 'restaurant'
    if (t === 'cafe') return 'cafe'
    if (['bar', 'pub', 'nightclub', 'wine_bar'].includes(t)) return 'bar'
    if (t === 'ice_cream') return 'dessert'
    if (['theatre', 'cinema', 'arts_centre'].includes(t)) return 'activity'
    return 'other'
  }
  if (cls === 'shop') {
    if (['bakery', 'pastry'].includes(t)) return 'bakery'
    if (['confectionery', 'chocolate', 'ice_cream'].includes(t)) return 'dessert'
    if (t === 'coffee') return 'cafe'
    return 'shop'
  }
  if (cls === 'tourism') {
    if (['hotel', 'hostel', 'guest_house', 'motel', 'apartment'].includes(t)) return 'hotel'
    if (['museum', 'gallery'].includes(t)) return 'museum'
    if (['attraction', 'viewpoint', 'artwork'].includes(t)) return 'sight'
    return 'sight'
  }
  if (cls === 'leisure') {
    if (['park', 'garden', 'nature_reserve'].includes(t)) return 'park'
    return 'activity'
  }
  if (cls === 'historic') return 'sight'
  if (cls === 'natural') return 'park'
  return 'other'
}

interface OverpassElement {
  type: string
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

async function overpassNearby(at: LatLng, radiusM: number, signal?: AbortSignal): Promise<SearchResult[]> {
  const around = `(around:${radiusM},${at.lat},${at.lng})`
  const query = `[out:json][timeout:10];(
    nwr${around}["amenity"]["name"];
    nwr${around}["shop"]["name"];
    nwr${around}["tourism"]["name"];
    nwr${around}["leisure"]["name"];
  );out center tags 30;`
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: `data=${encodeURIComponent(query)}`,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    signal,
  })
  if (!res.ok) throw new Error(`Nearby lookup failed (${res.status})`)
  const data = (await res.json()) as { elements: OverpassElement[] }
  const results: SearchResult[] = []
  for (const el of data.elements) {
    const tags = el.tags ?? {}
    const lat = el.lat ?? el.center?.lat
    const lng = el.lon ?? el.center?.lon
    if (!tags.name || lat == null || lng == null) continue
    const [cls, type] = tags.amenity
      ? ['amenity', tags.amenity]
      : tags.shop
        ? ['shop', tags.shop]
        : tags.tourism
          ? ['tourism', tags.tourism]
          : ['leisure', tags.leisure ?? '']
    const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ')
    results.push({
      provider: 'osm',
      providerId: `${el.type}/${el.id}`,
      name: tags.name,
      address: street || undefined,
      city: tags['addr:city'],
      lat,
      lng,
      category: osmCategory(cls, type),
    })
  }
  return results
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
  const body: Record<string, unknown> = { textQuery: q, pageSize: 10 }
  if (near) {
    body.locationBias = { circle: { center: { latitude: near.lat, longitude: near.lng }, radius: 20000 } }
  }
  const places = await googleFetch('searchText', body, signal)
  return places.map(googleToResult).filter((r): r is SearchResult => r !== null)
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

function googleToResult(p: GooglePlace): SearchResult | null {
  if (!p.location || !p.displayName) return null
  const comp = (type: string) => p.addressComponents?.find((c) => c.types.includes(type))?.longText
  return {
    provider: 'google',
    providerId: p.id,
    name: p.displayName.text,
    address: p.formattedAddress,
    city: comp('locality') || comp('postal_town') || comp('sublocality') || comp('administrative_area_level_2'),
    country: comp('country'),
    lat: p.location.latitude,
    lng: p.location.longitude,
    category: googleCategory(p.types ?? []),
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
