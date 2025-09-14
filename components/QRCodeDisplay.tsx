'use client'

import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'

interface QRCodeDisplayProps {
  value: string
  size?: number
}

export default function QRCodeDisplay({ value, size = 256 }: QRCodeDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (canvasRef.current && value) {
      QRCode.toCanvas(canvasRef.current, value, {
        width: size,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      }, (error) => {
        if (error) {
          console.error('QR code generation error:', error)
        }
      })
    }
  }, [value, size])

  return (
    <div className="flex justify-center p-4">
      <canvas
        ref={canvasRef}
        className="border border-gray-200 rounded-lg shadow-sm"
      />
    </div>
  )
}