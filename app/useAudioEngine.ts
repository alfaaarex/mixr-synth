import { useRef, useCallback, useEffect } from 'react'
import { SynthPatch } from './types'

interface SynthVoice {
  osc1: OscillatorNode
  osc2: OscillatorNode
  gain1: GainNode
  gain2: GainNode
  filter: BiquadFilterNode
  lfoGain: GainNode
  env: GainNode
  note: string | null
  startTime: number
  isReleased: boolean
}

export function useAudioEngine(patch: SynthPatch) {
  const audioCtxRef = useRef<AudioContext | null>(null)
  const masterGainRef = useRef<GainNode | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const specAnalyserRef = useRef<AnalyserNode | null>(null)
  
  // Voices array for polyphony (max 8 voices)
  const voicesRef = useRef<SynthVoice[]>([])
  
  const lfoRef = useRef<OscillatorNode | null>(null)
  const reverbRef = useRef<ConvolverNode | null>(null)
  const delayRef = useRef<DelayNode | null>(null)
  const delayGainRef = useRef<GainNode | null>(null)
  const reverbGainRef = useRef<GainNode | null>(null)
  const compressorRef = useRef<DynamicsCompressorNode | null>(null)

  const initAudio = useCallback(() => {
    if (audioCtxRef.current) return

    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    audioCtxRef.current = ctx

    const master = ctx.createGain()
    master.gain.value = patch.masterVol
    masterGainRef.current = master

    const analyser = ctx.createAnalyser()
    analyser.fftSize = 2048
    analyserRef.current = analyser

    const specAnalyser = ctx.createAnalyser()
    specAnalyser.fftSize = 512
    specAnalyserRef.current = specAnalyser

    const compressor = ctx.createDynamicsCompressor()
    compressor.threshold.value = -20
    compressor.knee.value = 10
    compressor.ratio.value = 4
    compressorRef.current = compressor

    // Reverb
    const reverb = ctx.createConvolver()
    reverbRef.current = reverb
    const revGain = ctx.createGain()
    revGain.gain.value = patch.reverbMix
    reverbGainRef.current = revGain

    const len = ctx.sampleRate * 2.5
    const ir = ctx.createBuffer(2, len, ctx.sampleRate)
    for (let c = 0; c < 2; c++) {
      const ch = ir.getChannelData(c)
      for (let i = 0; i < len; i++) {
        ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5)
      }
    }
    reverb.buffer = ir

    // Delay
    const delay = ctx.createDelay(2)
    delay.delayTime.value = patch.delayTime * 0.75
    delayRef.current = delay

    const dGain = ctx.createGain()
    dGain.gain.value = patch.delayMix
    delayGainRef.current = dGain

    const dFb = ctx.createGain()
    dFb.gain.value = patch.delayFeedback * 0.8
    delay.connect(dFb)
    dFb.connect(delay)

    // LFO
    const lfo = ctx.createOscillator()
    lfo.type = patch.lfoWave
    lfo.frequency.value = patch.lfoRate * 15
    lfo.start()
    lfoRef.current = lfo

    // Routing
    master.connect(analyser)
    analyser.connect(compressor)
    compressor.connect(ctx.destination)
    master.connect(specAnalyser)

    master.connect(reverb)
    reverb.connect(revGain)
    revGain.connect(compressor)

    master.connect(dGain)
    dGain.connect(delay)
    delay.connect(compressor)
  }, [patch.masterVol, patch.reverbMix, patch.delayTime, patch.delayMix, patch.delayFeedback, patch.lfoWave, patch.lfoRate])

  // Real-time parameter updates
  useEffect(() => {
    if (masterGainRef.current) masterGainRef.current.gain.setTargetAtTime(patch.masterVol, audioCtxRef.current!.currentTime, 0.05)
  }, [patch.masterVol])

  useEffect(() => {
    if (lfoRef.current) {
      lfoRef.current.frequency.setTargetAtTime(patch.lfoRate * 15, audioCtxRef.current!.currentTime, 0.05)
      lfoRef.current.type = patch.lfoWave
    }
  }, [patch.lfoRate, patch.lfoWave])

  useEffect(() => {
    if (delayRef.current) delayRef.current.delayTime.setTargetAtTime(patch.delayTime * 0.75, audioCtxRef.current!.currentTime, 0.05)
    if (delayGainRef.current) delayGainRef.current.gain.setTargetAtTime(patch.delayMix, audioCtxRef.current!.currentTime, 0.05)
  }, [patch.delayTime, patch.delayMix])

  useEffect(() => {
    if (reverbGainRef.current) reverbGainRef.current.gain.setTargetAtTime(patch.reverbMix, audioCtxRef.current!.currentTime, 0.05)
  }, [patch.reverbMix])
  
  // Real-time updates for active voices
  useEffect(() => {
    if (!audioCtxRef.current) return;
    const now = audioCtxRef.current.currentTime;
    
    voicesRef.current.forEach(v => {
      if (v.isReleased) return;
      
      v.osc1.type = patch.wave1;
      v.gain1.gain.setTargetAtTime(patch.osc1Vol, now, 0.05);
      
      v.osc2.type = patch.wave2;
      v.gain2.gain.setTargetAtTime(patch.osc2Vol, now, 0.05);
      
      const detuneOffset = (patch.osc2Detune - 0.5) * 50;
      v.osc2.detune.setTargetAtTime(detuneOffset, now, 0.05);
      
      v.filter.type = patch.filterType;
      v.filter.Q.setTargetAtTime(patch.filterRes * 20, now, 0.05);
      
      v.lfoGain.gain.setTargetAtTime(patch.lfoDepth * 200, now, 0.05);
    });
  }, [patch.wave1, patch.osc1Vol, patch.wave2, patch.osc2Vol, patch.osc2Detune, patch.filterType, patch.filterRes, patch.lfoDepth]);


  const playNote = useCallback((freq: number, noteLabel: string) => {
    initAudio()
    const ctx = audioCtxRef.current!
    if (ctx.state === 'suspended') ctx.resume()

    const now = ctx.currentTime

    // Voice stealing if more than 8 voices
    if (voicesRef.current.length >= 8) {
      // Find oldest released voice, or just oldest voice
      let oldestIdx = 0
      let oldestTime = Infinity
      let foundReleased = false
      
      for (let i = 0; i < voicesRef.current.length; i++) {
        const v = voicesRef.current[i]
        if (v.isReleased && !foundReleased) {
           foundReleased = true
           oldestTime = v.startTime
           oldestIdx = i
        } else if (v.isReleased === foundReleased && v.startTime < oldestTime) {
           oldestTime = v.startTime
           oldestIdx = i
        }
      }
      
      const v = voicesRef.current[oldestIdx]
      // Force kill
      v.env.gain.cancelScheduledValues(now)
      v.env.gain.setValueAtTime(0, now)
      try { v.osc1.stop(); v.osc2.stop(); } catch {}
      voicesRef.current.splice(oldestIdx, 1)
    }

    // Env gain
    const env = ctx.createGain()
    env.gain.setValueAtTime(0, now)
    env.gain.linearRampToValueAtTime(1, now + patch.attack * 2)
    env.gain.linearRampToValueAtTime(patch.sustain, now + patch.attack * 2 + patch.decay * 2)

    // Osc 1
    const osc1 = ctx.createOscillator()
    osc1.type = patch.wave1
    osc1.frequency.value = freq

    const gain1 = ctx.createGain()
    gain1.gain.value = patch.osc1Vol

    // Osc 2
    const osc2 = ctx.createOscillator()
    osc2.type = patch.wave2
    const semiOffset = (patch.osc2Semi - 0.5) * 24
    const detuneOffset = (patch.osc2Detune - 0.5) * 50
    osc2.frequency.value = freq * Math.pow(2, semiOffset / 12)
    osc2.detune.value = detuneOffset

    const gain2 = ctx.createGain()
    gain2.gain.value = patch.osc2Vol

    // Filter
    const filter = ctx.createBiquadFilter()
    filter.type = patch.filterType
    const fc = 80 * Math.pow(patch.filterCutoff, 3) * 200
    filter.frequency.value = Math.min(fc, 18000)
    filter.Q.value = patch.filterRes * 20

    // Filter env
    const envCutoff = patch.filterEnv * 4000
    filter.frequency.setValueAtTime(filter.frequency.value, now)
    filter.frequency.linearRampToValueAtTime(filter.frequency.value + envCutoff, now + patch.attack * 2)
    filter.frequency.linearRampToValueAtTime(filter.frequency.value, now + patch.attack * 2 + patch.decay * 2)

    // LFO routing
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = patch.lfoDepth * 200
    if (lfoRef.current) {
      lfoRef.current.connect(lfoGain)
      if (patch.lfoTarget === 'pitch') {
        lfoGain.connect(osc1.frequency)
        lfoGain.connect(osc2.frequency)
      } else if (patch.lfoTarget === 'filter') {
        lfoGain.connect(filter.frequency)
      } else if (patch.lfoTarget === 'amp') {
        lfoGain.connect(env.gain)
      }
    }

    // Distortion/drive
    const waveShaper = ctx.createWaveShaper()
    const n = 256
    const curve = new Float32Array(n)
    const k = patch.drive * 100 + 1
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1
      curve[i] = ((Math.PI + k) * x) / (Math.PI + k * Math.abs(x))
    }
    waveShaper.curve = curve

    // Connect
    osc1.connect(gain1)
    osc2.connect(gain2)
    gain1.connect(filter)
    gain2.connect(filter)
    filter.connect(waveShaper)
    waveShaper.connect(env)
    env.connect(masterGainRef.current!)

    osc1.start()
    osc2.start()

    const newVoice: SynthVoice = {
      osc1, osc2, gain1, gain2, filter, lfoGain, env, note: noteLabel, startTime: now, isReleased: false
    }
    voicesRef.current.push(newVoice)

  }, [patch, initAudio])

  const stopNote = useCallback((noteLabel: string) => {
    if (!audioCtxRef.current) return
    const ctx = audioCtxRef.current
    const now = ctx.currentTime

    voicesRef.current.forEach(v => {
      if (v.note === noteLabel && !v.isReleased) {
        v.isReleased = true
        v.env.gain.cancelScheduledValues(now)
        v.env.gain.setValueAtTime(v.env.gain.value, now)
        v.env.gain.exponentialRampToValueAtTime(0.001, now + patch.release * 3)

        try {
          v.osc1.stop(now + patch.release * 3 + 0.1)
          v.osc2.stop(now + patch.release * 3 + 0.1)
        } catch {}
      }
    })
    
    // Cleanup old released voices periodically
    voicesRef.current = voicesRef.current.filter(v => {
      if (v.isReleased && now > v.startTime + 10) return false;
      return true;
    });
  }, [patch.release])

  const stopAllNotes = useCallback(() => {
    if (!audioCtxRef.current) return
    const ctx = audioCtxRef.current
    const now = ctx.currentTime
    voicesRef.current.forEach(v => {
        if (!v.isReleased) {
            v.isReleased = true
            v.env.gain.cancelScheduledValues(now)
            v.env.gain.setValueAtTime(v.env.gain.value, now)
            v.env.gain.exponentialRampToValueAtTime(0.001, now + patch.release * 3)
            try {
              v.osc1.stop(now + patch.release * 3 + 0.1)
              v.osc2.stop(now + patch.release * 3 + 0.1)
            } catch {}
        }
    })
  }, [patch.release])

  return {
    initAudio,
    playNote,
    stopNote,
    stopAllNotes,
    analyser: analyserRef.current,
    specAnalyser: specAnalyserRef.current
  }
}
