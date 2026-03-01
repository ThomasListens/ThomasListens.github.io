/**
 * FreeSurfer Desikan-Killiany Atlas Color LUT + Fallback Palette
 *
 * Color assignment priority:
 *   1. Electrode coordinates → nearest DK region → FreeSurfer color
 *   2. Manual ELECTRODE_REGION_MAP override → FreeSurfer color
 *   3. Fallback: auto-assign a distinct hue per shaft, depth gradient within
 *
 * Source: https://surfer.nmr.mgh.harvard.edu/fswiki/FsTutorial/AnatomicalROI/FreeSurferColorLUT
 * Reference: Desikan et al. (2006) NeuroImage 31:968-980
 */

// ─── Subcortical structures ──────────────────────────────────

export const SUBCORTICAL = {
  'Thalamus':       { r: 0,   g: 118, b: 14  },
  'Caudate':        { r: 122, g: 186, b: 220 },
  'Putamen':        { r: 236, g: 13,  b: 176 },
  'Pallidum':       { r: 12,  g: 48,  b: 255 },
  'Hippocampus':    { r: 220, g: 216, b: 20  },
  'Amygdala':       { r: 103, g: 255, b: 255 },
  'Accumbens':      { r: 255, g: 165, b: 0   },
};

// ─── DK cortical parcellation (34 regions) ───────────────────

export const DK_CORTICAL = {
  'bankssts':                 { r: 25,  g: 100, b: 40  },
  'caudalanteriorcingulate':  { r: 125, g: 100, b: 160 },
  'caudalmiddlefrontal':      { r: 100, g: 25,  b: 0   },
  'cuneus':                   { r: 220, g: 20,  b: 100 },
  'entorhinal':               { r: 220, g: 20,  b: 10  },
  'fusiform':                 { r: 180, g: 220, b: 140 },
  'inferiorparietal':         { r: 220, g: 60,  b: 220 },
  'inferiortemporal':         { r: 180, g: 40,  b: 120 },
  'isthmuscingulate':         { r: 140, g: 20,  b: 140 },
  'lateraloccipital':         { r: 20,  g: 30,  b: 140 },
  'lateralorbitofrontal':     { r: 35,  g: 75,  b: 50  },
  'lingual':                  { r: 225, g: 140, b: 140 },
  'medialorbitofrontal':      { r: 200, g: 35,  b: 75  },
  'middletemporal':           { r: 160, g: 100, b: 50  },
  'parahippocampal':          { r: 20,  g: 220, b: 60  },
  'paracentral':              { r: 60,  g: 220, b: 60  },
  'parsopercularis':          { r: 220, g: 180, b: 140 },
  'parsorbitalis':            { r: 20,  g: 100, b: 50  },
  'parstriangularis':         { r: 220, g: 60,  b: 20  },
  'pericalcarine':            { r: 120, g: 100, b: 60  },
  'postcentral':              { r: 220, g: 20,  b: 20  },
  'posteriorcingulate':       { r: 220, g: 180, b: 220 },
  'precentral':               { r: 60,  g: 20,  b: 220 },
  'precuneus':                { r: 160, g: 140, b: 180 },
  'rostralanteriorcingulate': { r: 80,  g: 20,  b: 140 },
  'rostralmiddlefrontal':     { r: 75,  g: 50,  b: 125 },
  'superiorfrontal':          { r: 20,  g: 220, b: 160 },
  'superiorparietal':         { r: 20,  g: 180, b: 140 },
  'superiortemporal':         { r: 140, g: 220, b: 220 },
  'supramarginal':            { r: 80,  g: 160, b: 20  },
  'frontalpole':              { r: 100, g: 0,   b: 100 },
  'temporalpole':             { r: 70,  g: 70,  b: 70  },
  'transversetemporal':       { r: 150, g: 150, b: 200 },
  'insula':                   { r: 255, g: 192, b: 32  },
};


// ─── Manual electrode-to-region overrides ────────────────────
// Used when coordinates aren't available. Populated per-dataset or via UI.

export const ELECTRODE_REGION_MAP = {};

/**
 * Register a manual electrode → region mapping.
 */
export function registerElectrode(shaftName, region, hemisphere, soz = false) {
  const type = SUBCORTICAL[region] ? 'subcortical' : 'cortical';
  ELECTRODE_REGION_MAP[shaftName] = { region, hemisphere, type, soz };
}


// ─── Fallback palette ────────────────────────────────────────
// 16 hues, maximally distinguishable on dark backgrounds.
// Assigned round-robin to shafts with no atlas or manual color.

const FALLBACK_HUES = [
  { r: 230, g: 100, b: 100 },  // warm red
  { r: 100, g: 180, b: 230 },  // sky blue
  { r: 180, g: 230, b: 100 },  // lime
  { r: 230, g: 160, b: 60  },  // amber
  { r: 160, g: 100, b: 230 },  // violet
  { r: 100, g: 230, b: 180 },  // teal
  { r: 230, g: 100, b: 200 },  // pink
  { r: 200, g: 200, b: 100 },  // gold
  { r: 100, g: 140, b: 200 },  // steel blue
  { r: 200, g: 140, b: 100 },  // clay
  { r: 140, g: 200, b: 140 },  // sage
  { r: 200, g: 100, b: 140 },  // rose
  { r: 140, g: 200, b: 230 },  // ice
  { r: 230, g: 200, b: 140 },  // sand
  { r: 140, g: 100, b: 180 },  // plum
  { r: 100, g: 200, b: 100 },  // green
];

