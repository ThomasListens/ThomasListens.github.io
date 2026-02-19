import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { parseEDF, identifyShafts, computeBipolarPairs } from './edf.js';
import { BANDS, computeBandEnvelopes } from './dsp.js';
import { SonificationEngine, parseRatio, VOICE_MODES, DEFAULT_VOICE_MODE } from './audio.js';
import { MasterPanel } from './MasterPanel.jsx';
import { WaveformCanvas } from './WaveformCanvas.jsx';

const FONT = "'JetBrains Mono', 'IBM Plex Mono', 'Fira Code', monospace";
const VOICE_KEYS = Object.keys(VOICE_MODES);

export default function App() {
  const [edfData, setEdfData] = useState(null);
  const [fileName, setFileName] = useState('');
  const [shaftChannels, setShaftChannels] = useState([]);
  const [selectedShaft, setSelectedShaft] = useState('');
  const [availableShafts, setAvailableShafts] = useState([]);
  const [shaftMap, setShaftMap] = useState({});
  const [channelStates, setChannelStates] = useState({});
  const [activeBands, setActiveBands] = useState(BANDS.map(() => true));
  const [isPlaying, setIsPlaying] = useState(false);
  const [playheadPct, setPlayheadPct] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [customRatios, setCustomRatios] = useState({});
  const [fundamentalHz, setFundamentalHz] = useState(220);
  const [viewStart, setViewStart] = useState(0);
  const [viewEnd, setViewEnd] = useState(1);
  const [isLooping, setIsLooping] = useState(false);
  const [verticalZoom, setVerticalZoom] = useState(1.0);
  const [scaleMode, setScaleMode] = useState('fit');
  const [voiceModes, setVoiceModes] = useState({});      // { label: 'sine' | ... }
  const [globalVoiceMode, setGlobalVoiceMode] = useState(DEFAULT_VOICE_MODE);

  const engineRef = useRef(new SonificationEngine());

  // ─── Load EDF ─────────────────────────────────────────────
  const handleFile = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const edf = parseEDF(ev.target.result);
      setEdfData(edf);

      const map = identifyShafts(edf.signals);
      setShaftMap(map);

      const shaftNames = Object.keys(map).sort();
      setAvailableShafts(shaftNames);

      if (shaftNames.length > 0) {
        doSelectShaft(shaftNames[0], map);
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const doSelectShaft = useCallback((name, mapOverride) => {
    const map = mapOverride || shaftMap;
    const contacts = map[name];
    if (!contacts) return;

    setSelectedShaft(name);
    const pairs = computeBipolarPairs(contacts);
    setShaftChannels(pairs);

    const states = {};
    const ratios = {};
    const modes = {};
    pairs.forEach((p, i) => {
      states[p.label] = true;
      ratios[p.label] = `${i + 1}/1`;
      modes[p.label] = globalVoiceMode;
    });
    setChannelStates(states);
    setCustomRatios(ratios);
    setVoiceModes(modes);
  }, [shaftMap, globalVoiceMode]);

  // When global voice mode changes, update all channels
  const handleGlobalVoiceModeChange = useCallback((mode) => {
    setGlobalVoiceMode(mode);
    setVoiceModes((prev) => {
      const next = {};
      Object.keys(prev).forEach((k) => { next[k] = mode; });
      return next;
    });
  }, []);

  // ─── Band envelopes (memoized) ────────────────────────────
  const bandEnvelopes = useMemo(() => {
    const result = {};
    shaftChannels.forEach((ch) => {
      result[ch.label] = computeBandEnvelopes(ch.data, ch.fs);
    });
    return result;
  }, [shaftChannels]);

  const sharedPeak = useMemo(() => {
    if (!shaftChannels.length) return null;
    const active = shaftChannels.filter((ch) => channelStates[ch.label]);
    if (!active.length) return null;

    const allDeviations = [];
    active.forEach((ch) => {
      const s = Math.floor(viewStart * ch.data.length);
      const e = Math.floor(viewEnd * ch.data.length);
      const len = e - s;
      const step = Math.max(1, Math.floor(len / 3000));
      let sum = 0, count = 0;
      for (let i = s; i < e; i += step) { sum += ch.data[i]; count++; }
      const mean = count > 0 ? sum / count : 0;
      for (let i = s; i < e; i += step) {
        allDeviations.push(Math.abs(ch.data[i] - mean));
      }
    });

    allDeviations.sort((a, b) => a - b);
    return allDeviations[Math.floor(allDeviations.length * 0.995)] || 1;
  }, [shaftChannels, channelStates, viewStart, viewEnd]);

  // ─── View change ──────────────────────────────────────────
  const handleViewChange = useCallback((start, end) => {
    setViewStart(start);
    setViewEnd(end);
  }, []);

  const handleSeek = useCallback((pct) => {
    setPlayheadPct(pct);
    const engine = engineRef.current;
    if (isPlaying) {
      engine.seekTo(pct);
    }
  }, [isPlaying]);

  // ─── Master sum ───────────────────────────────────────────
  const masterSum = useMemo(() => {
    if (!shaftChannels.length) return null;
    const active = shaftChannels.filter((ch) => channelStates[ch.label]);
    if (!active.length) return new Float32Array(shaftChannels[0].data.length);
    const sum = new Float32Array(active[0].data.length);
    active.forEach((ch) => {
      for (let i = 0; i < sum.length; i++) {
        sum[i] += ch.data[i] / active.length;
      }
    });
    return sum;
  }, [shaftChannels, channelStates]);

  // ─── Playback ─────────────────────────────────────────────
  const togglePlayback = useCallback(() => {
    const engine = engineRef.current;

    if (isPlaying) {
      engine.stop();
      setIsPlaying(false);
      return;
    }

    if (!shaftChannels.length) return;

    engine.start({
      channels: shaftChannels,
      ratios: customRatios,
      fundamentalHz,
      playbackRate,
      channelStates,
      voiceModes,
      bandEnvelopes,
      startPct: playheadPct,
      loopStart: isLooping ? viewStart : null,
      loopEnd: isLooping ? viewEnd : null,
      onProgress: (pct) => setPlayheadPct(pct),
      onEnd: () => {
        setIsPlaying(false);
      },
    });
    setIsPlaying(true);
  }, [isPlaying, shaftChannels, customRatios, fundamentalHz, playbackRate,
      channelStates, voiceModes, bandEnvelopes, playheadPct, isLooping, viewStart, viewEnd]);

  // ─── Cleanup ──────────────────────────────────────────────
  useEffect(() => {
    return () => engineRef.current.dispose();
  }, []);

  // ─── Vertical zoom with Ctrl+wheel ────────────────────────
  const handleTrackWheel = useCallback((e) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const factor = e.deltaY > 0 ? 0.85 : 1.15;
      setVerticalZoom((prev) => Math.min(20, Math.max(0.1, prev * factor)));
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left) / rect.width;
      const zoomFactor = e.deltaY > 0 ? 1.15 : 0.85;
      const width = viewEnd - viewStart;
      let newWidth = Math.min(1, Math.max(0.005, width * zoomFactor));
      const absX = viewStart + mouseX * width;
      const r = (absX - viewStart) / width;
      let newStart = absX - r * newWidth;
      let newEnd = newStart + newWidth;
      if (newStart < 0) { newStart = 0; newEnd = newWidth; }
      if (newEnd > 1) { newEnd = 1; newStart = 1 - newWidth; }
      setViewStart(newStart);
      setViewEnd(newEnd);
    }
  }, [viewStart, viewEnd]);

  const toggleChannel = (label) => {
    setChannelStates((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const toggleBand = (idx) => {
    setActiveBands((prev) => {
      const next = [...prev];
      next[idx] = !next[idx];
      return next;
    });
  };

  const cycleVoiceMode = (label) => {
    setVoiceModes((prev) => {
      const current = prev[label] || DEFAULT_VOICE_MODE;
      const idx = VOICE_KEYS.indexOf(current);
      const next = VOICE_KEYS[(idx + 1) % VOICE_KEYS.length];
      return { ...prev, [label]: next };
    });
  };

  const duration = shaftChannels.length ? shaftChannels[0].data.length / shaftChannels[0].fs : 0;
  const trackHeight = shaftChannels.length
    ? Math.max(48, Math.min(90, 320 / shaftChannels.length))
    : 70;

  // ═════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════
  return (
    <div style={{
      background: '#07070b', color: '#d4d4d8',
      fontFamily: FONT, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      display: 'flex', flexDirection: 'column',
    }}>

      {/* ═══ TOP SECTION — MASTER PANEL ═══ */}
      <div style={{
        height: 220, flexShrink: 0, flexGrow: 0, flexBasis: 220,
        borderBottom: '2px solid #cc002030', overflow: 'hidden',
      }}>
        {shaftChannels.length > 0 ? (
          <MasterPanel
            shaftChannels={shaftChannels}
            channelStates={channelStates}
            bandEnvelopes={bandEnvelopes}
            activeBands={activeBands}
            viewStart={viewStart}
            viewEnd={viewEnd}
            onViewChange={handleViewChange}
            onSeek={handleSeek}
            playheadPct={playheadPct}
            fundamentalHz={fundamentalHz}
            customRatios={customRatios}
            selectedShaft={selectedShaft}
            duration={duration}
            isLooping={isLooping}
          />
        ) : (
          <div style={{
            height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#08080e', flexDirection: 'column', gap: 8,
          }}>
            <div style={{ fontSize: 12, color: '#1c1c24', letterSpacing: 2 }}>
              SEEG SONIFICATION ENGINE
            </div>
            <div style={{ fontSize: 9, color: '#27272a' }}>Load an EDF file to begin</div>
          </div>
        )}
      </div>

      {/* ═══ TRANSPORT BAR ═══ */}
      <div style={{
        height: 40, flexShrink: 0, flexGrow: 0, flexBasis: 40,
        background: '#0e0e16', borderBottom: '2px solid #cc002030',
        display: 'flex', alignItems: 'center', padding: '0 12px', gap: 10,
        overflow: 'hidden',
      }}>
        <label style={{
          background: '#1a1a24', border: '1px solid #27272a',
          padding: '4px 10px', fontSize: 9, color: '#71717a',
          cursor: 'pointer', borderRadius: 2, letterSpacing: 1, textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}>
          LOAD EDF
          <input type="file" accept=".edf" onChange={handleFile} style={{ display: 'none' }} />
        </label>

        {availableShafts.length > 0 && (
          <select
            value={selectedShaft}
            onChange={(e) => doSelectShaft(e.target.value)}
            style={{
              background: '#1a1a24', border: '1px solid #27272a',
              color: '#a1a1aa', padding: '4px 8px', fontSize: 10,
              fontFamily: FONT, borderRadius: 2,
            }}
          >
            {availableShafts.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}

        <Divider />

        <button
          onClick={togglePlayback}
          disabled={!shaftChannels.length}
          style={{
            background: isPlaying ? '#cc0020' : '#1a1a24',
            border: isPlaying ? '1px solid #cc0020' : '1px solid #333',
            color: '#fafafa', padding: '4px 16px',
            fontFamily: FONT, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase',
            cursor: shaftChannels.length ? 'pointer' : 'default', borderRadius: 2,
            opacity: shaftChannels.length ? 1 : 0.3,
          }}
        >
          {isPlaying ? '■ STOP' : '▶ PLAY'}
        </button>

        <button
          onClick={() => setIsLooping((prev) => !prev)}
          style={{
            background: isLooping ? '#cc002040' : 'transparent',
            border: isLooping ? '1px solid #cc002060' : '1px solid #27272a',
            color: isLooping ? '#ff1744' : '#3f3f46',
            padding: '3px 8px', fontSize: 10, fontFamily: FONT, cursor: 'pointer', borderRadius: 2,
          }}
        >
          ⟳
        </button>

        {[1, 2, 5, 10].map((r) => (
          <button
            key={r}
            onClick={() => setPlaybackRate(r)}
            style={{
              background: playbackRate === r ? '#cc002040' : 'transparent',
              border: playbackRate === r ? '1px solid #cc002060' : '1px solid transparent',
              color: playbackRate === r ? '#ff1744' : '#3f3f46',
              padding: '3px 6px', fontSize: 9, fontFamily: FONT, cursor: 'pointer', borderRadius: 2,
            }}
          >
            {r}×
          </button>
        ))}

        <Divider />

        {/* GLOBAL VOICE MODE */}
        {VOICE_KEYS.map((key) => (
          <button
            key={key}
            onClick={() => handleGlobalVoiceModeChange(key)}
            title={VOICE_MODES[key].description}
            style={{
              background: globalVoiceMode === key ? '#cc002030' : 'transparent',
              border: `1px solid ${globalVoiceMode === key ? '#cc002060' : '#27272a'}`,
              color: globalVoiceMode === key ? '#ff1744' : '#52525b',
              padding: '3px 6px', fontSize: 8, fontFamily: FONT, cursor: 'pointer',
              borderRadius: 2, letterSpacing: 0.5,
            }}
          >
            {VOICE_MODES[key].short}
          </button>
        ))}

        <Divider />

        {BANDS.map((band, i) => (
          <button
            key={band.name}
            onClick={() => toggleBand(i)}
            title={`${band.full} (${band.lo}–${band.hi} Hz)`}
            style={{
              background: activeBands[i] ? band.color + '20' : 'transparent',
              border: `1px solid ${activeBands[i] ? band.color + '60' : '#27272a'}`,
              color: activeBands[i] ? band.color : '#3f3f46',
              padding: '3px 6px', fontSize: 9, fontFamily: FONT, cursor: 'pointer',
              borderRadius: 2, minWidth: 24,
            }}
          >
            {band.name}
          </button>
        ))}

        <Divider />

        <button
          onClick={() => setScaleMode((m) => m === 'fit' ? 'shared' : 'fit')}
          style={{
            background: '#1a1a24',
            border: `1px solid ${scaleMode === 'shared' ? '#cc002060' : '#27272a'}`,
            color: scaleMode === 'shared' ? '#ff1744' : '#71717a',
            padding: '3px 8px', fontSize: 9, fontFamily: FONT, cursor: 'pointer',
            borderRadius: 2, letterSpacing: 1,
          }}
        >
          {scaleMode === 'fit' ? 'FIT' : 'SHARED'}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 8, color: '#3f3f46', letterSpacing: 1 }}>V:</span>
          <button
            onClick={() => setVerticalZoom((v) => Math.max(0.1, v * 0.75))}
            style={{
              background: 'transparent', border: '1px solid #27272a', color: '#52525b',
              padding: '1px 4px', fontSize: 9, fontFamily: FONT, cursor: 'pointer', borderRadius: 2,
            }}
          >−</button>
          <span style={{
            fontSize: 9, color: verticalZoom !== 1 ? '#ff1744' : '#52525b',
            minWidth: 32, textAlign: 'center',
          }}>
            {verticalZoom.toFixed(1)}×
          </span>
          <button
            onClick={() => setVerticalZoom((v) => Math.min(20, v * 1.33))}
            style={{
              background: 'transparent', border: '1px solid #27272a', color: '#52525b',
              padding: '1px 4px', fontSize: 9, fontFamily: FONT, cursor: 'pointer', borderRadius: 2,
            }}
          >+</button>
        </div>

        <div style={{ flex: 1 }} />

        <div style={{
          fontSize: 9, color: '#52525b', minWidth: 60, textAlign: 'right',
        }}>
          {duration > 0 ? `${(playheadPct * duration).toFixed(1)}s / ${duration.toFixed(1)}s` : ''}
        </div>

        <Divider />

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 8, color: '#3f3f46', letterSpacing: 1 }}>A=</span>
          <input
            type="number"
            value={fundamentalHz}
            onChange={(e) => setFundamentalHz(Number(e.target.value) || 220)}
            style={{
              background: '#1a1a24', border: '1px solid #27272a', color: '#a1a1aa',
              padding: '2px 6px', fontSize: 10, fontFamily: FONT, width: 50,
              borderRadius: 2, textAlign: 'right',
            }}
          />
          <span style={{ fontSize: 8, color: '#3f3f46' }}>Hz</span>
        </div>
      </div>

      {/* ═══ TRACK AREA ═══ */}
      <div style={{
        flex: 1, minHeight: 0, overflowX: 'hidden', overflowY: 'auto', background: '#09090f',
      }}>
        {shaftChannels.length === 0 ? (
          <div style={{
            height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: 12, color: '#1c1c24', minHeight: 300,
          }}>
            <div style={{ fontSize: 13 }}>SEEG SONIFICATION ENGINE</div>
            <div style={{ fontSize: 9, color: '#27272a', maxWidth: 400, textAlign: 'center', lineHeight: 1.7 }}>
              Load an EDF file to begin. Select a voice mode in the transport bar,
              or click the mode badge on individual tracks to experiment.
            </div>
            <div style={{ fontSize: 8, color: '#1c1c24', marginTop: 8 }}>
              Scroll = horizontal zoom · Ctrl+Scroll = vertical zoom · Click = seek
            </div>
          </div>
        ) : (
          shaftChannels.map((ch) => {
            const isActive = channelStates[ch.label];
            const ratioStr = customRatios[ch.label] || '1/1';
            const ratioVal = parseRatio(ratioStr);
            const hz = (fundamentalHz * ratioVal).toFixed(1);
            const cents = (1200 * Math.log2(ratioVal)).toFixed(0);
            const mode = voiceModes[ch.label] || DEFAULT_VOICE_MODE;
            const modeInfo = VOICE_MODES[mode];

            return (
              <div
                key={ch.label}
                style={{
                  display: 'grid', gridTemplateColumns: '180px 1fr',
                  height: trackHeight, maxHeight: trackHeight, overflow: 'hidden',
                  borderBottom: '1px solid #12121a',
                  opacity: isActive ? 1 : 0.45, transition: 'opacity 0.15s',
                }}
              >
                {/* Track Header */}
                <div style={{
                  background: '#0b0b12', borderRight: '1px solid #1a1a24',
                  padding: '6px 10px', display: 'flex', flexDirection: 'column',
                  justifyContent: 'center', gap: 3,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      onClick={() => toggleChannel(ch.label)}
                      style={{
                        width: 12, height: 12, borderRadius: 2,
                        background: isActive ? '#cc0020' : '#27272a',
                        border: 'none', cursor: 'pointer', flexShrink: 0,
                      }}
                    />
                    <span style={{
                      fontSize: 11, fontWeight: 600,
                      color: isActive ? '#fafafa' : '#52525b',
                    }}>
                      {selectedShaft}{ch.label}
                    </span>
                    {/* Per-track voice mode badge — click to cycle */}
                    <button
                      onClick={() => cycleVoiceMode(ch.label)}
                      title={`${modeInfo.name}: ${modeInfo.description}\nClick to cycle`}
                      style={{
                        marginLeft: 'auto',
                        background: '#15151f',
                        border: '1px solid #27272a',
                        color: '#71717a',
                        padding: '1px 4px', fontSize: 7, fontFamily: FONT,
                        cursor: 'pointer', borderRadius: 2, letterSpacing: 0.5,
                      }}
                    >
                      {modeInfo.short}
                    </button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 18 }}>
                    <input
                      value={ratioStr}
                      onChange={(e) =>
                        setCustomRatios((prev) => ({ ...prev, [ch.label]: e.target.value }))
                      }
                      style={{
                        background: '#15151f', border: '1px solid #27272a', color: '#a1a1aa',
                        padding: '1px 4px', fontSize: 9, fontFamily: FONT, width: 36,
                        borderRadius: 1, textAlign: 'center',
                      }}
                    />
                    <span style={{ fontSize: 8, color: '#3f3f46' }}>{hz} Hz</span>
                    <span style={{ fontSize: 8, color: '#27272a' }}>{cents}¢</span>
                  </div>
                </div>

                {/* Waveform */}
                <div
                  style={{ overflow: 'hidden', height: trackHeight, cursor: 'crosshair' }}
                  onWheel={handleTrackWheel}
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const clickX = (e.clientX - rect.left) / rect.width;
                    const pct = viewStart + clickX * (viewEnd - viewStart);
                    handleSeek(pct);
                  }}
                >
                  <WaveformCanvas
                    data={ch.data}
                    viewStart={viewStart}
                    viewEnd={viewEnd}
                    verticalZoom={verticalZoom}
                    scaleMode={scaleMode}
                    sharedScale={scaleMode === 'shared' ? sharedPeak : null}
                    color={isActive ? '#cc0020' : '#3f3f46'}
                    height={trackHeight}
                    playheadPct={playheadPct}
                    isActive={isActive}
                    bandEnvelopes={bandEnvelopes[ch.label]}
                    activeBands={activeBands}
                  />
                </div>
              </div>
            );
          })
        )}

        {shaftChannels.length > 0 && (
          <div style={{
            padding: '10px 12px', fontSize: 8, color: '#27272a', lineHeight: 1.6,
            borderTop: '1px solid #15151f',
          }}>
            {selectedShaft} · {shaftChannels.length} bipolar pairs · {shaftChannels[0]?.fs} Hz ·
            {' '}{duration.toFixed(1)}s · Ratios × {fundamentalHz} Hz ·
            {' '}Voice: {VOICE_MODES[globalVoiceMode]?.name}
            {isLooping && <span style={{ color: '#cc0020' }}> · LOOP {(viewStart * duration).toFixed(1)}s–{(viewEnd * duration).toFixed(1)}s</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function Divider() {
  return <div style={{ width: 1, height: 20, background: '#27272a' }} />;
}
