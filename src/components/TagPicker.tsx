import { useState } from 'react'
import { Plus } from 'lucide-react'

interface Props {
  value: string[]
  suggestions: string[]
  onChange: (tags: string[]) => void
}

function normalize(t: string) {
  return t.trim().replace(/^#/, '').toLowerCase()
}

export function TagPicker({ value, suggestions, onChange }: Props) {
  const [draft, setDraft] = useState('')

  const toggle = (tag: string) => {
    onChange(value.includes(tag) ? value.filter((t) => t !== tag) : [...value, tag])
  }

  const commit = () => {
    const parts = draft.split(/[,\s]+/).map(normalize).filter(Boolean)
    if (parts.length) onChange([...new Set([...value, ...parts])])
    setDraft('')
  }

  const shown = [...new Set([...value, ...suggestions])].slice(0, 30)

  return (
    <div>
      <div className="chips" style={{ marginBottom: 8 }}>
        {shown.map((t) => (
          <button key={t} type="button" className={`chip${value.includes(t) ? ' active' : ''}`} onClick={() => toggle(t)}>
            #{t}
          </button>
        ))}
      </div>
      <div className="row">
        <input
          className="input"
          placeholder="New tag (e.g. date-night, brunch)"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault()
              commit()
            }
          }}
          onBlur={commit}
          autoCapitalize="none"
        />
        <button type="button" className="btn small" style={{ flex: '0 0 auto' }} onClick={commit} aria-label="Add tag">
          <Plus size={18} />
        </button>
      </div>
    </div>
  )
}
