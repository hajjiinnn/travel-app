import { Bookmark, CheckCircle2, ExternalLink, ListPlus, Pencil, Share2, Trash2 } from 'lucide-react'
import { categoryLabel, costLabel, type Place } from '../db/schema'
import { deletePlace, savePlace } from '../db/repo'
import { usePhotos, useObjectUrls } from '../hooks'
import { distanceKm, formatDistance, type LatLng } from '../lib/geo'
import { Sheet } from './Sheet'
import { Stars } from './Stars'

interface Props {
  place: Place
  userLocation: LatLng | null
  onEdit: () => void
  onShare: () => void
  onAddToList: () => void
  onClose: () => void
  onDeleted: () => void
}

export function PlaceDetail({ place, userLocation, onEdit, onShare, onAddToList, onClose, onDeleted }: Props) {
  const photos = usePhotos(place.id)
  const urls = useObjectUrls(photos.map((p) => p.blob))

  const remove = async () => {
    if (!window.confirm(`Delete ${place.name}? This also removes its photos.`)) return
    await deletePlace(place.id)
    onDeleted()
  }

  const markBeen = () => {
    void savePlace({ ...place, status: 'been' }).then(onEdit)
  }

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.name} ${place.address ?? ''}`.trim())}${
    place.source?.provider === 'google' && place.source.id ? `&query_place_id=${place.source.id}` : ''
  }`

  const lastVisit = place.visits[place.visits.length - 1]

  return (
    <Sheet onClose={onClose}>
      {urls.length > 0 && (
        <div className="photo-strip" style={{ marginBottom: 8 }}>
          {urls.map((u, i) => (
            <img key={i} src={u} alt="" style={{ height: urls.length === 1 ? 220 : 140 }} />
          ))}
        </div>
      )}
      <div className="detail-title">{place.name}</div>
      <div className="detail-meta">
        <span className={`chip small`} style={{ background: place.status === 'been' ? 'var(--been)' : 'var(--want)', color: '#fff' }}>
          {place.status === 'been' ? 'Been there' : 'Want to go'}
        </span>
        <Stars value={place.rating} />
        {place.cost && <span className="cost">{costLabel(place.cost)}</span>}
        <span>{categoryLabel(place.category)}</span>
        {userLocation && <span>{formatDistance(distanceKm(userLocation, place))} away</span>}
      </div>
      {(place.address || place.city) && (
        <div className="hint" style={{ marginTop: 6 }}>
          {place.address ?? place.city}
        </div>
      )}

      <div className="detail-actions">
        <button onClick={onEdit}>
          <Pencil size={20} /> Edit
        </button>
        <button onClick={onShare}>
          <Share2 size={20} /> Share
        </button>
        <button onClick={onAddToList}>
          <ListPlus size={20} /> List
        </button>
        {place.status === 'want' ? (
          <button onClick={markBeen}>
            <CheckCircle2 size={20} /> Been!
          </button>
        ) : (
          <a href={mapsUrl} target="_blank" rel="noreferrer" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '10px 4px', borderRadius: 12, background: 'var(--bg-muted)', fontSize: 12, fontWeight: 600, color: 'var(--fg)', textDecoration: 'none' }}>
            <ExternalLink size={20} /> Maps
          </a>
        )}
      </div>

      {place.orderTips && (
        <div className="detail-block tip-order">
          <h4>Order / do</h4>
          <p>{place.orderTips}</p>
        </div>
      )}
      {place.avoidTips && (
        <div className="detail-block tip-avoid">
          <h4>Skip</h4>
          <p>{place.avoidTips}</p>
        </div>
      )}
      {place.notes && (
        <div className="detail-block">
          <h4>Notes</h4>
          <p>{place.notes}</p>
        </div>
      )}
      {place.recommendedBy && (
        <div className="detail-block">
          <h4>Recommended by</h4>
          <p>{place.recommendedBy}</p>
        </div>
      )}
      {place.tags.length > 0 && (
        <div className="detail-block">
          <div className="chips">
            {place.tags.map((t) => (
              <span key={t} className="chip small">
                #{t}
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="detail-block hint">
        {place.wouldReturn && <div>Would go back</div>}
        {place.status === 'been' && lastVisit && (
          <div>
            Visited {place.visits.length > 1 ? `${place.visits.length} times, last ` : ''}
            {new Date(lastVisit).toLocaleDateString()}
          </div>
        )}
        {place.status === 'want' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Bookmark size={14} /> Saved {new Date(place.createdAt).toLocaleDateString()}
          </div>
        )}
        {place.status === 'want' && (
          <div style={{ marginTop: 6 }}>
            <a href={mapsUrl} target="_blank" rel="noreferrer">
              Open in Google Maps
            </a>
          </div>
        )}
      </div>

      <div style={{ marginTop: 20 }}>
        <button className="btn danger block" onClick={remove}>
          <Trash2 size={18} /> Delete place
        </button>
      </div>
    </Sheet>
  )
}
