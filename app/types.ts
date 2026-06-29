export type WaveType = 'sine' | 'square' | 'sawtooth' | 'triangle'
export type FilterType = 'lowpass' | 'highpass' | 'bandpass' | 'notch'

export interface SynthPatch {
  // Osc 1
  wave1: WaveType
  osc1Vol: number
  // Osc 2
  wave2: WaveType
  osc2Vol: number
  osc2Detune: number
  osc2Semi: number
  // Filter
  filterType: FilterType
  filterCutoff: number
  filterRes: number
  filterEnv: number
  // Envelope
  attack: number
  decay: number
  sustain: number
  release: number
  // LFO
  lfoRate: number
  lfoDepth: number
  lfoWave: WaveType
  lfoTarget: 'pitch' | 'filter' | 'amp'
  // Effects
  reverbMix: number
  delayTime: number
  delayFeedback: number
  delayMix: number
  // Master
  masterVol: number
  masterPan: number
  drive: number
}

export const defaultPatch: SynthPatch = {
  wave1: 'sawtooth',
  osc1Vol: 0.8,
  wave2: 'square',
  osc2Vol: 0.4,
  osc2Detune: 0.5,
  osc2Semi: 0.5,
  filterType: 'lowpass',
  filterCutoff: 0.6,
  filterRes: 0.2,
  filterEnv: 0.3,
  attack: 0.05,
  decay: 0.3,
  sustain: 0.7,
  release: 0.3,
  lfoRate: 0.3,
  lfoDepth: 0.2,
  lfoWave: 'sine',
  lfoTarget: 'filter',
  reverbMix: 0.3,
  delayTime: 0.25,
  delayFeedback: 0.3,
  delayMix: 0.2,
  masterVol: 0.75,
  masterPan: 0.5,
  drive: 0.3
}
