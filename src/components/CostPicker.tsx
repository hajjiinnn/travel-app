import type { Cost } from '../db/schema'

const COSTS: Cost[] = [1, 2, 3, 4]

export function CostPicker({ value, onChange }: { value?: Cost; onChange: (v: Cost | undefined) => void }) {
  return (
    <div className="cost-row" role="radiogroup" aria-label="Cost">
      {COSTS.map((c) => (
        <button
          key={c}
          type="button"
          className={value === c ? 'on' : ''}
          onClick={() => onChange(value === c ? undefined : c)}
          role="radio"
          aria-checked={value === c}
        >
          {'$'.repeat(c)}
        </button>
      ))}
    </div>
  )
}
