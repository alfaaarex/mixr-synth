'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import Knob from './components/Knob'
import Fader from './components/Fader'
import Scope from './components/Scope'
import Piano from './components/Piano'
import PresetManager from './components/PresetManager'
import { SynthPatch, defaultPatch, WaveType, FilterType } from './types'
import { useAudioEngine } from './useAudioEngine'

// ─── Panel Section wrapper ───────────────────────────────────────────────────
function Panel({ title, children, accent = false, style = {} }: {
  title: string
  children: React.ReactNode
  accent?: boolean
  style?: React.CSSProperties
}) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: `1px solid ${accent ? 'var(--orange)' : 'var(--border)'}`,
      borderRadius: 6,
      padding: '10px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      ...style,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {accent && <div style={{ width: 3, height: 10, background: 'var(--orange)', borderRadius: 1 }} />}
        <span className="section-label">{title}</span>
      </div>
      {children}
    </div>
  )
}

// ─── Wave selector ───────────────────────────────────────────────────────────
function WaveSelector({ value, onChange }: { value: WaveType, onChange: (w: WaveType) => void }) {
  const waves: { type: WaveType; icon: string }[] = [
    { type: 'sine', icon: '∿' },
    { type: 'square', icon: '⊓' },
    { type: 'sawtooth', icon: '⩗' },
    { type: 'triangle', icon: '⋀' },
  ]
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {waves.map(w => (
        <button
          key={w.type}
          className={`toggle-btn ${value === w.type ? 'active' : ''}`}
          onClick={() => onChange(w.type)}
          style={{ fontSize: 12, padding: '3px 6px', fontFamily: 'monospace' }}
        >
          {w.icon}
        </button>
      ))}
    </div>
  )
}

// ─── Sequencer / Arpeggiator ─────────────────────────────────────────────────
const SEQ_NOTES = ['C5','B4','A4','G4','F4','E4','D4','C4']
const SEQ_FREQS: Record<string, number> = {
  'C5': 523.25, 'B4': 493.88, 'A4': 440, 'G4': 392,
  'F4': 349.23, 'E4': 329.63, 'D4': 293.66, 'C4': 261.63,
}

