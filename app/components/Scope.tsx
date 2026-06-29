'use client'
import { useEffect, useRef } from 'react'

interface ScopeProps {
  analyser: AnalyserNode | null
  width?: number
  height?: number
  color?: string
  mode?: 'wave' | 'spectrum'
}

export default function Scope({ analyser, width = 200, height = 80, color = '#FF6B2B', mode = 'wave' }: ScopeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw)
      ctx.clearRect(0, 0, width, height)

      // BG
      ctx.fillStyle = '#050505'
      ctx.fillRect(0, 0, width, height)

      // Grid lines
      ctx.strokeStyle = 'rgba(255,255,255,0.04)'
      ctx.lineWidth = 0.5
      for (let i = 1; i < 4; i++) {
        ctx.beginPath()
        ctx.moveTo(0, (height / 4) * i)
        ctx.lineTo(width, (height / 4) * i)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo((width / 4) * i, 0)
        ctx.lineTo((width / 4) * i, height)
        ctx.stroke()
      }

      if (!analyser) {
        // idle waveform
        ctx.beginPath()
        ctx.strokeStyle = color
        ctx.lineWidth = 1.5
        ctx.globalAlpha = 0.3
        ctx.moveTo(0, height / 2)
        ctx.lineTo(width, height / 2)
        ctx.stroke()
        ctx.globalAlpha = 1
        return
      }

      if (mode === 'wave') {
        const bufferLen = analyser.fftSize
        const data = new Float32Array(bufferLen)
        analyser.getFloatTimeDomainData(data)

        ctx.beginPath()
        ctx.strokeStyle = color
        ctx.lineWidth = 1.5
        ctx.shadowColor = color
        ctx.shadowBlur = 4

        const sliceW = width / bufferLen
        let x = 0
        for (let i = 0; i < bufferLen; i++) {
          const y = ((data[i] + 1) / 2) * height
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
          x += sliceW
        }
        ctx.stroke()
        ctx.shadowBlur = 0
      } else {
        const bufferLen = analyser.frequencyBinCount
        const data = new Uint8Array(bufferLen)
        analyser.getByteFrequencyData(data)

        const barW = width / (bufferLen / 4)
        let x = 0
        for (let i = 0; i < bufferLen / 4; i++) {
          const barH = (data[i] / 255) * height
          const hue = (i / (bufferLen / 4)) * 60
          ctx.fillStyle = `hsl(${20 + hue}, 100%, 55%)`
          ctx.fillRect(x, height - barH, barW - 0.5, barH)
          x += barW
        }
      }
    }

    draw()
    return () => cancelAnimationFrame(rafRef.current)
  }, [analyser, width, height, color, mode])

  return (
    <div style={{ position: 'relative', borderRadius: 4, overflow: 'hidden', border: '1px solid #1a1a1a' }}>
      <canvas ref={canvasRef} width={width} height={height} />
      <div className="scope-scanline" />
    </div>
  )
}