const _fallbackAssignments = new Map();
let _fallbackNext = 0;


// ─── Utilities ───────────────────────────────────────────────

/**
 * RGB → hex with minimum brightness for dark backgrounds.
 */
export function rgbToHex({ r, g, b }, minBrightness = 60) {
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  let scale = 1;
  if (lum < minBrightness) {
    scale = minBrightness / Math.max(lum, 1);
  }
  const clamp = (v) => Math.min(255, Math.round(v * scale));
  return '#' + [r, g, b].map(clamp).map((v) => v.toString(16).padStart(2, '0')).join('');
}

/**
 * Depth gradient: dim a color based on position along shaft.
 * @param {{r,g,b}} rgb
 * @param {number} t - 0 = deepest (brightest), 1 = superficial (dimmest)
 * @param {number} range - dimming range (0.3 = surface is 70% brightness)
 */
function depthShade(rgb, t, range = 0.3) {
  const brightness = 1.0 - t * range;
  return {
    r: Math.min(255, Math.round(rgb.r * brightness)),
    g: Math.min(255, Math.round(rgb.g * brightness)),
    b: Math.min(255, Math.round(rgb.b * brightness)),
  };
}

export function getRegionColor(regionName) {
  return SUBCORTICAL[regionName] || DK_CORTICAL[regionName] || null;
}

export function getAllRegions() {
  return {
    subcortical: Object.keys(SUBCORTICAL),
    cortical: Object.keys(DK_CORTICAL),
  };
}


// ─── Contact color map (set by electrode-localization.js) ────

let _contactColorMap = null;

/** Set per-contact color map from electrode localization. */
export function setContactColorMap(colorMap) {
  _contactColorMap = colorMap;
}

/** Get the current contact color map. */
export function getContactColorMap() {
  return _contactColorMap;
}

/** Reset fallback assignments (call when loading a new dataset). */
export function resetFallbackAssignments() {
  _fallbackAssignments.clear();
  _fallbackNext = 0;
}


// ─── Main color API ──────────────────────────────────────────

/**
 * Get the base color for a shaft.
 *
 * Priority:
 *   1. Contact color map (from coordinates)
 *   2. Manual ELECTRODE_REGION_MAP
 *   3. Fallback palette (auto-assigned, stable per shaft name)
 *
 * @param {string} shaftName
 * @returns {{ hex, rgb, region, hemisphere, soz, type, source }}
 */
export function getShaftColor(shaftName) {

  // 1. Coordinate-based lookup
  if (_contactColorMap) {
    for (let c = 1; c <= 20; c++) {
      const info = _contactColorMap.get(shaftName + c);
      if (info) {
        return { ...info, soz: false, source: 'coordinates' };
      }
    }
  }

  // 2. Manual mapping
  const mapping = ELECTRODE_REGION_MAP[shaftName];
  if (mapping) {
    const rgb = mapping.type === 'subcortical'
      ? SUBCORTICAL[mapping.region]
      : DK_CORTICAL[mapping.region];
    if (rgb) {
      return {
        hex: rgbToHex(rgb), rgb,
        region: mapping.region, hemisphere: mapping.hemisphere,
        soz: mapping.soz, type: mapping.type, source: 'manual',
      };
    }
  }

  // Try stripping shaft sub-letter: "RAF-A" → "RAF"
  const base = shaftName.replace(/-[A-Z]$/, '');
  if (base !== shaftName && ELECTRODE_REGION_MAP[base]) {
    const result = getShaftColor(base);
    if (result.source !== 'fallback') return result;
  }

  // 3. Fallback palette
  if (!_fallbackAssignments.has(shaftName)) {
    _fallbackAssignments.set(shaftName, _fallbackNext % FALLBACK_HUES.length);
    _fallbackNext++;
  }
  const rgb = FALLBACK_HUES[_fallbackAssignments.get(shaftName)];

  return {
    hex: rgbToHex(rgb), rgb,
    region: 'unknown',
    hemisphere: shaftName.startsWith('L') ? 'L' : shaftName.startsWith('R') ? 'R' : '?',
    soz: false, type: 'fallback', source: 'fallback',
  };
}

/**
 * Get colors for all bipolar pairs of a shaft.
 * Deep contacts = brighter, superficial = dimmer.
 *
 * If contact color map exists, each pair uses its deeper contact's region.
 *
 * @param {string} shaftName
 * @param {number} numPairs
 * @param {string[]} [pairLabels] - e.g. ["1-2", "2-3", "3-4"]
 * @returns {{ hex: string, region: string, source: string }[]}
 */
export function getShaftPairColors(shaftName, numPairs, pairLabels) {
  const results = [];

  for (let i = 0; i < numPairs; i++) {
    const t = numPairs <= 1 ? 0 : i / (numPairs - 1);

    // Try per-contact lookup
    if (_contactColorMap && pairLabels && pairLabels[i]) {
      const deeperContact = pairLabels[i].split('-')[0];
      const info = _contactColorMap.get(shaftName + deeperContact);
      if (info) {
        const shaded = depthShade(info.rgb, t);
        results.push({ hex: rgbToHex(shaded), region: info.region, source: 'coordinates' });
        continue;
      }
    }

    // Shaft-level color with depth gradient
    const base = getShaftColor(shaftName);
    const shaded = depthShade(base.rgb, t);
    results.push({ hex: rgbToHex(shaded), region: base.region, source: base.source });
  }

  return results;
}
