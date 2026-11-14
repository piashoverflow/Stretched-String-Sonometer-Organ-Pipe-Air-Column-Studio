import React, { useEffect, useRef, useState } from 'react';
import { Volume2, Square } from 'lucide-react';
import { Language, OrganPipeState, PipeBoundaryType } from '../../types/physics';
import { TranslationBundle } from '../../i18n/translations';
import { ProgressiveSlider } from '../ProgressiveSlider';
import { audioEngine } from '../../utils/audioEngine';
import { drawRoundRectPath, syncCanvasSize } from '../../utils/canvasHelpers';

interface OrganPipeModuleProps {
  lang: Language;
  t: TranslationBundle;
  state: OrganPipeState;
  setState: React.Dispatch<React.SetStateAction<OrganPipeState>>;
}

interface AirParticle {
  u: number; // 0..1 axial normalized position
  v: number; // -1..1 radial normalized position
}

// Deterministic pseudo-random particle distribution inside tube
const PARTICLES: AirParticle[] = Array.from({ length: 240 }, (_, i) => {
  const s1 = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  const s2 = Math.sin(i * 93.9898 + 17.133) * 24634.6345;
  const u = (i + 0.5) / 240 + ((s1 - Math.floor(s1)) - 0.5) * 0.008;
  const v = ((s2 - Math.floor(s2)) * 2 - 1) * 0.82;
  return { u: Math.max(0.01, Math.min(0.99, u)), v };
});

