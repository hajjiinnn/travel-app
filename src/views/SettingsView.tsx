import { useRef, useState } from 'react'
import { Download, Trash2, Upload } from 'lucide-react'
import { clearAllData, setSetting } from '../db/repo'
import { useSetting } from '../hooks'
import { downloadJson, exportBackup, importBackup, isBackup } from '../lib/backup'
import { searchProviderName } from '../lib/search'
import { MAP_STYLES, MAP_STYLE_SETTING, findMapStyle } from '../lib/mapStyles'

export function SettingsView({ placeCount, onToast }: { placeCount: number; onToast: (m: string) => void }) {
  const name = useSetting('displayName') ?? ''
  const mapStyle = findMapStyle(useSetting(MAP_STYLE_SETTING))
  const [busy, setBusy] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const doExport = async () => {
    setBusy(true)
    try {
      const backup = await exportBackup(true)
      downloadJson(`been-there-${new Date().toISOString().slice(0, 10)}.json`, backup)
      onToast('Backup downloaded')
    } finally {
      setBusy(false)
    }
  }

  const doImport = async (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    setBusy(true)
    try {
      const data: unknown = JSON.parse(await file.text())
      if (!isBackup(data)) throw new Error('That file is not a Been There backup.')
      const r = await importBackup(data)
      onToast(`Imported ${r.places} places, ${r.lists} lists, ${r.photos} photos`)
    } catch (e) {
      onToast((e as Error).message)
    } finally {
      setBusy(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const wipe = async () => {
    if (!window.confirm(`Delete all ${placeCount} places, lists, and photos from this device? Export a backup first if you want to keep them.`)) return
    await clearAllData()
    onToast('Everything cleared')
  }

  return (
    <div className="scroll">
      <div className="section-title">You</div>
      <div className="settings-group">
        <div className="settings-row">
          <div className="grow">
            <div style={{ fontWeight: 700 }}>Your name</div>
            <div className="sub">Shown on recs you share, e.g. “Connie recommends…”</div>
          </div>
        </div>
        <div className="settings-row">
          <input className="input" placeholder="Your name" defaultValue={name} onBlur={(e) => void setSetting('displayName', e.target.value.trim())} />
        </div>
      </div>

      <div className="section-title">Map</div>
      <div className="settings-group">
        <div className="settings-row" style={{ display: 'block' }}>
          <div className="chips" style={{ marginBottom: 8 }}>
            {MAP_STYLES.map((s) => (
              <button
                key={s.id}
                className={`chip${mapStyle.id === s.id ? ' active' : ''}`}
                onClick={() => void setSetting(MAP_STYLE_SETTING, s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="sub">{mapStyle.description}</div>
        </div>
      </div>

      <div className="section-title">Data</div>
      <div className="settings-group">
        <button className="settings-row" onClick={() => void doExport()} disabled={busy}>
          <Download size={20} />
          <div className="grow">
            <div style={{ fontWeight: 700 }}>Export backup</div>
            <div className="sub">Everything, photos included, as one file you can keep or move to a new phone.</div>
          </div>
        </button>
        <button className="settings-row" onClick={() => fileInput.current?.click()} disabled={busy}>
          <Upload size={20} />
          <div className="grow">
            <div style={{ fontWeight: 700 }}>Import backup</div>
            <div className="sub">Merges into what is already here.</div>
          </div>
        </button>
        <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={(e) => void doImport(e.target.files)} />
        <button className="settings-row" onClick={() => void wipe()} style={{ color: 'var(--danger)' }}>
          <Trash2 size={20} />
          <div className="grow">
            <div style={{ fontWeight: 700 }}>Clear all data</div>
          </div>
        </button>
      </div>

      <div className="section-title">About</div>
      <div className="settings-group">
        <div className="settings-row">
          <div className="grow">
            <div style={{ fontWeight: 700 }}>Storage</div>
            <div className="sub">Everything lives on this device only. Nothing is uploaded anywhere. Sharing a rec puts the place and your notes inside the link itself.</div>
          </div>
        </div>
        <div className="settings-row">
          <div className="grow">
            <div style={{ fontWeight: 700 }}>Place search</div>
            <div className="sub">Using {searchProviderName()}. Set VITE_GOOGLE_MAPS_API_KEY at build time to switch to Google Places.</div>
          </div>
        </div>
      </div>
    </div>
  )
}
