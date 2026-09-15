import { useEffect, useMemo, useState } from 'react'
import { List, ListChecks, Map as MapIcon, Plus, Search, Settings, SlidersHorizontal, X } from 'lucide-react'
import type { Place, PlaceList } from './db/schema'
import { useKnownTags, usePlaces, useSetting, useToast, useUserLocation } from './hooks'
import { activeFilterCount, applyFilters, collectCities, collectTags, DEFAULT_FILTERS, type Filters } from './lib/filters'
import { readShareFromLocation, type SharePayload } from './lib/share'
import { MapView } from './views/MapView'
import { ListView } from './views/ListView'
import { ListsView } from './views/ListsView'
import { SettingsView } from './views/SettingsView'
import { ImportView } from './views/ImportView'
import { AddPlaceSheet } from './components/AddPlaceSheet'
import { PlaceForm, type PlaceDraft } from './components/PlaceForm'
import { PlaceDetail } from './components/PlaceDetail'
import { FilterSheet } from './components/FilterSheet'
import { ShareSheet } from './components/ShareSheet'
import { ListPickerSheet } from './components/ListPickerSheet'

type Tab = 'map' | 'list' | 'lists' | 'settings'

type Modal =
  | { kind: 'none' }
  | { kind: 'add' }
  | { kind: 'form'; draft: PlaceDraft; existing?: Place }
  | { kind: 'detail'; id: string }
  | { kind: 'filters' }
  | { kind: 'share'; places: Place[]; title?: string; shareKind: 'rec' | 'list' }
  | { kind: 'listpick'; place: Place }
  | { kind: 'import'; payload: SharePayload }

const FILTER_KEY = 'been-there:filters'

function loadFilters(): Filters {
  try {
    const raw = localStorage.getItem(FILTER_KEY)
    if (raw) return { ...DEFAULT_FILTERS, ...(JSON.parse(raw) as Partial<Filters>), query: '', near: null }
  } catch {
    /* ignore */
  }
  return DEFAULT_FILTERS
}

