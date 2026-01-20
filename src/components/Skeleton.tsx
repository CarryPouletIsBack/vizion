import './Skeleton.css'

type SkeletonProps = {
  width?: string | number
  height?: string | number
  borderRadius?: string | number
  className?: string
}

export default function Skeleton({ width, height, borderRadius = '4px', className = '' }: SkeletonProps) {
  const style: React.CSSProperties = {
    width: width || '100%',
    height: height || '1em',
    borderRadius,
  }

  return <div className={`skeleton ${className}`} style={style} aria-hidden="true" />
}
