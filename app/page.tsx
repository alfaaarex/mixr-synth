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
      background: 'transparent',
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

const SEQ_NOTES = ['C5','B4','A4','G4','F4','E4','D4','C4']
const SEQ_FREQS: Record<string, number> = {
  'C5': 523.25, 'B4': 493.88, 'A4': 440, 'G4': 392,
  'F4': 349.23, 'E4': 329.63, 'D4': 293.66, 'C4': 261.63,
}

function Sequencer({ onStep, playing, setPlaying }: { onStep: (freq: number | null) => void, playing: boolean, setPlaying: (p: boolean) => void }) {
  const [steps, setSteps] = useState<(string | null)[]>(Array(16).fill(null))
  const [currentStep, setCurrentStep] = useState(-1)
  const [bpm, setBpm] = useState(0.5)
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
        <button className={`toggle-btn ${playing ? 'active' : ''}`} onClick={() => setPlaying(!playing)} style={{ padding: '5px 12px' }}>
          {playing ? '■ STOP' : '▶ PLAY'}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="section-label">BPM</span>
          <Knob value={bpm} onChange={setBpm} label="" size={28} valueLabel={Math.round(actualBpm).toString()} />
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
                background: steps[col] === note ? undefined : col === currentStep ? 'var(--surface3)' : 'rgba(255,255,255,0.05)',
                opacity: steps[col] === note ? 1 : 0.6,
              }}
              onClick={() => toggleStep(col, row)}
            />
          ))
        )}
      </div>
    </div>
  )
}

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
        let col = filled ? '#4AE68A' : 'rgba(255,255,255,0.05)'
        if (s < 4 && filled) col = '#FF4A6B'
        else if (s < 8 && filled) col = '#F5E642'
        ctx.fillStyle = col
        ctx.fillRect(0, s * segH + 1, W, segH - 2)
        const rLevel = level * (0.85 + Math.random() * 0.15)
        const rFilled = (segments - s) / segments <= rLevel
        ctx.fillStyle = rFilled ? col : 'rgba(255,255,255,0.05)'
        ctx.fillRect(W + 4, s * segH + 1, W, segH - 2)
      }
    }
    draw()
    return () => cancelAnimationFrame(rafRef.current)
  }, [analyser])
  return <canvas ref={canvasRef} width={36} height={80} />
}

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
      <rect width={W} height={H} fill="rgba(0,0,0,0.3)" rx={3} />
      <path d={`${path} L ${pad} ${yBottom} Z`} fill="rgba(255,107,43,0.1)" />
      <path d={path} fill="none" stroke="#FF6B2B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

type TabType = 'OSC' | 'FILTER' | 'FX' | 'SEQ'

