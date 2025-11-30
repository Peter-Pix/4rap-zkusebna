
import React, { useState, useRef, useEffect } from 'react';
import { BEATS } from '../constants';
import { Beat, Recording, LyricSheet, MixSettings, MixerPreset } from '../types';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { Play, Square, Check, RefreshCw, Volume2, Music, Upload, Trash2, FileText, Sliders, X, Plus, ChevronDown, Repeat, Menu, Activity, Mic, Settings, ChevronsRight, Save, LayoutTemplate } from 'lucide-react';

interface StudioPageProps {
  onSaveRecording: (recording: Recording) => void;
}

// Helper to convert blob to base64
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// Helper to create a simple reverb impulse response
const createImpulseResponse = (audioContext: BaseAudioContext, duration: number, decay: number) => {
  const sampleRate = audioContext.sampleRate;
  const length = sampleRate * duration;
  const impulse = audioContext.createBuffer(2, length, sampleRate);
  const left = impulse.getChannelData(0);
  const right = impulse.getChannelData(1);

  for (let i = 0; i < length; i++) {
    const n = i; // simple noise
    left[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, decay);
    right[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, decay);
  }
  return impulse;
};

// Helper: Count syllables for Czech language (heuristic)
const countSyllables = (text: string): number => {
  if (!text) return 0;
  // Czech vowels (short & long)
  const vowels = /[aáeéěiíoóuúůyý]/gi;
  const matches = text.match(vowels);
  return matches ? matches.length : 0;
};

// Helper: Simple Peak Detection for BPM
const detectBPM = async (buffer: AudioBuffer): Promise<number> => {
  try {
    const data = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;
    
    // Low pass filter simulation (simple moving average) to focus on bass/kick
    // This is very rudimentary.
    
    // We will look for peaks in 0.5s windows
    const peaks = [];
    const threshold = 0.8; 
    const minDistance = 0.3 * sampleRate; // Assume at least 0.3s between beats (max 200 BPM)
    
    let lastPeakIndex = 0;

    for (let i = 0; i < data.length; i++) {
       if (Math.abs(data[i]) > threshold) {
         if (i - lastPeakIndex > minDistance) {
           peaks.push(i);
           lastPeakIndex = i;
         }
       }
    }

    if (peaks.length < 2) return 0;

    // Calculate intervals
    const intervals = [];
    for (let i = 0; i < peaks.length - 1; i++) {
      intervals.push(peaks[i+1] - peaks[i]);
    }

    // Find most common interval
    const counts: {[key: number]: number} = {};
    intervals.forEach(int => {
       // Group vaguely similar intervals
       const key = Math.round(int / 1000) * 1000; 
       counts[key] = (counts[key] || 0) + 1;
    });

    let maxCount = 0;
    let bestInterval = 0;
    for (const key in counts) {
       if (counts[key] > maxCount) {
         maxCount = counts[key];
         bestInterval = parseInt(key);
       }
    }

    if (bestInterval === 0) return 0;

    const bpm = 60 / (bestInterval / sampleRate);
    
    // Clamp to reasonable range (60-180) - doubling or halving if needed
    let finalBpm = Math.round(bpm);
    while (finalBpm < 70) finalBpm *= 2;
    while (finalBpm > 180) finalBpm /= 2;

    return Math.round(finalBpm);
  } catch (e) {
    console.warn("BPM Detection failed", e);
    return 0;
  }
};

type LoopMode = 'full' | 4 | 8 | 16;

const DEFAULT_PRESETS: MixerPreset[] = [
  { id: 'def_clean', name: 'Clean Rap', settings: { bass: 0, treble: 2, reverb: 0.1, echo: 0, denoise: 0.5 }, isDefault: true },
  { id: 'def_trap', name: 'Trap Echo', settings: { bass: 2, treble: 4, reverb: 0.2, echo: 0.3, denoise: 0.2 }, isDefault: true },
  { id: 'def_radio', name: 'Radio Hit', settings: { bass: 1, treble: 5, reverb: 0.15, echo: 0.05, denoise: 0.8 }, isDefault: true },
  { id: 'def_dark', name: 'Deep/Dark', settings: { bass: 5, treble: -2, reverb: 0.4, echo: 0.1, denoise: 0.1 }, isDefault: true },
];

