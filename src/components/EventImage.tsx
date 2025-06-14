'use client'

import { useState } from 'react'

interface EventImageProps {
  src?: string | null
  alt: string
  className?: string
  width?: number
  height?: number
}

export default function EventImage({ src, alt, className = '', width = 128, height = 80 }: EventImageProps) {
  const [error, setError] = useState(false)
  const fallback = '/no-image-placeholder.png' // You can put this image in public/
  const showFallback = error || !src

  return (
    <div className={`relative bg-gray-100 flex items-center justify-center border border-gray-200 rounded-lg overflow-hidden ${className}`} style={{ width, height }}>
      <img
        src={showFallback ? fallback : src!}
      alt={alt}
        width={width}
        height={height}
        className="object-cover w-full h-full"
        onError={() => setError(true)}
        style={{ display: 'block' }}
      />
      {showFallback && (
        <span className="absolute inset-0 flex items-center justify-center text-xs text-gray-400 bg-white/70">No Image</span>
      )}
    </div>
  )
}