function Sequencer({ onStep, playing, setPlaying }: { onStep: (freq: number | null) => void, playing: boolean, setPlaying: (p: boolean) => void }) {
  const [steps, setSteps] = useState<(string | null)[]>(Array(16).fill(null))
  const [currentStep, setCurrentStep] = useState(-1)
  const [bpm, setBpm] = useState(0.5) // 0–1 mapped to 60–180
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const actualBpm = 60 + bpm * 120

  const toggleStep = (col: number, row: number) => {
    setSteps(prev => {
      const next = [...prev]
      next[col] = next[col] === SEQ_NOTES[row] ? null : SEQ_NOTES[row]
      return next
    })
  }

  useEffect(() => {
    if (!playing) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      setCurrentStep(-1)
      return
    }
    const ms = (60 / actualBpm) * 1000 / 4
    let step = 0
    intervalRef.current = setInterval(() => {
      setCurrentStep(step)
      onStep(steps[step] ? SEQ_FREQS[steps[step]!] : null)
      step = (step + 1) % 16
    }, ms)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [playing, actualBpm, steps, onStep])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <button
          className={`toggle-btn ${playing ? 'active' : ''}`}
          onClick={() => setPlaying(!playing)}
          style={{ padding: '5px 12px' }}
        >
          {playing ? '■ STOP' : '▶ PLAY'}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="section-label">BPM</span>
          <Knob value={bpm} onChange={setBpm} label="" size={28}
            valueLabel={Math.round(actualBpm).toString()} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(16, 1fr)', gap: 3 }}>
        {SEQ_NOTES.map((note, row) =>
          Array(16).fill(0).map((_, col) => (
            <div
              key={`${row}-${col}`}
              className={`seq-step ${steps[col] === note ? 'active' : ''} ${col === currentStep ? 'playing' : ''}`}
              style={{
                height: 14,
                background: steps[col] === note ? undefined : col === currentStep ? 'var(--surface3)' : 'var(--surface2)',
                opacity: steps[col] === note ? 1 : 0.6,
              }}
              onClick={() => toggleStep(col, row)}
            />
          ))
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: 2, paddingRight: 2 }}>
        {Array(16).fill(0).map((_, i) => (
          <span key={i} style={{ fontFamily: "'JetBrains Mono'", fontSize: 7, color: i === currentStep ? 'var(--yellow)' : 'var(--border-light)', width: 'calc(100% / 16)', textAlign: 'center' }}>
            {i % 4 === 0 ? (i / 4 + 1).toString() : '·'}
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── VU Meter ────────────────────────────────────────────────────────────────
function VUMeter({ analyser }: { analyser: AnalyserNode | null | undefined }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = 16, H = 80

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw)
      ctx.clearRect(0, 0, W * 2 + 4, H)

      let level = 0
      if (analyser) {
        const data = new Uint8Array(analyser.frequencyBinCount)
        analyser.getByteFrequencyData(data)
        level = data.reduce((a, b) => a + b, 0) / data.length / 255
      }

      const segments = 20
      const segH = H / segments

      for (let s = 0; s < segments; s++) {
        const filled = (segments - s) / segments <= level
        let col = filled ? '#4AE68A' : '#1a2a1a'
        if (s < 4 && filled) col = '#FF4A6B'
        else if (s < 8 && filled) col = '#F5E642'

        // Left channel
        ctx.fillStyle = col
        ctx.fillRect(0, s * segH + 1, W, segH - 2)

        // Right channel
        const rLevel = level * (0.85 + Math.random() * 0.15)
        const rFilled = (segments - s) / segments <= rLevel
        ctx.fillStyle = rFilled ? col : '#1a2a1a'
        ctx.fillRect(W + 4, s * segH + 1, W, segH - 2)
      }
    }
    draw()
    return () => cancelAnimationFrame(rafRef.current)
  }, [analyser])

  return <canvas ref={canvasRef} width={36} height={80} />
}

