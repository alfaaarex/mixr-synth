'use client'
import { useRef, useCallback, useState } from 'react'

interface FaderProps {
  value: number
  onChange: (v: number) => void
  label: string
  color?: string
  height?: number
}

export default function Fader({ value, onChange, label, color = '#FF6B2B', height = 80 }: FaderProps) {
  const dragRef = useRef<{ startY: number; startVal: number } | null>(null)
  const [active, setActive] = useState(false)

  const thumbH = 16
  const trackH = height
  const thumbY = (1 - value) * (trackH - thumbH)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragRef.current = { startY: e.clientY, startVal: value }
    setActive(true)
    const onMove = (me: MouseEvent) => {
      if (!dragRef.current) return
      const delta = (dragRef.current.startY - me.clientY) / (trackH - thumbH)
      onChange(Math.max(0, Math.min(1, dragRef.current.startVal + delta)))
    }
    const onUp = () => {
      dragRef.current = null
      setActive(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [value, onChange, trackH])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div
        className="fader-track"
        style={{ width: 16, height: trackH, position: 'relative', cursor: 'ns-resize' }}
        onMouseDown={onMouseDown}
      >
        {/* Fill */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: `${value * 100}%`,
          background: `linear-gradient(to top, ${color}44, ${color}22)`,
          borderRadius: '1px 1px 0 0',
        }} />
        {/* Thumb */}
        <div
          className="fader-thumb"
          style={{
            width: 22,
            height: thumbH,
            top: thumbY,
            boxShadow: active ? `0 0 8px ${color}44` : undefined,
          }}
        />
      </div>
      <span className="section-label" style={{ fontSize: 7 }}>{label}</span>
      <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 8, color: '#5a5a5a' }}>
        {Math.round(value * 100)}
      </span>
    </div>
  )
}
