import { Language, WireMaterialId } from '../types/physics';

export interface TranslationBundle {
  studioTitle: string;
  institutionName: string;
  langLabel: string;
  reset: string;
  mute: string;
  unmute: string;
  audioActive: string;
  modules: {
    sonometer: string;
    sonometerShort: string;
    organPipe: string;
    organPipeShort: string;
    resonanceTube: string;
    resonanceTubeShort: string;
  };
  common: {
    controls: string;
    telemetry: string;
    formulaCard: string;
    harmonicLadder: string;
    nodeAntinodeMap: string;
    fundamental: string;
    overtone1: string;
    overtone2: string;
    overtone3: string;
    harmonicLabel: string;
    frequency: string;
    wavelength: string;
    waveSpeed: string;
    node: string;
    antinode: string;
    nodes: string;
    antinodes: string;
    ratio: string;
    active: string;
    position: string;
    dragHint: string;
    speedOfSound: string;
    temperature: string;
  };
  sonometer: {
    title: string;
    subtitle: string;
    vibratingLength: string;
    hangingMass: string;
    tensionForce: string;
    wireMaterial: string;
    wireRadius: string;
    linearDensity: string;
    manualMuOverride: string;
    harmonicMode: string;
    harmonicNames: Record<number, string>;
    materials: Record<WireMaterialId, string>;
    pluckButton: string;
    paperRider: string;
    placeAtNode: string;
    placeAtAntinode: string;
    riderStatusIdle: string;
    riderStatusStable: string;
    riderStatusThrown: string;
    bridgeDragHint: string;
    slottedMassLabel: string;
    bridgeLeft: string;
    bridgeRight: string;
    lawSummary: string;
  };
  organPipe: {
    title: string;
    subtitle: string;
    boundaryType: string;
    closedPipe: string;
    openPipe: string;
    compareBoth: string;
    pipeLength: string;
    overtoneSelector: string;
    displacementOverlay: string;
    pressureOverlay: string;
    playToneButton: string;
    stopToneButton: string;
    closedTag: string;
    openTag: string;
    oddOnlyNote: string;
    allHarmonicsNote: string;
    ratioComparison: string;
    displacementNode: string;
    displacementAntinode: string;
    pressureNode: string;
    pressureAntinode: string;
    particleLegend: string;
  };
  resonanceTube: {
    title: string;
    subtitle: string;
    tuningForkFreq: string;
    tubeRadius: string;
    airColumnLength: string;
    endCorrectionToggle: string;
    endCorrectionApplied: string;
    endCorrectionIgnored: string;
    strikeForkButton: string;
    stopForkButton: string;
    snapResonance1: string;
    snapResonance2: string;
    captureL1: string;
    captureL2: string;
    resonanceStatusNone: string;
    resonanceStatusFirst: string;
    resonanceStatusSecond: string;
    resonanceIntensity: string;
    effectiveLength: string;
    endCorrectionVal: string;
    theoreticalE: string;
    measuredE: string;
    measuredSpeed: string;
    trueSpeed: string;
    firstResonance: string;
    secondResonance: string;
    zoomTitle: string;
    waterReservoirHint: string;
    intensityGraphTitle: string;
  };
}

