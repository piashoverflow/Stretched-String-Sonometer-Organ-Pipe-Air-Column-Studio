export type Language = 'bn' | 'en';
export type LabModule = 'sonometer' | 'organPipe' | 'resonanceTube';

export type WireMaterialId = 'steel' | 'copper' | 'brass' | 'nylon';

export interface WireMaterial {
  id: WireMaterialId;
  density: number; // kg/m^3
  color: string;
  highlight: string;
}

export const WIRE_MATERIALS: Record<WireMaterialId, WireMaterial> = {
  steel: {
    id: 'steel',
    density: 7850,
    color: '#475569',
    highlight: '#94a3b8',
  },
  copper: {
    id: 'copper',
    density: 8960,
    color: '#b45309',
    highlight: '#f59e0b',
  },
  brass: {
    id: 'brass',
    density: 8500,
    color: '#a16207',
    highlight: '#eab308',
  },
  nylon: {
    id: 'nylon',
    density: 1150,
    color: '#0284c7',
    highlight: '#7dd3fc',
  },
};

export interface SonometerState {
  length: number; // meters (0.10 to 1.00)
  bridge1Pos: number; // normalized meters along 1m bench (0.00 to 0.90)
  massKg: number; // kg (0.5 to 20.0)
  material: WireMaterialId;
  radiusMm: number; // mm (0.15 to 1.00)
  useManualMu: boolean;
  manualMuGramsPerM: number; // g/m (0.5 to 15.0)
  harmonicP: number; // 1 to 4 (or 5)
  paperRiderActive: boolean;
  paperRiderNormPos: number; // 0 to 1 along vibrating string
}

export type PipeBoundaryType = 'closed' | 'open' | 'compare';

export interface OrganPipeState {
  boundaryType: PipeBoundaryType;
  length: number; // meters (0.20 to 2.00)
  temperatureC: number; // 0 to 45 C -> v = 332 + 0.6 * T
  overtoneIndex: number; // 0 = Fundamental, 1 = 1st Overtone, 2 = 2nd, 3 = 3rd
  showDisplacementEnvelope: boolean;
  showPressureCurve: boolean;
}

export interface ResonanceTubeState {
  frequencyHz: number; // 256 to 512 Hz
  temperatureC: number; // 0 to 45 C
  tubeRadiusCm: number; // 1.0 to 5.0 cm
  airColumnLengthCm: number; // 5.0 to 110.0 cm
  applyEndCorrection: boolean;
  forkExcited: boolean;
  capturedL1Cm: number | null;
  capturedL2Cm: number | null;
}

export const GRAVITY = 9.81;
