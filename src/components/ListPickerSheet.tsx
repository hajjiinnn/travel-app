import { useState } from 'react'
import { Check, Plus } from 'lucide-react'
import type { Place } from '../db/schema'
import { createList, togglePlaceInList } from '../db/repo'
import { useLists } from '../hooks'
import { Sheet } from './Sheet'

export function ListPickerSheet({ place, onClose }: { place: Place; onClose: () => void }) {
  const lists = useLists() ?? []
  const [name, setName] = useState('')

  const create = async () => {
    if (!name.trim()) return
    await createList(name, undefined, [place.id])
    setName('')
  }

  return (
    <Sheet title="Add to list" onClose={onClose} footer={<button className="btn primary block" onClick={onClose}>Done</button>}>
      {lists.map((l) => {
        const on = l.placeIds.includes(place.id)
        return (
          <button key={l.id} className="list-check" onClick={() => void togglePlaceInList(l.id, place.id)}>
            <div className={`box${on ? ' on' : ''}`}>{on && <Check size={16} />}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{l.name}</div>
              <div className="hint">{l.placeIds.length} places</div>
            </div>
          </button>
        )
      })}
      <div className="row" style={{ marginTop: 12 }}>
        <input className="input" placeholder="New list, e.g. Tokyo 2026" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void create()} />
        <button className="btn small" style={{ flex: '0 0 auto' }} onClick={() => void create()} disabled={!name.trim()}>
          <Plus size={18} /> Create
        </button>
      </div>
    </Sheet>
  )
}
