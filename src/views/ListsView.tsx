import { useState } from 'react'
import { ChevronLeft, ListChecks, Plus, Share2, Trash2 } from 'lucide-react'
import type { Place, PlaceList } from '../db/schema'
import { createList, deleteList, updateList } from '../db/repo'
import { useCoverPhotos, useLists } from '../hooks'
import type { LatLng } from '../lib/geo'
import { PlaceCard } from './ListView'

interface Props {
  places: Place[]
  userLocation: LatLng | null
  onOpen: (place: Place) => void
  onShare: (list: PlaceList, places: Place[]) => void
}

export function ListsView({ places, userLocation, onOpen, onShare }: Props) {
  const lists = useLists()
  const covers = useCoverPhotos()
  const [openId, setOpenId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)

  const open = lists?.find((l) => l.id === openId)
  const byId = new Map(places.map((p) => [p.id, p]))

  const create = async () => {
    if (!name.trim()) return
    const l = await createList(name)
    setName('')
    setCreating(false)
    setOpenId(l.id)
  }

  if (open) {
    const listPlaces = open.placeIds.map((id) => byId.get(id)).filter((p): p is Place => !!p)
    return (
      <div className="scroll">
        <div className="row" style={{ marginBottom: 8 }}>
          <button className="icon-btn" style={{ flex: '0 0 auto' }} onClick={() => setOpenId(null)} aria-label="Back">
            <ChevronLeft size={24} />
          </button>
          <input
            className="input"
            value={open.name}
            onChange={(e) => void updateList(open.id, { name: e.target.value })}
            style={{ fontSize: 18, fontWeight: 800, background: 'none', border: 0, padding: '4px 0' }}
          />
          <button className="icon-btn" style={{ flex: '0 0 auto' }} onClick={() => onShare(open, listPlaces)} aria-label="Share list" disabled={!listPlaces.length}>
            <Share2 size={20} />
          </button>
          <button
            className="icon-btn"
            style={{ flex: '0 0 auto', color: 'var(--danger)' }}
            aria-label="Delete list"
            onClick={() => {
              if (window.confirm(`Delete the list "${open.name}"? Places stay saved.`)) {
                void deleteList(open.id)
                setOpenId(null)
              }
            }}
          >
            <Trash2 size={20} />
          </button>
        </div>
        <textarea
          className="textarea"
          placeholder="Description (optional): who it's for, when you went…"
          value={open.description ?? ''}
          onChange={(e) => void updateList(open.id, { description: e.target.value })}
          style={{ marginBottom: 12, minHeight: 44 }}
        />
        {listPlaces.length === 0 && <div className="empty">Open any place and tap “List” to add it here.</div>}
        {listPlaces.map((p) => (
          <PlaceCard key={p.id} place={p} userLocation={userLocation} cover={covers.get(p.id)?.blob} onOpen={onOpen} />
        ))}
      </div>
    )
  }

  return (
    <div className="scroll">
      <div className="row" style={{ marginBottom: 12 }}>
        <div className="section-title" style={{ margin: 0 }}>Lists</div>
        <button className="btn small" style={{ flex: '0 0 auto' }} onClick={() => setCreating(true)}>
          <Plus size={16} /> New list
        </button>
      </div>
      {creating && (
        <div className="row" style={{ marginBottom: 12 }}>
          <input className="input" autoFocus placeholder="e.g. Tokyo 2026, Best coffee, Date nights" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void create()} />
          <button className="btn small primary" style={{ flex: '0 0 auto' }} onClick={() => void create()} disabled={!name.trim()}>
            Create
          </button>
        </div>
      )}
      {lists?.length === 0 && !creating && (
        <div className="empty">
          <ListChecks size={40} />
          <h2>No lists yet</h2>
          <p>Group places into lists like “Lisbon weekend” or “Coffee in Brooklyn” and share the whole thing as one link.</p>
        </div>
      )}
      {lists?.map((l) => (
        <button key={l.id} className="card" onClick={() => setOpenId(l.id)}>
          <div className="card-thumb">
            <ListChecks size={24} />
          </div>
          <div className="card-body">
            <div className="card-title"><span className="name">{l.name}</span></div>
            <div className="card-sub">{l.placeIds.length} place{l.placeIds.length === 1 ? '' : 's'}{l.description ? ` · ${l.description}` : ''}</div>
          </div>
        </button>
      ))}
    </div>
  )
}
