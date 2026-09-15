import { useEffect, useRef, useState } from 'react'
import { LocateFixed, MapPin, Search } from 'lucide-react'
import { CategoryIcon } from './CategoryIcon'
import { categoryLabel } from '../db/schema'
import { Sheet } from './Sheet'
import { distanceKm, formatDistance, type LatLng } from '../lib/geo'
import { nearbyPlaces, searchPlaces, searchProviderName, type SearchResult } from '../lib/search'
import type { Place, PlaceStatus } from '../db/schema'
import type { PlaceDraft } from './PlaceForm'

interface Props {
  userLocation: LatLng | null
  locationError: string | null
  onRefreshLocation: () => Promise<LatLng | null>
  existingPlaces: Place[]
  onPick: (draft: PlaceDraft, existing?: Place) => void
  onClose: () => void
}

export function AddPlaceSheet({ userLocation, locationError, onRefreshLocation, existingPlaces, onPick, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<PlaceStatus>('been')
  const [results, setResults] = useState<SearchResult[]>([])
  const [nearby, setNearby] = useState<SearchResult[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [nearbyLoading, setNearbyLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abort = useRef<AbortController | null>(null)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    input.current?.focus()
  }, [])

  // Load what's within a short walk as soon as we know where the user is.
  useEffect(() => {
    if (!userLocation || nearby !== null) return
    const ctrl = new AbortController()
    setNearbyLoading(true)
    nearbyPlaces(userLocation, 200, ctrl.signal)
      .then((r) => setNearby(r.sort((a, b) => distanceKm(userLocation, a) - distanceKm(userLocation, b)).slice(0, 12)))
      .catch(() => setNearby([]))
      .finally(() => setNearbyLoading(false))
    return () => ctrl.abort()
  }, [userLocation, nearby])

  useEffect(() => {
    abort.current?.abort()
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      setLoading(false)
      return
    }
    const ctrl = new AbortController()
    abort.current = ctrl
    setLoading(true)
    setError(null)
    const t = window.setTimeout(() => {
      searchPlaces(q, userLocation ?? undefined, ctrl.signal)
        .then((r) => {
          if (!ctrl.signal.aborted) setResults(r)
        })
        .catch((e: Error) => {
          if (e.name !== 'AbortError') setError(e.message)
        })
        .finally(() => {
          if (!ctrl.signal.aborted) setLoading(false)
        })
    }, 350)
    return () => {
      window.clearTimeout(t)
      ctrl.abort()
    }
  }, [query, userLocation])

  const findExisting = (r: SearchResult) =>
    existingPlaces.find(
      (p) =>
        (p.source?.provider === r.provider && p.source.id === r.providerId) ||
        (p.name.toLowerCase() === r.name.toLowerCase() && distanceKm(p, r) < 0.1),
    )

  const pick = (r: SearchResult) => {
    const existing = findExisting(r)
    onPick(
      {
        name: r.name,
        address: r.address,
        city: r.city,
        country: r.country,
        lat: r.lat,
        lng: r.lng,
        category: r.category,
        status,
        source: { provider: r.provider, id: r.providerId },
      },
      existing,
    )
  }

  const pickManual = () => {
    const at = userLocation ?? { lat: 0, lng: 0 }
    onPick({ name: query.trim(), lat: at.lat, lng: at.lng, category: 'other', status, source: { provider: 'manual' } })
  }

  const renderResult = (r: SearchResult) => {
    const existing = findExisting(r)
    return (
      <button key={`${r.provider}:${r.providerId}`} className="result" onClick={() => pick(r)}>
        <div className="result-icon">
          <CategoryIcon category={r.category} />
        </div>
        <div className="result-body">
          <div className="result-name">
            {r.name}
            {existing && (
              <span className={`chip small`} style={{ marginLeft: 6 }}>
                {existing.status === 'been' ? 'Been' : 'Saved'}
              </span>
            )}
          </div>
          <div className="result-sub">
            {[r.kind === 'area' ? 'City or area' : categoryLabel(r.category), r.address ?? r.city]
              .filter(Boolean)
              .join(' · ')}
          </div>
        </div>
        {userLocation && <div className="result-dist">{formatDistance(distanceKm(userLocation, r))}</div>}
      </button>
    )
  }

  const showNearby = query.trim().length < 2

  return (
    <Sheet full title="Add a place" onClose={onClose}>
      <div className="field">
        <div className="toggle">
          <button type="button" className={status === 'been' ? 'on been' : ''} onClick={() => setStatus('been')}>
            Been there
          </button>
          <button type="button" className={status === 'want' ? 'on want' : ''} onClick={() => setStatus('want')}>
            Want to go
          </button>
        </div>
      </div>
      <div className="search" style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-muted)', borderRadius: 999, padding: '10px 12px' }}>
        <Search size={18} />
        <input
          ref={input}
          style={{ flex: 1, border: 0, background: 'none', outline: 'none', minWidth: 0 }}
          placeholder={`Search ${searchProviderName()}…`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          enterKeyHint="search"
        />
      </div>

      {error && <div className="error">{error}</div>}
      {loading && <div className="spinner" />}

      {!showNearby && !loading && (
        <div style={{ marginTop: 8 }}>
          {results.map(renderResult)}
          {results.length === 0 && <div className="hint" style={{ padding: '12px 4px' }}>No matches.</div>}
          <button className="result" onClick={pickManual}>
            <div className="result-icon">
              <MapPin size={18} />
            </div>
            <div className="result-body">
              <div className="result-name">Add “{query.trim()}” manually</div>
              <div className="result-sub">{userLocation ? 'Pinned at your current location' : 'No location attached'}</div>
            </div>
          </button>
        </div>
      )}

      {showNearby && (
        <div style={{ marginTop: 12 }}>
          <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <LocateFixed size={14} /> Right around you
          </div>
          {!userLocation && (
            <div className="hint" style={{ padding: '4px 4px 12px' }}>
              {locationError ?? 'Finding your location…'}{' '}
              <button className="chip small" onClick={() => void onRefreshLocation()}>
                Retry
              </button>
            </div>
          )}
          {nearbyLoading && <div className="spinner" />}
          {nearby?.map(renderResult)}
          {userLocation && nearby && nearby.length === 0 && !nearbyLoading && (
            <div className="hint" style={{ padding: '4px 4px 12px' }}>Nothing named nearby. Search above or add manually.</div>
          )}
        </div>
      )}
    </Sheet>
  )
}
