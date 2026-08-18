import type { ImgHTMLAttributes } from 'react'
import { useEffect, useState } from 'react'

type SafeImageProps = {
  src?: string
  fallbackSrc?: string
} & Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'>

const defaultFallbackSrc = '/ecafe-icon.png'

export function SafeImage({ src, fallbackSrc = defaultFallbackSrc, alt, onError, ...props }: SafeImageProps) {
  const [currentSrc, setCurrentSrc] = useState(src || fallbackSrc)

  useEffect(() => {
    setCurrentSrc(src || fallbackSrc)
  }, [fallbackSrc, src])

  return (
    <img
      {...props}
      src={currentSrc}
      alt={alt}
      onError={(event) => {
        if (currentSrc !== fallbackSrc) {
          setCurrentSrc(fallbackSrc)
        }

        onError?.(event)
      }}
    />
  )
}