export const TRANSLATIONS: Record<Language, TranslationBundle> = {
  bn: {
    studioTitle: 'টানা তারের কম্পন ও বায়ুস্তম্ভের কম্পন ল্যাব',
    institutionName: 'উদ্ভাস',
    langLabel: 'English',
    reset: 'রিসেট',
    mute: 'মিউট',
    unmute: 'শব্দ চালু',
    audioActive: 'অডিও সক্রিয়',
    modules: {
      sonometer: 'মডিউল ১: টানা তারের আড় কম্পন ও সোনোমিটার',
      sonometerShort: 'টানা তার ও সোনোমিটার',
      organPipe: 'মডিউল ২: খোলা ও বদ্ধ নলে বায়ুস্তম্ভের কম্পন',
      organPipeShort: 'খোলা ও বদ্ধ নল',
      resonanceTube: 'মডিউল ৩: প্রান্ত সংশোধন ও অনুনাদ নল পরীক্ষাগার',
      resonanceTubeShort: 'প্রান্ত সংশোধন ও অনুনাদ নল',
    },
    common: {
      controls: 'নিয়ন্ত্রণ প্যানেল',
      telemetry: 'লাইভ পরিমাপ ও তত্ত্ব',
      formulaCard: 'গাণিতিক সূত্র ও মান প্রতিস্থাপন',
      harmonicLadder: 'সমমেল ও উপসুর ক্রম',
      nodeAntinodeMap: 'নিস্পন্দ (N) ও সুস্পন্দ (A) অবস্থান',
      fundamental: 'মূলসুর (১ম সমমেল)',
      overtone1: '১ম উপসুর',
      overtone2: '২য় উপসুর',
      overtone3: '৩য় উপসুর',
      harmonicLabel: 'তম সমমেল',
      frequency: 'কম্পাঙ্ক',
      wavelength: 'তরঙ্গদৈর্ঘ্য',
      waveSpeed: 'তরঙ্গের বেগ',
      node: 'নিস্পন্দ (N)',
      antinode: 'সুস্পন্দ (A)',
      nodes: 'নিস্পন্দ বিন্দু',
      antinodes: 'সুস্পন্দ বিন্দু',
      ratio: 'অনুপাত',
      active: 'সক্রিয়',
      position: 'অবস্থান',
      dragHint: 'ক্যানভাসে সরাসরি টেনে পরিবর্তন করুন',
      speedOfSound: 'শব্দের বেগ',
      temperature: 'তাপমাত্রা',
    },
    sonometer: {
      title: 'সোনোমিটার ও টানা তারের আড় কম্পন',
      subtitle: 'মার্সেনের সূত্র যাচাই ও স্থির তরঙ্গের লুপ বিশ্লেষণ',
      vibratingLength: 'কম্পমান দৈর্ঘ্য (l)',
      hangingMass: 'ঝুলন্ত ভর (M)',
      tensionForce: 'টান বল (T = Mg)',
      wireMaterial: 'তারের উপাদান',
      wireRadius: 'তারের ব্যাসার্ধ (r)',
      linearDensity: 'একক দৈর্ঘ্যের ভর (μ)',
      manualMuOverride: 'ম্যানুয়াল μ ব্যবহার করুন',
      harmonicMode: 'লুপ / সমমেল সংখ্যা (p)',
      harmonicNames: {
        1: '১ম সমমেল (মূলসুর)',
        2: '২য় সমমেল (১ম উপসুর)',
        3: '৩য় সমমেল (২য় উপসুর)',
        4: '৪র্থ সমমেল (৩য় উপসুর)',
        5: '৫ম সমমেল (৪র্থ উপসুর)',
      },
      materials: {
        steel: 'ইস্পাত (Steel)',
        copper: 'তামা (Copper)',
        brass: 'পিতল (Brass)',
        nylon: 'নাইলন (Nylon)',
      },
      pluckButton: 'তারে টান দিয়ে শব্দ শুনুন',
      paperRider: 'কাগজের আরোহী (Paper Rider)',
      placeAtNode: 'নিস্পন্দ বিন্দুতে রাখুন',
      placeAtAntinode: 'সুস্পন্দ বিন্দুতে রাখুন',
      riderStatusIdle: 'আরোহী স্থির আছে — টান দিয়ে পরীক্ষা করুন',
      riderStatusStable: 'নিস্পন্দ বিন্দুতে স্থির (কম্পন শূন্য)',
      riderStatusThrown: 'সুস্পন্দ বিন্দু থেকে ছিটকে পড়েছে!',
      bridgeDragHint: 'কাঠের ব্রিজ B₁ ও B₂ ড্র্যাগ করে দৈর্ঘ্য l বদলান অথবা তারে ক্লিক করে কম্পন সৃষ্টি করুন',
      slottedMassLabel: 'ঝুলন্ত বাটখারা',
      bridgeLeft: 'ব্রিজ B₁',
      bridgeRight: 'ব্রিজ B₂',
      lawSummary: 'f ∝ 1/l · f ∝ √T · f ∝ 1/√μ',
    },
    organPipe: {
      title: 'খোলা ও বদ্ধ অর্গান নলে বায়ুস্তম্ভের কম্পন',
      subtitle: 'অণুদৈর্ঘ্য কণার কম্পন ও যুগ্ম-বিজোড় সমমেলের তুলনা',
      boundaryType: 'নলের প্রান্তের ধরন',
      closedPipe: 'একমুখ বদ্ধ নল',
      openPipe: 'উভয়মুখ খোলা নল',
      compareBoth: 'পাশাপাশি তুলনা',
      pipeLength: 'নলের দৈর্ঘ্য (L)',
      overtoneSelector: 'কম্পন মোড / উপসুর',
      displacementOverlay: 'সরণ তরঙ্গ রেখা (s)',
      pressureOverlay: 'চাপ পরিবর্তন রেখা (ΔP)',
      playToneButton: 'নলে ফুঁ দিয়ে সুর শুনুন',
      stopToneButton: 'শব্দ থামান',
      closedTag: 'বদ্ধ প্রান্ত (N) — খোলা প্রান্ত (A)',
      openTag: 'খোলা প্রান্ত (A) — খোলা প্রান্ত (A)',
      oddOnlyNote: 'একমুখ বদ্ধ নলে কেবল বিজোড় সমমেল (f₁, 3f₁, 5f₁, ...) উৎপন্ন হয়।',
      allHarmonicsNote: 'উভয়মুখ খোলা নলে সকল পূর্ণসংখ্যক সমমেল (f₁, 2f₁, 3f₁, ...) উৎপন্ন হয়।',
      ratioComparison: 'সমান দৈর্ঘ্যে খোলা নলের মূলসুর বদ্ধ নলের দ্বিগুণ (f_open = 2·f_closed)',
      displacementNode: 'সরণ নিস্পন্দ (N)',
      displacementAntinode: 'সরণ সুস্পন্দ (A)',
      pressureNode: 'চাপ নিস্পন্দ',
      pressureAntinode: 'চাপ সুস্পন্দ',
      particleLegend: 'বায়ুকণার অণুদৈর্ঘ্য কম্পন',
    },
    resonanceTube: {
      title: 'প্রান্ত সংশোধন ও অনুনাদ বায়ুস্তম্ভ নল',
      subtitle: 'র‍্যালে প্রান্ত সংশোধন (e = 0.6r) ও শব্দের বেগ নির্ণয়',
      tuningForkFreq: 'সুরশলাকার কম্পাঙ্ক (f)',
      tubeRadius: 'নলের অন্তঃব্যাসার্ধ (r)',
      airColumnLength: 'বায়ুস্তম্ভের দৈর্ঘ্য (l)',
      endCorrectionToggle: 'প্রান্ত সংশোধন (e = 0.6r)',
      endCorrectionApplied: 'প্রযোজ্য (L_eff = l + 0.6r)',
      endCorrectionIgnored: 'উপেক্ষিত (e = 0)',
      strikeForkButton: 'সুরশলাকা বাজান ও অনুনাদ শুনুন',
      stopForkButton: 'সুরশলাকা থামান',
      snapResonance1: '১ম অনুনাদ (l₁)',
      snapResonance2: '২য় অনুনাদ (l₂)',
      captureL1: 'l₁ রেকর্ড করুন',
      captureL2: 'l₂ রেকর্ড করুন',
      resonanceStatusNone: 'অনুনাদ অবস্থা: সাধারণ কম্পন',
      resonanceStatusFirst: '১ম অনুনাদ অর্জিত! (L_eff = λ/4)',
      resonanceStatusSecond: '২য় অনুনাদ অর্জিত! (L_eff = 3λ/4)',
      resonanceIntensity: 'অনুনাদ তীব্রতা',
      effectiveLength: 'কার্যকর দৈর্ঘ্য (L_eff)',
      endCorrectionVal: 'প্রান্ত সংশোধন (e)',
      theoreticalE: 'তাত্ত্বিক e = 0.6r',
      measuredE: 'পরিমাপকৃত e = (l₂ - 3l₁)/2',
      measuredSpeed: 'নির্ণীত বেগ v = 2f(l₂ - l₁)',
      trueSpeed: 'প্রকৃত বেগ (v)',
      firstResonance: '১ম অনুনাদ দৈর্ঘ্য (l₁)',
      secondResonance: '২য় অনুনাদ দৈর্ঘ্য (l₂)',
      zoomTitle: 'খোলা মুখে প্রান্ত সংশোধন (জুম)',
      waterReservoirHint: 'পানির জলাধার বা লেভেল টেনে বায়ুস্তম্ভের দৈর্ঘ্য l পরিবর্তন করুন',
      intensityGraphTitle: 'অনুনাদ তীব্রতা বনাম দৈর্ঘ্য (I–l)',
    },
  },
  en: {
    studioTitle: 'Stretched String & Air Column Studio',
    institutionName: 'উদ্ভাস',
    langLabel: 'বাংলা',
    reset: 'Reset',
    mute: 'Mute',
    unmute: 'Audio On',
    audioActive: 'Audio Active',
    modules: {
      sonometer: 'Module 1: Stretched String & Sonometer Laws',
      sonometerShort: 'Stretched String Sonometer',
      organPipe: 'Module 2: Open vs Closed Organ Pipe Harmonics',
      organPipeShort: 'Open vs Closed Pipe',
      resonanceTube: 'Module 3: End Correction & Resonance Tube Lab',
      resonanceTubeShort: 'End Correction & Resonance',
    },
    common: {
      controls: 'Control Dock',
      telemetry: 'Live Telemetry & Theory',
      formulaCard: 'Formula & Live Substitution',
      harmonicLadder: 'Harmonic & Overtone Ladder',
      nodeAntinodeMap: 'Node (N) & Antinode (A) Coordinates',
      fundamental: 'Fundamental (1st Harmonic)',
      overtone1: '1st Overtone',
      overtone2: '2nd Overtone',
      overtone3: '3rd Overtone',
      harmonicLabel: 'Harmonic',
      frequency: 'Frequency',
      wavelength: 'Wavelength',
      waveSpeed: 'Wave Speed',
      node: 'Node (N)',
      antinode: 'Antinode (A)',
      nodes: 'Nodes',
      antinodes: 'Antinodes',
      ratio: 'Ratio',
      active: 'Active',
      position: 'Position',
      dragHint: 'Drag directly on the canvas stage',
      speedOfSound: 'Speed of Sound',
      temperature: 'Temperature',
    },
    sonometer: {
      title: 'Stretched String Transverse Vibration & Sonometer',
      subtitle: "Verify Mersenne's Laws with draggable knife-edge bridges and paper rider",
      vibratingLength: 'Vibrating Length (l)',
      hangingMass: 'Hanging Mass (M)',
      tensionForce: 'Tension Force (T = Mg)',
      wireMaterial: 'Wire Material',
      wireRadius: 'Wire Radius (r)',
      linearDensity: 'Linear Mass Density (μ)',
      manualMuOverride: 'Manual μ Override',
      harmonicMode: 'Loops / Harmonic Mode (p)',
      harmonicNames: {
        1: '1st Harmonic (Fundamental)',
        2: '2nd Harmonic (1st Overtone)',
        3: '3rd Harmonic (2nd Overtone)',
        4: '4th Harmonic (3rd Overtone)',
        5: '5th Harmonic (4th Overtone)',
      },
      materials: {
        steel: 'Steel',
        copper: 'Copper',
        brass: 'Brass',
        nylon: 'Nylon',
      },
      pluckButton: 'Play Plucked String Audio',
      paperRider: 'Paper Rider Test',
      placeAtNode: 'Place at Node',
      placeAtAntinode: 'Place at Antinode',
      riderStatusIdle: 'Rider perched — pluck string to test',
      riderStatusStable: 'Balanced at Node (zero amplitude)',
      riderStatusThrown: 'Thrown off from Antinode!',
      bridgeDragHint: 'Drag wooden bridges B₁ & B₂ to change length l, or click the string to pluck',
      slottedMassLabel: 'Slotted Mass',
      bridgeLeft: 'Bridge B₁',
      bridgeRight: 'Bridge B₂',
      lawSummary: 'f ∝ 1/l · f ∝ √T · f ∝ 1/√μ',
    },
    organPipe: {
      title: 'Open vs Closed Organ Pipe Air Column Harmonics',
      subtitle: 'Longitudinal particle oscillation and odd vs complete harmonic series',
      boundaryType: 'Pipe Boundary Type',
      closedPipe: 'Closed at One End',
      openPipe: 'Open at Both Ends',
      compareBoth: 'Side-by-Side Comparison',
      pipeLength: 'Pipe Length (L)',
      overtoneSelector: 'Mode / Overtone Selector',
      displacementOverlay: 'Displacement Envelope (s)',
      pressureOverlay: 'Pressure Curve (ΔP)',
      playToneButton: 'Blow Air / Play Pipe Tone',
      stopToneButton: 'Stop Pipe Tone',
      closedTag: 'Closed End (N) — Open End (A)',
      openTag: 'Open End (A) — Open End (A)',
      oddOnlyNote: 'Closed-end pipes support ONLY odd harmonics (f₁, 3f₁, 5f₁, ...).',
      allHarmonicsNote: 'Open-end pipes support ALL integer harmonics (f₁, 2f₁, 3f₁, ...).',
      ratioComparison: 'For equal length L, open pipe fundamental is twice closed pipe (f_open = 2·f_closed)',
      displacementNode: 'Displacement Node (N)',
      displacementAntinode: 'Displacement Antinode (A)',
      pressureNode: 'Pressure Node',
      pressureAntinode: 'Pressure Antinode',
      particleLegend: 'Longitudinal Air Particles',
    },
    resonanceTube: {
      title: 'End Correction (e = 0.6r) & Resonance Tube Lab',
      subtitle: 'Rayleigh end correction and speed of sound measurement via water column',
      tuningForkFreq: 'Tuning Fork Frequency (f)',
      tubeRadius: 'Inner Tube Radius (r)',
      airColumnLength: 'Air Column Length (l)',
      endCorrectionToggle: 'Apply End Correction (e = 0.6r)',
      endCorrectionApplied: 'Applied (L_eff = l + 0.6r)',
      endCorrectionIgnored: 'Ignored (e = 0)',
      strikeForkButton: 'Strike Tuning Fork & Listen',
      stopForkButton: 'Silence Tuning Fork',
      snapResonance1: '1st Resonance (l₁)',
      snapResonance2: '2nd Resonance (l₂)',
      captureL1: 'Record l₁',
      captureL2: 'Record l₂',
      resonanceStatusNone: 'Status: Off-Resonance',
      resonanceStatusFirst: '1st Resonance Peak! (L_eff = λ/4)',
      resonanceStatusSecond: '2nd Resonance Peak! (L_eff = 3λ/4)',
      resonanceIntensity: 'Resonance Intensity',
      effectiveLength: 'Effective Length (L_eff)',
      endCorrectionVal: 'End Correction (e)',
      theoreticalE: 'Theoretical e = 0.6r',
      measuredE: 'Calculated e = (l₂ - 3l₁)/2',
      measuredSpeed: 'Measured Speed v = 2f(l₂ - l₁)',
      trueSpeed: 'True Speed (v)',
      firstResonance: '1st Resonance (l₁)',
      secondResonance: '2nd Resonance (l₂)',
      zoomTitle: 'Open Mouth End Correction (Zoom)',
      waterReservoirHint: 'Drag water reservoir or meniscus directly to tune air column l',
      intensityGraphTitle: 'Resonance Intensity vs Length (I–l)',
    },
  },
};
