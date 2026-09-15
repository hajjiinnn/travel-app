import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface SheetProps {
  title?: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  full?: boolean
  headerRight?: ReactNode
}

export function Sheet({ title, onClose, children, footer, full, headerRight }: SheetProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className={`sheet${full ? ' full' : ''}`} role="dialog" aria-modal="true">
        <div className="sheet-handle" />
        <div className="sheet-header">
          <h2>{title}</h2>
          {headerRight}
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={22} />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-footer">{footer}</div>}
      </div>
    </>
  )
}
