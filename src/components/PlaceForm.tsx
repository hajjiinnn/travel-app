import { useEffect, useRef, useState } from 'react'
import { Camera, Check, X } from 'lucide-react'
import { CATEGORIES, categoryLabel, nowIso, type Category, type Cost, type Place, type PlaceStatus } from '../db/schema'
import { addPhoto, deletePhoto, savePlace, type PlaceInput } from '../db/repo'
import { useKnownTags, usePhotos, useObjectUrls } from '../hooks'
import { resizeImage } from '../lib/photos'
import { StarPicker } from './Stars'
import { CostPicker } from './CostPicker'
import { TagPicker } from './TagPicker'
import { Sheet } from './Sheet'

export type PlaceDraft = Omit<PlaceInput, 'tags' | 'status'> & { status?: PlaceStatus; tags?: string[] }

interface Props {
  draft: PlaceDraft
  existing?: Place
  onSaved: (place: Place) => void
  onClose: () => void
}

interface PendingPhoto {
  blob: Blob
  width: number
  height: number
}

export function PlaceForm({ draft, existing, onSaved, onClose }: Props) {
  const knownTags = useKnownTags()
  const storedPhotos = usePhotos(existing?.id)
  const storedUrls = useObjectUrls(storedPhotos.map((p) => p.blob))

  const [name, setName] = useState(draft.name)
  const [status, setStatus] = useState<PlaceStatus>(draft.status ?? 'been')
  const [rating, setRating] = useState<number | undefined>(draft.rating)
  const [cost, setCost] = useState<Cost | undefined>(draft.cost)
  const [category, setCategory] = useState<Category>(draft.category ?? 'other')
  const [tags, setTags] = useState<string[]>(draft.tags ?? [])
  const [notes, setNotes] = useState(draft.notes ?? '')
  const [orderTips, setOrderTips] = useState(draft.orderTips ?? '')
  const [avoidTips, setAvoidTips] = useState(draft.avoidTips ?? '')
  const [wouldReturn, setWouldReturn] = useState<boolean | undefined>(draft.wouldReturn)
  const [pending, setPending] = useState<PendingPhoto[]>([])
  const [removed, setRemoved] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pendingUrls = useObjectUrls(pending.map((p) => p.blob))
  const fileInput = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!draft.name) nameRef.current?.focus()
  }, [draft.name])

  const onFiles = async (files: FileList | null) => {
    if (!files) return
    try {
      const resized = await Promise.all([...files].map((f) => resizeImage(f)))
      setPending((p) => [...p, ...resized])
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const save = async () => {
    if (!name.trim()) {
      setError('Give the place a name.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const visits = existing?.visits ?? draft.visits ?? []
      const becameBeen = status === 'been' && (!existing || existing.status !== 'been')
      const place = await savePlace({
        ...draft,
        id: existing?.id ?? draft.id,
        name: name.trim(),
        status,
        rating: status === 'been' ? rating : undefined,
        cost,
        category,
        tags,
        notes: notes.trim() || undefined,
        orderTips: orderTips.trim() || undefined,
        avoidTips: avoidTips.trim() || undefined,
        wouldReturn: status === 'been' ? wouldReturn : undefined,
        visits: becameBeen ? [...visits, nowIso()] : visits,
      })
      await Promise.all([
        ...pending.map((p) => addPhoto(place.id, p.blob, p.width, p.height)),
        ...removed.map((id) => deletePhoto(id)),
      ])
      onSaved(place)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const visiblePhotos = storedPhotos.map((p, i) => ({ id: p.id, url: storedUrls[i] })).filter((p) => !removed.includes(p.id))

  return (
    <Sheet
      full
      title={existing ? 'Edit place' : status === 'been' ? 'Add a place' : 'Save for later'}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" style={{ flex: 1 }} onClick={save} disabled={saving}>
            <Check size={18} /> {saving ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <div className="field">
        <input ref={nameRef} className="input" placeholder="Place name" value={name} onChange={(e) => setName(e.target.value)} style={{ fontSize: 18, fontWeight: 700 }} />
        {draft.address && <div className="hint" style={{ marginTop: 4 }}>{draft.address}</div>}
      </div>

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

      {status === 'been' && (
        <div className="field">
          <label>Rating</label>
          <div className="row">
            <StarPicker value={rating} onChange={setRating} />
            <div style={{ flex: '0 0 auto' }} className="chips">
              <button type="button" className={`chip${wouldReturn === true ? ' active' : ''}`} onClick={() => setWouldReturn(wouldReturn === true ? undefined : true)}>
                Would go back
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="field">
        <label>Cost</label>
        <CostPicker value={cost} onChange={setCost} />
      </div>

      {status === 'been' && (
        <>
          <div className="field">
            <label>Order this / do this</label>
            <input className="input" placeholder="e.g. the al pastor tacos, sit on the patio" value={orderTips} onChange={(e) => setOrderTips(e.target.value)} />
          </div>
          <div className="field">
            <label>Skip this</label>
            <input className="input" placeholder="e.g. the queso, weekend brunch line" value={avoidTips} onChange={(e) => setAvoidTips(e.target.value)} />
          </div>
        </>
      )}

      <div className="field">
        <label>{status === 'been' ? 'Notes' : 'Why go / who told you'}</label>
        <textarea className="textarea" placeholder={status === 'been' ? 'Anything you want to remember' : 'e.g. Sam says get the omakase'} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <div className="field">
        <label>Tags</label>
        <TagPicker value={tags} suggestions={knownTags} onChange={setTags} />
      </div>

      <div className="field">
        <label>Photos</label>
        <div className="photo-strip">
          {visiblePhotos.map((p) => (
            <div className="photo-thumb" key={p.id}>
              <img src={p.url} alt="" />
              <button type="button" className="remove" onClick={() => setRemoved((r) => [...r, p.id])} aria-label="Remove photo">
                <X size={14} />
              </button>
            </div>
          ))}
          {pending.map((_, i) => (
            <div className="photo-thumb" key={`p${i}`}>
              <img src={pendingUrls[i]} alt="" />
              <button type="button" className="remove" onClick={() => setPending((p) => p.filter((_, j) => j !== i))} aria-label="Remove photo">
                <X size={14} />
              </button>
            </div>
          ))}
          <button type="button" className="photo-add" onClick={() => fileInput.current?.click()}>
            <Camera size={22} /> Add
          </button>
          <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(e) => void onFiles(e.target.files)} />
        </div>
      </div>

      <div className="field">
        <label>Type</label>
        <div className="chips">
          {CATEGORIES.map((c) => (
            <button key={c} type="button" className={`chip${category === c ? ' active' : ''}`} onClick={() => setCategory(c)}>
              {categoryLabel(c)}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="error">{error}</div>}
    </Sheet>
  )
}