export default function MixrSynth() {
  const [patch, setPatch] = useState<SynthPatch>(defaultPatch)
  const { initAudio, playNote, stopNote, stopAllNotes, analyser, specAnalyser } = useAudioEngine(patch)
  
  const [activeNotes, setActiveNotes] = useState<Set<string>>(new Set())
  const [playingSeq, setPlayingSeq] = useState(false)
  const [octave, setOctave] = useState(4)
  const [activeTab, setActiveTab] = useState<TabType>('OSC')

  const updatePatch = <K extends keyof SynthPatch>(key: K, val: SynthPatch[K]) => {
    setPatch(prev => ({ ...prev, [key]: val }))
  }

  const handleSeqStep = useCallback((freq: number | null) => {
    if (freq) {
      playNote(freq, `SEQ-${freq}`)
      setTimeout(() => stopNote(`SEQ-${freq}`), 100) 
    }
  }, [playNote, stopNote])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 16px',
    }}>
      
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: 900,
        display: 'flex',
        flexDirection: 'column',
        padding: '24px',
        gap: 20
      }}>

        {/* ── Top Bar ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontFamily: "'Space Grotesk'", fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--white)' }}>MIXR</span>
            <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 10, color: 'var(--steel)', letterSpacing: '0.15em' }}>MODEL MX-V3</span>
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <PresetManager currentPatch={patch} onLoadPatch={setPatch} />
            <button className="toggle-btn" onClick={() => { initAudio(); stopAllNotes() }} style={{ background: 'var(--red)', color: 'white', borderColor: 'transparent' }}>PANIC</button>
          </div>
        </div>

        {/* ── Visualizer & Master Section ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 20, alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: 8 }}>
          <div style={{ display: 'flex', gap: 16, height: 80 }}>
            {analyser ? <Scope analyser={analyser} width={300} height={80} /> : <div style={{ width: 300, height: 80, background: 'rgba(0,0,0,0.4)', borderRadius: 3 }} />}
            {specAnalyser ? <Scope analyser={specAnalyser} width={300} height={80} mode="spectrum" /> : <div style={{ width: 300, height: 80, background: 'rgba(0,0,0,0.4)', borderRadius: 3 }} />}
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <VUMeter analyser={analyser} />
            <div style={{ display: 'flex', gap: 12 }}>
              <Knob value={patch.masterVol} onChange={(v) => updatePatch('masterVol', v)} label="VOL" size={48} valueLabel={`${Math.round(patch.masterVol * 100)}`} />
              <Knob value={patch.masterPan} onChange={(v) => updatePatch('masterPan', v)} label="PAN" size={36} color="#4A9EFF" valueLabel={patch.masterPan === 0.5 ? 'C' : patch.masterPan < 0.5 ? `L` : `R`} />
            </div>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', gap: 10 }}>
          {(['OSC', 'FILTER', 'FX', 'SEQ'] as TabType[]).map(tab => (
            <button key={tab} className={`tab-btn ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
              {tab === 'OSC' ? 'Oscillators & Mix' : tab === 'FILTER' ? 'Filter & Envelopes' : tab === 'FX' ? 'LFO & Effects' : 'Sequencer'}
            </button>
          ))}
        </div>

        {/* ── Tab Content ── */}
        <div style={{ minHeight: 220, display: 'flex', gap: 16 }}>
          
          {activeTab === 'OSC' && (
            <>
              <Panel title="OSC 1" accent style={{ flex: 1 }}>
                <WaveSelector value={patch.wave1} onChange={(v) => updatePatch('wave1', v)} />
                <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
                  <Knob value={patch.osc1Vol} onChange={(v) => updatePatch('osc1Vol', v)} label="LEVEL" size={44} />
                  <Knob value={patch.osc2Semi} onChange={(v) => updatePatch('osc2Semi', v)} label="SEMI" size={36} color="#4A9EFF" />
                </div>
              </Panel>
              <Panel title="OSC 2" style={{ flex: 1 }}>
                <WaveSelector value={patch.wave2} onChange={(v) => updatePatch('wave2', v)} />
                <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
                  <Knob value={patch.osc2Vol} onChange={(v) => updatePatch('osc2Vol', v)} label="LEVEL" size={44} />
                  <Knob value={patch.osc2Detune} onChange={(v) => updatePatch('osc2Detune', v)} label="DETUNE" size={36} color="#4A9EFF" />
                </div>
              </Panel>
              <Panel title="NOISE & GLIDE" style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className={`toggle-btn ${patch.noiseType === 'white' ? 'active' : ''}`} onClick={() => updatePatch('noiseType', 'white')}>WHT</button>
                  <button className={`toggle-btn ${patch.noiseType === 'pink' ? 'active' : ''}`} onClick={() => updatePatch('noiseType', 'pink')}>PNK</button>
                </div>
                <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
                  <Knob value={patch.noiseVol} onChange={(v) => updatePatch('noiseVol', v)} label="NOISE LVL" size={44} />
                  <Knob value={patch.glideTime} onChange={(v) => updatePatch('glideTime', v)} label="GLIDE" size={36} color="#4AE68A" valueLabel={`${Math.round(patch.glideTime * 1000)}ms`} />
                </div>
              </Panel>
            </>
          )}

          {activeTab === 'FILTER' && (
            <>
              <Panel title="FILTER" accent style={{ flex: 1.2 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['lowpass','highpass','bandpass','notch'] as FilterType[]).map(t => (
                    <button key={t} className={`toggle-btn ${patch.filterType === t ? 'active' : ''}`} onClick={() => updatePatch('filterType', t)}>{t.slice(0,2).toUpperCase()}</button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
                  <Knob value={patch.filterCutoff} onChange={(v) => updatePatch('filterCutoff', v)} label="CUTOFF" size={48} />
                  <Knob value={patch.filterRes} onChange={(v) => updatePatch('filterRes', v)} label="RESO" size={40} color="#4A9EFF" />
                  <Knob value={patch.filterEnv} onChange={(v) => updatePatch('filterEnv', v)} label="ENV AMT" size={36} color="#4AE68A" />
                  <Knob value={patch.drive} onChange={(v) => updatePatch('drive', v)} label="DRIVE" size={36} color="#FF4A6B" />
                </div>
              </Panel>
              <Panel title="AMP ENVELOPE" style={{ flex: 1 }}>
                <ADSRDisplay a={patch.attack} d={patch.decay} s={patch.sustain} r={patch.release} />
                <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                  <Fader value={patch.attack} onChange={(v) => updatePatch('attack', v)} label="A" height={60} />
                  <Fader value={patch.decay} onChange={(v) => updatePatch('decay', v)} label="D" height={60} />
                  <Fader value={patch.sustain} onChange={(v) => updatePatch('sustain', v)} label="S" height={60} color="#4AE68A" />
                  <Fader value={patch.release} onChange={(v) => updatePatch('release', v)} label="R" height={60} />
                </div>
              </Panel>
            </>
          )}

          {activeTab === 'FX' && (
            <>
              <Panel title="LFO" accent style={{ flex: 1 }}>
                <WaveSelector value={patch.lfoWave} onChange={(v) => updatePatch('lfoWave', v)} />
                <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
                  <Knob value={patch.lfoRate} onChange={(v) => updatePatch('lfoRate', v)} label="RATE" size={44} />
                  <Knob value={patch.lfoDepth} onChange={(v) => updatePatch('lfoDepth', v)} label="DEPTH" size={36} color="#4A9EFF" />
                </div>
                <div style={{ display: 'flex', gap: 4, marginTop: 10 }}>
                  {(['pitch','filter','amp'] as const).map(t => (
                    <button key={t} className={`toggle-btn ${patch.lfoTarget === t ? 'active' : ''}`} onClick={() => updatePatch('lfoTarget', t)}>{t.toUpperCase()}</button>
                  ))}
                </div>
              </Panel>
              <Panel title="DELAY" style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
                  <Knob value={patch.delayTime} onChange={(v) => updatePatch('delayTime', v)} label="TIME" size={44} />
                  <Knob value={patch.delayFeedback} onChange={(v) => updatePatch('delayFeedback', v)} label="FBACK" size={36} color="#4A9EFF" />
                  <Knob value={patch.delayMix} onChange={(v) => updatePatch('delayMix', v)} label="MIX" size={36} />
                </div>
              </Panel>
              <Panel title="REVERB" style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
                  <Knob value={patch.reverbMix} onChange={(v) => updatePatch('reverbMix', v)} label="MIX" size={44} />
                </div>
              </Panel>
            </>
          )}

          {activeTab === 'SEQ' && (
            <Panel title="STEP SEQUENCER" accent style={{ flex: 1 }}>
              <Sequencer onStep={handleSeqStep} playing={playingSeq} setPlaying={setPlayingSeq} />
            </Panel>
          )}

        </div>

        {/* ── Keyboard ── */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span className="section-label">OCTAVE</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {[3, 4, 5, 6].map(o => (
                  <button key={o} className={`toggle-btn ${octave === o ? 'active' : ''}`} onClick={() => setOctave(o)}>
                    {o}
                  </button>
                ))}
              </div>
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
        </div>

      </div>
    </div>
  )
}
