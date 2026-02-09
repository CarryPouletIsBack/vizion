import './Skeleton.css'

type SkeletonProps = {
  width?: string | number
  height?: string | number
  borderRadius?: string | number
  className?: string
  /** Affichage block (prend toute la largeur). */
  block?: boolean
  style?: React.CSSProperties
}

export default function Skeleton({ width, height, borderRadius = '4px', className = '', block, style: styleProp }: SkeletonProps) {
  const style: React.CSSProperties = {
    width: width || '100%',
    height: height || '1em',
    borderRadius,
    ...styleProp,
  }

  return (
    <div
      className={`skeleton ${block ? 'skeleton--block' : ''} ${className}`.trim()}
      style={style}
      aria-hidden="true"
    />
  )
}

/** Plusieurs lignes skeleton (texte, listes). */
type SkeletonLinesProps = {
  lines?: number
  className?: string
  /** Largeur de la dernière ligne (souvent plus courte). */
  lastLineWidth?: string
}

export function SkeletonLines({ lines = 3, className = '', lastLineWidth = '60%' }: SkeletonLinesProps) {
  return (
    <div className={`skeleton-lines ${className}`.trim()} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={14}
          className="skeleton-lines__line"
          block
          style={i === lines - 1 && lines > 1 ? { width: lastLineWidth } : undefined}
        />
      ))}
    </div>
  )
}
