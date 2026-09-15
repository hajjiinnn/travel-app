import { CATEGORIES, categoryLabel, type Category, type Cost } from '../db/schema'
import { DEFAULT_FILTERS, type Filters, type SortKey } from '../lib/filters'
import type { LatLng } from '../lib/geo'
import { Sheet } from './Sheet'

interface Props {
  filters: Filters
  cities: string[]
  tags: string[]
  userLocation: LatLng | null
  onChange: (f: Filters) => void
  onClose: () => void
}

const RADII = [0.5, 1, 2, 5, 15]
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'recent', label: 'Recent' },
  { key: 'rating', label: 'Top rated' },
  { key: 'distance', label: 'Nearest' },
  { key: 'name', label: 'A–Z' },
]

export function FilterSheet({ filters, cities, tags, userLocation, onChange, onClose }: Props) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch })
  const toggleIn = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])

  return (
    <Sheet
      title="Filter & sort"
      onClose={onClose}
      headerRight={
        <button className="chip" onClick={() => onChange({ ...DEFAULT_FILTERS, query: filters.query })}>
          Reset
        </button>
      }
      footer={
        <button className="btn primary block" onClick={onClose}>
          Done
        </button>
      }
    >
      <div className="field">
        <label>Show</label>
        <div className="chips">
          {(['all', 'been', 'want'] as const).map((s) => (
            <button key={s} className={`chip${filters.status === s ? ' active' : ''}`} onClick={() => set({ status: s })}>
              {s === 'all' ? 'Everything' : s === 'been' ? 'Been there' : 'Want to go'}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label>Sort by</label>
        <div className="chips">
          {SORTS.map((s) => (
            <button key={s.key} className={`chip${filters.sort === s.key ? ' active' : ''}`} onClick={() => set({ sort: s.key })} disabled={s.key === 'distance' && !userLocation}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label>Minimum rating</label>
        <div className="chips">
          {[0, 3, 4, 5].map((r) => (
            <button key={r} className={`chip${filters.minRating === r ? ' active' : ''}`} onClick={() => set({ minRating: r })}>
              {r === 0 ? 'Any' : `${'★'.repeat(r)}${r < 5 ? '+' : ''}`}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label>Cost</label>
        <div className="chips">
          {([1, 2, 3, 4] as Cost[]).map((c) => (
            <button key={c} className={`chip${filters.costs.includes(c) ? ' active' : ''}`} onClick={() => set({ costs: toggleIn(filters.costs, c) })}>
              {'$'.repeat(c)}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label>Near me</label>
        <div className="chips">
          <button className={`chip${!filters.near ? ' active' : ''}`} onClick={() => set({ near: null })}>
            Anywhere
          </button>
          {RADII.map((km) => (
            <button
              key={km}
              className={`chip${filters.near?.radiusKm === km ? ' active' : ''}`}
              disabled={!userLocation}
              onClick={() => userLocation && set({ near: { ...userLocation, radiusKm: km }, city: null })}
            >
              {km < 1 ? `${km * 1000} m` : `${km} km`}
            </button>
          ))}
        </div>
        {!userLocation && <div className="hint" style={{ marginTop: 6 }}>Turn on location to filter by distance.</div>}
      </div>

      {cities.length > 0 && (
        <div className="field">
          <label>City</label>
          <div className="chips">
            <button className={`chip${!filters.city ? ' active' : ''}`} onClick={() => set({ city: null })}>
              All
            </button>
            {cities.map((c) => (
              <button key={c} className={`chip${filters.city === c ? ' active' : ''}`} onClick={() => set({ city: filters.city === c ? null : c, near: null })}>
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {tags.length > 0 && (
        <div className="field">
          <label>Tags</label>
          <div className="chips">
            {tags.map((t) => (
              <button key={t} className={`chip${filters.tags.includes(t) ? ' active' : ''}`} onClick={() => set({ tags: toggleIn(filters.tags, t) })}>
                #{t}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="field">
        <label>Type</label>
        <div className="chips">
          {CATEGORIES.map((c) => (
            <button key={c} className={`chip${filters.categories.includes(c) ? ' active' : ''}`} onClick={() => set({ categories: toggleIn<Category>(filters.categories, c) })}>
              {categoryLabel(c)}
            </button>
          ))}
        </div>
      </div>
    </Sheet>
  )
}