export const OrganPipeModule: React.FC<OrganPipeModuleProps> = ({
  t,
  state,
  setState,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const tRef = useRef(t);
  tRef.current = t;

  const [playingMode, setPlayingMode] = useState<'closed' | 'open' | null>(null);
  const phaseRef = useRef(0);
  const lastTimeRef = useRef<number | null>(null);

  // Stop sustained sound on unmount or mode change
  useEffect(() => {
    return () => {
      audioEngine.stopSustained();
    };
  }, []);

  const speedOfSound = 332 + 0.6 * state.temperatureC;
  const k = state.overtoneIndex; // 0, 1, 2, 3

  // Closed pipe calculations
  const closedHarmonicN = 2 * k + 1; // 1, 3, 5, 7
  const closedF1 = speedOfSound / (4 * state.length);
  const closedFreq = closedHarmonicN * closedF1;
  const closedLambda = (4 * state.length) / closedHarmonicN;

  // Open pipe calculations
  const openHarmonicN = k + 1; // 1, 2, 3, 4
  const openF1 = speedOfSound / (2 * state.length);
  const openFreq = openHarmonicN * openF1;
  const openLambda = (2 * state.length) / openHarmonicN;

  const handlePlayTone = (mode: 'closed' | 'open') => {
    if (playingMode === mode) {
      audioEngine.stopSustained();
      setPlayingMode(null);
      return;
    }
    const freq = mode === 'closed' ? closedFreq : openFreq;
    setPlayingMode(mode);
    audioEngine.startOrganPipeTone(freq, mode, () => {
      setPlayingMode(null);
    });
  };

  // Update audio pitch dynamically if user changes slider while playing
  useEffect(() => {
    if (playingMode) {
      const freq = playingMode === 'closed' ? closedFreq : openFreq;
      audioEngine.startOrganPipeTone(freq, playingMode, () => {
        setPlayingMode(null);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.length, state.temperatureC, state.overtoneIndex, state.boundaryType]);

  // Canvas 60fps Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let animId = 0;

    const drawSinglePipe = (
      ctx: CanvasRenderingContext2D,
      mode: 'closed' | 'open',
      pipeX: number,
      pipeY: number,
      pipeW: number,
      pipeH: number,
      s: OrganPipeState,
      phase: number
    ) => {
      const overtone = s.overtoneIndex;
      const cosPhase = Math.cos(phase);
      const halfH = pipeH / 2;
      const centerY = pipeY + halfH;
      const nClosed = 2 * overtone + 1;
      const nOpen = overtone + 1;

      // Displacement profile in [-1, 1]
      const getDisp = (u: number) =>
        mode === 'closed'
          ? Math.sin((nClosed * Math.PI * u) / 2)
          : Math.cos(nOpen * Math.PI * u);

      // Pressure variation profile (spatial derivative of displacement) in [-1, 1]
      const getPressure = (u: number) =>
        mode === 'closed'
          ? Math.cos((nClosed * Math.PI * u) / 2)
          : Math.sin(nOpen * Math.PI * u);

      // 1. Pressure shading inside pipe (compression = sky/blue, rarefaction = warm amber/rose)
      const slices = 70;
      const sliceW = pipeW / slices;
      for (let i = 0; i < slices; i++) {
        const u = (i + 0.5) / slices;
        const pVal = getPressure(u) * cosPhase;
        if (Math.abs(pVal) < 0.02) continue;
        ctx.fillStyle =
          pVal > 0
            ? `rgba(2, 132, 199, ${Math.min(0.24, Math.abs(pVal) * 0.24)})`
            : `rgba(244, 63, 94, ${Math.min(0.16, Math.abs(pVal) * 0.16)})`;
        ctx.fillRect(pipeX + i * sliceW, pipeY + 2, sliceW + 0.6, pipeH - 4);
      }

      // 2. Cylindrical Glass Tube Walls
      const glassGrad = ctx.createLinearGradient(0, pipeY, 0, pipeY + pipeH);
      glassGrad.addColorStop(0, 'rgba(224, 242, 254, 0.45)');
      glassGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.15)');
      glassGrad.addColorStop(1, 'rgba(224, 242, 254, 0.45)');
      ctx.fillStyle = glassGrad;
      ctx.fillRect(pipeX, pipeY, pipeW, pipeH);

      // Top & bottom glass rims
      ctx.strokeStyle = '#0369a1';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(pipeX, pipeY);
      ctx.lineTo(pipeX + pipeW, pipeY);
      ctx.moveTo(pipeX, pipeY + pipeH);
      ctx.lineTo(pipeX + pipeW, pipeY + pipeH);
      ctx.stroke();

      // Left boundary: Rigid metal cap if closed, flared open mouth if open
      if (mode === 'closed') {
        ctx.fillStyle = '#334155';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2;
        drawRoundRectPath(ctx, pipeX - 10, pipeY - 4, 12, pipeH + 8, 3);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.strokeStyle = '#0369a1';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(pipeX, pipeY);
        ctx.lineTo(pipeX - 9, pipeY - 7);
        ctx.moveTo(pipeX, pipeY + pipeH);
        ctx.lineTo(pipeX - 9, pipeY + pipeH + 7);
        ctx.stroke();
      }

      // Right boundary: Always open mouth
      ctx.strokeStyle = '#0369a1';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(pipeX + pipeW, pipeY);
      ctx.lineTo(pipeX + pipeW + 9, pipeY - 7);
      ctx.moveTo(pipeX + pipeW, pipeY + pipeH);
      ctx.lineTo(pipeX + pipeW + 9, pipeY + pipeH + 7);
      ctx.stroke();

      // 3. Longitudinal Air Particles oscillating horizontally
      const maxDispPx = Math.min(22, pipeW / (mode === 'closed' ? nClosed * 4.5 : nOpen * 5.2));
      for (let i = 0; i < PARTICLES.length; i++) {
        const pt = PARTICLES[i];
        const dispFactor = getDisp(pt.u);
        const dx = dispFactor * maxDispPx * cosPhase;
        const px = pipeX + pt.u * pipeW + dx;
        const py = centerY + pt.v * (halfH - 8);

        if (px < pipeX + 3 || px > pipeX + pipeW - 3) continue;

        const absAmp = Math.abs(dispFactor);
        ctx.beginPath();
        ctx.arc(px, py, absAmp > 0.7 ? 2.6 : 2.1, 0, Math.PI * 2);
        if (absAmp < 0.14) {
          ctx.fillStyle = '#e11d48'; // Stationary Node particles highlighted crimson
        } else if (absAmp > 0.72) {
          ctx.fillStyle = '#059669'; // Vigorous Antinode particles highlighted emerald
        } else {
          ctx.fillStyle = '#334155';
        }
        ctx.fill();
      }

      // 4. Overlaid Acoustic Pressure Curve (Sky Blue dashed/solid)
      if (s.showPressureCurve) {
        ctx.save();
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 3]);
        ctx.beginPath();
        for (let i = 0; i <= 140; i++) {
          const u = i / 140;
          const x = pipeX + u * pipeW;
          const y = centerY - getPressure(u) * (halfH - 12) * cosPhase;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.restore();
      }

      // 5. Overlaid Displacement Standing Wave Envelope (Emerald)
      if (s.showDisplacementEnvelope) {
        [1, -1].forEach((sign) => {
          ctx.save();
          ctx.strokeStyle = 'rgba(5, 150, 105, 0.75)';
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          for (let i = 0; i <= 160; i++) {
            const u = i / 160;
            const x = pipeX + u * pipeW;
            const y = centerY + sign * getDisp(u) * (halfH - 10);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
          ctx.restore();
        });

        // Live phase displacement wave
        ctx.save();
        ctx.strokeStyle = '#047857';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let i = 0; i <= 160; i++) {
          const u = i / 160;
          const x = pipeX + u * pipeW;
          const y = centerY - getDisp(u) * (halfH - 10) * cosPhase;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.restore();
      }

      // 6. Node (N) & Antinode (A) markers along the pipe
      const nodesU: number[] = [];
      const antinodesU: number[] = [];
      if (mode === 'closed') {
        for (let m = 0; m <= overtone; m++) {
          nodesU.push((2 * m) / nClosed);
          antinodesU.push((2 * m + 1) / nClosed);
        }
      } else {
        for (let m = 0; m <= overtone; m++) {
          nodesU.push((2 * m + 1) / (2 * nOpen));
        }
        for (let m = 0; m <= nOpen; m++) {
          antinodesU.push(m / nOpen);
        }
      }

      nodesU.forEach((u) => {
        const nx = pipeX + u * pipeW;
        ctx.fillStyle = '#e11d48';
        ctx.beginPath();
        ctx.arc(nx, centerY, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#be123c';
        ctx.font = '700 11px "IBM Plex Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('N', nx, pipeY + pipeH + 16);
      });

      antinodesU.forEach((u) => {
        const ax = pipeX + u * pipeW;
        ctx.fillStyle = '#059669';
        ctx.beginPath();
        ctx.arc(ax, pipeY + 10, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#047857';
        ctx.font = '700 11px "IBM Plex Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('A', ax, pipeY + pipeH + 16);
      });

      // Pipe Title & Formula Tag above pipe
      const v = 332 + 0.6 * s.temperatureC;
      const f = mode === 'closed' ? (nClosed * v) / (4 * s.length) : (nOpen * v) / (2 * s.length);
      const fracLabel =
        mode === 'closed'
          ? nClosed === 1
            ? 'L = λ/4'
            : `L = ${nClosed}λ/4`
          : nOpen === 1
          ? 'L = λ/2'
          : `L = ${nOpen}λ/2`;

      ctx.fillStyle = '#0f172a';
      ctx.font = '700 12px "Plus Jakarta Sans", "Noto Sans Bengali", sans-serif';
      ctx.textAlign = 'left';
      const titleStr =
        mode === 'closed'
          ? `${tRef.current.organPipe.closedPipe} (N — A) · ${fracLabel}`
          : `${tRef.current.organPipe.openPipe} (A — A) · ${fracLabel}`;
      ctx.fillText(titleStr, pipeX, pipeY - 12);

      ctx.fillStyle = '#047857';
      ctx.font = '700 12px "IBM Plex Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`f = ${f.toFixed(1)} Hz`, pipeX + pipeW, pipeY - 12);
    };

    const renderFrame = (timestamp: number) => {
      if (lastTimeRef.current === null) lastTimeRef.current = timestamp;
      const dt = Math.min(0.05, (timestamp - lastTimeRef.current) / 1000);
      lastTimeRef.current = timestamp;

      const size = syncCanvasSize(canvas);
      const ctx = canvas.getContext('2d');
      if (!ctx || !size) {
        animId = requestAnimationFrame(renderFrame);
        return;
      }

      const { width, height, dpr } = size;
      const s = stateRef.current;

      phaseRef.current += 8.5 * dt;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      // Subtle blueprint grid
      ctx.strokeStyle = 'rgba(14, 165, 233, 0.08)';
      ctx.lineWidth = 1;
      for (let gx = 0; gx < width; gx += 28) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, height);
        ctx.stroke();
      }
      for (let gy = 0; gy < height; gy += 28) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(width, gy);
        ctx.stroke();
      }

      // Scale pipe pixel width visually with L (0.20m to 2.00m)
      const maxPipeW = Math.max(180, width - 90);
      const minPipeW = Math.max(120, maxPipeW * 0.36);
      const pipeW = minPipeW + ((s.length - 0.2) / 1.8) * (maxPipeW - minPipeW);
      const pipeX = (width - pipeW) / 2;

      if (s.boundaryType === 'compare') {
        const pipeH = Math.min(115, (height - 130) / 2);
        const topY = Math.max(46, height * 0.16);
        const botY = topY + pipeH + 64;
        drawSinglePipe(ctx, 'closed', pipeX, topY, pipeW, pipeH, s, phaseRef.current);
        drawSinglePipe(ctx, 'open', pipeX, botY, pipeW, pipeH, s, phaseRef.current * 1.4);
      } else {
        const pipeH = Math.min(165, height * 0.42);
        const pipeY = (height - pipeH) / 2;
        drawSinglePipe(ctx, s.boundaryType, pipeX, pipeY, pipeW, pipeH, s, phaseRef.current);
      }

      // Length scale bar at bottom
      const scaleY = height - 28;
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(pipeX, scaleY);
      ctx.lineTo(pipeX + pipeW, scaleY);
      ctx.moveTo(pipeX, scaleY - 5);
      ctx.lineTo(pipeX, scaleY + 5);
      ctx.moveTo(pipeX + pipeW, scaleY - 5);
      ctx.lineTo(pipeX + pipeW, scaleY + 5);
      ctx.stroke();

      ctx.fillStyle = '#0369a1';
      ctx.font = '700 12px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`L = ${s.length.toFixed(2)} m`, pipeX + pipeW / 2, scaleY - 8);

      ctx.restore();
      animId = requestAnimationFrame(renderFrame);
    };

    animId = requestAnimationFrame(renderFrame);
    return () => {
      cancelAnimationFrame(animId);
    };
  }, []);

  const overtoneOptions = [
    { idx: 0, label: t.common.fundamental },
    { idx: 1, label: t.common.overtone1 },
    { idx: 2, label: t.common.overtone2 },
    { idx: 3, label: t.common.overtone3 },
  ];

  const isClosedPrimary = state.boundaryType !== 'open';
  const primaryFreq = isClosedPrimary ? closedFreq : openFreq;
  const primaryF1 = isClosedPrimary ? closedF1 : openF1;
  const primaryLambda = isClosedPrimary ? closedLambda : openLambda;

  // Node & Antinode coordinate arrays for telemetry
  const activeModeForCoords = state.boundaryType === 'open' ? 'open' : 'closed';
  const nodeCoords =
    activeModeForCoords === 'closed'
      ? Array.from({ length: k + 1 }, (_, m) => (((2 * m) / closedHarmonicN) * state.length).toFixed(3))
      : Array.from({ length: k + 1 }, (_, m) => (((2 * m + 1) / (2 * openHarmonicN)) * state.length).toFixed(3));
  const antinodeCoords =
    activeModeForCoords === 'closed'
      ? Array.from({ length: k + 1 }, (_, m) => (((2 * m + 1) / closedHarmonicN) * state.length).toFixed(3))
      : Array.from({ length: openHarmonicN + 1 }, (_, m) => ((m / openHarmonicN) * state.length).toFixed(3));

  return (
    <div className="flex flex-col lg:flex-row gap-3.5 items-stretch min-h-[calc(100vh-110px)]">
      {/* LEFT CONTROL DOCK */}
      <aside className="w-full lg:w-[275px] xl:w-[310px] 2xl:w-[340px] shrink-0 bg-white/95 backdrop-blur-sm border border-sky-200 shadow-sm rounded-2xl p-4 flex flex-col gap-3.5">
        <div className="border-b border-sky-100 pb-2.5">
          <h2 className="text-sm font-bold text-slate-950">{t.common.controls}</h2>
          <p className="text-xs text-slate-500 mt-0.5">{t.organPipe.subtitle}</p>
        </div>

        {/* Boundary Type Selector */}
        <div className="space-y-1.5">
          <span className="text-xs font-semibold text-slate-800">{t.organPipe.boundaryType}</span>
          <div className="flex flex-col gap-1.5">
            {(
              [
                { id: 'closed', label: t.organPipe.closedPipe },
                { id: 'open', label: t.organPipe.openPipe },
                { id: 'compare', label: t.organPipe.compareBoth },
              ] as { id: PipeBoundaryType; label: string }[]
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setState((prev) => ({ ...prev, boundaryType: opt.id }))}
                className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-colors text-left cursor-pointer ${
                  state.boundaryType === opt.id
                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                    : 'bg-sky-50/70 text-slate-800 border-sky-200 hover:bg-sky-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Pipe Length L */}
        <ProgressiveSlider
          id="pipe-length"
          label={t.organPipe.pipeLength}
          value={state.length}
          min={0.2}
          max={2.0}
          step={0.02}
          unit="m"
          displayValue={state.length.toFixed(2)}
          subLabel={`${(state.length * 100).toFixed(0)} cm`}
          onChange={(val) => setState((prev) => ({ ...prev, length: val }))}
        />

        {/* Temperature / Speed of Sound */}
        <ProgressiveSlider
          id="pipe-temp"
          label={`${t.common.temperature} (θ) → v = 332 + 0.6θ`}
          value={state.temperatureC}
          min={0}
          max={45}
          step={1}
          unit="°C"
          displayValue={state.temperatureC.toFixed(0)}
          subLabel={`${t.common.speedOfSound}: v = ${speedOfSound.toFixed(1)} m/s`}
          onChange={(val) => setState((prev) => ({ ...prev, temperatureC: val }))}
        />

        {/* Mode / Overtone Selector */}
        <div className="space-y-1.5 pt-1 border-t border-sky-100">
          <span className="text-xs font-semibold text-slate-800">
            {t.organPipe.overtoneSelector}
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            {overtoneOptions.map((opt) => (
              <button
                key={opt.idx}
                type="button"
                onClick={() => setState((prev) => ({ ...prev, overtoneIndex: opt.idx }))}
                className={`px-2.5 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                  state.overtoneIndex === opt.idx
                    ? 'bg-sky-700 text-white border-sky-800'
                    : 'bg-sky-50 text-slate-800 border-sky-200 hover:bg-sky-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Wave Visualization Overlays */}
        <div className="space-y-2 pt-1 border-t border-sky-100">
          <label className="text-xs font-semibold text-slate-800 flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={state.showDisplacementEnvelope}
              onChange={(e) =>
                setState((prev) => ({ ...prev, showDisplacementEnvelope: e.target.checked }))
              }
              className="accent-emerald-600 w-3.5 h-3.5 rounded"
            />
            <span className="text-emerald-700 font-semibold">{t.organPipe.displacementOverlay}</span>
          </label>
          <label className="text-xs font-semibold text-slate-800 flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={state.showPressureCurve}
              onChange={(e) =>
                setState((prev) => ({ ...prev, showPressureCurve: e.target.checked }))
              }
              className="accent-sky-600 w-3.5 h-3.5 rounded"
            />
            <span className="text-sky-700 font-semibold">{t.organPipe.pressureOverlay}</span>
          </label>
        </div>

        {/* Web Audio Play Pipe Buttons */}
        <div className="mt-auto pt-2 space-y-2">
          {state.boundaryType === 'compare' ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handlePlayTone('closed')}
                className={`py-2.5 px-3 rounded-xl font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  playingMode === 'closed'
                    ? 'bg-rose-600 hover:bg-rose-700 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                {playingMode === 'closed' ? <Square className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                <span>{t.organPipe.closedPipe}</span>
              </button>
              <button
                type="button"
                onClick={() => handlePlayTone('open')}
                className={`py-2.5 px-3 rounded-xl font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  playingMode === 'open'
                    ? 'bg-rose-600 hover:bg-rose-700 text-white'
                    : 'bg-sky-700 hover:bg-sky-800 text-white'
                }`}
              >
                {playingMode === 'open' ? <Square className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                <span>{t.organPipe.openPipe}</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => handlePlayTone(state.boundaryType === 'open' ? 'open' : 'closed')}
              className={`w-full py-2.5 px-4 rounded-xl font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
                playingMode
                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              {playingMode ? <Square className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              <span>{playingMode ? t.organPipe.stopToneButton : t.organPipe.playToneButton}</span>
            </button>
          )}
        </div>
      </aside>

      {/* CENTER CANVAS STAGE */}
      <section className="flex-1 min-w-0 bg-white/95 backdrop-blur-sm border border-sky-200 shadow-sm rounded-2xl p-4 flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-sky-100">
          <div>
            <h1 className="text-base font-bold text-slate-950">{t.organPipe.title}</h1>
            <p className="text-xs text-slate-600">
              {state.boundaryType === 'closed'
                ? t.organPipe.oddOnlyNote
                : state.boundaryType === 'open'
                ? t.organPipe.allHarmonicsNote
                : t.organPipe.ratioComparison}
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs font-medium text-slate-700">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-600 inline-block" />
              {t.common.node}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" />
              {t.common.antinode}
            </span>
          </div>
        </div>

        <div ref={containerRef} className="flex-1 min-h-[420px] relative mt-2 rounded-xl overflow-hidden bg-sky-50/40 border border-sky-100">
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />
        </div>
      </section>

      {/* RIGHT TELEMETRY PANEL */}
      <aside className="w-full lg:w-[270px] xl:w-[300px] 2xl:w-[330px] shrink-0 bg-white/95 backdrop-blur-sm border border-sky-200 shadow-sm rounded-2xl p-4 flex flex-col gap-3.5">
        <div className="border-b border-sky-100 pb-2.5">
          <h2 className="text-sm font-bold text-slate-950">{t.common.telemetry}</h2>
          <p className="text-[11px] font-mono text-sky-700 mt-0.5">
            {state.boundaryType === 'closed'
              ? t.organPipe.closedTag
              : state.boundaryType === 'open'
              ? t.organPipe.openTag
              : 'f_open = 2 · f_closed'}
          </p>
        </div>

        {state.boundaryType === 'compare' ? (
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200">
              <div className="text-[11px] font-semibold text-slate-600">{t.organPipe.closedPipe}</div>
              <div className="text-xl font-mono font-bold text-emerald-700 tabular-nums mt-0.5">
                {closedFreq.toFixed(1)} <span className="text-xs font-medium text-slate-500">Hz</span>
              </div>
              <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                n = {closedHarmonicN} · λ = {closedLambda.toFixed(2)}m
              </div>
            </div>
            <div className="p-3 rounded-xl bg-sky-50/70 border border-sky-200">
              <div className="text-[11px] font-semibold text-slate-600">{t.organPipe.openPipe}</div>
              <div className="text-xl font-mono font-bold text-sky-700 tabular-nums mt-0.5">
                {openFreq.toFixed(1)} <span className="text-xs font-medium text-slate-500">Hz</span>
              </div>
              <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                n = {openHarmonicN} · λ = {openLambda.toFixed(2)}m
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-xl bg-sky-50/70 border border-sky-100">
              <div className="text-[11px] font-semibold text-slate-500">
                {t.common.frequency} (f)
              </div>
              <div className="text-2xl font-mono font-bold text-emerald-700 tabular-nums mt-0.5">
                {primaryFreq.toFixed(1)}
                <span className="text-xs font-medium text-slate-500 ml-1">Hz</span>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-sky-50/70 border border-sky-100">
              <div className="text-[11px] font-semibold text-slate-500">
                {t.common.fundamental} (f₁)
              </div>
              <div className="text-2xl font-mono font-bold text-slate-900 tabular-nums mt-0.5">
                {primaryF1.toFixed(1)}
                <span className="text-xs font-medium text-slate-500 ml-1">Hz</span>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-[11px] font-semibold text-slate-500">{t.common.wavelength} (λ)</div>
              <div className="text-base font-mono font-bold text-slate-900 tabular-nums">
                {primaryLambda.toFixed(3)} <span className="text-xs text-slate-500">m</span>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-[11px] font-semibold text-slate-500">{t.common.speedOfSound} (v)</div>
              <div className="text-base font-mono font-bold text-slate-900 tabular-nums">
                {speedOfSound.toFixed(1)} <span className="text-xs text-slate-500">m/s</span>
              </div>
            </div>
          </div>
        )}

        {/* Formula Substitution Card */}
        <div className="p-3 rounded-xl bg-sky-50/60 border border-sky-200 space-y-2">
          <div className="text-xs font-bold text-slate-900">{t.common.formulaCard}</div>
          {state.boundaryType === 'compare' ? (
            <div className="font-mono text-[11px] text-slate-800 bg-white rounded-lg p-2.5 border border-sky-100 space-y-1.5 tabular-nums">
              <div>
                <span className="font-bold text-emerald-700">Closed:</span> f = ({closedHarmonicN} × {speedOfSound.toFixed(1)}) / (4 × {state.length.toFixed(2)}) = <strong>{closedFreq.toFixed(1)} Hz</strong>
              </div>
              <div>
                <span className="font-bold text-sky-700">Open:</span> f = ({openHarmonicN} × {speedOfSound.toFixed(1)}) / (2 × {state.length.toFixed(2)}) = <strong>{openFreq.toFixed(1)} Hz</strong>
              </div>
            </div>
          ) : (
            <div className="font-mono text-xs text-slate-800 bg-white rounded-lg p-2.5 border border-sky-100 leading-relaxed tabular-nums">
              <div className="font-semibold text-sky-800">
                {isClosedPrimary ? 'f = (2k + 1)v / 4L' : 'f = (k + 1)v / 2L'}
              </div>
              <div className="mt-1 text-[11px] text-slate-600">
                = ({isClosedPrimary ? closedHarmonicN : openHarmonicN} × {speedOfSound.toFixed(1)}) / ({isClosedPrimary ? 4 : 2} × {state.length.toFixed(2)})
              </div>
              <div className="mt-1 font-bold text-emerald-700">
                = {primaryFreq.toFixed(2)} Hz
              </div>
            </div>
          )}
        </div>

        {/* Harmonic Ladder (Proving Odd vs All Harmonics) */}
        <div className="space-y-2">
          <div className="text-xs font-bold text-slate-900">{t.common.harmonicLadder}</div>
          <div className="divide-y divide-sky-100 border border-sky-200 rounded-xl overflow-hidden bg-white">
            {[0, 1, 2, 3].map((idx) => {
              const cMult = 2 * idx + 1;
              const oMult = idx + 1;
              const isSelected = state.overtoneIndex === idx;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setState((prev) => ({ ...prev, overtoneIndex: idx }))}
                  className={`w-full px-3 py-1.5 flex items-center justify-between text-xs transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-50 text-emerald-950 font-bold'
                      : 'hover:bg-sky-50 text-slate-700'
                  }`}
                >
                  <span className="truncate">{overtoneOptions[idx].label}</span>
                  <span className="font-mono tabular-nums shrink-0 ml-2">
                    {state.boundaryType === 'compare'
                      ? `${cMult}f₁ᶜ / ${oMult}f₁ᵒ`
                      : state.boundaryType === 'closed'
                      ? `${cMult}f₁ (${(cMult * closedF1).toFixed(0)} Hz)`
                      : `${oMult}f₁ (${(oMult * openF1).toFixed(0)} Hz)`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Node & Antinode Coordinates */}
        <div className="space-y-2 mt-auto">
          <div className="text-xs font-bold text-slate-900">{t.common.nodeAntinodeMap}</div>
          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono tabular-nums">
            <div className="p-2 rounded-lg bg-rose-50/70 border border-rose-200">
              <div className="font-bold text-rose-700 mb-1">
                {t.common.nodes} ({nodeCoords.length})
              </div>
              <div className="text-slate-700 leading-snug">
                {nodeCoords.map((p) => `${p}m`).join(', ')}
              </div>
            </div>
            <div className="p-2 rounded-lg bg-emerald-50/70 border border-emerald-200">
              <div className="font-bold text-emerald-700 mb-1">
                {t.common.antinodes} ({antinodeCoords.length})
              </div>
              <div className="text-slate-700 leading-snug">
                {antinodeCoords.map((p) => `${p}m`).join(', ')}
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
};