export default function App() {
  const places = usePlaces()
  const knownTags = useKnownTags()
  const displayName = useSetting('displayName')
  const { location, error: locationError, refresh: refreshLocation } = useUserLocation()
  const toast = useToast()

  const [tab, setTabRaw] = useState<Tab>('map')
  const [placesTab, setPlacesTab] = useState<'map' | 'list'>('map')
  const setTab = (t: Tab) => {
    if (t === 'map' || t === 'list') setPlacesTab(t)
    setTabRaw(t)
  }
  const [modal, setModal] = useState<Modal>({ kind: 'none' })
  const [filters, setFilters] = useState<Filters>(loadFilters)
  const [searchOpen, setSearchOpen] = useState(false)
  const [locateNonce, setLocateNonce] = useState(0)

  useEffect(() => {
    try {
      const { query: _q, near: _n, ...rest } = filters
      localStorage.setItem(FILTER_KEY, JSON.stringify(rest))
    } catch {
      /* ignore */
    }
  }, [filters])

  // Shared link: /#s=… opens the import sheet once and then clears the hash.
  useEffect(() => {
    const check = () => {
      const payload = readShareFromLocation()
      if (payload) {
        setModal({ kind: 'import', payload })
        history.replaceState(null, '', window.location.pathname)
      }
    }
    check()
    window.addEventListener('hashchange', check)
    return () => window.removeEventListener('hashchange', check)
  }, [])

  const all = useMemo(() => places ?? [], [places])
  const visible = useMemo(() => applyFilters(all, filters, location), [all, filters, location])
  const cities = useMemo(() => collectCities(all), [all])
  const tags = useMemo(() => collectTags(all, knownTags), [all, knownTags])
  const filterCount = activeFilterCount(filters)

  const close = () => setModal({ kind: 'none' })
  const openDetail = (p: Place) => setModal({ kind: 'detail', id: p.id })
  const detailPlace = modal.kind === 'detail' ? all.find((p) => p.id === modal.id) : undefined

  useEffect(() => {
    if (modal.kind === 'detail' && places && !detailPlace) close()
  }, [modal, places, detailPlace])

  const onLocate = async () => {
    const pos = await refreshLocation()
    if (!pos) toast.show(locationError ?? 'Could not get your location')
    setLocateNonce((n) => n + 1)
  }

  const shareList = (list: PlaceList, listPlaces: Place[]) =>
    setModal({ kind: 'share', places: listPlaces, title: list.name, shareKind: 'list' })

  return (
    <div className="app">
      <header className="topbar">
        {searchOpen ? (
          <div className="search">
            <Search size={18} />
            <input autoFocus placeholder="Search names, notes, tags…" value={filters.query} onChange={(e) => setFilters({ ...filters, query: e.target.value })} />
            <button
              className="icon-btn"
              style={{ width: 28, height: 28 }}
              onClick={() => {
                setFilters({ ...filters, query: '' })
                setSearchOpen(false)
              }}
              aria-label="Close search"
            >
              <X size={18} />
            </button>
          </div>
        ) : (
          <>
            <div style={{ fontWeight: 800, fontSize: 18, flex: 1 }}>{tab === 'lists' ? 'Lists' : tab === 'settings' ? 'Settings' : 'Been There'}</div>
            {(tab === 'map' || tab === 'list') && (
              <>
                <div className="segmented">
                  <button className={tab === 'map' ? 'active' : ''} onClick={() => setTab('map')} aria-label="Map view">
                    <MapIcon size={18} />
                  </button>
                  <button className={tab === 'list' ? 'active' : ''} onClick={() => setTab('list')} aria-label="List view">
                    <List size={18} />
                  </button>
                </div>
                <button className="icon-btn" onClick={() => setSearchOpen(true)} aria-label="Search">
                  <Search size={22} />
                </button>
                <button className="icon-btn" onClick={() => setModal({ kind: 'filters' })} aria-label="Filters">
                  <SlidersHorizontal size={22} />
                  {filterCount > 0 && <span className="badge">{filterCount}</span>}
                </button>
              </>
            )}
          </>
        )}
      </header>

      <main className="app-body">
        {tab === 'map' && <MapView key={locateNonce} places={visible} userLocation={location} onLocate={() => void onLocate()} onOpen={openDetail} />}
        {tab === 'list' && (
          <ListView places={visible} allCount={all.length} userLocation={location} groupByCity={!filters.city && filters.sort === 'recent' && cities.length > 1} onOpen={openDetail} onAdd={() => setModal({ kind: 'add' })} />
        )}
        {tab === 'lists' && <ListsView places={all} userLocation={location} onOpen={openDetail} onShare={shareList} />}
        {tab === 'settings' && <SettingsView placeCount={all.length} onToast={toast.show} />}
        {(tab === 'map' || tab === 'list') && (
          <button className="fab" onClick={() => setModal({ kind: 'add' })} aria-label="Add a place">
            <Plus size={30} />
          </button>
        )}
      </main>

      <nav className="bottomnav">
        <button className={tab === 'map' || tab === 'list' ? 'active' : ''} onClick={() => setTab(placesTab)}>
          <MapIcon size={22} /> Places
        </button>
        <button className={tab === 'lists' ? 'active' : ''} onClick={() => setTab('lists')}>
          <ListChecks size={22} /> Lists
        </button>
        <button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}>
          <Settings size={22} /> Settings
        </button>
      </nav>

      {modal.kind === 'add' && (
        <AddPlaceSheet
          userLocation={location}
          locationError={locationError}
          onRefreshLocation={refreshLocation}
          existingPlaces={all}
          onPick={(draft, existing) => setModal({ kind: 'form', draft: existing ? { ...existing, status: draft.status ?? existing.status } : draft, existing })}
          onClose={close}
        />
      )}
      {modal.kind === 'form' && (
        <PlaceForm
          draft={modal.draft}
          existing={modal.existing}
          onClose={modal.existing ? () => setModal({ kind: 'detail', id: modal.existing!.id }) : close}
          onSaved={(p) => {
            toast.show(modal.existing ? 'Saved' : p.status === 'been' ? 'Logged!' : 'Saved for later')
            setModal({ kind: 'detail', id: p.id })
          }}
        />
      )}
      {detailPlace && (
        <PlaceDetail
          place={detailPlace}
          userLocation={location}
          onClose={close}
          onEdit={() => setModal({ kind: 'form', draft: detailPlace, existing: detailPlace })}
          onShare={() => setModal({ kind: 'share', places: [detailPlace], shareKind: 'rec' })}
          onAddToList={() => setModal({ kind: 'listpick', place: detailPlace })}
          onDeleted={() => {
            close()
            toast.show('Deleted')
          }}
        />
      )}
      {modal.kind === 'filters' && <FilterSheet filters={filters} cities={cities} tags={tags} userLocation={location} onChange={setFilters} onClose={close} />}
      {modal.kind === 'share' && <ShareSheet places={modal.places} title={modal.title} kind={modal.shareKind} from={displayName || undefined} onClose={close} onToast={toast.show} />}
      {modal.kind === 'listpick' && <ListPickerSheet place={modal.place} onClose={() => setModal({ kind: 'detail', id: modal.place.id })} />}
      {modal.kind === 'import' && (
        <ImportView
          payload={modal.payload}
          existingPlaces={all}
          onClose={close}
          onDone={(n) => {
            close()
            setTab('list')
            toast.show(`Saved ${n} place${n === 1 ? '' : 's'}`)
          }}
        />
      )}

      {toast.message && <div className="toast">{toast.message}</div>}
    </div>
  )
}
