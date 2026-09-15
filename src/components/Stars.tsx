import { Star } from 'lucide-react'

export function StarPicker({ value, onChange }: { value?: number; onChange: (v: number | undefined) => void }) {
  return (
    <div className="star-row" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={value && n <= value ? 'on' : ''}
          onClick={() => onChange(value === n ? undefined : n)}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          role="radio"
          aria-checked={value === n}
        >
          <Star size={34} fill={value && n <= value ? 'currentColor' : 'none'} />
        </button>
      ))}
    </div>
  )
}

export function Stars({ value }: { value?: number }) {
  if (!value) return null
  return (
    <span className="stars" aria-label={`${value} out of 5`}>
      {'★'.repeat(value)}
      <span className="stars-muted">{'★'.repeat(5 - value)}</span>
    </span>
  )
}
