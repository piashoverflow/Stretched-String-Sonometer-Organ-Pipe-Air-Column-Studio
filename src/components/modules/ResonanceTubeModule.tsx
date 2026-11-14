import React, { useEffect, useRef } from 'react';
import { Volume2, Square, Target, BookmarkCheck } from 'lucide-react';
import { Language, ResonanceTubeState } from '../../types/physics';
import { TranslationBundle } from '../../i18n/translations';
import { ProgressiveSlider } from '../ProgressiveSlider';
import { audioEngine } from '../../utils/audioEngine';
import { drawRoundRectPath, syncCanvasSize } from '../../utils/canvasHelpers';

interface ResonanceTubeModuleProps {
  lang: Language;
  t: TranslationBundle;
  state: ResonanceTubeState;
  setState: React.Dispatch<React.SetStateAction<ResonanceTubeState>>;
}

// Deterministic air column particle seeds
const COLUMN_PARTICLES = Array.from({ length: 90 }, (_, i) => {
  const s1 = Math.sin(i * 19.31 + 3.17) * 43758.54;
  const s2 = Math.sin(i * 47.19 + 9.41) * 19384.23;
  return {
    u: (i + 0.5) / 90,
    xFrac: ((s1 - Math.floor(s1)) * 2 - 1) * 0.78,
    phaseJitter: s2 - Math.floor(s2),
  };
});

