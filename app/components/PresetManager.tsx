import { useState, useEffect } from 'react'
import { SynthPatch, defaultPatch } from '../types'

interface Props {
  currentPatch: SynthPatch
  onLoadPatch: (patch: SynthPatch) => void
}

const FACTORY_PRESETS: Record<string, SynthPatch> = {
  'Init Patch': defaultPatch,
  'Classic Bass': {
    ...defaultPatch,
    wave1: 'square', wave2: 'sawtooth', osc2Semi: 0.5, osc2Detune: 0.52,
    filterCutoff: 0.2, filterRes: 0.6, filterEnv: 0.8,
    attack: 0.01, decay: 0.3, sustain: 0.1, release: 0.1,
    drive: 0.6
  },
  'Lush Pad': {
    ...defaultPatch,
    wave1: 'sawtooth', wave2: 'sawtooth', osc2Semi: 0.5, osc2Detune: 0.55,
    filterCutoff: 0.4, filterRes: 0.1, filterEnv: 0.2,
    attack: 0.4, decay: 0.5, sustain: 0.8, release: 0.6,
    reverbMix: 0.6, delayMix: 0.4
  }
}

export default function PresetManager({ currentPatch, onLoadPatch }: Props) {
  const [presets, setPresets] = useState<Record<string, SynthPatch>>(FACTORY_PRESETS)
  const [selectedPreset, setSelectedPreset] = useState<string>('Init Patch')
  const [saveName, setSaveName] = useState<string>('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('mixr_presets')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setPresets({ ...FACTORY_PRESETS, ...parsed })
      } catch (e) {
        console.error('Failed to load presets', e)
      }
    }
  }, [])

  const savePresets = (newPresets: Record<string, SynthPatch>) => {
    setPresets(newPresets)
    const userPresets = Object.fromEntries(
      Object.entries(newPresets).filter(([k]) => !FACTORY_PRESETS[k])
    )
    localStorage.setItem('mixr_presets', JSON.stringify(userPresets))
  }

  const handleSave = () => {
    if (!saveName.trim()) return
    const updated = { ...presets, [saveName]: currentPatch }
    savePresets(updated)
    setSelectedPreset(saveName)
    setIsSaving(false)
    setSaveName('')
  }

  const handleLoad = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const name = e.target.value
    setSelectedPreset(name)
    if (presets[name]) {
      onLoadPatch(presets[name])
    }
  }

  const handleExport = () => {
    const data = JSON.stringify(currentPatch, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selectedPreset || 'preset'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const patch = JSON.parse(ev.target?.result as string) as SynthPatch
        // Basic validation could go here
        onLoadPatch(patch)
        const name = file.name.replace('.json', '')
        setSelectedPreset(name)
        // Optionally save to list automatically
      } catch (err) {
        alert('Invalid preset file')
      }
    }
    reader.readAsText(file)
  }

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 12 }}>
      <select 
        value={selectedPreset} 
        onChange={handleLoad}
        style={{
          background: 'var(--surface2)',
          color: 'var(--white)',
          border: '1px solid var(--border)',
          borderRadius: 4,
          padding: '4px 8px',
          fontFamily: 'inherit',
          outline: 'none'
        }}
      >
        <optgroup label="Factory Presets">
          {Object.keys(FACTORY_PRESETS).map(p => <option key={p} value={p}>{p}</option>)}
        </optgroup>
        <optgroup label="User Presets">
          {Object.keys(presets).filter(p => !FACTORY_PRESETS[p]).map(p => <option key={p} value={p}>{p}</option>)}
        </optgroup>
      </select>

      {isSaving ? (
        <div style={{ display: 'flex', gap: 4 }}>
          <input 
            autoFocus
            value={saveName}
            onChange={e => setSaveName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            placeholder="Preset name..."
            style={{
              background: 'var(--black)',
              color: 'var(--white)',
              border: '1px solid var(--orange)',
              borderRadius: 4,
              padding: '2px 6px',
              fontSize: 12,
              width: 120
            }}
          />
          <button className="toggle-btn" onClick={handleSave}>Save</button>
          <button className="toggle-btn" onClick={() => setIsSaving(false)}>Cancel</button>
        </div>
      ) : (
        <button className="toggle-btn" onClick={() => { setSaveName(selectedPreset); setIsSaving(true) }}>
          Save As...
        </button>
      )}

      <div style={{ width: 1, height: 16, background: 'var(--border)' }} />

      <button className="toggle-btn" onClick={handleExport} title="Export Preset">↓</button>
      <label className="toggle-btn" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Import Preset">
        ↑
        <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
      </label>
    </div>
  )
}
