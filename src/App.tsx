import { useState } from 'react';
import { RotateCcw, Volume2, VolumeX, Languages } from 'lucide-react';
import {
  LabModule,
  Language,
  OrganPipeState,
  ResonanceTubeState,
  SonometerState,
} from './types/physics';
import { TRANSLATIONS } from './i18n/translations';
import { SonometerModule } from './components/modules/SonometerModule';
import { OrganPipeModule } from './components/modules/OrganPipeModule';
import { ResonanceTubeModule } from './components/modules/ResonanceTubeModule';
import { audioEngine } from './utils/audioEngine';

const DEFAULT_SONOMETER: SonometerState = {
  length: 0.6,
  bridge1Pos: 0.2,
  massKg: 4.0,
  material: 'steel',
  radiusMm: 0.35,
  useManualMu: false,
  manualMuGramsPerM: 3.0,
  harmonicP: 2,
  paperRiderActive: true,
  paperRiderNormPos: 0.25,
};

const DEFAULT_ORGAN_PIPE: OrganPipeState = {
  boundaryType: 'compare',
  length: 0.8,
  temperatureC: 25,
  overtoneIndex: 0,
  showDisplacementEnvelope: true,
  showPressureCurve: true,
};

const DEFAULT_RESONANCE_TUBE: ResonanceTubeState = {
  frequencyHz: 384,
  temperatureC: 25,
  tubeRadiusCm: 2.5,
  airColumnLengthCm: 21.0,
  applyEndCorrection: true,
  forkExcited: false,
  capturedL1Cm: null,
  capturedL2Cm: null,
};

export default function App() {
  const [lang, setLang] = useState<Language>('bn');
  const [activeModule, setActiveModule] = useState<LabModule>('sonometer');
  const [muted, setMuted] = useState(false);

  const [sonometerState, setSonometerState] = useState<SonometerState>(DEFAULT_SONOMETER);
  const [organPipeState, setOrganPipeState] = useState<OrganPipeState>(DEFAULT_ORGAN_PIPE);
  const [resonanceTubeState, setResonanceTubeState] =
    useState<ResonanceTubeState>(DEFAULT_RESONANCE_TUBE);

  const t = TRANSLATIONS[lang];

  const handleSwitchModule = (mod: LabModule) => {
    audioEngine.stopSustained();
    setResonanceTubeState((prev) => ({ ...prev, forkExcited: false }));
    setActiveModule(mod);
  };

  const handleToggleMute = () => {
    const nextMuted = !muted;
    setMuted(nextMuted);
    audioEngine.setMuted(nextMuted);
  };

  const handleReset = () => {
    audioEngine.stopSustained();
    if (activeModule === 'sonometer') {
      setSonometerState(DEFAULT_SONOMETER);
    } else if (activeModule === 'organPipe') {
      setOrganPipeState(DEFAULT_ORGAN_PIPE);
    } else {
      setResonanceTubeState(DEFAULT_RESONANCE_TUBE);
    }
  };

  const toggleLanguage = () => {
    setLang((prev) => (prev === 'bn' ? 'en' : 'bn'));
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-sky-50 via-slate-50 to-sky-100/70 text-slate-950 flex flex-col">
      {/* Top Navigation & Branding Bar */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-sky-200 shadow-xs">
        <div className="max-w-[1680px] mx-auto px-3 sm:px-4 py-2.5 flex flex-wrap xl:flex-nowrap items-center justify-between gap-2.5">
          {/* Left: Dynamic Studio Title */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-sky-700 text-white flex items-center justify-center font-mono font-bold text-sm shadow-xs">
              λ/2
            </div>
            <span className="text-sm sm:text-base font-extrabold tracking-tight text-slate-950 whitespace-nowrap">
              {t.studioTitle}
            </span>
          </div>

          {/* Center: 3 Interactive Lab Mode Tabs (Pill Navigation) */}
          <nav
            aria-label="Lab Modules"
            className="flex items-center gap-1 p-1 bg-sky-100/80 border border-sky-200 rounded-full overflow-x-auto max-w-full"
          >
            {(
              [
                { id: 'sonometer', full: t.modules.sonometer, short: t.modules.sonometerShort },
                { id: 'organPipe', full: t.modules.organPipe, short: t.modules.organPipeShort },
                {
                  id: 'resonanceTube',
                  full: t.modules.resonanceTube,
                  short: t.modules.resonanceTubeShort,
                },
              ] as { id: LabModule; full: string; short: string }[]
            ).map((tab) => {
              const isActive = activeModule === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleSwitchModule(tab.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-950 hover:bg-white/60'
                  }`}
                >
                  <span className="hidden 2xl:inline">{tab.full}</span>
                  <span className="2xl:hidden">{tab.short}</span>
                </button>
              );
            })}
          </nav>

          {/* Right: Language Switcher, Mute, Reset & Institution Badge */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={toggleLanguage}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              title="Switch Language"
            >
              <Languages className="w-3.5 h-3.5 text-sky-700" />
              <span>{t.langLabel}</span>
            </button>

            <button
              type="button"
              onClick={handleToggleMute}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                muted
                  ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
              }`}
              title={muted ? t.unmute : t.mute}
            >
              {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{muted ? t.mute : t.unmute}</span>
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              title={t.reset}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.reset}</span>
            </button>

            <span className="bg-rose-50 border border-rose-300 text-rose-600 font-extrabold px-3 py-1 rounded-full text-sm whitespace-nowrap">
              {t.institutionName}
            </span>
          </div>
        </div>
      </header>

      {/* Main 3-Column Lab Workspace */}
      <main className="flex-1 max-w-[1680px] w-full mx-auto p-4">
        {activeModule === 'sonometer' && (
          <SonometerModule
            lang={lang}
            t={t}
            state={sonometerState}
            setState={setSonometerState}
          />
        )}
        {activeModule === 'organPipe' && (
          <OrganPipeModule
            lang={lang}
            t={t}
            state={organPipeState}
            setState={setOrganPipeState}
          />
        )}
        {activeModule === 'resonanceTube' && (
          <ResonanceTubeModule
            lang={lang}
            t={t}
            state={resonanceTubeState}
            setState={setResonanceTubeState}
          />
        )}
      </main>
    </div>
  );
}
