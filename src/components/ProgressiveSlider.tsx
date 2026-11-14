import React from 'react';

interface ProgressiveSliderProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  displayValue?: string;
  subLabel?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}

export const ProgressiveSlider: React.FC<ProgressiveSliderProps> = ({
  id,
  label,
  value,
  min,
  max,
  step,
  unit,
  displayValue,
  subLabel,
  disabled = false,
  onChange,
}) => {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

  return (
    <div className={`space-y-1.5 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-xs font-semibold text-slate-800 leading-tight">
          {label}
        </label>
        <div className="flex items-baseline gap-1 font-mono tabular-nums shrink-0">
          <span className="text-sm font-bold text-emerald-700">
            {displayValue ?? value.toFixed(step < 0.01 ? 3 : step < 0.1 ? 2 : step < 1 ? 1 : 0)}
          </span>
          {unit && <span className="text-[11px] font-medium text-slate-500">{unit}</span>}
        </div>
      </div>

      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="emerald-slider"
        style={{
          background: `linear-gradient(to right, #059669 0%, #059669 ${pct}%, #d1fae5 ${pct}%, #d1fae5 100%)`,
        }}
      />

      {subLabel && (
        <div className="text-[11px] text-slate-500 font-mono tabular-nums">{subLabel}</div>
      )}
    </div>
  );
};
