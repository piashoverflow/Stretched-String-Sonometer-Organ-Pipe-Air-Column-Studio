import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Volume2, Sparkles, Crosshair } from 'lucide-react';
import {
  GRAVITY,
  Language,
  SonometerState,
  WIRE_MATERIALS,
  WireMaterialId,
} from '../../types/physics';
import { TranslationBundle } from '../../i18n/translations';
import { ProgressiveSlider } from '../ProgressiveSlider';
import { audioEngine } from '../../utils/audioEngine';
import { drawRoundRectPath, syncCanvasSize } from '../../utils/canvasHelpers';

interface SonometerModuleProps {
  lang: Language;
  t: TranslationBundle;
  state: SonometerState;
  setState: React.Dispatch<React.SetStateAction<SonometerState>>;
}

interface RiderPhysics {
  status: 'idle' | 'stable' | 'thrown';
  yOffset: number;
  vy: number;
  vx: number;
  xOffset: number;
  angle: number;
  angVel: number;
}

export const SonometerModule: React.FC<SonometerModuleProps> = ({
  lang,
  t,
  state,
  setState,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Physics calculations
  const tensionN = state.massKg * GRAVITY;
  const radiusM = state.radiusMm / 1000;
  const materialInfo = WIRE_MATERIALS[state.material];
  const computedMuKgM = Math.PI * radiusM * radiusM * materialInfo.density;
  const muKgM = state.useManualMu ? state.manualMuGramsPerM / 1000 : computedMuKgM;
  const muGramsPerM = muKgM * 1000;
  const waveSpeed = Math.sqrt(tensionN / muKgM);
  const fundamentalFreq = waveSpeed / (2 * state.length);
  const activeFreq = state.harmonicP * fundamentalFreq;
  const activeWavelength = (2 * state.length) / state.harmonicP;

  // Animation & interaction refs for 60fps canvas without React re-render overhead
  const stateRef = useRef(state);
  stateRef.current = state;
  const activeFreqRef = useRef(activeFreq);
  activeFreqRef.current = activeFreq;

  const pluckEnergyRef = useRef(0.75); // 0..1 amplitude multiplier (stays gently oscillating or bursts on pluck)
  const continuousDriveRef = useRef(true);
  const phaseRef = useRef(0);
  const lastTimeRef = useRef<number | null>(null);
  const dragTargetRef = useRef<'b1' | 'b2' | 'rider' | null>(null);
  const hoverTargetRef = useRef<'b1' | 'b2' | 'rider' | 'string' | null>(null);
  const [hoverTarget, setHoverTarget] = useState<'b1' | 'b2' | 'rider' | 'string' | null>(null);

  const riderPhysRef = useRef<RiderPhysics>({
    status: 'idle',
    yOffset: 0,
    vy: 0,
    vx: 0,
    xOffset: 0,
    angle: 0,
    angVel: 0,
  });
  const [riderStatus, setRiderStatus] = useState<'idle' | 'stable' | 'thrown'>('idle');

  const triggerPluck = useCallback((playAudio: boolean) => {
    pluckEnergyRef.current = 1.0;
    continuousDriveRef.current = true;
    const s = stateRef.current;

    if (playAudio) {
      audioEngine.playPluckedString(activeFreqRef.current, s.material);
    }

    if (s.paperRiderActive) {
      const localAmp = Math.abs(Math.sin(s.harmonicP * Math.PI * s.paperRiderNormPos));
      if (localAmp < 0.18) {
        riderPhysRef.current = {
          status: 'stable',
          yOffset: 0,
          vy: 0,
          vx: 0,
          xOffset: 0,
          angle: 0,
          angVel: 0,
        };
        setRiderStatus('stable');
      } else {
        riderPhysRef.current = {
          status: 'thrown',
          yOffset: -4,
          vy: -(210 + localAmp * 160),
          vx: (s.paperRiderNormPos > 0.5 ? 1 : -1) * (35 + localAmp * 40),
          xOffset: 0,
          angle: 0,
          angVel: (Math.random() > 0.5 ? 1 : -1) * (6 + localAmp * 6),
        };
        setRiderStatus('thrown');
      }
    }
  }, []);

  const resetRiderToString = useCallback((newNormPos?: number) => {
    riderPhysRef.current = {
      status: 'idle',
      yOffset: 0,
      vy: 0,
      vx: 0,
      xOffset: 0,
      angle: 0,
      angVel: 0,
    };
    setRiderStatus('idle');
    if (typeof newNormPos === 'number') {
      setState((prev) => ({ ...prev, paperRiderActive: true, paperRiderNormPos: newNormPos }));
    }
  }, [setState]);

  // Helper to map canvas coordinates <-> bench meters (0.00 to 1.00 m)
  const getLayoutMetrics = (width: number, height: number) => {
    const padLeft = Math.max(40, width * 0.065);
    const padRight = Math.max(82, width * 0.14);
    const benchWidth = Math.max(160, width - padLeft - padRight);
    const stringY = height * 0.43;
    const boxTopY = stringY + 34;
    const boxHeight = Math.min(92, height * 0.2);
    const pulleyX = padLeft + benchWidth + 22;
    const pulleyY = stringY + 12;
    return { padLeft, padRight, benchWidth, stringY, boxTopY, boxHeight, pulleyX, pulleyY };
  };

  // Pointer interactions on canvas
  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      width: rect.width,
      height: rect.height,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pt = getCanvasPoint(e);
    const m = getLayoutMetrics(pt.width, pt.height);
    const s = stateRef.current;

    const b1X = m.padLeft + s.bridge1Pos * m.benchWidth;
    const b2X = m.padLeft + (s.bridge1Pos + s.length) * m.benchWidth;
    const riderX = b1X + s.paperRiderNormPos * (b2X - b1X);

    // Check rider first if active and not thrown far
    if (
      s.paperRiderActive &&
      riderPhysRef.current.status !== 'thrown' &&
      Math.abs(pt.x - riderX) < 18 &&
      Math.abs(pt.y - (m.stringY - 10)) < 26
    ) {
      dragTargetRef.current = 'rider';
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    // Check bridges B1 and B2
    if (Math.abs(pt.x - b1X) < 20 && pt.y >= m.stringY - 20 && pt.y <= m.boxTopY + 26) {
      dragTargetRef.current = 'b1';
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    if (Math.abs(pt.x - b2X) < 20 && pt.y >= m.stringY - 20 && pt.y <= m.boxTopY + 26) {
      dragTargetRef.current = 'b2';
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    // Clicking along the vibrating string plucks it
    if (pt.x >= b1X && pt.x <= b2X && Math.abs(pt.y - m.stringY) < 42) {
      triggerPluck(true);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pt = getCanvasPoint(e);
    const m = getLayoutMetrics(pt.width, pt.height);
    const s = stateRef.current;

    if (dragTargetRef.current) {
      const meterPos = Math.max(0, Math.min(1, (pt.x - m.padLeft) / m.benchWidth));
      if (dragTargetRef.current === 'b1') {
        const b2 = s.bridge1Pos + s.length;
        const clampedB1 = Math.max(0, Math.min(b2 - 0.1, meterPos));
        const newLength = Math.round((b2 - clampedB1) * 100) / 100;
        const newB1 = Math.round((b2 - newLength) * 100) / 100;
        setState((prev) => ({ ...prev, bridge1Pos: newB1, length: newLength }));
        if (riderPhysRef.current.status === 'thrown') {
          resetRiderToString();
        }
      } else if (dragTargetRef.current === 'b2') {
        const clampedB2 = Math.min(1, Math.max(s.bridge1Pos + 0.1, meterPos));
        const newLength = Math.round((clampedB2 - s.bridge1Pos) * 100) / 100;
        setState((prev) => ({ ...prev, length: newLength }));
        if (riderPhysRef.current.status === 'thrown') {
          resetRiderToString();
        }
      } else if (dragTargetRef.current === 'rider') {
        const b1X = m.padLeft + s.bridge1Pos * m.benchWidth;
        const b2X = m.padLeft + (s.bridge1Pos + s.length) * m.benchWidth;
        const norm = Math.max(0.03, Math.min(0.97, (pt.x - b1X) / Math.max(10, b2X - b1X)));
        riderPhysRef.current.status = 'idle';
        riderPhysRef.current.yOffset = 0;
        riderPhysRef.current.xOffset = 0;
        riderPhysRef.current.angle = 0;
        setRiderStatus('idle');
        setState((prev) => ({ ...prev, paperRiderNormPos: norm }));
      }
      return;
    }

    // Hover feedback
    const b1X = m.padLeft + s.bridge1Pos * m.benchWidth;
    const b2X = m.padLeft + (s.bridge1Pos + s.length) * m.benchWidth;
    const riderX = b1X + s.paperRiderNormPos * (b2X - b1X);

    let nextHover: 'b1' | 'b2' | 'rider' | 'string' | null = null;
    if (
      s.paperRiderActive &&
      riderPhysRef.current.status !== 'thrown' &&
      Math.abs(pt.x - riderX) < 18 &&
      Math.abs(pt.y - (m.stringY - 10)) < 26
    ) {
      nextHover = 'rider';
    } else if (Math.abs(pt.x - b1X) < 20 && pt.y >= m.stringY - 20 && pt.y <= m.boxTopY + 26) {
      nextHover = 'b1';
    } else if (Math.abs(pt.x - b2X) < 20 && pt.y >= m.stringY - 20 && pt.y <= m.boxTopY + 26) {
      nextHover = 'b2';
    } else if (pt.x >= b1X && pt.x <= b2X && Math.abs(pt.y - m.stringY) < 42) {
      nextHover = 'string';
    }
    hoverTargetRef.current = nextHover;
    setHoverTarget(nextHover);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragTargetRef.current) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      dragTargetRef.current = null;
    }
  };

  // High-DPI 60fps Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let animId = 0;

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
      const freq = activeFreqRef.current;

      // Update wave phase (visually scaled angular speed so standing loops are crisp & readable)
      const visualOmega = 10 + Math.min(28, freq * 0.045);
      phaseRef.current += visualOmega * dt;

      // Gently settle pluck burst back to steady driven resonance amplitude
      if (pluckEnergyRef.current > 0.62) {
        pluckEnergyRef.current = Math.max(0.62, pluckEnergyRef.current - dt * 0.25);
      }

      // Update Paper Rider projectile physics if thrown
      const rp = riderPhysRef.current;
      if (rp.status === 'thrown') {
        rp.vy += 640 * dt; // gravity
        rp.yOffset += rp.vy * dt;
        rp.xOffset += rp.vx * dt;
        rp.angle += rp.angVel * dt;
        if (rp.yOffset > 200) {
          rp.yOffset = 200;
          rp.vy = 0;
          rp.vx = 0;
          rp.angVel = 0;
        }
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      // Subtle scientific blueprint grid
      ctx.strokeStyle = 'rgba(14, 165, 233, 0.08)';
      ctx.lineWidth = 1;
      const gridStep = 28;
      for (let gx = 0; gx < width; gx += gridStep) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, height);
        ctx.stroke();
      }
      for (let gy = 0; gy < height; gy += gridStep) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(width, gy);
        ctx.stroke();
      }

      const m = getLayoutMetrics(width, height);
      const b1X = m.padLeft + s.bridge1Pos * m.benchWidth;
      const b2X = m.padLeft + (s.bridge1Pos + s.length) * m.benchWidth;
      const vibSpanPx = b2X - b1X;

      // 1. Sonometer Hollow Resonance Box (Sleek Light-Oak & Brushed Aluminum Lab Finish)
      const boxLeft = m.padLeft - 24;
      const boxWidth = m.benchWidth + 48;
      const boxGrad = ctx.createLinearGradient(0, m.boxTopY, 0, m.boxTopY + m.boxHeight);
      boxGrad.addColorStop(0, '#f8fafc');
      boxGrad.addColorStop(0.18, '#e2e8f0');
      boxGrad.addColorStop(1, '#cbd5e1');

      ctx.fillStyle = boxGrad;
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.5;
      drawRoundRectPath(ctx, boxLeft, m.boxTopY, boxWidth, m.boxHeight, 8);
      ctx.fill();
      ctx.stroke();

      // Top plate highlight strip
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(boxLeft + 2, m.boxTopY, boxWidth - 4, 4);

      // Acoustic Soundholes on Resonance Box
      const holeY = m.boxTopY + m.boxHeight * 0.62;
      [0.26, 0.74].forEach((frac) => {
        const hx = m.padLeft + m.benchWidth * frac;
        ctx.beginPath();
        ctx.arc(hx, holeY, 16, 0, Math.PI * 2);
        ctx.fillStyle = '#1e293b';
        ctx.fill();
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2;
        ctx.stroke();
      });

      // Calibrated Meter Ruler (0 cm to 100 cm)
      const rulerY = m.boxTopY + 10;
      ctx.fillStyle = '#fefce8';
      ctx.strokeStyle = '#ca8a04';
      ctx.lineWidth = 1;
      ctx.fillRect(m.padLeft, rulerY, m.benchWidth, 22);
      ctx.strokeRect(m.padLeft, rulerY, m.benchWidth, 22);

      ctx.fillStyle = '#0f172a';
      ctx.font = '600 10px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      for (let cm = 0; cm <= 100; cm += 2) {
        const tx = m.padLeft + (cm / 100) * m.benchWidth;
        const isMajor = cm % 10 === 0;
        const isMid = cm % 5 === 0;
        const tickH = isMajor ? 9 : isMid ? 6 : 3.5;
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = isMajor ? 1.2 : 0.8;
        ctx.beginPath();
        ctx.moveTo(tx, rulerY);
        ctx.lineTo(tx, rulerY + tickH);
        ctx.stroke();
        if (isMajor) {
          ctx.fillText(`${cm}`, tx, rulerY + 19);
        }
      }

      // 2. Fixed Outer Peg (Left) & Frictionless Brass Pulley (Right) + Hanging Mass
      const leftPegX = m.padLeft - 14;
      ctx.fillStyle = '#334155';
      drawRoundRectPath(ctx, leftPegX - 4, m.stringY - 8, 8, m.boxTopY - m.stringY + 8, 3);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(leftPegX, m.stringY, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#0f172a';
      ctx.fill();

      // Pulley bracket & wheel
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(boxLeft + boxWidth - 4, m.boxTopY + 8);
      ctx.lineTo(m.pulleyX, m.pulleyY);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(m.pulleyX, m.pulleyY, 13, 0, Math.PI * 2);
      ctx.fillStyle = '#fbbf24';
      ctx.fill();
      ctx.strokeStyle = '#92400e';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(m.pulleyX, m.pulleyY, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#451a03';
      ctx.fill();

      // Wire from left peg -> B1, and B2 -> pulley -> hanging weight
      const wireMat = WIRE_MATERIALS[s.material];
      const wireLineWidth = Math.max(1.4, Math.min(3.4, 1.2 + s.radiusMm * 1.8));
      ctx.strokeStyle = wireMat.color;
      ctx.lineWidth = wireLineWidth;

      ctx.beginPath();
      ctx.moveTo(leftPegX, m.stringY);
      ctx.lineTo(b1X, m.stringY);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(b2X, m.stringY);
      ctx.lineTo(m.pulleyX, m.pulleyY - 12);
      ctx.stroke();

      // Vertical hanging wire from pulley right edge
      const hangX = m.pulleyX + 12;
      const weightTopY = Math.min(height - 96, m.pulleyY + 86);
      ctx.beginPath();
      ctx.moveTo(hangX, m.pulleyY);
      ctx.lineTo(hangX, weightTopY);
      ctx.stroke();

      // Hanging Slotted Weights (proportional discs)
      const numDiscs = Math.max(1, Math.min(8, Math.ceil(s.massKg / 2.5)));
      const hangerWidth = 36;
      ctx.fillStyle = '#334155';
      ctx.fillRect(hangX - 2, weightTopY, 4, numDiscs * 7 + 8);
      for (let d = 0; d < numDiscs; d++) {
        const dy = weightTopY + 6 + d * 7;
        ctx.fillStyle = d % 2 === 0 ? '#475569' : '#64748b';
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1;
        drawRoundRectPath(ctx, hangX - hangerWidth / 2, dy, hangerWidth, 5.5, 2);
        ctx.fill();
        ctx.stroke();
      }
      // Mass label & Tension vector arrow
      const weightBottomY = weightTopY + 14 + numDiscs * 7;
      ctx.fillStyle = '#0f172a';
      ctx.font = '700 11px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${s.massKg.toFixed(1)} kg`, hangX, weightBottomY + 13);
      ctx.fillStyle = '#0369a1';
      ctx.font = '600 10px "IBM Plex Mono", monospace';
      ctx.fillText(`T = ${(s.massKg * GRAVITY).toFixed(1)} N`, hangX, weightBottomY + 26);

      // 3. Standing Wave Envelope & Oscillating String between B1 and B2
      const maxAmpPx = Math.min(54, Math.max(24, 24 + (1 - Math.min(1, s.massKg / 25)) * 22)) * pluckEnergyRef.current;
      const p = s.harmonicP;
      const cosPhase = Math.cos(phaseRef.current);

      // Soft translucent wave loop fill
      ctx.save();
      ctx.beginPath();
      for (let i = 0; i <= 140; i++) {
        const u = i / 140;
        const x = b1X + u * vibSpanPx;
        const env = Math.sin(p * Math.PI * u) * maxAmpPx;
        if (i === 0) ctx.moveTo(x, m.stringY - env);
        else ctx.lineTo(x, m.stringY - env);
      }
      for (let i = 140; i >= 0; i--) {
        const u = i / 140;
        const x = b1X + u * vibSpanPx;
        const env = Math.sin(p * Math.PI * u) * maxAmpPx;
        ctx.lineTo(x, m.stringY + env);
      }
      ctx.closePath();
      const fillGrad = ctx.createLinearGradient(0, m.stringY - maxAmpPx, 0, m.stringY + maxAmpPx);
      fillGrad.addColorStop(0, 'rgba(16, 185, 129, 0.16)');
      fillGrad.addColorStop(0.5, 'rgba(14, 165, 233, 0.06)');
      fillGrad.addColorStop(1, 'rgba(16, 185, 129, 0.16)');
      ctx.fillStyle = fillGrad;
      ctx.fill();
      ctx.restore();

      // Dashed upper and lower standing-wave envelopes
      [1, -1].forEach((sign) => {
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = 'rgba(5, 150, 105, 0.45)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        for (let i = 0; i <= 120; i++) {
          const u = i / 120;
          const x = b1X + u * vibSpanPx;
          const y = m.stringY + sign * Math.sin(p * Math.PI * u) * maxAmpPx;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.restore();
      });

      // Equilibrium center line
      ctx.save();
      ctx.setLineDash([2, 4]);
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(b1X, m.stringY);
      ctx.lineTo(b2X, m.stringY);
      ctx.stroke();
      ctx.restore();

      // Live oscillating string curve
      ctx.strokeStyle = wireMat.color;
      ctx.lineWidth = wireLineWidth + 0.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i <= 160; i++) {
        const u = i / 160;
        const x = b1X + u * vibSpanPx;
        const y = m.stringY - Math.sin(p * Math.PI * u) * maxAmpPx * cosPhase;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Specular metallic highlight on string
      ctx.strokeStyle = wireMat.highlight;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (let i = 0; i <= 160; i++) {
        const u = i / 160;
        const x = b1X + u * vibSpanPx;
        const y = m.stringY - Math.sin(p * Math.PI * u) * maxAmpPx * cosPhase - 0.8;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // 4. Glowing Crimson Nodes (N) & Emerald Antinodes (A)
      for (let k = 0; k <= p; k++) {
        const nx = b1X + (k / p) * vibSpanPx;
        ctx.save();
        ctx.shadowColor = 'rgba(225, 29, 72, 0.55)';
        ctx.shadowBlur = 8;
        ctx.fillStyle = '#e11d48';
        ctx.beginPath();
        ctx.arc(nx, m.stringY, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.fillStyle = '#be123c';
        ctx.font = '700 11px "IBM Plex Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('N', nx, m.stringY - 12);
      }

      for (let k = 0; k < p; k++) {
        const ax = b1X + ((k + 0.5) / p) * vibSpanPx;
        const envTop = m.stringY - maxAmpPx;
        ctx.save();
        ctx.shadowColor = 'rgba(5, 150, 105, 0.5)';
        ctx.shadowBlur = 8;
        ctx.fillStyle = '#059669';
        ctx.beginPath();
        ctx.arc(ax, envTop, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(ax, m.stringY + maxAmpPx, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.fillStyle = '#047857';
        ctx.font = '700 11px "IBM Plex Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('A', ax, envTop - 10);
      }

      // 5. Draggable Wooden Knife-Edge Bridges (B1 and B2)
      const drawBridge = (bx: number, label: string, isHovered: boolean) => {
        ctx.save();
        ctx.fillStyle = isHovered ? '#b45309' : '#92400e';
        ctx.strokeStyle = '#451a03';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(bx, m.stringY + 2);
        ctx.lineTo(bx + 11, m.boxTopY);
        ctx.lineTo(bx - 11, m.boxTopY);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Knife-edge brass tip
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(bx, m.stringY + 3, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Handle badge below bridge
        ctx.fillStyle = isHovered ? '#059669' : '#0f172a';
        ctx.font = '700 11px "Plus Jakarta Sans", "Noto Sans Bengali", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(label, bx, m.stringY - 26);
        ctx.restore();
      };

      drawBridge(b1X, 'B₁', hoverTargetRef.current === 'b1' || dragTargetRef.current === 'b1');
      drawBridge(b2X, 'B₂', hoverTargetRef.current === 'b2' || dragTargetRef.current === 'b2');

      // Length Dimension Bracket above bridges
      const dimY = Math.max(30, m.stringY - maxAmpPx - 36);
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(b1X, dimY);
      ctx.lineTo(b2X, dimY);
      ctx.moveTo(b1X, dimY - 5);
      ctx.lineTo(b1X, dimY + 5);
      ctx.moveTo(b2X, dimY - 5);
      ctx.lineTo(b2X, dimY + 5);
      ctx.stroke();

      const lengthText = `l = ${s.length.toFixed(2)} m (${(s.length * 100).toFixed(0)} cm)`;
      ctx.font = '700 12px "IBM Plex Mono", monospace';
      const tw = ctx.measureText(lengthText).width + 16;
      ctx.fillStyle = '#f0f9ff';
      ctx.fillRect((b1X + b2X) / 2 - tw / 2, dimY - 10, tw, 20);
      ctx.fillStyle = '#0369a1';
      ctx.textAlign = 'center';
      ctx.fillText(lengthText, (b1X + b2X) / 2, dimY + 4);

      // 6. Paper Rider (Folded V-shaped paper slip)
      if (s.paperRiderActive) {
        const riderBaseX = b1X + s.paperRiderNormPos * vibSpanPx;
        const stringLocalY =
          m.stringY - Math.sin(p * Math.PI * s.paperRiderNormPos) * maxAmpPx * cosPhase;
        const rx = riderBaseX + rp.xOffset;
        const ry = rp.status === 'thrown' ? m.stringY + rp.yOffset : stringLocalY;

        ctx.save();
        ctx.translate(rx, ry);
        ctx.rotate(rp.angle);

        // Paper V-shape sitting astride string
        ctx.fillStyle = rp.status === 'thrown' ? '#fecdd3' : '#fef08a';
        ctx.strokeStyle = rp.status === 'thrown' ? '#e11d48' : '#ca8a04';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(0, -16);
        ctx.lineTo(9, 4);
        ctx.lineTo(3, 4);
        ctx.lineTo(0, -6);
        ctx.lineTo(-3, 4);
        ctx.lineTo(-9, 4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.restore();
      }

      ctx.restore();
      animId = requestAnimationFrame(renderFrame);
    };

    animId = requestAnimationFrame(renderFrame);
    return () => {
      cancelAnimationFrame(animId);
    };
  }, []);

  // Node and Antinode coordinate list
  const nodePositions = Array.from({ length: state.harmonicP + 1 }, (_, k) =>
    ((k / state.harmonicP) * state.length).toFixed(3)
  );
  const antinodePositions = Array.from({ length: state.harmonicP }, (_, k) =>
    (((k + 0.5) / state.harmonicP) * state.length).toFixed(3)
  );

  const cursorClass =
    dragTargetRef.current || hoverTarget === 'b1' || hoverTarget === 'b2' || hoverTarget === 'rider'
      ? 'cursor-ew-resize'
      : hoverTarget === 'string'
      ? 'cursor-pointer'
      : 'cursor-default';

  return (
    <div className="flex flex-col lg:flex-row gap-3.5 items-stretch min-h-[calc(100vh-110px)]">
      {/* LEFT CONTROL DOCK */}
      <aside className="w-full lg:w-[275px] xl:w-[310px] 2xl:w-[340px] shrink-0 bg-white/95 backdrop-blur-sm border border-sky-200 shadow-sm rounded-2xl p-4 flex flex-col gap-3.5">
        <div className="border-b border-sky-100 pb-2.5">
          <h2 className="text-sm font-bold text-slate-950">{t.common.controls}</h2>
          <p className="text-xs text-slate-500 mt-0.5">{t.sonometer.subtitle}</p>
        </div>

        {/* Length Slider */}
        <ProgressiveSlider
          id="sono-length"
          label={t.sonometer.vibratingLength}
          value={state.length}
          min={0.1}
          max={1.0}
          step={0.01}
          unit="m"
          displayValue={state.length.toFixed(2)}
          subLabel={`${(state.length * 100).toFixed(0)} cm`}
          onChange={(val) => {
            setState((prev) => {
              const clampedB1 = Math.min(prev.bridge1Pos, 1 - val);
              return { ...prev, length: val, bridge1Pos: Math.max(0, clampedB1) };
            });
          }}
        />

        {/* Hanging Mass / Tension Slider */}
        <ProgressiveSlider
          id="sono-mass"
          label={t.sonometer.hangingMass}
          value={state.massKg}
          min={0.5}
          max={20.0}
          step={0.5}
          unit="kg"
          displayValue={state.massKg.toFixed(1)}
          subLabel={`${t.sonometer.tensionForce}: ${tensionN.toFixed(2)} N`}
          onChange={(val) => setState((prev) => ({ ...prev, massKg: val }))}
        />

        {/* Wire Material Selector */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-800">
              {t.sonometer.wireMaterial}
            </span>
            <span className="text-[11px] font-mono tabular-nums text-slate-500">
              ρ = {materialInfo.density} kg/m³
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {(Object.keys(WIRE_MATERIALS) as WireMaterialId[]).map((matId) => {
              const active = state.material === matId;
              return (
                <button
                  key={matId}
                  type="button"
                  onClick={() => setState((prev) => ({ ...prev, material: matId }))}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors text-left cursor-pointer ${
                    active
                      ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                      : 'bg-sky-50/70 text-slate-800 border-sky-200 hover:bg-sky-100'
                  }`}
                >
                  {t.sonometer.materials[matId]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Wire Radius OR Manual Mu */}
        <div className="space-y-2.5 pt-1 border-t border-sky-100">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-semibold text-slate-800 flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={state.useManualMu}
                onChange={(e) =>
                  setState((prev) => ({ ...prev, useManualMu: e.target.checked }))
                }
                className="accent-emerald-600 w-3.5 h-3.5 rounded"
              />
              {t.sonometer.manualMuOverride}
            </label>
            <span className="text-[11px] font-mono tabular-nums text-emerald-700 font-semibold">
              μ = {muGramsPerM.toFixed(2)} g/m
            </span>
          </div>

          {!state.useManualMu ? (
            <ProgressiveSlider
              id="sono-radius"
              label={t.sonometer.wireRadius}
              value={state.radiusMm}
              min={0.15}
              max={1.0}
              step={0.05}
              unit="mm"
              displayValue={state.radiusMm.toFixed(2)}
              subLabel={`μ = πr²ρ = ${muKgM.toExponential(3)} kg/m`}
              onChange={(val) => setState((prev) => ({ ...prev, radiusMm: val }))}
            />
          ) : (
            <ProgressiveSlider
              id="sono-mu"
              label={t.sonometer.linearDensity}
              value={state.manualMuGramsPerM}
              min={0.5}
              max={15.0}
              step={0.1}
              unit="g/m"
              displayValue={state.manualMuGramsPerM.toFixed(1)}
              subLabel={`μ = ${(state.manualMuGramsPerM / 1000).toExponential(3)} kg/m`}
              onChange={(val) =>
                setState((prev) => ({ ...prev, manualMuGramsPerM: val }))
              }
            />
          )}
        </div>

        {/* Harmonic Mode Selector (p = 1..5) */}
        <div className="space-y-1.5 pt-1 border-t border-sky-100">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-800">
              {t.sonometer.harmonicMode}
            </span>
            <span className="text-[11px] font-mono font-bold text-sky-700">
              p = {state.harmonicP}
            </span>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {[1, 2, 3, 4, 5].map((pVal) => (
              <button
                key={pVal}
                type="button"
                onClick={() => {
                  setState((prev) => ({ ...prev, harmonicP: pVal }));
                  if (riderStatus === 'thrown') resetRiderToString();
                }}
                className={`py-1.5 rounded-lg text-xs font-mono font-bold border transition-colors cursor-pointer ${
                  state.harmonicP === pVal
                    ? 'bg-sky-700 text-white border-sky-800'
                    : 'bg-sky-50 text-slate-800 border-sky-200 hover:bg-sky-100'
                }`}
              >
                p={pVal}
              </button>
            ))}
          </div>
          <div className="text-[11px] font-medium text-slate-600">
            {t.sonometer.harmonicNames[state.harmonicP]}
          </div>
        </div>

        {/* Paper Rider Interactive Controls */}
        <div className="space-y-2 pt-1 border-t border-sky-100">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-800 flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={state.paperRiderActive}
                onChange={(e) => {
                  resetRiderToString();
                  setState((prev) => ({ ...prev, paperRiderActive: e.target.checked }));
                }}
                className="accent-emerald-600 w-3.5 h-3.5 rounded"
              />
              {t.sonometer.paperRider}
            </label>
            <span
              className={`text-[11px] font-semibold ${
                riderStatus === 'thrown'
                  ? 'text-rose-600'
                  : riderStatus === 'stable'
                  ? 'text-emerald-700'
                  : 'text-slate-500'
              }`}
            >
              {riderStatus === 'thrown'
                ? t.sonometer.riderStatusThrown
                : riderStatus === 'stable'
                ? t.sonometer.riderStatusStable
                : t.sonometer.riderStatusIdle}
            </span>
          </div>
          {state.paperRiderActive && (
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  const nodePos = state.harmonicP === 1 ? 0.0 : 1 / state.harmonicP;
                  resetRiderToString(Math.max(0.05, nodePos));
                }}
                className="px-2 py-1.5 text-[11px] font-semibold rounded-lg bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 cursor-pointer flex items-center justify-center gap-1"
              >
                <Crosshair className="w-3 h-3" />
                {t.sonometer.placeAtNode}
              </button>
              <button
                type="button"
                onClick={() => {
                  const antiPos = 0.5 / state.harmonicP;
                  resetRiderToString(antiPos);
                }}
                className="px-2 py-1.5 text-[11px] font-semibold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 cursor-pointer flex items-center justify-center gap-1"
              >
                <Sparkles className="w-3 h-3" />
                {t.sonometer.placeAtAntinode}
              </button>
            </div>
          )}
        </div>

        {/* Web Audio Pluck CTA */}
        <div className="mt-auto pt-2">
          <button
            type="button"
            onClick={() => triggerPluck(true)}
            className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Volume2 className="w-4 h-4 shrink-0" />
            <span>{t.sonometer.pluckButton}</span>
          </button>
        </div>
      </aside>

      {/* CENTER CANVAS STAGE */}
      <section className="flex-1 min-w-0 bg-white/95 backdrop-blur-sm border border-sky-200 shadow-sm rounded-2xl p-4 flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-sky-100">
          <div>
            <h1 className="text-base font-bold text-slate-950">{t.sonometer.title}</h1>
            <p className="text-xs text-slate-600">{t.sonometer.bridgeDragHint}</p>
          </div>
          <div className="flex items-center gap-4 text-xs font-medium text-slate-700">
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
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className={`absolute inset-0 w-full h-full block touch-none ${cursorClass}`}
          />
        </div>
      </section>

      {/* RIGHT TELEMETRY PANEL */}
      <aside className="w-full lg:w-[270px] xl:w-[300px] 2xl:w-[330px] shrink-0 bg-white/95 backdrop-blur-sm border border-sky-200 shadow-sm rounded-2xl p-4 flex flex-col gap-3.5">
        <div className="border-b border-sky-100 pb-2.5">
          <h2 className="text-sm font-bold text-slate-950">{t.common.telemetry}</h2>
          <p className="text-[11px] font-mono text-sky-700 mt-0.5">{t.sonometer.lawSummary}</p>
        </div>

        {/* Key Numeric Readouts */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="p-3 rounded-xl bg-sky-50/70 border border-sky-100">
            <div className="text-[11px] font-semibold text-slate-500">
              {t.common.frequency} (f<sub>{state.harmonicP}</sub>)
            </div>
            <div className="text-2xl font-mono font-bold text-emerald-700 tabular-nums mt-0.5">
              {activeFreq.toFixed(1)}
              <span className="text-xs font-medium text-slate-500 ml-1">Hz</span>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-sky-50/70 border border-sky-100">
            <div className="text-[11px] font-semibold text-slate-500">
              {t.common.fundamental} (f₁)
            </div>
            <div className="text-2xl font-mono font-bold text-slate-900 tabular-nums mt-0.5">
              {fundamentalFreq.toFixed(1)}
              <span className="text-xs font-medium text-slate-500 ml-1">Hz</span>
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-[11px] font-semibold text-slate-500">{t.common.wavelength} (λ)</div>
            <div className="text-base font-mono font-bold text-slate-900 tabular-nums">
              {activeWavelength.toFixed(3)} <span className="text-xs text-slate-500">m</span>
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-[11px] font-semibold text-slate-500">{t.common.waveSpeed} (v)</div>
            <div className="text-base font-mono font-bold text-slate-900 tabular-nums">
              {waveSpeed.toFixed(1)} <span className="text-xs text-slate-500">m/s</span>
            </div>
          </div>
        </div>

        {/* Formula & Live Substitution Card */}
        <div className="p-3 rounded-xl bg-sky-50/60 border border-sky-200 space-y-2">
          <div className="text-xs font-bold text-slate-900">{t.common.formulaCard}</div>
          <div className="font-mono text-xs text-slate-800 bg-white rounded-lg p-2.5 border border-sky-100 leading-relaxed">
            <div className="font-semibold text-sky-800">
              f = (p / 2l) · √(T / μ)
            </div>
            <div className="mt-1.5 text-[11px] text-slate-600 tabular-nums">
              = ({state.harmonicP} / (2 × {state.length.toFixed(2)})) × √({tensionN.toFixed(1)} / {muKgM.toExponential(2)})
            </div>
            <div className="mt-1 font-bold text-emerald-700 tabular-nums">
              = {activeFreq.toFixed(2)} Hz
            </div>
          </div>
        </div>

        {/* Harmonic Ladder */}
        <div className="space-y-2">
          <div className="text-xs font-bold text-slate-900">{t.common.harmonicLadder}</div>
          <div className="divide-y divide-sky-100 border border-sky-200 rounded-xl overflow-hidden bg-white">
            {[1, 2, 3, 4, 5].map((pVal) => {
              const fVal = pVal * fundamentalFreq;
              const isSelected = state.harmonicP === pVal;
              return (
                <button
                  key={pVal}
                  type="button"
                  onClick={() => setState((prev) => ({ ...prev, harmonicP: pVal }))}
                  className={`w-full px-3 py-1.5 flex items-center justify-between text-xs transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-50 text-emerald-900 font-bold'
                      : 'hover:bg-sky-50 text-slate-700'
                  }`}
                >
                  <span className="font-mono tabular-nums">
                    p={pVal} ({pVal}f₁)
                  </span>
                  <span className="font-mono tabular-nums">
                    {fVal.toFixed(1)} Hz
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
                {t.common.nodes} ({nodePositions.length})
              </div>
              <div className="text-slate-700 leading-snug">
                {nodePositions.map((pos) => `${pos}m`).join(', ')}
              </div>
            </div>
            <div className="p-2 rounded-lg bg-emerald-50/70 border border-emerald-200">
              <div className="font-bold text-emerald-700 mb-1">
                {t.common.antinodes} ({antinodePositions.length})
              </div>
              <div className="text-slate-700 leading-snug">
                {antinodePositions.map((pos) => `${pos}m`).join(', ')}
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
};