export const ResonanceTubeModule: React.FC<ResonanceTubeModuleProps> = ({
  t,
  state,
  setState,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const phaseRef = useRef(0);
  const lastTimeRef = useRef<number | null>(null);
  const draggingRef = useRef<'meniscus' | 'reservoir' | null>(null);

  // Physics Calculations
  const speedOfSoundMs = 332 + 0.6 * state.temperatureC;
  const speedOfSoundCmS = speedOfSoundMs * 100;
  const wavelengthCm = speedOfSoundCmS / state.frequencyHz;
  const theoreticalECm = 0.6 * state.tubeRadiusCm;
  const appliedECm = state.applyEndCorrection ? theoreticalECm : 0;

  const l1Cm = wavelengthCm / 4 - appliedECm;
  const l2Cm = (3 * wavelengthCm) / 4 - appliedECm;
  const effLengthCm = state.airColumnLengthCm + appliedECm;

  // Lorentzian resonance intensity [0, 1]
  const gamma = 2.6; // cm half-width
  const res1 = (gamma * gamma) / (Math.pow(state.airColumnLengthCm - l1Cm, 2) + gamma * gamma);
  const res2 = (gamma * gamma) / (Math.pow(state.airColumnLengthCm - l2Cm, 2) + gamma * gamma);
  const resonanceIntensity = Math.max(res1, res2);
  const isResonant1 = res1 >= 0.72 && res1 >= res2;
  const isResonant2 = res2 >= 0.72 && res2 > res1;
  const isResonant = isResonant1 || isResonant2;

  // Derived experimental measurements (using captured or live theoretical l1/l2)
  const usedL1 = state.capturedL1Cm ?? l1Cm;
  const usedL2 = state.capturedL2Cm ?? l2Cm;
  const measuredSpeedMs = (2 * state.frequencyHz * (usedL2 - usedL1)) / 100;
  const measuredECm = (usedL2 - 3 * usedL1) / 2;

  // Stop sustained sound on unmount
  useEffect(() => {
    return () => {
      audioEngine.stopSustained();
    };
  }, []);

  // Sync Web Audio resonance swell while tuning fork is excited
  useEffect(() => {
    if (state.forkExcited) {
      audioEngine.updateResonanceParams(state.frequencyHz, resonanceIntensity);
    }
  }, [state.forkExcited, state.frequencyHz, resonanceIntensity]);

  const toggleFork = () => {
    if (state.forkExcited) {
      audioEngine.stopSustained();
      setState((prev) => ({ ...prev, forkExcited: false }));
    } else {
      audioEngine.startResonanceTone(state.frequencyHz, resonanceIntensity);
      setState((prev) => ({ ...prev, forkExcited: true }));
    }
  };

  // Layout geometry helper shared by pointer events & renderer
  const getLayout = (width: number, height: number) => {
    const tubeTopY = Math.max(88, height * 0.17);
    const tubeBottomY = height - 42;
    const tubeHeightPx = Math.max(200, tubeBottomY - tubeTopY);
    const maxTubeCm = 110;
    const tubeWidthPx = Math.max(36, Math.min(72, 26 + stateRef.current.tubeRadiusCm * 8.5));
    const tubeCenterX = Math.max(95, width * 0.2);
    const reservoirX = tubeCenterX + tubeWidthPx / 2 + Math.max(66, width * 0.11);
    return {
      tubeTopY,
      tubeBottomY,
      tubeHeightPx,
      maxTubeCm,
      tubeWidthPx,
      tubeCenterX,
      reservoirX,
    };
  };

  const getPointerPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      width: rect.width,
      height: rect.height,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pt = getPointerPos(e);
    const m = getLayout(pt.width, pt.height);
    const waterY =
      m.tubeTopY + (stateRef.current.airColumnLengthCm / m.maxTubeCm) * m.tubeHeightPx;

    // Check water meniscus inside tube or reservoir
    if (Math.abs(pt.x - m.tubeCenterX) <= m.tubeWidthPx + 24 && Math.abs(pt.y - waterY) < 42) {
      draggingRef.current = 'meniscus';
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    if (Math.abs(pt.x - m.reservoirX) <= 44 && pt.y >= m.tubeTopY - 20 && pt.y <= m.tubeBottomY + 20) {
      draggingRef.current = 'reservoir';
      e.currentTarget.setPointerCapture(e.pointerId);
      const clampedY = Math.max(m.tubeTopY, Math.min(m.tubeBottomY, pt.y));
      const newCm = Math.max(
        5,
        Math.min(110, Math.round(((clampedY - m.tubeTopY) / m.tubeHeightPx) * m.maxTubeCm * 2) / 2)
      );
      setState((prev) => ({ ...prev, airColumnLengthCm: newCm }));
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!draggingRef.current) return;
    const pt = getPointerPos(e);
    const m = getLayout(pt.width, pt.height);
    const clampedY = Math.max(m.tubeTopY, Math.min(m.tubeBottomY, pt.y));
    const newCm = Math.max(
      5,
      Math.min(110, Math.round(((clampedY - m.tubeTopY) / m.tubeHeightPx) * m.maxTubeCm * 2) / 2)
    );
    setState((prev) => ({ ...prev, airColumnLengthCm: newCm }));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (draggingRef.current) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      draggingRef.current = null;
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

      phaseRef.current += (s.forkExcited ? 18 : 7) * dt;
      const cosPhase = Math.cos(phaseRef.current);

      // Recompute live physics inside frame
      const vCmS = (332 + 0.6 * s.temperatureC) * 100;
      const lamCm = vCmS / s.frequencyHz;
      const eTheoCm = 0.6 * s.tubeRadiusCm;
      const eAppCm = s.applyEndCorrection ? eTheoCm : 0;
      const res1Len = lamCm / 4 - eAppCm;
      const res2Len = (3 * lamCm) / 4 - eAppCm;
      const gWidth = 2.6;
      const r1 = (gWidth * gWidth) / (Math.pow(s.airColumnLengthCm - res1Len, 2) + gWidth * gWidth);
      const r2 = (gWidth * gWidth) / (Math.pow(s.airColumnLengthCm - res2Len, 2) + gWidth * gWidth);
      const intensity = Math.max(r1, r2);
      const resonant = intensity >= 0.72;

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

      const m = getLayout(width, height);
      const pxPerCm = m.tubeHeightPx / m.maxTubeCm;
      const waterY = m.tubeTopY + s.airColumnLengthCm * pxPerCm;
      const tubeLeft = m.tubeCenterX - m.tubeWidthPx / 2;
      const tubeRight = m.tubeCenterX + m.tubeWidthPx / 2;

      // 1. Calibrated Vertical Ruler (Left of tube: 0 to 110 cm)
      const rulerX = tubeLeft - 32;
      ctx.fillStyle = '#fefce8';
      ctx.strokeStyle = '#ca8a04';
      ctx.lineWidth = 1;
      ctx.fillRect(rulerX, m.tubeTopY, 22, m.tubeHeightPx);
      ctx.strokeRect(rulerX, m.tubeTopY, 22, m.tubeHeightPx);

      ctx.fillStyle = '#0f172a';
      ctx.font = '600 9.5px "IBM Plex Mono", monospace';
      ctx.textAlign = 'right';
      for (let cm = 0; cm <= m.maxTubeCm; cm += 5) {
        const ty = m.tubeTopY + cm * pxPerCm;
        const isMajor = cm % 10 === 0;
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = isMajor ? 1.2 : 0.8;
        ctx.beginPath();
        ctx.moveTo(rulerX + 22, ty);
        ctx.lineTo(rulerX + (isMajor ? 13 : 17), ty);
        ctx.stroke();
        if (isMajor) {
          ctx.fillText(`${cm}`, rulerX + 11, ty + 3);
        }
      }

      // 2. Flexible Rubber Tubing connecting Tube Bottom -> Water Reservoir
      const resBottomY = Math.min(m.tubeBottomY + 6, waterY + 55);
      const resTopY = Math.max(m.tubeTopY - 12, waterY - 45);
      ctx.save();
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(m.tubeCenterX, m.tubeBottomY);
      ctx.bezierCurveTo(
        m.tubeCenterX,
        m.tubeBottomY + 34,
        m.reservoirX,
        m.tubeBottomY + 34,
        m.reservoirX,
        resBottomY
      );
      ctx.stroke();

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(m.tubeCenterX, m.tubeBottomY);
      ctx.bezierCurveTo(
        m.tubeCenterX,
        m.tubeBottomY + 34,
        m.reservoirX,
        m.tubeBottomY + 34,
        m.reservoirX,
        resBottomY
      );
      ctx.stroke();
      ctx.restore();

      // 3. Draggable Water Reservoir (Right of tube)
      const resW = 46;
      const resH = resBottomY - resTopY;
      ctx.save();
      // Reservoir glass vessel
      ctx.fillStyle = 'rgba(240, 249, 255, 0.8)';
      ctx.strokeStyle = '#0369a1';
      ctx.lineWidth = 2;
      drawRoundRectPath(ctx, m.reservoirX - resW / 2, resTopY, resW, resH, [2, 2, 10, 10]);
      ctx.fill();
      ctx.stroke();

      // Water inside reservoir aligned with meniscus waterY
      const resWaterTop = Math.max(resTopY + 6, Math.min(resBottomY - 6, waterY));
      ctx.fillStyle = 'rgba(14, 165, 233, 0.45)';
      drawRoundRectPath(
        ctx,
        m.reservoirX - resW / 2 + 2,
        resWaterTop,
        resW - 4,
        resBottomY - resWaterTop - 2,
        [0, 0, 8, 8]
      );
      ctx.fill();

      // Dashed equilibrium level line between meniscus & reservoir
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(2, 132, 199, 0.45)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(tubeRight, waterY);
      ctx.lineTo(m.reservoirX - resW / 2, resWaterTop);
      ctx.stroke();
      ctx.setLineDash([]);

      // Drag handle grip on reservoir
      ctx.fillStyle = '#0369a1';
      ctx.font = '700 10px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('⇅ DRAG', m.reservoirX, resTopY - 7);
      ctx.restore();

      // 4. Air Column Resonance Glow & Water Column inside Resonance Tube
      if (resonant) {
        const glowAlpha = 0.14 + intensity * 0.28;
        const glowGrad = ctx.createLinearGradient(tubeLeft, m.tubeTopY, tubeRight, waterY);
        glowGrad.addColorStop(0, `rgba(16, 185, 129, ${glowAlpha})`);
        glowGrad.addColorStop(0.5, `rgba(5, 150, 105, ${glowAlpha * 1.25})`);
        glowGrad.addColorStop(1, `rgba(16, 185, 129, ${glowAlpha})`);
        ctx.fillStyle = glowGrad;
        ctx.fillRect(tubeLeft, m.tubeTopY - eAppCm * pxPerCm, m.tubeWidthPx, waterY - (m.tubeTopY - eAppCm * pxPerCm));
      } else {
        ctx.fillStyle = 'rgba(240, 249, 255, 0.55)';
        ctx.fillRect(tubeLeft, m.tubeTopY, m.tubeWidthPx, waterY - m.tubeTopY);
      }

      // Water inside tube (from waterY to tubeBottomY)
      const waterGrad = ctx.createLinearGradient(tubeLeft, waterY, tubeRight, m.tubeBottomY);
      waterGrad.addColorStop(0, 'rgba(14, 165, 233, 0.52)');
      waterGrad.addColorStop(1, 'rgba(3, 105, 161, 0.72)');
      ctx.fillStyle = waterGrad;
      ctx.fillRect(tubeLeft, waterY, m.tubeWidthPx, m.tubeBottomY - waterY);

      // Curved water meniscus
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(tubeLeft, waterY - 2);
      ctx.quadraticCurveTo(m.tubeCenterX, waterY + 4, tubeRight, waterY - 2);
      ctx.stroke();

      // 5. Standing Wave & Longitudinal Air Particles inside Air Column
      const effLenCm = s.airColumnLengthCm + eAppCm;
      const effectiveTopY = m.tubeTopY - eAppCm * pxPerCm;
      const effHeightPx = waterY - effectiveTopY;
      // Compute spatial wave number k = 2*pi / lambda so wave matches effective length
      const kWave = (2 * Math.PI) / lamCm;
      const ampScale = (0.28 + intensity * 0.72) * (s.forkExcited ? 1.0 : 0.55);

      // Air Particles inside [tubeTopY, waterY]
      COLUMN_PARTICLES.forEach((pt) => {
        const distFromWaterCm = (1 - pt.u) * s.airColumnLengthCm;
        const disp = Math.sin(kWave * distFromWaterCm) * ampScale;
        const py = m.tubeTopY + pt.u * (waterY - m.tubeTopY) + disp * 9 * cosPhase;
        const px = m.tubeCenterX + pt.xFrac * (m.tubeWidthPx * 0.42);
        if (py > m.tubeTopY + 2 && py < waterY - 3) {
          ctx.beginPath();
          ctx.arc(px, py, resonant ? 2.4 : 1.9, 0, Math.PI * 2);
          ctx.fillStyle = Math.abs(disp) < 0.16 ? '#e11d48' : resonant ? '#047857' : '#334155';
          ctx.fill();
        }
      });

      // Standing wave displacement envelope plotted vertically along air column
      const waveAmpPx = (m.tubeWidthPx * 0.38) * ampScale;
      [1, -1].forEach((sign) => {
        ctx.save();
        ctx.strokeStyle = resonant ? '#059669' : '#0284c7';
        ctx.lineWidth = resonant ? 2.4 : 1.6;
        if (!resonant) ctx.setLineDash([4, 3]);
        ctx.beginPath();
        for (let i = 0; i <= 80; i++) {
          const u = i / 80; // 0 = effectiveTop (antinode region), 1 = water meniscus (node)
          const distFromMeniscusCm = (1 - u) * effLenCm;
          const xOff = sign * Math.sin(kWave * distFromMeniscusCm) * waveAmpPx;
          const y = effectiveTopY + u * effHeightPx;
          if (i === 0) ctx.moveTo(m.tubeCenterX + xOff, y);
          else ctx.lineTo(m.tubeCenterX + xOff, y);
        }
        ctx.stroke();
        ctx.restore();
      });

      // Node marker at water meniscus
      ctx.fillStyle = '#e11d48';
      ctx.beginPath();
      ctx.arc(m.tubeCenterX, waterY, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#be123c';
      ctx.font = '700 10.5px "IBM Plex Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText('N', tubeRight + 8, waterY + 4);

      // Antinode marker at effectiveTopY (above rim by e = 0.6r)
      ctx.fillStyle = '#059669';
      ctx.beginPath();
      ctx.arc(m.tubeCenterX, effectiveTopY, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#047857';
      ctx.fillText('A', tubeRight + 8, effectiveTopY + 4);

      // Glass tube outer walls
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(tubeLeft, m.tubeTopY);
      ctx.lineTo(tubeLeft, m.tubeBottomY);
      ctx.lineTo(tubeRight, m.tubeBottomY);
      ctx.lineTo(tubeRight, m.tubeTopY);
      ctx.stroke();

      // Open rim flare
      ctx.beginPath();
      ctx.moveTo(tubeLeft, m.tubeTopY);
      ctx.lineTo(tubeLeft - 6, m.tubeTopY - 4);
      ctx.moveTo(tubeRight, m.tubeTopY);
      ctx.lineTo(tubeRight + 6, m.tubeTopY - 4);
      ctx.stroke();

      // Length l indicator arrow beside tube
      ctx.fillStyle = '#0369a1';
      ctx.font = '700 11px "IBM Plex Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`l = ${s.airColumnLengthCm.toFixed(1)} cm`, tubeRight + 10, (m.tubeTopY + waterY) / 2);

      // 6. Vibrating Tuning Fork above tube mouth
      const forkBaseY = m.tubeTopY - 56;
      const forkVib = s.forkExcited ? Math.sin(phaseRef.current * 2.4) * 3.2 : 0;
      ctx.save();
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      // Handle
      ctx.beginPath();
      ctx.moveTo(m.tubeCenterX + 26, forkBaseY);
      ctx.lineTo(m.tubeCenterX + 44, forkBaseY);
      ctx.stroke();
      // U-tines horizontal over mouth
      ctx.beginPath();
      ctx.moveTo(m.tubeCenterX - 18, forkBaseY - 9 - forkVib);
      ctx.lineTo(m.tubeCenterX + 18, forkBaseY - 9 - forkVib);
      ctx.quadraticCurveTo(m.tubeCenterX + 28, forkBaseY, m.tubeCenterX + 18, forkBaseY + 9 + forkVib);
      ctx.lineTo(m.tubeCenterX - 18, forkBaseY + 9 + forkVib);
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.font = '700 11px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${s.frequencyHz.toFixed(0)} Hz`, m.tubeCenterX, forkBaseY - 18);

      // Acoustic ripple arcs when excited
      if (s.forkExcited) {
        for (let w = 0; w < 3; w++) {
          const rad = 10 + ((phaseRef.current * 4 + w * 14) % 42);
          const alpha = Math.max(0, 1 - rad / 52) * (0.4 + intensity * 0.5);
          ctx.strokeStyle = resonant ? `rgba(5, 150, 105, ${alpha})` : `rgba(2, 132, 199, ${alpha})`;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(m.tubeCenterX, m.tubeTopY - 18, rad, 0.2 * Math.PI, 0.8 * Math.PI);
          ctx.stroke();
        }
      }
      ctx.restore();

      // 7. RIGHT SIDE INSETS: (A) End Correction Zoom Inset & (B) Resonance Intensity Graph (I vs l)
      const rightStartX = Math.max(m.reservoirX + 46, width * 0.46);
      const rightPanelW = width - rightStartX - 18;

      if (rightPanelW > 170) {
        // (A) End Correction Zoom Inset (Top-Right)
        const zoomH = Math.min(185, height * 0.42);
        const zoomY = 18;
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#bae6fd';
        ctx.lineWidth = 1.5;
        drawRoundRectPath(ctx, rightStartX, zoomY, rightPanelW, zoomH, 12);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#0f172a';
        ctx.font = '700 11px "Plus Jakarta Sans", "Noto Sans Bengali", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(t.resonanceTube.zoomTitle, rightStartX + 12, zoomY + 20);

        // Magnified tube mouth cross-section
        const zCenterX = rightStartX + rightPanelW * 0.44;
        const zTubeW = Math.min(94, rightPanelW * 0.36);
        const zRimY = zoomY + zoomH * 0.56;
        const zBotY = zoomY + zoomH - 18;
        const zECm = s.applyEndCorrection ? eTheoCm : 0;
        const zEPx = Math.min(34, (zECm / 3.0) * 34);
        const zAntinodeY = zRimY - zEPx;

        // Magnified tube walls
        ctx.fillStyle = 'rgba(224, 242, 254, 0.5)';
        ctx.fillRect(zCenterX - zTubeW / 2, zRimY, zTubeW, zBotY - zRimY);
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(zCenterX - zTubeW / 2, zRimY);
        ctx.lineTo(zCenterX - zTubeW / 2, zBotY);
        ctx.moveTo(zCenterX + zTubeW / 2, zRimY);
        ctx.lineTo(zCenterX + zTubeW / 2, zBotY);
        ctx.stroke();

        // Rim reference dashed line
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(zCenterX - zTubeW / 2 - 14, zRimY);
        ctx.lineTo(zCenterX + zTubeW / 2 + 24, zRimY);
        ctx.stroke();

        // Antinode level dashed line at zAntinodeY
        ctx.strokeStyle = '#059669';
        ctx.beginPath();
        ctx.moveTo(zCenterX - zTubeW / 2 - 14, zAntinodeY);
        ctx.lineTo(zCenterX + zTubeW / 2 + 24, zAntinodeY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Magnified wave envelope curving out to antinode above rim
        [1, -1].forEach((sign) => {
          ctx.strokeStyle = '#059669';
          ctx.lineWidth = 2;
          ctx.beginPath();
          for (let j = 0; j <= 30; j++) {
            const frac = j / 30;
            const y = zAntinodeY + frac * (zBotY - zAntinodeY);
            const env = Math.cos(frac * 0.95) * (zTubeW * 0.36);
            if (j === 0) ctx.moveTo(zCenterX + sign * env, y);
            else ctx.lineTo(zCenterX + sign * env, y);
          }
          ctx.stroke();
        });

        // Radius r bracket inside tube
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 1.4;
        const rY = zBotY - 16;
        ctx.beginPath();
        ctx.moveTo(zCenterX, rY);
        ctx.lineTo(zCenterX + zTubeW / 2, rY);
        ctx.stroke();
        ctx.fillStyle = '#0369a1';
        ctx.font = '700 10px "IBM Plex Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`r=${s.tubeRadiusCm.toFixed(1)}cm`, zCenterX + zTubeW * 0.25, rY - 5);

        // Antinode & e = 0.6r annotation
        ctx.fillStyle = '#059669';
        ctx.beginPath();
        ctx.arc(zCenterX, zAntinodeY, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.textAlign = 'left';
        ctx.fillText(
          `e = ${zECm.toFixed(2)} cm`,
          zCenterX + zTubeW / 2 + 10,
          (zRimY + zAntinodeY) / 2 + 4
        );
        ctx.restore();

        // (B) Resonance Intensity Graph I vs l (Bottom-Right)
        const graphY = zoomY + zoomH + 16;
        const graphH = height - graphY - 18;
        if (graphH > 120) {
          ctx.save();
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#bae6fd';
          ctx.lineWidth = 1.5;
          drawRoundRectPath(ctx, rightStartX, graphY, rightPanelW, graphH, 12);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#0f172a';
          ctx.font = '700 11px "Plus Jakarta Sans", "Noto Sans Bengali", sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(t.resonanceTube.intensityGraphTitle, rightStartX + 12, graphY + 20);

          const plotX = rightStartX + 34;
          const plotW = rightPanelW - 50;
          const plotY = graphY + 34;
          const plotH = graphH - 64;

          // Axes
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(plotX, plotY);
          ctx.lineTo(plotX, plotY + plotH);
          ctx.lineTo(plotX + plotW, plotY + plotH);
          ctx.stroke();

          // Intensity curve I(l) across 5..110 cm
          ctx.strokeStyle = '#0284c7';
          ctx.lineWidth = 2;
          ctx.beginPath();
          for (let cm = 5; cm <= 110; cm += 0.5) {
            const p1 = (gWidth * gWidth) / (Math.pow(cm - res1Len, 2) + gWidth * gWidth);
            const p2 = (gWidth * gWidth) / (Math.pow(cm - res2Len, 2) + gWidth * gWidth);
            const val = Math.max(p1, p2);
            const px = plotX + ((cm - 5) / 105) * plotW;
            const py = plotY + plotH - val * (plotH - 8);
            if (cm === 5) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.stroke();

          // Peak markers l1 & l2
          [
            { lVal: res1Len, lbl: 'l₁' },
            { lVal: res2Len, lbl: 'l₂' },
          ].forEach((pk) => {
            if (pk.lVal >= 5 && pk.lVal <= 110) {
              const px = plotX + ((pk.lVal - 5) / 105) * plotW;
              ctx.setLineDash([3, 3]);
              ctx.strokeStyle = 'rgba(5, 150, 105, 0.55)';
              ctx.beginPath();
              ctx.moveTo(px, plotY);
              ctx.lineTo(px, plotY + plotH);
              ctx.stroke();
              ctx.setLineDash([]);
              ctx.fillStyle = '#047857';
              ctx.font = '700 10px "IBM Plex Mono", monospace';
              ctx.textAlign = 'center';
              ctx.fillText(pk.lbl, px, plotY + plotH + 13);
            }
          });

          // Live cursor dot at current airColumnLengthCm
          const curX = plotX + ((s.airColumnLengthCm - 5) / 105) * plotW;
          const curY = plotY + plotH - intensity * (plotH - 8);
          ctx.fillStyle = resonant ? '#059669' : '#e11d48';
          ctx.beginPath();
          ctx.arc(curX, curY, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.fillStyle = '#475569';
          ctx.font = '600 9.5px "IBM Plex Mono", monospace';
          ctx.textAlign = 'right';
          ctx.fillText('110 cm', plotX + plotW, plotY + plotH + 23);
          ctx.textAlign = 'left';
          ctx.fillText('5 cm', plotX, plotY + plotH + 23);

          ctx.restore();
        }
      }

      ctx.restore();
      animId = requestAnimationFrame(renderFrame);
    };

    animId = requestAnimationFrame(renderFrame);
    return () => {
      cancelAnimationFrame(animId);
    };
  }, [t]);

  const forkPresets = [256, 320, 384, 426.7, 512];

  return (
    <div className="flex flex-col lg:flex-row gap-3.5 items-stretch min-h-[calc(100vh-110px)]">
      {/* LEFT CONTROL DOCK */}
      <aside className="w-full lg:w-[275px] xl:w-[310px] 2xl:w-[340px] shrink-0 bg-white/95 backdrop-blur-sm border border-sky-200 shadow-sm rounded-2xl p-4 flex flex-col gap-3.5">
        <div className="border-b border-sky-100 pb-2.5">
          <h2 className="text-sm font-bold text-slate-950">{t.common.controls}</h2>
          <p className="text-xs text-slate-500 mt-0.5">{t.resonanceTube.subtitle}</p>
        </div>

        {/* Air Column Length l Slider */}
        <ProgressiveSlider
          id="res-length"
          label={t.resonanceTube.airColumnLength}
          value={state.airColumnLengthCm}
          min={5}
          max={110}
          step={0.5}
          unit="cm"
          displayValue={state.airColumnLengthCm.toFixed(1)}
          subLabel={`${t.resonanceTube.effectiveLength}: ${effLengthCm.toFixed(2)} cm`}
          onChange={(val) => setState((prev) => ({ ...prev, airColumnLengthCm: val }))}
        />

        {/* Quick Snap to Resonance 1 & 2 */}
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            disabled={l1Cm < 5 || l1Cm > 110}
            onClick={() =>
              setState((prev) => ({
                ...prev,
                airColumnLengthCm: Math.round(l1Cm * 2) / 2,
              }))
            }
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-40 cursor-pointer flex items-center justify-center gap-1"
          >
            <Target className="w-3.5 h-3.5" />
            <span>{t.resonanceTube.snapResonance1}</span>
          </button>
          <button
            type="button"
            disabled={l2Cm < 5 || l2Cm > 110}
            onClick={() =>
              setState((prev) => ({
                ...prev,
                airColumnLengthCm: Math.round(l2Cm * 2) / 2,
              }))
            }
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-40 cursor-pointer flex items-center justify-center gap-1"
          >
            <Target className="w-3.5 h-3.5" />
            <span>{t.resonanceTube.snapResonance2}</span>
          </button>
        </div>

        {/* Tuning Fork Frequency */}
        <div className="space-y-2 pt-1 border-t border-sky-100">
          <ProgressiveSlider
            id="res-freq"
            label={t.resonanceTube.tuningForkFreq}
            value={state.frequencyHz}
            min={256}
            max={512}
            step={1}
            unit="Hz"
            displayValue={state.frequencyHz.toFixed(0)}
            subLabel={`λ = ${wavelengthCm.toFixed(1)} cm`}
            onChange={(val) =>
              setState((prev) => ({
                ...prev,
                frequencyHz: val,
                capturedL1Cm: null,
                capturedL2Cm: null,
              }))
            }
          />
          <div className="flex flex-wrap gap-1">
            {forkPresets.map((fPreset) => (
              <button
                key={fPreset}
                type="button"
                onClick={() =>
                  setState((prev) => ({
                    ...prev,
                    frequencyHz: fPreset,
                    capturedL1Cm: null,
                    capturedL2Cm: null,
                  }))
                }
                className={`px-2 py-1 rounded-md text-[11px] font-mono font-semibold border cursor-pointer ${
                  Math.abs(state.frequencyHz - fPreset) < 0.6
                    ? 'bg-sky-700 text-white border-sky-800'
                    : 'bg-sky-50 text-slate-700 border-sky-200 hover:bg-sky-100'
                }`}
              >
                {fPreset}
              </button>
            ))}
          </div>
        </div>

        {/* Inner Tube Radius r */}
        <ProgressiveSlider
          id="res-radius"
          label={t.resonanceTube.tubeRadius}
          value={state.tubeRadiusCm}
          min={1.0}
          max={5.0}
          step={0.1}
          unit="cm"
          displayValue={state.tubeRadiusCm.toFixed(1)}
          subLabel={`${t.resonanceTube.theoreticalE} = ${theoreticalECm.toFixed(2)} cm`}
          onChange={(val) =>
            setState((prev) => ({
              ...prev,
              tubeRadiusCm: val,
              capturedL1Cm: null,
              capturedL2Cm: null,
            }))
          }
        />

        {/* Room Temperature / Speed of Sound */}
        <ProgressiveSlider
          id="res-temp"
          label={`${t.common.temperature} (θ)`}
          value={state.temperatureC}
          min={0}
          max={45}
          step={1}
          unit="°C"
          displayValue={state.temperatureC.toFixed(0)}
          subLabel={`${t.resonanceTube.trueSpeed}: ${speedOfSoundMs.toFixed(1)} m/s`}
          onChange={(val) =>
            setState((prev) => ({
              ...prev,
              temperatureC: val,
              capturedL1Cm: null,
              capturedL2Cm: null,
            }))
          }
        />

        {/* End Correction Toggle */}
        <div className="pt-1 border-t border-sky-100">
          <label className="flex items-center justify-between gap-2 cursor-pointer p-2.5 rounded-xl bg-sky-50/70 border border-sky-200">
            <div>
              <div className="text-xs font-bold text-slate-900">
                {t.resonanceTube.endCorrectionToggle}
              </div>
              <div className="text-[11px] text-slate-600 font-mono">
                {state.applyEndCorrection
                  ? t.resonanceTube.endCorrectionApplied
                  : t.resonanceTube.endCorrectionIgnored}
              </div>
            </div>
            <input
              type="checkbox"
              checked={state.applyEndCorrection}
              onChange={(e) =>
                setState((prev) => ({
                  ...prev,
                  applyEndCorrection: e.target.checked,
                  capturedL1Cm: null,
                  capturedL2Cm: null,
                }))
              }
              className="accent-emerald-600 w-4 h-4 rounded shrink-0"
            />
          </label>
        </div>

        {/* Strike Tuning Fork Web Audio Button */}
        <div className="mt-auto pt-2">
          <button
            type="button"
            onClick={toggleFork}
            className={`w-full py-2.5 px-4 rounded-xl font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
              state.forkExcited
                ? 'bg-rose-600 hover:bg-rose-700 text-white'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            {state.forkExcited ? <Square className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            <span>
              {state.forkExcited
                ? t.resonanceTube.stopForkButton
                : t.resonanceTube.strikeForkButton}
            </span>
          </button>
        </div>
      </aside>

      {/* CENTER CANVAS STAGE */}
      <section className="flex-1 min-w-0 bg-white/95 backdrop-blur-sm border border-sky-200 shadow-sm rounded-2xl p-4 flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-sky-100">
          <div>
            <h1 className="text-base font-bold text-slate-950">{t.resonanceTube.title}</h1>
            <p className="text-xs text-slate-600">{t.resonanceTube.waterReservoirHint}</p>
          </div>
          <div
            className={`px-3 py-1 rounded-lg text-xs font-bold border ${
              isResonant
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : 'bg-slate-50 text-slate-700 border-slate-200'
            }`}
          >
            {isResonant1
              ? t.resonanceTube.resonanceStatusFirst
              : isResonant2
              ? t.resonanceTube.resonanceStatusSecond
              : t.resonanceTube.resonanceStatusNone}
          </div>
        </div>

        <div ref={containerRef} className="flex-1 min-h-[430px] relative mt-2 rounded-xl overflow-hidden bg-sky-50/40 border border-sky-100">
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="absolute inset-0 w-full h-full block touch-none cursor-ns-resize"
          />
        </div>
      </section>

      {/* RIGHT TELEMETRY PANEL */}
      <aside className="w-full lg:w-[270px] xl:w-[300px] 2xl:w-[330px] shrink-0 bg-white/95 backdrop-blur-sm border border-sky-200 shadow-sm rounded-2xl p-4 flex flex-col gap-3.5">
        <div className="border-b border-sky-100 pb-2.5">
          <h2 className="text-sm font-bold text-slate-950">{t.common.telemetry}</h2>
          <p className="text-[11px] font-mono text-sky-700 mt-0.5">
            v = 2f(l₂ - l₁) · e = (l₂ - 3l₁)/2
          </p>
        </div>

        {/* Resonance Intensity Bar */}
        <div className="p-3 rounded-xl bg-sky-50/70 border border-sky-200 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-slate-800">{t.resonanceTube.resonanceIntensity}</span>
            <span
              className={`font-mono tabular-nums ${
                isResonant ? 'text-emerald-700' : 'text-slate-700'
              }`}
            >
              {(resonanceIntensity * 100).toFixed(0)}%
            </span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-slate-200 overflow-hidden">
            <div
              className={`h-full transition-all duration-100 ${
                isResonant ? 'bg-emerald-600' : 'bg-sky-600'
              }`}
              style={{ width: `${Math.min(100, resonanceIntensity * 100)}%` }}
            />
          </div>
        </div>

        {/* Capture l1 & l2 Measurement Cards */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="p-2.5 rounded-xl bg-white border border-sky-200 space-y-1.5">
            <div className="text-[11px] font-semibold text-slate-600">
              {t.resonanceTube.firstResonance}
            </div>
            <div className="text-lg font-mono font-bold text-slate-900 tabular-nums">
              {usedL1.toFixed(2)} <span className="text-xs text-slate-500">cm</span>
            </div>
            <button
              type="button"
              onClick={() =>
                setState((prev) => ({ ...prev, capturedL1Cm: prev.airColumnLengthCm }))
              }
              className="w-full py-1 px-2 rounded-md text-[11px] font-semibold bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 cursor-pointer flex items-center justify-center gap-1"
            >
              <BookmarkCheck className="w-3 h-3" />
              {t.resonanceTube.captureL1}
            </button>
          </div>
          <div className="p-2.5 rounded-xl bg-white border border-sky-200 space-y-1.5">
            <div className="text-[11px] font-semibold text-slate-600">
              {t.resonanceTube.secondResonance}
            </div>
            <div className="text-lg font-mono font-bold text-slate-900 tabular-nums">
              {usedL2.toFixed(2)} <span className="text-xs text-slate-500">cm</span>
            </div>
            <button
              type="button"
              onClick={() =>
                setState((prev) => ({ ...prev, capturedL2Cm: prev.airColumnLengthCm }))
              }
              className="w-full py-1 px-2 rounded-md text-[11px] font-semibold bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 cursor-pointer flex items-center justify-center gap-1"
            >
              <BookmarkCheck className="w-3 h-3" />
              {t.resonanceTube.captureL2}
            </button>
          </div>
        </div>

        {/* Speed of Sound & End Correction Telemetry */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200">
            <div className="text-[11px] font-semibold text-slate-600">
              {t.resonanceTube.theoreticalE}
            </div>
            <div className="text-base font-mono font-bold text-emerald-700 tabular-nums mt-0.5">
              {theoreticalECm.toFixed(2)} <span className="text-xs">cm</span>
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-[11px] font-semibold text-slate-600">
              {t.resonanceTube.measuredE}
            </div>
            <div className="text-base font-mono font-bold text-slate-900 tabular-nums mt-0.5">
              {measuredECm.toFixed(2)} <span className="text-xs">cm</span>
            </div>
          </div>
        </div>

        {/* Live Formula Substitution Card */}
        <div className="p-3 rounded-xl bg-sky-50/60 border border-sky-200 space-y-2 mt-auto">
          <div className="text-xs font-bold text-slate-900">{t.common.formulaCard}</div>
          <div className="font-mono text-xs text-slate-800 bg-white rounded-lg p-2.5 border border-sky-100 space-y-2 tabular-nums">
            <div>
              <div className="font-semibold text-sky-800">v = 2f(l₂ - l₁)</div>
              <div className="text-[11px] text-slate-600 mt-0.5">
                = 2 × {state.frequencyHz.toFixed(0)} × ({(usedL2 / 100).toFixed(3)} - {(usedL1 / 100).toFixed(3)})
              </div>
              <div className="font-bold text-emerald-700 mt-0.5">
                = {measuredSpeedMs.toFixed(2)} m/s
              </div>
            </div>
            <div className="pt-1.5 border-t border-sky-100">
              <div className="font-semibold text-sky-800">e = (l₂ - 3l₁) / 2</div>
              <div className="text-[11px] text-slate-600 mt-0.5">
                = ({usedL2.toFixed(2)} - 3 × {usedL1.toFixed(2)}) / 2 = <strong>{measuredECm.toFixed(2)} cm</strong>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
};