// ─── ADSR Display ────────────────────────────────────────────────────────────
function ADSRDisplay({ a, d, s, r }: { a: number, d: number, s: number, r: number }) {
  const W = 100, H = 40
  const pad = 4

  const tA = a * 0.25 * W
  const tD = tA + d * 0.2 * W
  const tS = tD + 0.3 * W
  const tR = tS + r * 0.25 * W

  const yTop = pad
  const yBottom = H - pad
  const ySustain = yBottom - s * (yBottom - yTop)

  const path = [
    `M ${pad} ${yBottom}`,
    `L ${pad + tA} ${yTop}`,
    `L ${pad + tD} ${ySustain}`,
    `L ${pad + tS} ${ySustain}`,
    `L ${pad + tR} ${yBottom}`,
  ].join(' ')

  return (
    <svg width={W} height={H} style={{ display: 'block' }}>
      <rect width={W} height={H} fill="#050505" rx={3} />
      {/* Grid */}
      <line x1={pad + tA} y1={pad} x2={pad + tA} y2={H - pad} stroke="#1e1e1e" strokeWidth="0.5" />
      <line x1={pad + tD} y1={pad} x2={pad + tD} y2={H - pad} stroke="#1e1e1e" strokeWidth="0.5" />
      <line x1={pad + tS} y1={pad} x2={pad + tS} y2={H - pad} stroke="#1e1e1e" strokeWidth="0.5" />
      {/* Fill */}
      <path d={`${path} L ${pad} ${yBottom} Z`} fill="rgba(255,107,43,0.1)" />
      {/* Line */}
      <path d={path} fill="none" stroke="#FF6B2B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Labels */}
      {(['A','D','S','R'] as const).map((l, i) => {
        const xs = [pad + tA / 2, pad + (tA + tD) / 2, pad + (tD + tS) / 2, pad + (tS + tR) / 2]
        return <text key={l} x={xs[i]} y={H - 1} fill="#3a3a3a" fontSize="5" textAnchor="middle" fontFamily="Space Grotesk">{l}</text>
      })}
    </svg>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function MixrSynth() {
  const [patch, setPatch] = useState<SynthPatch>(defaultPatch)
  const { initAudio, playNote, stopNote, stopAllNotes, analyser, specAnalyser } = useAudioEngine(patch)
  
  const [activeNotes, setActiveNotes] = useState<Set<string>>(new Set())
  const [playingSeq, setPlayingSeq] = useState(false)
  const [octave, setOctave] = useState(4)

  const updatePatch = <K extends keyof SynthPatch>(key: K, val: SynthPatch[K]) => {
    setPatch(prev => ({ ...prev, [key]: val }))
  }

  const handleSeqStep = useCallback((freq: number | null) => {
    if (freq) {
      playNote(freq, `SEQ-${freq}`)
      // Brief timeout to stop the note for the sequencer step
      setTimeout(() => stopNote(`SEQ-${freq}`), 100) 
    }
  }, [playNote, stopNote])

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--black)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      padding: '20px 16px 40px',
      gap: 12,
    }}>

      {/* ── Header ── */}
      <div style={{
        width: '100%',
        maxWidth: 1160,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: 8,
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{
            fontFamily: "'Space Grotesk'",
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: '-0.03em',
            color: 'var(--white)',
          }}>MIXR</span>
          <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 9, color: 'var(--steel)', letterSpacing: '0.15em' }}>
            POLY SYNTH v2.0
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <PresetManager currentPatch={patch} onLoadPatch={setPatch} />
          
          <button
            className={`toggle-btn`}
            onClick={() => { initAudio(); stopAllNotes() }}
            style={{ padding: '5px 12px', background: 'var(--orange)', color: 'black' }}
          >
            PANIC (INIT AUDIO)
          </button>
        </div>
      </div>

      {/* ── Main Body ── */}
      <div style={{
        width: '100%',
        maxWidth: 1160,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: 10,
      }}>
        {/* ── OSC 1 ── */}
        <Panel title="OSCILLATOR 1" accent>
          <WaveSelector value={patch.wave1} onChange={(v) => updatePatch('wave1', v)} />
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
            <Knob value={patch.osc1Vol} onChange={(v) => updatePatch('osc1Vol', v)} label="LEVEL" size={44} valueLabel={`${Math.round(patch.osc1Vol * 100)}`} />
            <Knob value={patch.osc2Semi} onChange={(v) => updatePatch('osc2Semi', v)} label="SEMI" size={36} color="#4A9EFF"
              valueLabel={`${Math.round((patch.osc2Semi - 0.5) * 24) > 0 ? '+' : ''}${Math.round((patch.osc2Semi - 0.5) * 24)}`} />
          </div>
        </Panel>

        {/* ── OSC 2 ── */}
        <Panel title="OSCILLATOR 2">
          <WaveSelector value={patch.wave2} onChange={(v) => updatePatch('wave2', v)} />
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
            <Knob value={patch.osc2Vol} onChange={(v) => updatePatch('osc2Vol', v)} label="LEVEL" size={44} valueLabel={`${Math.round(patch.osc2Vol * 100)}`} />
            <Knob value={patch.osc2Detune} onChange={(v) => updatePatch('osc2Detune', v)} label="DETUNE" size={36} color="#4A9EFF"
              valueLabel={`${Math.round((patch.osc2Detune - 0.5) * 50)}c`} />
            <Knob value={patch.osc2Semi} onChange={(v) => updatePatch('osc2Semi', v)} label="SEMI" size={36} color="#4AE68A"
              valueLabel={`${Math.round((patch.osc2Semi - 0.5) * 24) > 0 ? '+' : ''}${Math.round((patch.osc2Semi - 0.5) * 24)}`} />
          </div>
        </Panel>

        {/* ── SCOPE ── */}
        <Panel title="SCOPE" style={{ gap: 6 }}>
          {analyser ? (
             <Scope analyser={analyser} width={220} height={60} />
          ) : (
             <div style={{ width: 220, height: 60, background: '#050505', border: '1px solid #1a1a1a', borderRadius: 3 }} />
          )}
          {specAnalyser ? (
             <Scope analyser={specAnalyser} width={220} height={40} mode="spectrum" />
          ) : (
             <div style={{ width: 220, height: 40, background: '#050505', border: '1px solid #1a1a1a', borderRadius: 3 }} />
          )}
        </Panel>
      </div>

      {/* ── Middle row ── */}
      <div style={{
        width: '100%',
        maxWidth: 1160,
        display: 'grid',
        gridTemplateColumns: '1.2fr 1fr 1fr 0.8fr',
        gap: 10,
      }}>

        {/* ── FILTER ── */}
        <Panel title="FILTER" accent>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['lowpass','highpass','bandpass','notch'] as FilterType[]).map(t => (
              <button key={t} className={`toggle-btn ${patch.filterType === t ? 'active' : ''}`}
                onClick={() => updatePatch('filterType', t)} style={{ fontSize: 7, padding: '2px 4px' }}>
                {t.slice(0,2).toUpperCase()}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end' }}>
            <Knob value={patch.filterCutoff} onChange={(v) => updatePatch('filterCutoff', v)} label="CUTOFF" size={48}
              valueLabel={`${Math.round(80 * Math.pow(patch.filterCutoff, 3) * 200 / 1000)}k`} />
            <Knob value={patch.filterRes} onChange={(v) => updatePatch('filterRes', v)} label="RESO" size={40} color="#4A9EFF"
              valueLabel={`${Math.round(patch.filterRes * 20)}`} />
            <Knob value={patch.filterEnv} onChange={(v) => updatePatch('filterEnv', v)} label="ENV" size={36} color="#4AE68A"
              valueLabel={`${Math.round(patch.filterEnv * 100)}`} />
            <Knob value={patch.drive} onChange={(v) => updatePatch('drive', v)} label="DRIVE" size={36} color="#FF4A6B"
              valueLabel={`${Math.round(patch.drive * 100)}`} />
          </div>
        </Panel>

        {/* ── ENVELOPE ── */}
        <Panel title="ENVELOPE">
          <ADSRDisplay a={patch.attack} d={patch.decay} s={patch.sustain} r={patch.release} />
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <Fader value={patch.attack} onChange={(v) => updatePatch('attack', v)} label="A" height={70} />
            <Fader value={patch.decay} onChange={(v) => updatePatch('decay', v)} label="D" height={70} />
            <Fader value={patch.sustain} onChange={(v) => updatePatch('sustain', v)} label="S" height={70} color="#4AE68A" />
            <Fader value={patch.release} onChange={(v) => updatePatch('release', v)} label="R" height={70} />
          </div>
        </Panel>

        {/* ── LFO ── */}
        <Panel title="LFO">
          <WaveSelector value={patch.lfoWave} onChange={(v) => updatePatch('lfoWave', v)} />
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            <Knob value={patch.lfoRate} onChange={(v) => updatePatch('lfoRate', v)} label="RATE" size={44}
              valueLabel={`${(patch.lfoRate * 15).toFixed(1)}`} />
            <Knob value={patch.lfoDepth} onChange={(v) => updatePatch('lfoDepth', v)} label="DEPTH" size={36} color="#4A9EFF"
              valueLabel={`${Math.round(patch.lfoDepth * 100)}`} />
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['pitch','filter','amp'] as const).map(t => (
              <button key={t} className={`toggle-btn ${patch.lfoTarget === t ? 'active' : ''}`}
                onClick={() => updatePatch('lfoTarget', t)} style={{ fontSize: 7 }}>
                {t.toUpperCase()}
              </button>
            ))}
          </div>
        </Panel>

        {/* ── MASTER + VU ── */}
        <Panel title="MASTER">
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <VUMeter analyser={analyser} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
              <Knob value={patch.masterVol} onChange={(v) => updatePatch('masterVol', v)} label="VOL" size={44}
                valueLabel={`${Math.round(patch.masterVol * 100)}`} />
              <Knob value={patch.masterPan} onChange={(v) => updatePatch('masterPan', v)} label="PAN" size={36} color="#4A9EFF"
                valueLabel={patch.masterPan === 0.5 ? 'C' : patch.masterPan < 0.5 ? `L${Math.round((0.5 - patch.masterPan) * 200)}` : `R${Math.round((patch.masterPan - 0.5) * 200)}`} />
            </div>
          </div>
        </Panel>
      </div>

      {/* ── Effects Row ── */}
      <div style={{
        width: '100%',
        maxWidth: 1160,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 10,
      }}>
        <Panel title="REVERB">
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end' }}>
            <Knob value={patch.reverbMix} onChange={(v) => updatePatch('reverbMix', v)} label="MIX" size={44} />
          </div>
        </Panel>
        <Panel title="DELAY">
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end' }}>
            <Knob value={patch.delayTime} onChange={(v) => updatePatch('delayTime', v)} label="TIME" size={44}
              valueLabel={`${Math.round(patch.delayTime * 750)}ms`} />
            <Knob value={patch.delayFeedback} onChange={(v) => updatePatch('delayFeedback', v)} label="FBACK" size={36} color="#4A9EFF"
              valueLabel={`${Math.round(patch.delayFeedback * 80)}`} />
            <Knob value={patch.delayMix} onChange={(v) => updatePatch('delayMix', v)} label="MIX" size={36}
              valueLabel={`${Math.round(patch.delayMix * 100)}`} />
          </div>
        </Panel>
      </div>

      {/* ── Sequencer ── */}
      <div style={{ width: '100%', maxWidth: 1160 }}>
        <Panel title="STEP SEQUENCER" accent>
          <Sequencer onStep={handleSeqStep} playing={playingSeq} setPlaying={setPlayingSeq} />
        </Panel>
      </div>

      {/* ── Keyboard ── */}
      <div style={{ width: '100%', maxWidth: 1160 }}>
        <Panel title="KEYBOARD (POLYPHONIC)" style={{ alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {[3, 4, 5, 6].map(o => (
                <button key={o} className={`toggle-btn ${octave === o ? 'active' : ''}`}
                  onClick={() => setOctave(o)}>
                  OCT {o}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 14 }}>
              {[4, 5].map(oct => (
                <Piano
                  key={oct}
                  octave={oct === 4 ? octave : octave + 1}
                  onNoteOn={(freq, note) => {
                    playNote(freq, note)
                    setActiveNotes(s => new Set(s).add(note))
                  }}
                  onNoteOff={(_, note) => {
                    stopNote(note)
                    setActiveNotes(prev => {
                      const next = new Set(prev)
                      next.delete(note)
                      return next
                    })
                  }}
                  activeNotes={activeNotes}
                />
              ))}
            </div>
          </div>
        </Panel>
      </div>

      {/* Footer */}
      <div style={{
        width: '100%',
        maxWidth: 1160,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 8,
        borderTop: '1px solid var(--border)',
      }}>
        <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 8, color: '#3a3a3a', letterSpacing: '0.1em' }}>
          MIXR INSTRUMENTS — POLYPHONIC SYNTHESIZER — MODEL MX-02
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="toggle-btn active" style={{ fontSize: 7 }}>8 VOICES</button>
        </div>
      </div>
    </div>
  )
}
