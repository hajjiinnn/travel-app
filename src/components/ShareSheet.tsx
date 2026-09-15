import { useMemo, useState } from 'react'
import { Copy, Link, MessageSquareText, Share2 } from 'lucide-react'
import type { Place } from '../db/schema'
import { buildPayload, buildShareUrl, formatListText, formatPlaceText } from '../lib/share'
import { Sheet } from './Sheet'

interface Props {
  places: Place[]
  title?: string
  from?: string
  kind: 'rec' | 'list'
  onClose: () => void
  onToast: (msg: string) => void
}

export function ShareSheet({ places, title, from, kind, onClose, onToast }: Props) {
  const [copiedText, setCopiedText] = useState(false)
  const heading = title ?? (places.length === 1 ? places[0].name : `${places.length} places`)
  const url = useMemo(() => buildShareUrl(buildPayload(places, { kind, title, from })), [places, kind, title, from])
  const text = useMemo(() => (places.length === 1 && !title ? formatPlaceText(places[0]) : formatListText(heading, places)), [places, heading, title])
  const canShare = typeof navigator !== 'undefined' && !!navigator.share

  const copy = async (value: string, what: string) => {
    try {
      await navigator.clipboard.writeText(value)
      onToast(`${what} copied`)
    } catch {
      onToast('Could not copy. Long-press the text below instead.')
      setCopiedText(true)
    }
  }

  const nativeShare = async (withLink: boolean) => {
    try {
      await navigator.share(withLink ? { title: heading, text: `${from ? `${from} recommends: ` : ''}${heading}`, url } : { title: heading, text })
    } catch {
      /* user cancelled */
    }
  }

  return (
    <Sheet title={`Share ${heading}`} onClose={onClose}>
      <div className="hint" style={{ marginBottom: 12 }}>
        The link opens this app with the {kind === 'list' ? 'list' : 'place'} and your notes attached, so they can save it with one tap. Photos are not included.
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {canShare && (
          <button className="btn primary" onClick={() => void nativeShare(true)}>
            <Share2 size={18} /> Share link
          </button>
        )}
        <button className="btn" onClick={() => void copy(url, 'Link')}>
          <Link size={18} /> Copy link
        </button>
        {canShare && (
          <button className="btn" onClick={() => void nativeShare(false)}>
            <MessageSquareText size={18} /> Share as text
          </button>
        )}
        <button className="btn" onClick={() => void copy(text, 'Text')}>
          <Copy size={18} /> Copy as text
        </button>
      </div>
      <div className="section-title">Preview</div>
      <div className="pre" style={copiedText ? { userSelect: 'all' } : undefined}>
        {text}
      </div>
    </Sheet>
  )
}
