import { useEffect, useMemo } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import { LocateFixed } from 'lucide-react'
import { costLabel, type Place } from '../db/schema'
import type { LatLng } from '../lib/geo'

interface Props {
  places: Place[]
  userLocation: LatLng | null
  onLocate: () => void
  onOpen: (place: Place) => void
}

function pinIcon(place: Place) {
  const label = place.status === 'been' && place.rating ? String(place.rating) : place.status === 'want' ? '♡' : '•'
  return L.divIcon({
    className: `pin pin-${place.status}`,
    html: `<div class="pin-inner"><span>${label}</span></div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
    popupAnchor: [0, -38],
  })
}

const meIcon = L.divIcon({ className: '', html: '<div class="pin-me"></div>', iconSize: [16, 16], iconAnchor: [8, 8] })

function FitToPlaces({ places, userLocation }: { places: Place[]; userLocation: LatLng | null }) {
  const map = useMap()
  const key = places.map((p) => p.id).join(',')
  useEffect(() => {
    if (places.length === 0) {
      if (userLocation) map.setView([userLocation.lat, userLocation.lng], 14)
      return
    }
    const bounds = L.latLngBounds(places.map((p) => [p.lat, p.lng] as [number, number]))
    map.fitBounds(bounds.pad(0.2), { maxZoom: 15, animate: false })
    // Only refit when the visible set changes, not on every location tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map])
  return null
}

function FlyTo({ target }: { target: LatLng | null }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 15))
  }, [target, map])
  return null
}

export function MapView({ places, userLocation, onLocate, onOpen }: Props) {
  const center = useMemo<[number, number]>(() => {
    if (places.length) return [places[0].lat, places[0].lng]
    if (userLocation) return [userLocation.lat, userLocation.lng]
    return [40.7128, -74.006]
  }, [places, userLocation])

  return (
    <div className="map-wrap">
      <MapContainer center={center} zoom={13} zoomControl={false} attributionControl>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FitToPlaces places={places} userLocation={userLocation} />
        <FlyTo target={null} />
        {userLocation && <Marker position={[userLocation.lat, userLocation.lng]} icon={meIcon} interactive={false} />}
        {places.map((p) => (
          <Marker key={p.id} position={[p.lat, p.lng]} icon={pinIcon(p)}>
            <Popup>
              <div className="popup-name">{p.name}</div>
              <div className="popup-meta">
                {[p.status === 'been' ? (p.rating ? '★'.repeat(p.rating) : 'Been') : 'Want to go', costLabel(p.cost), p.city].filter(Boolean).join(' · ')}
              </div>
              {p.orderTips && <div className="popup-meta">Order: {p.orderTips}</div>}
              <button className="popup-open" onClick={() => onOpen(p)}>
                Open →
              </button>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      <div className="map-count">{places.length} place{places.length === 1 ? '' : 's'}</div>
      <div className="map-locate">
        <button onClick={onLocate} aria-label="Center on my location">
          <LocateFixed size={22} />
        </button>
      </div>
    </div>
  )
}
