'use client'
import { useCallback } from 'react'

interface PianoProps {
  onNoteOn: (freq: number, note: string) => void
  onNoteOff: (freq: number, note: string) => void
  activeNotes: Set<string>
  octave?: number
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

function noteToFreq(note: string, octave: number): number {
  const idx = NOTE_NAMES.indexOf(note)
  const semitones = (octave - 4) * 12 + idx - 9
  return 440 * Math.pow(2, semitones / 12)
}

export default function Piano({ onNoteOn, onNoteOff, activeNotes, octave = 4 }: PianoProps) {
  const whites = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
  const blacks: { note: string; pos: number }[] = [
    { note: 'C#', pos: 0 },
    { note: 'D#', pos: 1 },
    { note: 'F#', pos: 3 },
    { note: 'G#', pos: 4 },
    { note: 'A#', pos: 5 },
  ]

  const keyW = 28
  const keyH = 100
  const blackW = 17
  const blackH = 62
  const totalW = whites.length * keyW

  return (
    <div style={{ position: 'relative', width: totalW, height: keyH, flexShrink: 0 }}>
      {/* White keys */}
      {whites.map((note, i) => {
        const fullNote = `${note}${octave}`
        const pressed = activeNotes.has(fullNote)
        return (
          <div
            key={note}
            className={`piano-key-white ${pressed ? 'pressed' : ''}`}
            style={{
              position: 'absolute',
              left: i * keyW,
              top: 0,
              width: keyW - 1,
              height: keyH,
            }}
            onMouseDown={() => onNoteOn(noteToFreq(note, octave), fullNote)}
            onMouseUp={() => onNoteOff(noteToFreq(note, octave), fullNote)}
            onMouseLeave={() => onNoteOff(noteToFreq(note, octave), fullNote)}
          >
            <span style={{
              position: 'absolute',
              bottom: 6,
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: 7,
              color: '#888',
              fontFamily: "'JetBrains Mono'",
              fontWeight: 500,
            }}>{note}</span>
          </div>
        )
      })}

      {/* Black keys */}
      {blacks.map(({ note, pos }) => {
        const fullNote = `${note}${octave}`
        const pressed = activeNotes.has(fullNote)
        return (
          <div
            key={note}
            className={`piano-key-black ${pressed ? 'pressed' : ''}`}
            style={{
              position: 'absolute',
              left: pos * keyW + keyW - blackW / 2,
              top: 0,
              width: blackW,
              height: blackH,
            }}
            onMouseDown={(e) => { e.stopPropagation(); onNoteOn(noteToFreq(note, octave), fullNote) }}
            onMouseUp={() => onNoteOff(noteToFreq(note, octave), fullNote)}
            onMouseLeave={() => onNoteOff(noteToFreq(note, octave), fullNote)}
          />
        )
      })}
    </div>
  )
}
