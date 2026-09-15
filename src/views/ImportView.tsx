import { useState } from 'react'
import { Check } from 'lucide-react'
import { costLabel, type Place, type PlaceStatus } from '../db/schema'
import type { SharedPlace } from '../lib/share'
import { createList, savePlace } from '../db/repo'
import type { SharePayload } from '../lib/share'
import { Sheet } from '../components/Sheet'
import { CategoryIcon } from '../components/CategoryIcon'
import { distanceKm } from '../lib/geo'

interface Props {
  payload: SharePayload
  existingPlaces: Place[]
  onDone: (count: number) => void
  onClose: () => void
}

function alreadyHave(existing: Place[], s: SharedPlace): Place | undefined {
  return existing.find(
    (p) => (s.s && p.source?.provider === s.s.p && p.source.id === s.s.i) || (p.name.toLowerCase() === s.n.toLowerCase() && distanceKm(p, { lat: s.la, lng: s.ln }) < 0.1),
  )
}

export function ImportView({ payload, existingPlaces, onDone, onClose }: Props) {
  const [selected, setSelected] = useState<Set<number>>(() => new Set(payload.places.map((_, i) => i).filter((i) => !alreadyHave(existingPlaces, payload.places[i]))))
  const [status, setStatus] = useState<PlaceStatus>('want')
  const [makeList, setMakeList] = useState(payload.kind === 'list')
  const [busy, setBusy] = useState(false)

  const heading = payload.title ?? (payload.places.length === 1 ? payload.places[0].n : `${payload.places.length} places`)
  const toggle = (i: number) => setSelected((s) => {
    const n = new Set(s)
    if (n.has(i)) n.delete(i)
    else n.add(i)
    return n
  })

  const save = async () => {
    setBusy(true)
    try {
      const ids: string[] = []
      for (const i of [...selected].sort()) {
        const s = payload.places[i]
        const p = await savePlace({
          name: s.n,
          address: s.a,
          city: s.c,
          country: s.k,
          lat: s.la,
          lng: s.ln,
          category: s.g,
          status,
          rating: status === 'been' ? s.r : undefined,
          cost: s.$,
          tags: s.t,
          notes: s.o,
          orderTips: s.y,
          avoidTips: s.x,
          recommendedBy: payload.from,
          source: s.s ? { provider: s.s.p, id: s.s.i } : { provider: 'manual' },
        })
        ids.push(p.id)
      }
      if (makeList && ids.length) await createList(payload.title ?? `From ${payload.from ?? 'a friend'}`, undefined, ids)
      onDone(ids.length)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      full
      title={payload.from ? `${payload.from} sent you ${heading}` : heading}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Not now</button>
          <button className="btn primary" style={{ flex: 1 }} onClick={() => void save()} disabled={busy || selected.size === 0}>
            <Check size={18} /> Save {selected.size} to my places
          </button>
        </>
      }
    >
      <div className="field">
        <label>Save as</label>
        <div className="toggle">
          <button type="button" className={status === 'want' ? 'on want' : ''} onClick={() => setStatus('want')}>Want to go</button>
          <button type="button" className={status === 'been' ? 'on been' : ''} onClick={() => setStatus('been')}>Been there</button>
        </div>
      </div>
      {payload.places.length > 1 && (
        <div className="field">
          <button className="list-check" onClick={() => setMakeList((v) => !v)}>
            <div className={`box${makeList ? ' on' : ''}`}>{makeList && <Check size={16} />}</div>
            <div>Also create a list “{payload.title ?? `From ${payload.from ?? 'a friend'}`}”</div>
          </button>
        </div>
      )}
      {payload.places.map((s, i) => {
        const have = alreadyHave(existingPlaces, s)
        return (
          <button key={i} className="list-check" onClick={() => toggle(i)}>
            <div className={`box${selected.has(i) ? ' on' : ''}`}>{selected.has(i) && <Check size={16} />}</div>
            <div className="result-icon"><CategoryIcon category={s.g} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>
                {s.n}
                {s.r ? <span className="stars" style={{ marginLeft: 6 }}>{'★'.repeat(s.r)}</span> : null}
                {s.$ ? <span className="cost" style={{ marginLeft: 6 }}>{costLabel(s.$)}</span> : null}
                {have && <span className="chip small" style={{ marginLeft: 6 }}>Already saved</span>}
              </div>
              <div className="hint">{s.a ?? s.c ?? ''}</div>
              {s.y && <div style={{ fontSize: 14 }}>Order: {s.y}</div>}
              {s.x && <div style={{ fontSize: 14 }}>Skip: {s.x}</div>}
              {s.o && <div className="hint">{s.o}</div>}
              {s.t?.length ? <div className="chips" style={{ marginTop: 4 }}>{s.t.map((t) => <span key={t} className="chip small">#{t}</span>)}</div> : null}
            </div>
          </button>
        )
      })}
    </Sheet>
  )
}
