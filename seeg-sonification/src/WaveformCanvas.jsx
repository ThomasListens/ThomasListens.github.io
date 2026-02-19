import { useRef, useEffect } from 'react';
import { BANDS } from './dsp.js';

export function WaveformCanvas({
  data,
  viewStart = 0,
  viewEnd = 1,
  verticalZoom = 1,
  scaleMode = 'fit',
  sharedScale = null,
  color = '#cc0020',
  height = 70,
  playheadPct = -1,
  isActive = true,
  onClick,
  bandEnvelopes,
  activeBands,
}) {
  const canvasRef = useRef(null);
  const envPeakRef = useRef({ values: null, data: null });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = isActive ? '#0c0c14' : '#08080c';
    ctx.fillRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = '#ffffff06';
    ctx.lineWidth = 0.5;
    for (let y = h * 0.25; y < h; y += h * 0.25) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    ctx.strokeStyle = '#ffffff12';
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();

    // ─── Visible range ───────────────────────────────────
    const startIdx = Math.floor(viewStart * data.length);
    const endIdx = Math.floor(viewEnd * data.length);
    const visibleLen = endIdx - startIdx;
    const samplesPerPx = visibleLen / w;

    // ─── DC offset (always from visible region) ──────────
    const dcStep = Math.max(1, Math.floor(visibleLen / 2000));
    let dcSum = 0, dcCount = 0;
    for (let i = startIdx; i < endIdx; i += dcStep) {
      dcSum += data[i]; dcCount++;
    }
    const dcOffset = dcCount > 0 ? dcSum / dcCount : 0;

    // ─── Determine scale ─────────────────────────────────
    let baseScale;

    if (scaleMode === 'shared' && sharedScale !== null) {
      baseScale = sharedScale;
    } else {
      let visMax = 0;
      const visStep = Math.max(1, Math.floor(visibleLen / 5000));
      for (let i = startIdx; i < endIdx; i += visStep) {
        const v = Math.abs(data[i] - dcOffset);
        if (v > visMax) visMax = v;
      }
      baseScale = visMax || 1;
    }

    const effectiveScale = baseScale / verticalZoom;

    // ─── Band envelopes ──────────────────────────────────
    if (bandEnvelopes && activeBands) {
      if (envPeakRef.current.data !== bandEnvelopes) {
        const peaks = [];
        BANDS.forEach((band, bi) => {
          if (!bandEnvelopes[bi]) { peaks.push(1); return; }
          const env = bandEnvelopes[bi];
          const step = Math.max(1, Math.floor(env.length / 5000));
          const samps = [];
          for (let j = 0; j < env.length; j += step) samps.push(env[j]);
          samps.sort((a, b) => a - b);
          peaks.push(samps[Math.floor(samps.length * 0.95)] || 1);
        });
        envPeakRef.current = { values: peaks, data: bandEnvelopes };
      }

      const envPeaks = envPeakRef.current.values;
      const maxFill = 0.4;

      BANDS.forEach((band, bi) => {
        if (!activeBands[bi] || !bandEnvelopes[bi]) return;
        const env = bandEnvelopes[bi];

        let envScale;
        if (scaleMode === 'fit') {
          let visEnvMax = 0;
          const vs = Math.max(1, Math.floor(visibleLen / 2000));
          for (let i = startIdx; i < endIdx; i += vs) {
            const idx = Math.min(i, env.length - 1);
            if (env[idx] > visEnvMax) visEnvMax = env[idx];
          }
          envScale = Math.max(visEnvMax, envPeaks[bi] * 0.01);
        } else {
          envScale = envPeaks[bi];
        }

        ctx.globalAlpha = 0.2;
        ctx.fillStyle = band.color;
        ctx.beginPath();
        ctx.moveTo(0, h / 2);
        for (let px = 0; px < w; px++) {
          const si = startIdx + Math.floor(px * samplesPerPx);
          const val = env[Math.min(si, env.length - 1)] || 0;
          const norm = Math.min(val / envScale, 1.5) * maxFill;
          ctx.lineTo(px, h / 2 - norm * (h / 2));
        }
        for (let px = w - 1; px >= 0; px--) {
          const si = startIdx + Math.floor(px * samplesPerPx);
          const val = env[Math.min(si, env.length - 1)] || 0;
          const norm = Math.min(val / envScale, 1.5) * maxFill;
          ctx.lineTo(px, h / 2 + norm * (h / 2));
        }
        ctx.closePath();
        ctx.fill();

        ctx.globalAlpha = 0.4;
        ctx.strokeStyle = band.color;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        for (let px = 0; px < w; px++) {
          const si = startIdx + Math.floor(px * samplesPerPx);
          const val = env[Math.min(si, env.length - 1)] || 0;
          const norm = Math.min(val / envScale, 1.5) * maxFill;
          const y = h / 2 - norm * (h / 2);
          if (px === 0) ctx.moveTo(px, y); else ctx.lineTo(px, y);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      });
    }

    // ─── Waveform ────────────────────────────────────────
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.globalAlpha = isActive ? 1 : 0.3;
    ctx.beginPath();

    for (let px = 0; px < w; px++) {
      const s = startIdx + Math.floor(px * samplesPerPx);
      const e = Math.min(startIdx + Math.floor((px + 1) * samplesPerPx), endIdx);
      let min = Infinity, max = -Infinity;
      for (let i = s; i < e; i++) {
        const centered = data[i] - dcOffset;
        if (centered < min) min = centered;
        if (centered > max) max = centered;
      }

      const yMin = h / 2 - (max / effectiveScale) * (h / 2) * 0.9;
      const yMax = h / 2 - (min / effectiveScale) * (h / 2) * 0.9;
      const yMinC = Math.max(0, Math.min(h, yMin));
      const yMaxC = Math.max(0, Math.min(h, yMax));

      if (px === 0) ctx.moveTo(px, yMinC);
      ctx.lineTo(px, yMinC);
      ctx.lineTo(px, yMaxC);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;

    // ─── Calibration Bar ─────────────────────────────────
    const uvPerPixel = effectiveScale / ((h / 2) * 0.9);
    const targetBarPx = h * 0.3;
    const targetBarUv = uvPerPixel * targetBarPx;
    
    const niceValues = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
    let barUv = niceValues[0];
    for (const nv of niceValues) {
      if (nv <= targetBarUv * 1.5) barUv = nv;
    }
    
    const barPx = (barUv / effectiveScale) * (h / 2) * 0.9;
    const barX = w - 8;
    const maxBarPx = (h / 2) - 4;
    const clampedBarPx = Math.min(barPx, maxBarPx);
    const barTop = h / 2 - clampedBarPx;
    const barBot = h / 2 + clampedBarPx;

    if (clampedBarPx >= 4) {
      ctx.fillStyle = '#0c0c14cc';
      ctx.fillRect(w - 28, barTop - 2, 28, barBot - barTop + 4);

      ctx.strokeStyle = '#a1a1aa';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(barX, barTop);
      ctx.lineTo(barX, barBot);
      ctx.moveTo(barX - 3, barTop);
      ctx.lineTo(barX, barTop);
      ctx.moveTo(barX - 3, barBot);
      ctx.lineTo(barX, barBot);
      ctx.stroke();

      const label = barUv >= 1000 ? `${(barUv/1000).toFixed(0)}mV` : `${barUv}µV`;
      ctx.save();
      ctx.translate(barX - 5, h / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = '#0c0c14';
      ctx.font = "bold 8px 'JetBrains Mono', monospace";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          ctx.fillText(label, ox, oy);
        }
      }
      ctx.fillStyle = '#d4d4d8';
      ctx.fillText(label, 0, 0);
      ctx.restore();
    }

    // ─── Playhead ────────────────────────────────────────
    if (playheadPct >= 0) {
      const visiblePct = (playheadPct - viewStart) / (viewEnd - viewStart);
      if (visiblePct >= 0 && visiblePct <= 1) {
        const px = visiblePct * w;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(px, 0);
        ctx.lineTo(px, h);
        ctx.stroke();
      }
    }
  }, [data, viewStart, viewEnd, verticalZoom, scaleMode, sharedScale, color,
      height, playheadPct, isActive, bandEnvelopes, activeBands]);

  return (
    <div onClick={onClick} style={{ position: 'relative', height }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  );
}