export const StudioPage: React.FC<StudioPageProps> = ({ onSaveRecording }) => {
  // --- STATE ---
  const [beats, setBeats] = useState<Beat[]>(BEATS);
  const [selectedBeat, setSelectedBeat] = useState<Beat | null>(BEATS[0]);
  
  // Workflow State
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  
  // Loop State
  const [isLooping, setIsLooping] = useState(false);
  const [loopMode, setLoopMode] = useState<LoopMode>('full');

  const [timer, setTimer] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [showMixer, setShowMixer] = useState(false);
  const [showTools, setShowTools] = useState(false);
  
  // Input Settings
  const [inputDevices, setInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [inputGain, setInputGain] = useState(1.0);

  // Volume State
  const [masterVolume, setMasterVolume] = useState(1.0);
  const [beatVolume, setBeatVolume] = useState(0.8);
  const [recordingVolume, setRecordingVolume] = useState(1.0);
  const [metronomeVolume, setMetronomeVolume] = useState(0.5);
  
  // Metronome State
  const [metronomeOn, setMetronomeOn] = useState(false);

  // Data State
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [recordedBuffer, setRecordedBuffer] = useState<AudioBuffer | null>(null);

  // Lyrics State
  const [showLyrics, setShowLyrics] = useState(false);
  const [lyricSheets, setLyricSheets] = useState<LyricSheet[]>([]);
  const [activeLyricId, setActiveLyricId] = useState<string | null>(null);
  const [flowAdviceDismissed, setFlowAdviceDismissed] = useState(false);
  const [showFlowAdvice, setShowFlowAdvice] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);

  // Preset State
  const [presets, setPresets] = useState<MixerPreset[]>(DEFAULT_PRESETS);
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');

  // Modal State
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'info' | 'confirm';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
    onConfirm: () => {},
  });

  // Mixing State
  const [mixSettings, setMixSettings] = useState<MixSettings>({
    bass: 0,   // dB
    treble: 0, // dB
    reverb: 0,  // 0 to 1 mix
    echo: 0, // 0 to 1 mix
    denoise: 0 // 0 to 1 intensity (HighPass)
  });

  // --- REFS ---
  const beatAudioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const recordingAudioRef = useRef<HTMLAudioElement | null>(null);
  const waveformCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Web Audio API Refs for Visualizer & Mixing & Metronome
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const beatSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const analyserBeatRef = useRef<AnalyserNode | null>(null);
  const analyserMicRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Input Refs
  const inputGainNodeRef = useRef<GainNode | null>(null);

  // Metronome Refs
  const nextNoteTimeRef = useRef(0.0);
  const metronomeTimerRef = useRef<number | null>(null);
  const beatCountRef = useRef(0);

  // Mixing Nodes
  const recordingSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const bassNodeRef = useRef<BiquadFilterNode | null>(null);
  const trebleNodeRef = useRef<BiquadFilterNode | null>(null);
  const reverbNodeRef = useRef<ConvolverNode | null>(null);
  const echoNodeRef = useRef<DelayNode | null>(null);
  const echoFeedbackNodeRef = useRef<GainNode | null>(null);
  const denoiseNodeRef = useRef<BiquadFilterNode | null>(null); // HighPass filter
  const dryGainNodeRef = useRef<GainNode | null>(null);
  const wetGainNodeRef = useRef<GainNode | null>(null);
  const echoGainNodeRef = useRef<GainNode | null>(null);

  const getAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  };

  // --- INIT SETTINGS ---
  useEffect(() => {
    // Enumerate devices
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then(devices => {
        const inputs = devices.filter(d => d.kind === 'audioinput');
        setInputDevices(inputs);
        if (inputs.length > 0 && !selectedDeviceId) {
          setSelectedDeviceId(inputs[0].deviceId);
        }
      });
    }
  }, []);

  // Update Input Gain Logic (Pre-recording)
  useEffect(() => {
    if (inputGainNodeRef.current) {
      inputGainNodeRef.current.gain.value = inputGain;
    }
  }, [inputGain]);


  // --- INIT LYRICS & PRESETS ---
  useEffect(() => {
    // Load lyrics
    try {
      const storedLyrics = localStorage.getItem('zkusebna_lyrics_v1');
      if (storedLyrics) {
        const parsed = JSON.parse(storedLyrics);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setLyricSheets(parsed);
          setActiveLyricId(parsed[0].id);
        } else {
          createInitialLyricSheet();
        }
      } else {
        createInitialLyricSheet();
      }

      // Load Presets
      const storedPresets = localStorage.getItem('zkusebna_mixer_presets_v1');
      if (storedPresets) {
        const parsed = JSON.parse(storedPresets);
        // Merge defaults with stored custom presets (filtering out defaults from stored to avoid dupes/stale defaults)
        const customPresets = parsed.filter((p: MixerPreset) => !p.isDefault);
        setPresets([...DEFAULT_PRESETS, ...customPresets]);
      }

      // Check flow advice suppression
      const adviceTimestamp = localStorage.getItem('zkusebna_flow_advice_dismissed');
      if (adviceTimestamp) {
        const days = (Date.now() - parseInt(adviceTimestamp)) / (1000 * 60 * 60 * 24);
        if (days < 7) setFlowAdviceDismissed(true);
      }
    } catch (e) {
      console.error("Error loading data", e);
      createInitialLyricSheet();
    }
  }, []);

  useEffect(() => {
    if (lyricSheets.length > 0) {
      localStorage.setItem('zkusebna_lyrics_v1', JSON.stringify(lyricSheets));
    }
  }, [lyricSheets]);

  // Save presets when they change
  useEffect(() => {
    if (presets.length > 0) {
      // Only save custom presets to storage
      const customPresets = presets.filter(p => !p.isDefault);
      localStorage.setItem('zkusebna_mixer_presets_v1', JSON.stringify(customPresets));
    }
  }, [presets]);

  const createInitialLyricSheet = () => {
    const newSheet: LyricSheet = {
      id: Date.now().toString(),
      title: 'Nový Text 1',
      content: '',
      lastEdited: Date.now()
    };
    setLyricSheets([newSheet]);
    setActiveLyricId(newSheet.id);
  };

  const getActiveSheet = () => lyricSheets.find(s => s.id === activeLyricId) || lyricSheets[0];

  const updateActiveSheet = (updates: Partial<LyricSheet>) => {
    if (!activeLyricId) return;
    
    setLyricSheets(prev => prev.map(sheet => {
      if (sheet.id === activeLyricId) {
        const updated = { ...sheet, ...updates, lastEdited: Date.now() };
        // Flow Analysis Logic if content changed
        if (updates.content !== undefined && !flowAdviceDismissed && !showFlowAdvice) {
          analyzeFlow(updates.content);
        }
        return updated;
      }
      return sheet;
    }));
  };

  const handleNewSheet = () => {
    const newSheet: LyricSheet = {
      id: Date.now().toString(),
      title: `Nový Text ${lyricSheets.length + 1}`,
      content: '',
      lastEdited: Date.now()
    };
    setLyricSheets(prev => [...prev, newSheet]);
    setActiveLyricId(newSheet.id);
  };

  const handleDeleteSheet = () => {
    if (lyricSheets.length <= 1) {
      updateActiveSheet({ content: '' }); // Just clear if it's the last one
      return;
    }
    openConfirm("Smazat text?", "Opravdu chceš smazat tento text?", () => {
      const newSheets = lyricSheets.filter(s => s.id !== activeLyricId);
      setLyricSheets(newSheets);
      setActiveLyricId(newSheets[0].id);
    });
  };

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsRenaming(false);
  };

  // --- STATS & ANALYSIS ---
  const getStats = () => {
    const sheet = getActiveSheet();
    if (!sheet) return { lines: 0, syllables: 0 };
    
    const lines = sheet.content.split('\n').filter(l => l.trim().length > 0);
    const totalSyllables = countSyllables(sheet.content);
    
    return { lines: lines.length, syllables: totalSyllables };
  };

  const analyzeFlow = (text: string) => {
    const lines = text.split('\n').filter(l => l.trim().length > 0);
    if (lines.length < 4) return; // Need some data

    let maxVariance = 0;
    for (let i = 0; i < lines.length - 1; i++) {
      const curr = countSyllables(lines[i]);
      const next = countSyllables(lines[i+1]);
      if (curr > 0 && next > 0) {
        const diff = Math.abs(curr - next);
        if (diff > maxVariance) maxVariance = diff;
      }
    }

    if (maxVariance > 5) {
      setShowFlowAdvice(true);
    }
  };

  const dismissFlowAdvice = () => {
    setShowFlowAdvice(false);
    setFlowAdviceDismissed(true);
    localStorage.setItem('zkusebna_flow_advice_dismissed', Date.now().toString());
  };

  // --- MODAL HELPERS ---
  const openAlert = (title: string, message: string) => {
    setModalConfig({
      isOpen: true,
      title,
      message,
      type: 'info',
      onConfirm: () => setModalConfig(prev => ({ ...prev, isOpen: false }))
    });
  };

  const openConfirm = (title: string, message: string, action: () => void) => {
    setModalConfig({
      isOpen: true,
      title,
      message,
      type: 'confirm',
      onConfirm: () => {
        action();
        setModalConfig(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const closeDialog = () => {
    setModalConfig(prev => ({ ...prev, isOpen: false }));
  };

  // --- PRESET HANDLERS ---
  const handleSavePreset = () => {
    if (!newPresetName.trim()) return;
    const newPreset: MixerPreset = {
      id: `custom-${Date.now()}`,
      name: newPresetName.trim(),
      settings: { ...mixSettings }, // Copy current settings
      isDefault: false
    };
    setPresets(prev => [...prev, newPreset]);
    setNewPresetName('');
    setIsSavingPreset(false);
  };

  const handleLoadPreset = (preset: MixerPreset) => {
    setMixSettings({ ...preset.settings });
  };

  const handleDeletePreset = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    openConfirm("Smazat preset?", "Opravdu chceš smazat toto nastavení mixu?", () => {
      setPresets(prev => prev.filter(p => p.id !== id));
    });
  };

  // --- METRONOME ENGINE ---
  const scheduleMetronomeClick = (time: number) => {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const envelope = ctx.createGain();

    // High pitch on 1st beat, low on others
    osc.frequency.value = beatCountRef.current % 4 === 0 ? 1000 : 800;
    
    // Apply Master Volume * Metronome Volume
    const effectiveVolume = metronomeVolume * masterVolume;
    
    envelope.gain.value = effectiveVolume;
    envelope.gain.exponentialRampToValueAtTime(effectiveVolume, time + 0.001);
    envelope.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

    osc.connect(envelope);
    envelope.connect(ctx.destination);

    osc.start(time);
    osc.stop(time + 0.05);
  };

  const metronomeScheduler = () => {
    const ctx = getAudioContext();
    // Lookahead: 0.1s
    const lookahead = 0.1;
    // Schedule ahead time
    while (nextNoteTimeRef.current < ctx.currentTime + lookahead) {
       scheduleMetronomeClick(nextNoteTimeRef.current);
       
       const bpm = selectedBeat?.bpm || 120;
       const secondsPerBeat = 60.0 / bpm;
       nextNoteTimeRef.current += secondsPerBeat;
       beatCountRef.current++;
    }
    metronomeTimerRef.current = window.setTimeout(metronomeScheduler, 25);
  };

  const startMetronome = () => {
    const ctx = getAudioContext();
    nextNoteTimeRef.current = ctx.currentTime;
    beatCountRef.current = 0;
    metronomeScheduler();
  };

  const stopMetronome = () => {
    if (metronomeTimerRef.current) {
      clearTimeout(metronomeTimerRef.current);
    }
  };

  // Sync Metronome with Playback
  useEffect(() => {
    if (metronomeOn && (isPlaying || isRecording)) {
       startMetronome();
    } else {
       stopMetronome();
    }
    return () => stopMetronome();
  }, [metronomeOn, isPlaying, isRecording]);


  // --- VISUALIZER & LOOP ENGINE ---
  useEffect(() => {
    if (beatAudioRef.current && !beatSourceRef.current) {
      const ctx = getAudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128; // Lower for chunkier bars
      analyserBeatRef.current = analyser;

      try {
        const source = ctx.createMediaElementSource(beatAudioRef.current);
        source.connect(analyser);
        analyser.connect(ctx.destination);
        beatSourceRef.current = source;
      } catch (e) {
        console.warn("MediaElementSource already attached", e);
      }
    }
  }, [selectedBeat]);

  const drawVisualizer = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // --- LOOP LOGIC (Check every frame) ---
    if (isLooping && loopMode !== 'full' && beatAudioRef.current && isPlaying) {
       // Calculate Loop Duration
       const bpm = selectedBeat?.bpm || 120;
       const secondsPerBeat = 60 / bpm;
       const bars = typeof loopMode === 'number' ? loopMode : 4;
       // Assuming 4/4 time signature
       const loopDuration = secondsPerBeat * 4 * bars;
       
       if (beatAudioRef.current.currentTime >= loopDuration) {
          beatAudioRef.current.currentTime = 0;
          // Note: HTML audio loop attribute isn't precise enough for bar looping,
          // so we force seek. This might click slightly.
       }
    }

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Subtle Grid
    ctx.strokeStyle = '#f3f4f6';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < width; i += 50) {
      ctx.moveTo(i, 0);
      ctx.lineTo(i, height);
    }
    ctx.stroke();

    // LAYER 1: BEAT FREQUENCY (Black Bars from Bottom)
    // Only draw beat bars if beat is loaded and playing (and not metronome only)
    if (analyserBeatRef.current && selectedBeat?.url) {
      const bufferLength = analyserBeatRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyserBeatRef.current.getByteFrequencyData(dataArray);

      const barWidth = (width / bufferLength);
      let x = 0;

      ctx.fillStyle = '#000000'; // Pure Black
      for (let i = 0; i < bufferLength; i++) {
        // Boost value to make bars taller
        const barHeight = (dataArray[i] / 255) * height * 0.8; 
        ctx.fillRect(x, height - barHeight, barWidth - 1, barHeight);
        x += barWidth;
      }
    }

    // LAYER 2: MIC INPUT (Red Line Overlay)
    if (isRecording && analyserMicRef.current) {
      const bufferLength = analyserMicRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyserMicRef.current.getByteTimeDomainData(dataArray);

      ctx.lineWidth = 4;
      ctx.strokeStyle = '#e91e63'; // Brand Pink/Red
      ctx.beginPath();

      const sliceWidth = width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * (height / 2); // Centered waveform

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }
      ctx.lineTo(width, height / 2);
      ctx.stroke();
    } 
    // Static line when not recording but maybe previewing
    else if (!isRecording) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#e5e7eb'; // Grey static line
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
    }

    animationFrameRef.current = requestAnimationFrame(drawVisualizer);
  };

  useEffect(() => {
    drawVisualizer();
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isRecording, isPreviewing, selectedBeat, isLooping, loopMode]);

  // --- STATIC WAVEFORM GENERATION (POST RECORDING) ---
  useEffect(() => {
    if (recordedBlob) {
      const ctx = getAudioContext();
      recordedBlob.arrayBuffer().then(arrayBuffer => {
        ctx.decodeAudioData(arrayBuffer).then(buffer => {
          setRecordedBuffer(buffer);
        });
      }).catch(e => console.error("Error decoding audio data", e));
    } else {
      setRecordedBuffer(null);
    }
  }, [recordedBlob]);

  useEffect(() => {
    if (recordedBuffer && waveformCanvasRef.current) {
      const canvas = waveformCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;
      const data = recordedBuffer.getChannelData(0);
      const step = Math.ceil(data.length / width);
      const amp = height / 2;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      
      // Draw Grid
      ctx.strokeStyle = '#eeeeee';
      ctx.beginPath();
      ctx.moveTo(0, height/2);
      ctx.lineTo(width, height/2);
      ctx.stroke();

      ctx.fillStyle = '#000000'; // Black Waveform
      
      for (let i = 0; i < width; i++) {
        let min = 1.0;
        let max = -1.0;
        for (let j = 0; j < step; j++) {
          const datum = data[(i * step) + j];
          if (datum < min) min = datum;
          if (datum > max) max = datum;
        }
        ctx.fillRect(i, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
      }
    }
  }, [recordedBuffer]);


  // --- MIXING ENGINE (POST-RECORDING) ---
  useEffect(() => {
    // Whenever audioUrl exists (recording finished), set up mixing chain
    if (audioUrl && recordingAudioRef.current) {
      const ctx = getAudioContext();
      
      // We always rebuild chain here for simplicity in this MVP when recording changes
      // In a pro app, we'd maintain graph persistence better.
      try {
        const source = ctx.createMediaElementSource(recordingAudioRef.current);
        recordingSourceRef.current = source;

        // Denoise (HighPass)
        const denoise = ctx.createBiquadFilter();
        denoise.type = 'highpass';
        denoise.frequency.value = 0; // Default off
        denoiseNodeRef.current = denoise;

        // EQ Nodes
        const bass = ctx.createBiquadFilter();
        bass.type = 'lowshelf';
        bass.frequency.value = 200;
        bassNodeRef.current = bass;

        const treble = ctx.createBiquadFilter();
        treble.type = 'highshelf';
        treble.frequency.value = 2000;
        trebleNodeRef.current = treble;

        // Reverb Nodes
        const reverb = ctx.createConvolver();
        reverb.buffer = createImpulseResponse(ctx, 2, 2); // 2 seconds reverb
        reverbNodeRef.current = reverb;

        // Echo Nodes
        const echo = ctx.createDelay();
        echo.delayTime.value = 0.3; // 300ms delay
        echoNodeRef.current = echo;
        
        const echoFeedback = ctx.createGain();
        echoFeedback.gain.value = 0.3;
        echoFeedbackNodeRef.current = echoFeedback;

        // Gains
        const dryGain = ctx.createGain();
        dryGainNodeRef.current = dryGain;

        const wetGain = ctx.createGain(); // Reverb Gain
        wetGainNodeRef.current = wetGain;
        
        const echoGain = ctx.createGain(); // Echo Gain
        echoGainNodeRef.current = echoGain;

        // --- CONNECT THE GRAPH ---
        // Source -> Denoise -> Bass -> Treble -> (Splits)
        source.connect(denoise);
        denoise.connect(bass);
        bass.connect(treble);

        // Path 1: Dry
        treble.connect(dryGain);
        dryGain.connect(ctx.destination);

        // Path 2: Reverb
        treble.connect(reverb);
        reverb.connect(wetGain);
        wetGain.connect(ctx.destination);

        // Path 3: Echo (Delay loop)
        treble.connect(echo);
        echo.connect(echoFeedback);
        echoFeedback.connect(echo); // Loop
        echo.connect(echoGain);
        echoGain.connect(ctx.destination);

      } catch (e) {
        console.error("Error setting up mixing chain", e);
      }
    }
  }, [audioUrl]);

  // Update Mix Params
  useEffect(() => {
    if (denoiseNodeRef.current) {
       // Denoise simply cuts low end rumble. Scale 0-1 to 0-500Hz
       denoiseNodeRef.current.frequency.value = mixSettings.denoise * 500;
    }
    if (bassNodeRef.current) bassNodeRef.current.gain.value = mixSettings.bass;
    if (trebleNodeRef.current) trebleNodeRef.current.gain.value = mixSettings.treble;
    
    // Balance dry/wet slightly so volume doesn't explode
    // Simplistic mixing logic for MVP
    if (dryGainNodeRef.current) {
       dryGainNodeRef.current.gain.value = 1.0; // Keep dry signal strong usually
    }
    
    if (wetGainNodeRef.current) {
      wetGainNodeRef.current.gain.value = mixSettings.reverb * 1.5; 
    }
    
    if (echoGainNodeRef.current) {
       echoGainNodeRef.current.gain.value = mixSettings.echo;
    }

  }, [mixSettings]);

  // Volume Updates
  useEffect(() => {
    if (recordingAudioRef.current) {
        recordingAudioRef.current.volume = Math.min(Math.max(recordingVolume * masterVolume, 0), 1);
    }
  }, [recordingVolume, masterVolume, audioUrl]);

  useEffect(() => {
    if (beatAudioRef.current) {
      beatAudioRef.current.volume = Math.min(Math.max(beatVolume * masterVolume, 0), 1);
    }
  }, [beatVolume, masterVolume, selectedBeat]);


  // --- UTILS ---
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  useEffect(() => {
    if (isRecording) {
      timerRef.current = window.setInterval(() => {
        setTimer((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleUploadBeat = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      
      // Attempt BPM Detection
      let detectedBpm = 0;
      try {
         const ctx = getAudioContext();
         const buffer = await file.arrayBuffer();
         const audioBuffer = await ctx.decodeAudioData(buffer);
         detectedBpm = await detectBPM(audioBuffer);
      } catch (e) {
         console.warn("BPM detection failed on upload", e);
      }

      const newBeat: Beat = {
        id: `custom-${Date.now()}`,
        title: file.name.replace(/\.[^/.]+$/, "").substring(0, 20),
        bpm: detectedBpm,
        genre: 'Custom',
        url: url,
        coverImage: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?q=80&w=200&auto=format&fit=crop&grayscale'
      };
      
      setBeats(prev => [newBeat, ...prev]);
      setSelectedBeat(newBeat);
      
      if (isPlaying || isPreviewing) {
        if (beatAudioRef.current) {
          beatAudioRef.current.pause();
          beatAudioRef.current.currentTime = 0;
        }
        setIsPlaying(false);
        setIsPreviewing(false);
      }
    }
  };

  const handleDeleteBeat = (e: React.MouseEvent, beatId: string) => {
    e.stopPropagation(); 

    openConfirm(
      "Smazat beat?",
      "Opravdu chceš tento beat trvale odstranit ze seznamu?",
      () => {
        if (selectedBeat?.id === beatId) {
          if (beatAudioRef.current) {
            beatAudioRef.current.pause();
            beatAudioRef.current.currentTime = 0;
          }
          setIsPreviewing(false);
          setIsPlaying(false);
          
          const remainingBeats = beats.filter(b => b.id !== beatId);
          setSelectedBeat(remainingBeats.length > 0 ? remainingBeats[0] : null);
        }
        setBeats(prev => prev.filter(b => b.id !== beatId));
      }
    );
  };

  const handleSelectBeat = (beat: Beat) => {
     if (isRecording) return;
     if (isPreviewing && beatAudioRef.current) {
         beatAudioRef.current.pause();
         beatAudioRef.current.currentTime = 0;
         setIsPreviewing(false);
     }
     setSelectedBeat(beat);
     // Auto-enable metronome if no URL (Metronome only beat)
     if (!beat.url) {
        setMetronomeOn(true);
     }
  };

  const startRecording = async () => {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    if (isPreviewing && beatAudioRef.current) {
      beatAudioRef.current.pause();
      beatAudioRef.current.currentTime = 0;
      setIsPreviewing(false);
    }

    try {
      setPermissionError(null);
      
      const constraints = {
        audio: {
          deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
          echoCancellation: false,
          autoGainControl: false, 
          noiseSuppression: false 
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      const micSource = ctx.createMediaStreamSource(stream);
      
      // INPUT GAIN NODE
      const gainNode = ctx.createGain();
      gainNode.gain.value = inputGain;
      inputGainNodeRef.current = gainNode;
      
      // ANALYSER
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyserMicRef.current = analyser;

      // RECORDING DESTINATION (This allows us to record the gained audio)
      const destination = ctx.createMediaStreamDestination();
      
      // Graph: Mic -> Gain -> Analyser -> Destination
      micSource.connect(gainNode);
      gainNode.connect(analyser);
      gainNode.connect(destination);

      mediaRecorderRef.current = new MediaRecorder(destination.stream);
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        stream.getTracks().forEach(track => track.stop());
        // Clean up nodes
        micSource.disconnect();
        gainNode.disconnect();
        setShowMixer(true); // Auto show mixer on finish
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setTimer(0);
      setRecordedBlob(null);

      // Play beat if URL exists
      if (beatAudioRef.current && selectedBeat?.url) {
        beatAudioRef.current.currentTime = 0;
        beatAudioRef.current.volume = Math.min(Math.max(beatVolume * masterVolume, 0), 1);
        beatAudioRef.current.play();
      }
      setIsPlaying(true);

    } catch (err) {
      console.error("Error accessing microphone:", err);
      setPermissionError("Nemáme přístup k mikrofonu. Povol ho prosím v prohlížeči.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (beatAudioRef.current) {
        beatAudioRef.current.pause();
        beatAudioRef.current.currentTime = 0;
        setIsPlaying(false);
      }
    }
  };

  const togglePlayback = async () => {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') await ctx.resume();

    if (isPlaying) {
      if (beatAudioRef.current) beatAudioRef.current.pause();
      if (recordingAudioRef.current) recordingAudioRef.current.pause();
      setIsPlaying(false);
    } else {
      // Play Back Logic
      if (beatAudioRef.current && selectedBeat?.url) {
        beatAudioRef.current.currentTime = 0;
        beatAudioRef.current.volume = Math.min(Math.max(beatVolume * masterVolume, 0), 1);
        beatAudioRef.current.play();
      }
      
      if (recordingAudioRef.current) {
         recordingAudioRef.current.currentTime = 0;
         recordingAudioRef.current.volume = Math.min(Math.max(recordingVolume * masterVolume, 0), 1);
         recordingAudioRef.current.play();
      }
      setIsPlaying(true);
    }
  };

  const togglePreview = async () => {
    // Allows preview/play even if URL is empty provided metronome is on (practice mode)
    if (!beatAudioRef.current) return;
    if (!selectedBeat?.url && !metronomeOn) return; 

    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    if (isPreviewing) {
      if (selectedBeat?.url) {
         beatAudioRef.current.pause();
         beatAudioRef.current.currentTime = 0;
      }
      setIsPreviewing(false);
    } else {
      if (selectedBeat?.url) {
         beatAudioRef.current.currentTime = 0;
         beatAudioRef.current.volume = Math.min(Math.max(beatVolume * masterVolume, 0), 1);
         beatAudioRef.current.play();
      }
      setIsPreviewing(true);
    }
  };

  // --- MIXDOWN RENDERING ---
  const renderMixdown = async (vocalBuffer: AudioBuffer, beatUrl: string): Promise<Blob | null> => {
      try {
        const offlineCtx = new OfflineAudioContext(2, vocalBuffer.length, vocalBuffer.sampleRate);
        
        // 1. Prepare Vocal Track with Effects
        const vocalSource = offlineCtx.createBufferSource();
        vocalSource.buffer = vocalBuffer;

        // Recreate effects chain in offline context
        const denoise = offlineCtx.createBiquadFilter();
        denoise.type = 'highpass';
        denoise.frequency.value = mixSettings.denoise * 500;

        const bass = offlineCtx.createBiquadFilter();
        bass.type = 'lowshelf';
        bass.frequency.value = 200;
        bass.gain.value = mixSettings.bass;

        const treble = offlineCtx.createBiquadFilter();
        treble.type = 'highshelf';
        treble.frequency.value = 2000;
        treble.gain.value = mixSettings.treble;

        // Effect Routing (Simplified for Mixdown - Parallel paths hard to manage without full graph, using direct chain + sends)
        // Note: For pure accuracy we should replicate exact graph. Here we'll do linear + reverb mix.
        
        const dryGain = offlineCtx.createGain();
        dryGain.gain.value = recordingVolume; // Base volume

        // Reverb Send
        const reverb = offlineCtx.createConvolver();
        reverb.buffer = createImpulseResponse(offlineCtx, 2, 2);
        const reverbGain = offlineCtx.createGain();
        reverbGain.gain.value = mixSettings.reverb * 1.5;

        // Echo Send
        const echo = offlineCtx.createDelay();
        echo.delayTime.value = 0.3;
        const echoFb = offlineCtx.createGain();
        echoFb.gain.value = 0.3;
        const echoGain = offlineCtx.createGain();
        echoGain.gain.value = mixSettings.echo;

        // Graph Wiring
        vocalSource.connect(denoise);
        denoise.connect(bass);
        bass.connect(treble);
        
        // Dry Path
        treble.connect(dryGain);
        dryGain.connect(offlineCtx.destination);
        
        // Wet Paths
        treble.connect(reverb);
        reverb.connect(reverbGain);
        reverbGain.connect(offlineCtx.destination);

        treble.connect(echo);
        echo.connect(echoFb);
        echoFb.connect(echo);
        echo.connect(echoGain);
        echoGain.connect(offlineCtx.destination);

        vocalSource.start(0);

        // 2. Prepare Beat Track (if exists)
        if (beatUrl) {
            try {
                const response = await fetch(beatUrl);
                const arrayBuffer = await response.arrayBuffer();
                const beatBuffer = await offlineCtx.decodeAudioData(arrayBuffer);
                
                const beatSource = offlineCtx.createBufferSource();
                beatSource.buffer = beatBuffer;
                
                // LOOPING LOGIC FOR MIXDOWN
                if (isLooping) {
                  beatSource.loop = true;
                  if (loopMode !== 'full') {
                     // Calculate loop duration in seconds
                     const bpm = selectedBeat?.bpm || 120;
                     const loopSeconds = (60 / bpm) * 4 * loopMode;
                     beatSource.loopEnd = loopSeconds;
                  }
                }

                const beatGain = offlineCtx.createGain();
                beatGain.gain.value = beatVolume;
                
                beatSource.connect(beatGain);
                beatGain.connect(offlineCtx.destination);
                beatSource.start(0);
            } catch (e) {
                console.warn("Could not mix beat into final export", e);
            }
        }

        const renderedBuffer = await offlineCtx.startRendering();
        
        // Convert to WAV/WebM blob - Simplest for browser is usually just encoding buffer to WAV
        // For this MVP, we will stick to a basic WAV encoder helper or just resolve logic.
        // Since writing a WAV encoder is verbose, and `audio/webm` recording is what we usually have,
        // we can't easily turn an AudioBuffer back to WebM without a library.
        // However, we can trick it by playing it into a MediaRecorder or using a WAV encoder.
        
        // SIMPLE WAV ENCODER implementation for mixdown
        return bufferToWav(renderedBuffer);

      } catch (e) {
          console.error("Mixdown failed", e);
          return null;
      }
  };

  // Basic WAV Encoder
  const bufferToWav = (buffer: AudioBuffer): Blob => {
     const numOfChan = buffer.numberOfChannels;
     const length = buffer.length * numOfChan * 2 + 44;
     const bufferArr = new ArrayBuffer(length);
     const view = new DataView(bufferArr);
     const channels = [];
     let i;
     let sample;
     let offset = 0;
     let pos = 0;
   
     // write WAVE header
     setUint32(0x46464952);                         // "RIFF"
     setUint32(length - 8);                         // file length - 8
     setUint32(0x45564157);                         // "WAVE"
   
     setUint32(0x20746d66);                         // "fmt " chunk
     setUint32(16);                                 // length = 16
     setUint16(1);                                  // PCM (uncompressed)
     setUint16(numOfChan);
     setUint32(buffer.sampleRate);
     setUint32(buffer.sampleRate * 2 * numOfChan);  // avg. bytes/sec
     setUint16(numOfChan * 2);                      // block-align
     setUint16(16);                                 // 16-bit (hardcoded in this example)
   
     setUint32(0x61746164);                         // "data" - chunk
     setUint32(length - pos - 4);                   // chunk length
   
     // write interleaved data
     for(i = 0; i < buffer.numberOfChannels; i++)
       channels.push(buffer.getChannelData(i));
   
     while(pos < buffer.length) {
       for(i = 0; i < numOfChan; i++) {             // interleave channels
         sample = Math.max(-1, Math.min(1, channels[i][pos])); // clamp
         sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767)|0; // scale to 16-bit signed int
         view.setInt16(44 + offset, sample, true);          // write 16-bit sample
         offset += 2;
       }
       pos++;
     }
   
     return new Blob([bufferArr], { type: 'audio/wav' });
   
     function setUint16(data: any) {
       view.setUint16(pos, data, true);
       pos += 2;
     }
   
     function setUint32(data: any) {
       view.setUint32(pos, data, true);
       pos += 4;
     }
  }


  const handleSave = async () => {
    if (!selectedBeat || !audioUrl || !recordedBlob) return;
    
    setIsSaving(true);
    try {
      // MIXDOWN PROCESS
      let finalBlob = recordedBlob;
      if (recordedBuffer) {
         // Attempt mixdown
         const mixedBlob = await renderMixdown(recordedBuffer, selectedBeat.url);
         if (mixedBlob) {
             finalBlob = mixedBlob;
         }
      }

      const base64Audio = await blobToBase64(finalBlob);

      const newRecording: Recording = {
        id: Date.now().toString(),
        beatId: selectedBeat.id,
        beatTitle: selectedBeat.title,
        name: `Track ${new Date().toLocaleTimeString()} (Mix)`,
        date: new Date().toLocaleDateString(),
        blobUrl: base64Audio,
        duration: timer
      };

      onSaveRecording(newRecording);
      setRecordedBlob(null);
      setAudioUrl(null);
      setTimer(0);
      setMixSettings({ bass: 0, treble: 0, reverb: 0, echo: 0, denoise: 0 }); 
      setRecordingVolume(1);
      setShowMixer(false);
      openAlert("Uloženo!", "Tvůj track (včetně mixu) byl úspěšně uložen do profilu.");
    } catch (error) {
      console.error("Error saving recording", error);
      openAlert("Chyba", "Chyba při ukládání nahrávky.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="pt-4 pb-24 px-4 max-w-6xl mx-auto md:pt-24 relative">
      
      <Modal 
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
        onConfirm={modalConfig.onConfirm}
        onCancel={closeDialog}
      />

      {/* --- SMART MENU / TOOLS DRAWER (LEFT SIDE) --- */}
      <div 
        className={`fixed top-0 left-0 h-full w-full md:w-80 bg-white border-r-4 border-black shadow-[5px_0_0_0_rgba(0,0,0,0.1)] z-[60] transform transition-transform duration-300 ease-in-out ${showTools ? 'translate-x-0' : '-translate-x-full'}`}
      >
         <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-4 border-b-4 border-black bg-black text-white flex justify-between items-center">
               <h3 className="font-black uppercase text-xl flex gap-2 items-center"><Menu /> Studio Tools</h3>
               <button onClick={() => setShowTools(false)} className="hover:text-brand-pink"><X /></button>
            </div>

            <div className="flex-grow overflow-y-auto p-4 space-y-8">
               
               {/* INPUT SETTINGS */}
               <div className="border-3 border-black p-4 bg-gray-50 shadow-hard-sm">
                  <h4 className="font-bold uppercase flex items-center gap-2 mb-4 text-sm"><Settings size={16}/> Nastavení Vstupu</h4>
                  
                  <div className="space-y-4">
                      <div>
                        <label className="text-xs font-bold uppercase block mb-1">Mikrofon</label>
                        <select 
                           value={selectedDeviceId} 
                           onChange={(e) => setSelectedDeviceId(e.target.value)}
                           className="w-full text-xs font-bold border-2 border-black p-2 bg-white"
                        >
                           {inputDevices.length === 0 && <option value="">Výchozí mikrofon</option>}
                           {inputDevices.map(device => (
                              <option key={device.deviceId} value={device.deviceId}>
                                 {device.label || `Mikrofon ${device.deviceId.slice(0,5)}...`}
                              </option>
                           ))}
                        </select>
                      </div>
                      
                      <div>
                         <label className="text-xs font-bold uppercase block mb-1 flex justify-between">
                            <span>Input Gain</span>
                            <span>{Math.round(inputGain * 100)}%</span>
                         </label>
                         <input 
                            type="range" min="0" max="2" step="0.1" 
                            value={inputGain} 
                            onChange={(e) => setInputGain(parseFloat(e.target.value))}
                            className="w-full h-2 bg-gray-300 accent-black"
                         />
                      </div>
                  </div>
               </div>


               {/* Metronome Section */}
               <div className="border-3 border-black p-4 bg-gray-50 shadow-hard-sm">
                  <div className="flex justify-between items-center mb-4">
                     <h4 className="font-bold uppercase flex items-center gap-2 text-sm"><Activity size={16}/> Metronom</h4>
                     <button 
                        onClick={() => setMetronomeOn(!metronomeOn)}
                        className={`w-12 h-6 rounded-full border-2 border-black flex items-center transition-all ${metronomeOn ? 'bg-green-400 justify-end' : 'bg-gray-300 justify-start'}`}
                     >
                        <div className="w-4 h-4 bg-white border-2 border-black rounded-full mx-1"></div>
                     </button>
                  </div>
                  <div className="space-y-2">
                     <label className="text-xs font-bold uppercase">Hlasitost Metronomu</label>
                     <input 
                        type="range" min="0" max="1" step="0.1" 
                        value={metronomeVolume} 
                        onChange={(e) => setMetronomeVolume(parseFloat(e.target.value))}
                        className="w-full h-2 bg-black accent-brand-pink"
                     />
                  </div>
                  <div className="mt-2 text-xs font-mono">
                     BPM: {selectedBeat?.bpm || 120} (Auto-sync)
                  </div>
               </div>

               {/* Loop Toggle & Options */}
               <div className="border-3 border-black p-4 bg-gray-50 shadow-hard-sm">
                 <button
                    onClick={() => setIsLooping(!isLooping)}
                    className={`w-full flex items-center justify-between font-bold uppercase transition-all mb-4`}
                  >
                    <span className="flex items-center gap-2 text-sm"><Repeat size={16} /> Loop Beat</span>
                    <div className={`w-10 h-5 rounded-full border-2 border-black flex items-center px-1 ${isLooping ? 'bg-brand-cyan justify-end' : 'bg-white justify-start'}`}>
                        <div className="w-3 h-3 bg-black rounded-full"></div>
                    </div>
                 </button>
                 
                 {isLooping && (
                    <div className="grid grid-cols-2 gap-2">
                       {[4, 8, 16].map((bars) => (
                          <button 
                            key={bars}
                            onClick={() => setLoopMode(bars as LoopMode)}
                            className={`p-2 text-xs font-black border-2 border-black uppercase transition-all ${loopMode === bars ? 'bg-black text-white' : 'bg-white text-black hover:bg-gray-200'}`}
                          >
                             {bars} Bars
                          </button>
                       ))}
                       <button 
                          onClick={() => setLoopMode('full')}
                          className={`p-2 text-xs font-black border-2 border-black uppercase transition-all ${loopMode === 'full' ? 'bg-black text-white' : 'bg-white text-black hover:bg-gray-200'}`}
                       >
                          Full Song
                       </button>
                    </div>
                 )}
               </div>

               {/* Lyrics Toggle */}
               <button 
                  onClick={() => { setShowLyrics(!showLyrics); setShowTools(false); }}
                  className="w-full flex items-center justify-between p-3 border-3 border-black font-bold uppercase bg-brand-yellow shadow-hard-sm hover:translate-x-1"
               >
                  <span className="flex items-center gap-2 text-sm"><FileText size={16} /> Textař</span>
                  <span className="text-xs">{showLyrics ? 'ZAVŘÍT' : 'OTEVŘÍT'}</span>
               </button>

               {/* Beat Library */}
               <div>
                  <h4 className="font-black uppercase mb-2 border-b-2 border-black pb-1 text-sm">Knihovna Beatů</h4>
                  <label className="cursor-pointer block w-full bg-black text-white p-3 text-center font-bold uppercase hover:bg-gray-800 border-2 border-transparent transition-all shadow-hard-sm text-sm mb-4">
                     <span className="flex items-center justify-center gap-2"><Upload size={16} /> Nahrát vlastní</span>
                     <input type="file" accept="audio/*" onChange={handleUploadBeat} className="hidden" />
                  </label>

                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                     {beats.map(beat => (
                        <div 
                           key={beat.id}
                           onClick={() => { handleSelectBeat(beat); }}
                           className={`p-2 cursor-pointer border-2 transition-all flex items-center justify-between ${selectedBeat?.id === beat.id ? 'bg-brand-cyan border-black' : 'bg-white border-gray-300 hover:border-black'}`}
                        >
                           <div className="truncate pr-2">
                              <div className="font-bold text-xs uppercase truncate">{beat.title}</div>
                              <div className="text-[10px] font-mono">{beat.bpm > 0 ? beat.bpm + ' BPM' : (beat.url ? 'CUSTOM' : 'METRONOME')}</div>
                           </div>
                           {beat.id.startsWith('custom-') && (
                              <button onClick={(e) => handleDeleteBeat(e, beat.id)} className="text-red-500 hover:bg-red-100 p-1"><Trash2 size={14}/></button>
                           )}
                        </div>
                     ))}
                  </div>
               </div>

            </div>
         </div>
      </div>

      {/* --- LYRICS DRAWER (RIGHT SIDE) --- */}
      <div 
        className={`fixed top-0 right-0 h-full w-full md:w-96 bg-white border-l-4 border-black shadow-[-5px_0_0_0_rgba(0,0,0,0.1)] z-[60] transform transition-transform duration-300 ease-in-out ${showLyrics ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex flex-col h-full bg-white">
          <div className="flex justify-between items-center p-4 border-b-4 border-black bg-brand-yellow">
            <h3 className="text-xl font-black uppercase flex items-center gap-2">
              <FileText size={24} /> Textař
            </h3>
            <button onClick={() => setShowLyrics(false)} className="hover:bg-black hover:text-white p-1 transition-colors">
              <X size={28} strokeWidth={3} />
            </button>
          </div>

          <div className="flex justify-between items-center p-2 bg-gray-100 border-b-4 border-black">
             <div className="relative group flex-grow mr-2">
                {isRenaming ? (
                  <form onSubmit={handleRenameSubmit} className="flex">
                    <input 
                      autoFocus
                      className="w-full text-sm font-bold border-2 border-black p-1 uppercase"
                      value={getActiveSheet()?.title}
                      onChange={(e) => updateActiveSheet({ title: e.target.value })}
                      onBlur={() => setIsRenaming(false)}
                    />
                    <button type="submit" className="bg-black text-white p-1 ml-1"><Check size={16}/></button>
                  </form>
                ) : (
                  <div className="flex items-center">
                    <button className="flex items-center gap-1 font-bold text-sm bg-white border-2 border-black px-2 py-1 shadow-hard-sm uppercase max-w-[120px] md:max-w-none truncate">
                      {getActiveSheet()?.title || 'Vybrat text'} <ChevronDown size={14} />
                    </button>
                    <button onClick={() => setIsRenaming(true)} className="ml-2 p-1 hover:bg-gray-200" title="Přejmenovat">
                       <Sliders size={14} className="transform rotate-90" /> {/* Using slider icon as pencil approx */}
                    </button>
                    {/* Dropdown content */}
                    <div className="absolute top-full left-0 w-48 bg-white border-2 border-black shadow-hard hidden group-hover:block z-50">
                      {lyricSheets.map(sheet => (
                        <button 
                          key={sheet.id}
                          onClick={() => setActiveLyricId(sheet.id)}
                          className={`w-full text-left px-3 py-2 text-sm font-bold border-b border-gray-200 hover:bg-brand-cyan ${sheet.id === activeLyricId ? 'bg-gray-100' : ''}`}
                        >
                          {sheet.title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
             </div>
             
             <div className="flex gap-2">
               <button onClick={handleNewSheet} className="p-1 bg-white border-2 border-black shadow-hard-sm hover:bg-green-100" title="Nový text"><Plus size={18} /></button>
               <button onClick={handleDeleteSheet} className="p-1 bg-white border-2 border-black shadow-hard-sm hover:bg-red-100" title="Smazat text"><Trash2 size={18} /></button>
             </div>
          </div>

          {showFlowAdvice && !flowAdviceDismissed && (
             <div className="m-4 p-3 bg-brand-cyan border-2 border-black shadow-hard-sm">
                <div className="flex justify-between items-start">
                  <h4 className="font-black uppercase text-sm mb-1">Tip na Flow</h4>
                  <button onClick={dismissFlowAdvice}><X size={14}/></button>
                </div>
                <p className="text-xs font-bold leading-tight">Pozor, skáčeš mezi řádky o hodně slabik!</p>
             </div>
          )}

          <textarea
            className="flex-grow w-full p-4 text-lg font-mono resize-none focus:outline-none bg-yellow-50"
            placeholder="Piš text sem..."
            value={getActiveSheet()?.content || ''}
            onChange={(e) => updateActiveSheet({ content: e.target.value })}
          />
          
          <div className="p-2 border-t-4 border-black bg-white flex justify-between items-center text-xs font-bold uppercase font-mono">
             <span>BARS: {getStats().lines}</span>
             <span>SYLABY: {getStats().syllables}</span>
          </div>
        </div>
      </div>


      {/* --- MAIN STAGE --- */}
      <div className="bg-white border-4 border-black shadow-hard relative min-h-[500px] flex flex-col">
         
         {/* Top Bar inside Studio */}
         <div className="flex justify-between items-center p-4 border-b-4 border-black bg-gray-50">
            <div>
               <h1 className="text-xl md:text-2xl font-black uppercase tracking-tight flex items-center gap-2">
                  <Music className="text-brand-cyan" fill="black" /> 
                  {selectedBeat?.title || "NO BEAT"}
               </h1>
            </div>
            <div className="flex items-center gap-4">
               {/* Audio Element (Hidden mostly) */}
               <audio 
                  ref={beatAudioRef} 
                  src={selectedBeat?.url || ''} 
                  loop={isLooping && loopMode === 'full'} 
                  crossOrigin="anonymous"
                  onEnded={() => {
                     // Only stop if not looping full song. 
                     // If looping segments, drawVisualizer handles the loop.
                     if(!isLooping) {
                        if(isRecording) stopRecording();
                        setIsPlaying(false);
                        setIsPreviewing(false);
                     }
                  }}
               />
               <Button onClick={() => setShowTools(!showTools)} size="sm" variant="black" className="flex items-center gap-2">
                  <Menu size={18} /> <span className="hidden md:inline">STUDIO TOOLS</span>
               </Button>
            </div>
         </div>

         {/* VISUALIZER HERO */}
         <div className="relative flex-grow bg-white flex flex-col justify-center items-center overflow-hidden">
            {/* Main real-time canvas */}
            <canvas 
               ref={canvasRef} 
               width={1200} 
               height={400} 
               className={`w-full h-full object-cover absolute inset-0 z-0 ${audioUrl ? 'opacity-20' : 'opacity-100'}`}
            />
            
            {/* POST-RECORDING STATIC WAVEFORM */}
            {audioUrl && (
              <div className="absolute inset-0 z-10 flex items-center justify-center p-4">
                 <div className="w-full max-w-4xl h-32 md:h-48 border-4 border-black bg-white shadow-hard relative">
                    <canvas 
                      ref={waveformCanvasRef}
                      width={1000}
                      height={200}
                      className="w-full h-full"
                    />
                    <div className="absolute top-0 left-0 bg-brand-cyan text-black font-black text-xs px-2 border-r-2 border-b-2 border-black">
                      NAHRÁVKA
                    </div>
                 </div>
              </div>
            )}
            
            {/* Overlay Info (Pre-recording) */}
            <div className="relative z-10 text-center pointer-events-none">
               {!isRecording && !audioUrl && (
                  <div className="bg-white border-4 border-black p-4 shadow-hard inline-block transform -rotate-2">
                     <p className="font-black uppercase text-xl">Připraveno</p>
                     <p className="font-mono text-sm">{selectedBeat?.bpm || '?'} BPM</p>
                  </div>
               )}
            </div>
         </div>

         {/* TRANSPORT CONTROLS BAR */}
         <div className="border-t-4 border-black bg-white p-4 md:p-6 relative z-20">
            
            <div className="flex flex-col items-center">
               {/* Timer */}
               <div className="text-5xl font-mono font-black mb-6 tracking-widest bg-black text-white px-4 border-4 border-transparent">
                  {formatTime(timer)}
               </div>

               <div className="flex justify-center items-center gap-6 md:gap-12 w-full">
                  
                  {/* PRE-RECORDING CONTROLS */}
                  {!audioUrl ? (
                     <>
                        <button 
                           onClick={togglePreview}
                           disabled={!selectedBeat?.url && !metronomeOn}
                           className={`w-16 h-16 border-4 border-black shadow-hard flex items-center justify-center transition-all ${(!selectedBeat?.url && !metronomeOn) ? 'opacity-50 cursor-not-allowed bg-gray-200' : isPreviewing ? 'bg-brand-cyan translate-y-1 shadow-none' : 'bg-white hover:bg-gray-100'}`}
                           title="Preview Beat"
                        >
                           {isPreviewing ? <Square fill="black"/> : <Play fill="black"/>}
                        </button>

                        <button 
                           onClick={isRecording ? stopRecording : startRecording}
                           className={`w-24 h-24 border-4 border-black rounded-full shadow-hard flex items-center justify-center transition-all active:translate-y-1 active:shadow-none ${isRecording ? 'bg-white' : 'bg-red-600 hover:bg-red-500'}`}
                        >
                           {isRecording ? (
                              <div className="w-8 h-8 bg-black"></div>
                           ) : (
                              <div className="w-8 h-8 bg-white rounded-full"></div>
                           )}
                        </button>

                        <div className="w-16 h-16 flex items-center justify-center">
                           <Activity className={metronomeOn ? "text-green-500 animate-pulse" : "text-gray-300"} />
                        </div>
                     </>
                  ) : (
                     /* POST-RECORDING CONTROLS */
                     <div className="flex items-center gap-6 w-full justify-center">
                        <button 
                           onClick={() => {
                              setAudioUrl(null);
                              setRecordedBlob(null);
                              setRecordedBuffer(null);
                              setTimer(0);
                              setIsPlaying(false);
                              setShowMixer(false);
                           }} 
                           title="Zahodit"
                           className="w-20 h-20 bg-white text-red-600 border-4 border-black hover:bg-red-50 shadow-hard flex items-center justify-center transition-all active:translate-y-1 active:shadow-none"
                        >
                           <Trash2 size={32} strokeWidth={2.5}/>
                        </button>

                        <button 
                           onClick={togglePlayback}
                           title={isPlaying ? "Stop" : "Přehrát"}
                           className="w-20 h-20 bg-brand-cyan border-4 border-black shadow-hard flex items-center justify-center hover:bg-cyan-400 transition-all active:translate-y-1 active:shadow-none"
                        >
                           {isPlaying ? <Square size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" />}
                        </button>

                        <button 
                           onClick={handleSave}
                           title="Uložit a Mixovat"
                           className="w-20 h-20 bg-black text-white border-4 border-black hover:bg-gray-900 shadow-hard flex items-center justify-center transition-all active:translate-y-1 active:shadow-none"
                        >
                           {isSaving ? <RefreshCw className="animate-spin" size={32}/> : <Check size={36} strokeWidth={3}/>}
                        </button>
                     </div>
                  )}
               </div>
            </div>

            {/* Mixer Toggle (Only if audio exists) */}
            {audioUrl && (
               <div className="mt-8 flex justify-center">
                  <button onClick={() => setShowMixer(!showMixer)} className="font-bold uppercase text-xs flex items-center gap-2 border-b-2 border-black pb-1 hover:text-brand-pink">
                     <Sliders size={14}/> {showMixer ? 'Skrýt Mixážní Pult' : 'KONTROLA'}
                  </button>
               </div>
            )}
         </div>

         {/* COLLAPSIBLE MIXER PANEL */}
         {audioUrl && showMixer && (
             <div className="bg-gray-100 border-t-4 border-black p-6 animate-in slide-in-from-bottom-10 fade-in">
                
                {/* PRESETS TOOLBAR */}
                <div className="max-w-4xl mx-auto mb-6 pb-6 border-b-2 border-gray-300">
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="font-black uppercase text-sm flex items-center gap-2"><LayoutTemplate size={16}/> Presets</h4>
                        {!isSavingPreset ? (
                           <button onClick={() => setIsSavingPreset(true)} className="bg-black text-white px-3 py-1 text-xs font-bold uppercase flex items-center gap-2 hover:bg-gray-800 transition-colors">
                             <Save size={14}/> Uložit aktuální
                           </button>
                        ) : (
                           <div className="flex gap-2">
                              <input 
                                autoFocus
                                value={newPresetName} 
                                onChange={(e) => setNewPresetName(e.target.value)}
                                placeholder="Název presetu..."
                                className="border-2 border-black p-1 text-xs font-bold uppercase w-32 md:w-48"
                              />
                              <button onClick={handleSavePreset} className="bg-brand-cyan border-2 border-black px-2 hover:bg-cyan-400"><Check size={14}/></button>
                              <button onClick={() => setIsSavingPreset(false)} className="bg-white border-2 border-black px-2 hover:bg-red-100 text-red-600"><X size={14}/></button>
                           </div>
                        )}
                    </div>
                    
                    <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                       {presets.map(preset => (
                          <div key={preset.id} className="flex-shrink-0 group relative">
                             <button 
                                onClick={() => handleLoadPreset(preset)}
                                className="px-4 py-2 bg-white border-2 border-black shadow-hard-sm text-xs font-bold uppercase hover:bg-brand-yellow hover:-translate-y-1 transition-all whitespace-nowrap"
                             >
                                {preset.name}
                             </button>
                             {!preset.isDefault && (
                                <button 
                                  onClick={(e) => handleDeletePreset(e, preset.id)}
                                  className="absolute -top-2 -right-2 bg-red-500 text-white p-1 border-2 border-black rounded-full opacity-0 group-hover:opacity-100 transition-opacity transform scale-75 hover:scale-100"
                                >
                                   <Trash2 size={10} />
                                </button>
                             )}
                          </div>
                       ))}
                    </div>
                </div>

                <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
                  {/* Master Volume */}
                  <div className="text-center col-span-2 md:col-span-4 border-b-2 border-gray-300 pb-4 mb-2">
                     <label className="block text-sm font-black uppercase mb-2">Master Volume</label>
                     <input type="range" min="0" max="1.5" step="0.1" value={masterVolume} onChange={(e) => setMasterVolume(parseFloat(e.target.value))} className="w-full md:w-1/2 accent-black h-4"/>
                  </div>

                  <div className="text-center">
                     <label className="block text-xs font-bold uppercase mb-2 text-brand-cyan">Beat Volume</label>
                     <input type="range" min="0" max="1.2" step="0.1" value={beatVolume} onChange={(e) => setBeatVolume(parseFloat(e.target.value))} className="w-full accent-brand-cyan"/>
                  </div>
                  <div className="text-center">
                     <label className="block text-xs font-bold uppercase mb-2 text-brand-pink">Vocal Volume</label>
                     <input type="range" min="0" max="1.5" step="0.1" value={recordingVolume} onChange={(e) => setRecordingVolume(parseFloat(e.target.value))} className="w-full accent-brand-pink"/>
                  </div>
                  
                  {/* EQ & FX */}
                  <div className="text-center">
                     <label className="block text-xs font-bold uppercase mb-2">Bass / Treble</label>
                     <div className="flex gap-2">
                        <input type="range" min="-10" max="10" step="1" title="Bass" value={mixSettings.bass} onChange={(e) => setMixSettings({...mixSettings, bass: parseFloat(e.target.value)})} className="w-full accent-gray-600"/>
                        <input type="range" min="-10" max="10" step="1" title="Treble" value={mixSettings.treble} onChange={(e) => setMixSettings({...mixSettings, treble: parseFloat(e.target.value)})} className="w-full accent-gray-400"/>
                     </div>
                  </div>
                  
                  <div className="text-center">
                     <label className="block text-xs font-bold uppercase mb-2 text-purple-600">Reverb / Echo</label>
                     <div className="flex gap-2">
                        <input type="range" min="0" max="0.8" step="0.05" title="Reverb" value={mixSettings.reverb} onChange={(e) => setMixSettings({...mixSettings, reverb: parseFloat(e.target.value)})} className="w-full accent-purple-600"/>
                        <input type="range" min="0" max="0.8" step="0.05" title="Echo" value={mixSettings.echo} onChange={(e) => setMixSettings({...mixSettings, echo: parseFloat(e.target.value)})} className="w-full accent-blue-600"/>
                     </div>
                  </div>

                  <div className="text-center">
                     <label className="block text-xs font-bold uppercase mb-2 text-green-600">Denoise (Low Cut)</label>
                     <input type="range" min="0" max="1" step="0.1" value={mixSettings.denoise} onChange={(e) => setMixSettings({...mixSettings, denoise: parseFloat(e.target.value)})} className="w-full accent-green-600"/>
                  </div>

                </div>
                
                {/* Invisible audio element for recording playback */}
                <audio 
                   ref={recordingAudioRef} 
                   src={audioUrl} 
                   onEnded={() => {
                      setIsPlaying(false);
                      if(beatAudioRef.current) {
                         beatAudioRef.current.pause();
                         beatAudioRef.current.currentTime = 0;
                      }
                   }}
                />
             </div>
         )}
      </div>
      
      {permissionError && (
          <div className="mt-6 p-4 bg-red-100 text-red-700 font-bold border-4 border-red-600 text-center uppercase">
            {permissionError}
          </div>
      )}
      
      <div className="mt-4 text-center font-bold text-xs text-gray-400 uppercase tracking-[0.2em]">
         Zkušebna Studio v1.1
      </div>

    </div>
  );
};
