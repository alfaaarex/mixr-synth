'use client'
import { useRef, useEffect, useCallback, useState } from 'react'

interface KnobProps {
  value: number // 0–1
  onChange: (v: number) => void
  label: string
  color?: string
  size?: number
  valueLabel?: string
}

export default function Knob({ value, onChange, label, color = '#FF6B2B', size = 48, valueLabel }: KnobProps) {
  const dragRef = useRef<{ startY: number; startVal: number } | null>(null)
  const [active, setActive] = useState(false)

  // Map value 0–1 to angle: -145° to +145°
  const angle = -145 + value * 290
  const rad = (angle * Math.PI) / 180
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 4
  const indicatorLen = r - 3
  const ix = cx + Math.sin(rad) * indicatorLen
  const iy = cy - Math.cos(rad) * indicatorLen

  // Arc path for value fill
  const startAngle = -145 * (Math.PI / 180)
  const endAngle = rad
  const arcR = r - 1
  const startX = cx + Math.sin(startAngle) * arcR
  const startY = cy - Math.cos(startAngle) * arcR
  const endX = cx + Math.sin(endAngle) * arcR
  const endY = cy - Math.cos(endAngle) * arcR
  const largeArc = value > 0.5 ? 1 : 0

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragRef.current = { startY: e.clientY, startVal: value }
    setActive(true)

    const onMove = (me: MouseEvent) => {
      if (!dragRef.current) return
      const delta = (dragRef.current.startY - me.clientY) / 200
      const newVal = Math.max(0, Math.min(1, dragRef.current.startVal + delta))
      onChange(newVal)
    }
    const onUp = () => {
      dragRef.current = null
      setActive(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [value, onChange])

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = -e.deltaY / 1000
    onChange(Math.max(0, Math.min(1, value + delta)))
  }, [value, onChange])

  const displayVal = valueLabel ?? Math.round(value * 100).toString()

  return (
    <div
      className={`knob-container ${active ? 'active' : ''}`}
      onMouseDown={onMouseDown}
      onWheel={onWheel}
      style={{ width: size, userSelect: 'none' }}
    >
      <svg
        className="knob-svg"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ overflow: 'visible' }}
      >
        <defs>
          <radialGradient id={`kg-${label}`} cx="40%" cy="30%" r="60%">
            <stop offset="0%" stopColor="#3a3a3a" />
            <stop offset="100%" stopColor="#111111" />
          </radialGradient>
          <filter id={`ks-${label}`}>
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.8" />
          </filter>
        </defs>

        {/* Track ring */}
        <circle
          cx={cx} cy={cy} r={arcR}
          fill="none"
          stroke="#2a2a2a"
          strokeWidth="2.5"
          strokeDasharray="4 1"
        />

        {/* Value arc */}
        {value > 0 && (
          <path
            d={`M ${startX} ${startY} A ${arcR} ${arcR} 0 ${largeArc} 1 ${endX} ${endY}`}
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.9"
          />
        )}

        {/* Knob body */}
        <circle
          cx={cx} cy={cy} r={r - 2}
          fill={`url(#kg-${label})`}
          filter={`url(#ks-${label})`}
          stroke="#1a1a1a"
          strokeWidth="1"
        />

        {/* Highlight */}
        <ellipse
          cx={cx - r * 0.2} cy={cy - r * 0.3}
          rx={r * 0.35} ry={r * 0.2}
          fill="rgba(255,255,255,0.06)"
        />

        {/* Indicator line */}
        <line
          x1={cx} y1={cy}
          x2={ix} y2={iy}
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx={ix} cy={iy} r="1.5" fill={color} />
      </svg>

      <span className="section-label" style={{ fontSize: 7, color: '#6a6a6a', textAlign: 'center', lineHeight: 1.2 }}>
        {label}
      </span>
      <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 8, color: '#5a5a5a', lineHeight: 1 }}>
        {displayVal}
      </span>
    </div>
  )
}
