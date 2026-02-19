import { useRef, useEffect, useCallback } from 'react';
import { BANDS } from './dsp.js';

export function MasterPanel({
  shaftChannels,
  channelStates,
  bandEnvelopes,
  activeBands,
  viewStart,
  viewEnd,
  onViewChange,
  onSeek,
  playheadPct,
  fundamentalHz,
  customRatios,
  selectedShaft,
  duration,
  isLooping,
}) {
  const canvasRef = useRef(null);
  const interactionRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    if (W === 0 || H === 0) return;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const splitY = Math.floor(H * 0.45);

    ctx.fillStyle = '#08080e';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = '#1a1a2480';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, splitY);
    ctx.lineTo(W, splitY);
    ctx.stroke();

    ctx.font = "9px 'JetBrains Mono', monospace";
    ctx.fillStyle = '#cc002050';
    ctx.fillText('MASTER AUDIO', 8, 14);
    ctx.fillStyle = '#52525b50';
    ctx.fillText('EEG OVERLAY', 8, splitY + 14);

    if (duration > 0) {
      ctx.fillStyle = '#27272a';
      ctx.textAlign = 'right';
      ctx.fillText(`${duration.toFixed(1)}s`, W - 8, 14);
      ctx.textAlign = 'left';
    }

    const active = shaftChannels.filter((ch) => channelStates[ch.label]);
    if (!active.length) {
      ctx.fillStyle = '#1c1c24';
      ctx.font = "11px 'JetBrains Mono', monospace";
      ctx.textAlign = 'center';
      ctx.fillText('No active channels', W / 2, H / 2);
      ctx.textAlign = 'left';
      return;
    }

    // ─── TOP: RMS Envelope ───────────────────────────────
    const topH = splitY - 20;
    const topY = 20;
    const mixLen = active[0].data.length;
    const rmsStep = Math.max(1, Math.floor(mixLen / W));
    const mixedRMS = new Float32Array(W);

    for (let px = 0; px < W; px++) {
      const si = Math.floor((px / W) * mixLen);
      let sum = 0;
      active.forEach((ch) => {
        let sqSum = 0;
        const windowSize = Math.min(rmsStep, 256);
        for (let j = 0; j < windowSize && si + j < ch.data.length; j++) {
          sqSum += ch.data[si + j] * ch.data[si + j];
        }
        sum += Math.sqrt(sqSum / windowSize);
      });
      mixedRMS[px] = sum / active.length;
    }

    const sorted = [...mixedRMS].sort((a, b) => a - b);
    const p98 = sorted[Math.floor(sorted.length * 0.98)] || 1;

    ctx.beginPath();
    ctx.moveTo(0, topY + topH);
    for (let px = 0; px < W; px++) {
      const norm = Math.min(mixedRMS[px] / p98, 1.5);
      ctx.lineTo(px, topY + topH - norm * topH);
    }
    ctx.lineTo(W, topY + topH);
    ctx.closePath();

    const grad = ctx.createLinearGradient(0, topY, 0, topY + topH);
    grad.addColorStop(0, '#cc002060');
    grad.addColorStop(1, '#cc002010');
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    for (let px = 0; px < W; px++) {
      const norm = Math.min(mixedRMS[px] / p98, 1.5);
      const y = topY + topH - norm * topH;
      if (px === 0) ctx.moveTo(px, y); else ctx.lineTo(px, y);
    }
    ctx.strokeStyle = '#cc002080';
    ctx.lineWidth = 1;
    ctx.stroke();

    // ─── BOTTOM: Overlapping EEG ─────────────────────────
    const botY = splitY + 18;
    const botH = H - botY - 14;
    const colors = [
      '#cc0020', '#ff6b35', '#ffd700', '#22cc88',
      '#2299ff', '#aa44ff', '#ff44aa', '#44ffcc',
    ];

    active.forEach((ch, ci) => {
      const col = colors[ci % colors.length];
      const samplesPerPx = ch.data.length / W;

      if (!canvas['_peak_' + ch.label] || canvas['_peakData_' + ch.label] !== ch.data) {
        const samps = [];
        const step = Math.max(1, Math.floor(ch.data.length / 5000));
        for (let j = 0; j < ch.data.length; j += step) samps.push(Math.abs(ch.data[j]));
        samps.sort((a, b) => a - b);
        canvas['_peak_' + ch.label] = samps[Math.floor(samps.length * 0.98)] || 1;
        canvas['_peakData_' + ch.label] = ch.data;
      }
      const scale = canvas['_peak_' + ch.label];

      ctx.strokeStyle = col;
      ctx.lineWidth = 0.8;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();

      for (let px = 0; px < W; px++) {
        const start = Math.floor(px * samplesPerPx);
        const end = Math.min(Math.floor((px + 1) * samplesPerPx), ch.data.length);
        let min = Infinity, max = -Infinity;
        for (let i = start; i < end; i++) {
          if (ch.data[i] < min) min = ch.data[i];
          if (ch.data[i] > max) max = ch.data[i];
        }
        const mid = botY + botH / 2;
        const yMin = mid - (max / scale) * (botH / 2) * 0.8;
        const yMax = mid - (min / scale) * (botH / 2) * 0.8;
        if (px === 0) ctx.moveTo(px, yMin);
        ctx.lineTo(px, yMin);
        ctx.lineTo(px, yMax);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    });

    ctx.textAlign = 'right';
    active.forEach((ch, ci) => {
      ctx.fillStyle = colors[ci % colors.length];
      ctx.globalAlpha = 0.7;
      ctx.font = "8px 'JetBrains Mono', monospace";
      ctx.fillText(ch.label, W - 8, splitY + 14 + ci * 11);
    });
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';

    // ─── ZOOM REGION OVERLAY ─────────────────────────────
    const x1 = viewStart * W;
    const x2 = viewEnd * W;

    if (viewStart > 0.001 || viewEnd < 0.999) {
      ctx.fillStyle = '#00000060';
      ctx.fillRect(0, 0, x1, H);
      ctx.fillRect(x2, 0, W - x2, H);

      if (isLooping) {
        ctx.strokeStyle = '#ff174480';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(x1, 0, x2 - x1, H);
        ctx.setLineDash([]);
        ctx.fillStyle = '#ff1744';
        ctx.font = "bold 9px 'JetBrains Mono', monospace";
        ctx.fillText('⟳ LOOP', x1 + 4, H - 16);
      } else {
        ctx.strokeStyle = '#cc002040';
        ctx.lineWidth = 1;
        ctx.strokeRect(x1, 0, x2 - x1, H);
      }

      const handleColor = isLooping ? '#ff1744' : '#cc0020';
      ctx.fillStyle = handleColor;
      ctx.fillRect(x1 - 1, 0, 3, H);
      ctx.fillRect(x2 - 2, 0, 3, H);

      ctx.fillStyle = '#ffffffaa';
      ctx.font = "7px 'JetBrains Mono', monospace";
      ctx.fillText(`${(viewStart * duration).toFixed(1)}s`, x1 + 4, H - 4);
      ctx.textAlign = 'right';
      ctx.fillText(`${(viewEnd * duration).toFixed(1)}s`, x2 - 4, H - 4);
      ctx.textAlign = 'left';
    }

    // ─── PLAYHEAD ────────────────────────────────────────
    if (playheadPct >= 0 && playheadPct <= 1) {
      const px = playheadPct * W;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, H);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(px - 4, 0);
      ctx.lineTo(px + 4, 0);
      ctx.lineTo(px, 6);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#ffffffcc';
      ctx.font = "9px 'JetBrains Mono', monospace";
      const timeStr = `${(playheadPct * duration).toFixed(1)}s`;
      const textX = px + 8 > W - 40 ? px - 44 : px + 8;
      ctx.fillText(timeStr, textX, 14);
    }

    // ─── TIME MARKERS ────────────────────────────────────
    ctx.fillStyle = '#27272a';
    ctx.font = "7px 'JetBrains Mono', monospace";
    const numMarkers = Math.min(10, Math.floor(W / 80));
    for (let i = 0; i <= numMarkers; i++) {
      const t = (i / numMarkers) * duration;
      const px = (i / numMarkers) * W;
      ctx.fillText(`${t.toFixed(0)}s`, px + 2, H - 2);
      ctx.strokeStyle = '#27272a40';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(px, H - 12);
      ctx.lineTo(px, H);
      ctx.stroke();
    }

  }, [shaftChannels, channelStates, bandEnvelopes, activeBands,
      viewStart, viewEnd, playheadPct, duration, isLooping]);

  // ─── Mouse Interaction ──────────────────────────────────
  const getX = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  };

  const handleMouseDown = useCallback((e) => {
    const x = getX(e);
    const grabSize = 0.008;
    const isNearLeftEdge = Math.abs(x - viewStart) < grabSize && (viewStart > 0.001 || viewEnd < 0.999);
    const isNearRightEdge = Math.abs(x - viewEnd) < grabSize && (viewStart > 0.001 || viewEnd < 0.999);

    if (isNearLeftEdge) {
      interactionRef.current = { type: 'resize-left' };
    } else if (isNearRightEdge) {
      interactionRef.current = { type: 'resize-right' };
    } else {
      interactionRef.current = { type: 'pending', startX: x, moved: false };
    }

    const handleMouseMove = (e2) => {
      const x2 = getX(e2);
      const state = interactionRef.current;
      if (!state) return;

      if (state.type === 'pending') {
        const dist = Math.abs(x2 - state.startX);
        if (dist > 0.005) {
          state.type = 'drag-select';
          state.moved = true;
        }
      }

      if (state.type === 'drag-select') {
        const left = Math.min(state.startX, x2);
        const right = Math.max(state.startX, x2);
        onViewChange(Math.max(0, left), Math.min(1, right));
      } else if (state.type === 'resize-left') {
        onViewChange(Math.max(0, Math.min(viewEnd - 0.005, x2)), viewEnd);
      } else if (state.type === 'resize-right') {
        onViewChange(viewStart, Math.min(1, Math.max(viewStart + 0.005, x2)));
      }
    };

    const handleMouseUp = (e2) => {
      const state = interactionRef.current;
      
      if (state && state.type === 'pending' && !state.moved) {
        onSeek(state.startX);
      }
      
      if (state && state.type === 'drag-select') {
        const x2 = getX(e2);
        const left = Math.min(state.startX, x2);
        const right = Math.max(state.startX, x2);
        if (right - left < 0.005) {
          onSeek(state.startX);
          onViewChange(0, 1);
        }
      }

      interactionRef.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [viewStart, viewEnd, onViewChange, onSeek]);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const mouseX = getX(e);
    const zoomFactor = e.deltaY > 0 ? 1.15 : 0.85;
    const width = viewEnd - viewStart;
    let newWidth = Math.min(1, Math.max(0.005, width * zoomFactor));
    const r = (mouseX - viewStart) / (width || 1);
    let newStart = mouseX - r * newWidth;
    let newEnd = newStart + newWidth;
    if (newStart < 0) { newStart = 0; newEnd = newWidth; }
    if (newEnd > 1) { newEnd = 1; newStart = 1 - newWidth; }
    onViewChange(newStart, newEnd);
  }, [viewStart, viewEnd, onViewChange]);

  const handleDoubleClick = useCallback(() => {
    onViewChange(0, 1);
  }, [onViewChange]);

  const handleMouseMove = useCallback((e) => {
    const x = getX(e);
    const grabSize = 0.008;
    const canvas = canvasRef.current;
    const isZoomed = viewStart > 0.001 || viewEnd < 0.999;

    if (isZoomed && (Math.abs(x - viewStart) < grabSize || Math.abs(x - viewEnd) < grabSize)) {
      canvas.style.cursor = 'col-resize';
    } else {
      canvas.style.cursor = 'crosshair';
    }
  }, [viewStart, viewEnd]);

  return (
    <canvas
      ref={canvasRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onWheel={handleWheel}
      onDoubleClick={handleDoubleClick}
      style={{
        width: '100%', height: '100%', display: 'block', cursor: 'crosshair',
      }}
    />
  );
}
