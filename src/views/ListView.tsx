import { MapPinPlus } from 'lucide-react'
import { costLabel, type Place } from '../db/schema'
import { useCoverPhotos } from '../hooks'
import { distanceKm, formatDistance, type LatLng } from '../lib/geo'
import { CategoryIcon } from '../components/CategoryIcon'
import { Stars } from '../components/Stars'
import { Thumb } from '../components/Thumb'

interface Props {
  places: Place[]
  allCount: number
  userLocation: LatLng | null
  groupByCity: boolean
  onOpen: (place: Place) => void
  onAdd: () => void
}

export function PlaceCard({ place, userLocation, cover, onOpen }: { place: Place; userLocation: LatLng | null; cover?: Blob; onOpen: (p: Place) => void }) {
  return (
    <button className="card" onClick={() => onOpen(place)}>
      {cover ? <Thumb blob={cover} className="card-thumb" /> : <div className="card-thumb"><CategoryIcon category={place.category} size={24} /></div>}
      <div className="card-body">
        <div className="card-title">
          <span className={`status-dot ${place.status}`} />
          <span className="name">{place.name}</span>
        </div>
        <div className="card-sub">{[place.address ?? place.city, userLocation ? formatDistance(distanceKm(userLocation, place)) : null].filter(Boolean).join(' · ')}</div>
        <div className="card-row">
          {place.status === 'been' ? <Stars value={place.rating} /> : <span className="chip small" style={{ background: 'var(--want)', color: '#fff' }}>Want to go</span>}
          {place.cost && <span className="cost">{costLabel(place.cost)}</span>}
          {place.tags.slice(0, 3).map((t) => (
            <span key={t} className="chip small">#{t}</span>
          ))}
        </div>
        {place.orderTips && <div className="card-tip">Order: {place.orderTips}</div>}
        {!place.orderTips && place.notes && <div className="card-tip hint">{place.notes}</div>}
      </div>
    </button>
  )
}

export function ListView({ places, allCount, userLocation, groupByCity, onOpen, onAdd }: Props) {
  const covers = useCoverPhotos()

  if (allCount === 0) {
    return (
      <div className="scroll">
        <div className="empty">
          <MapPinPlus size={40} />
          <h2>No places yet</h2>
          <p>Just finished a meal? Tap + and it takes ten seconds to log the spot, rate it, and note what to order next time.</p>
          <button className="btn primary" onClick={onAdd} style={{ marginTop: 12 }}>
            Add your first place
          </button>
        </div>
      </div>
    )
  }

  if (places.length === 0) {
    return (
      <div className="scroll">
        <div className="empty">
          <h2>Nothing matches</h2>
          <p>Try loosening the filters.</p>
        </div>
      </div>
    )
  }

  const groups: [string, Place[]][] = groupByCity
    ? [...places.reduce((m, p) => {
        const k = p.city ?? 'Elsewhere'
        m.set(k, [...(m.get(k) ?? []), p])
        return m
      }, new Map<string, Place[]>())]
    : [['', places]]

  return (
    <div className="scroll">
      {groups.map(([city, group]) => (
        <div key={city}>
          {city && <div className="section-title">{city} · {group.length}</div>}
          {group.map((p) => (
            <PlaceCard key={p.id} place={p} userLocation={userLocation} cover={covers.get(p.id)?.blob} onOpen={onOpen} />
          ))}
        </div>
      ))}
    </div>
  )
}
