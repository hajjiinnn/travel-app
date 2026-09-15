import { useObjectUrl } from '../hooks'

export function Thumb({ blob, className }: { blob: Blob; className?: string }) {
  const url = useObjectUrl(blob)
  return url ? <img src={url} alt="" className={className} /> : <div className={className} />
}
