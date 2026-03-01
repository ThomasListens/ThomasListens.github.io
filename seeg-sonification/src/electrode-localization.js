/**
 * Electrode Localization → Atlas Color Assignment
 *
 * Pipeline:
 *   1. Load electrodes.tsv (BIDS format: name, x, y, z)
 *   2. For each contact with coordinates, find nearest DK atlas region
 *   3. Assign FreeSurfer LUT color to that contact
 *   4. For bipolar pairs, use the deeper contact's (first contact's) region
 *
 * The DK atlas centroids below are approximate MNI/fsaverage coordinates
 * for each region. For production use, you'd want the actual parcellation
 * volume lookup, but centroids give a reasonable assignment for SEEG contacts
 * which are typically well within the target structure.
 */

import { SUBCORTICAL, DK_CORTICAL, getRegionColor } from './atlas-colors.js';

// ─── DK Atlas Region Centroids (fsaverage/MNI space) ─────────
// Approximate centroids from FreeSurfer fsaverage parcellation.
// Format: [x, y, z, regionName, type]
// Subcortical coords from Harvard-Oxford / FreeSurfer aseg centroids.

const REGION_CENTROIDS = [
  // Subcortical — Left
  [-12, -18, 7, 'Thalamus', 'L'],
  [-13, 12, 9, 'Caudate', 'L'],
  [-24, 3, -1, 'Putamen', 'L'],
  [-18, -4, 0, 'Pallidum', 'L'],
  [-26, -21, -12, 'Hippocampus', 'L'],
  [-22, -5, -18, 'Amygdala', 'L'],
  [-10, 12, -7, 'Accumbens', 'L'],

  // Subcortical — Right
  [12, -18, 7, 'Thalamus', 'R'],
  [14, 12, 9, 'Caudate', 'R'],
  [25, 3, -1, 'Putamen', 'R'],
  [19, -4, 0, 'Pallidum', 'R'],
  [27, -21, -12, 'Hippocampus', 'R'],
  [23, -5, -18, 'Amygdala', 'R'],
  [11, 12, -7, 'Accumbens', 'R'],

  // Cortical — Left hemisphere (approximate DK centroids)
  [-52, -37, 2, 'bankssts', 'L'],
  [-5, 12, 30, 'caudalanteriorcingulate', 'L'],
  [-36, 12, 42, 'caudalmiddlefrontal', 'L'],
  [-7, -79, 21, 'cuneus', 'L'],
  [-24, -8, -30, 'entorhinal', 'L'],
  [-35, -42, -18, 'fusiform', 'L'],
  [-42, -62, 30, 'inferiorparietal', 'L'],
  [-50, -28, -18, 'inferiortemporal', 'L'],
  [-8, -42, 26, 'isthmuscingulate', 'L'],
  [-28, -82, 8, 'lateraloccipital', 'L'],
  [-28, 32, -14, 'lateralorbitofrontal', 'L'],
  [-14, -68, -3, 'lingual', 'L'],
  [-6, 42, -12, 'medialorbitofrontal', 'L'],
  [-55, -18, -14, 'middletemporal', 'L'],
  [-22, -30, -16, 'parahippocampal', 'L'],
  [-8, -26, 56, 'paracentral', 'L'],
  [-48, 10, 12, 'parsopercularis', 'L'],
  [-40, 34, -10, 'parsorbitalis', 'L'],
  [-44, 28, 2, 'parstriangularis', 'L'],
  [-8, -76, 6, 'pericalcarine', 'L'],
  [-44, -26, 48, 'postcentral', 'L'],
  [-6, -30, 32, 'posteriorcingulate', 'L'],
  [-38, -10, 52, 'precentral', 'L'],
  [-8, -58, 38, 'precuneus', 'L'],
  [-6, 32, 8, 'rostralanteriorcingulate', 'L'],
  [-32, 38, 22, 'rostralmiddlefrontal', 'L'],
  [-12, 30, 44, 'superiorfrontal', 'L'],
  [-24, -58, 52, 'superiorparietal', 'L'],
  [-52, -12, -2, 'superiortemporal', 'L'],
  [-50, -38, 32, 'supramarginal', 'L'],
  [-8, 60, -10, 'frontalpole', 'L'],
  [-36, 10, -34, 'temporalpole', 'L'],
  [-44, -22, 8, 'transversetemporal', 'L'],
  [-34, 0, 4, 'insula', 'L'],

  // Cortical — Right hemisphere (mirror of left)
  [52, -37, 2, 'bankssts', 'R'],
  [6, 12, 30, 'caudalanteriorcingulate', 'R'],
  [37, 12, 42, 'caudalmiddlefrontal', 'R'],
  [8, -79, 21, 'cuneus', 'R'],
  [25, -8, -30, 'entorhinal', 'R'],
  [36, -42, -18, 'fusiform', 'R'],
  [43, -62, 30, 'inferiorparietal', 'R'],
  [51, -28, -18, 'inferiortemporal', 'R'],
  [9, -42, 26, 'isthmuscingulate', 'R'],
  [29, -82, 8, 'lateraloccipital', 'R'],
  [29, 32, -14, 'lateralorbitofrontal', 'R'],
  [15, -68, -3, 'lingual', 'R'],
  [7, 42, -12, 'medialorbitofrontal', 'R'],
  [56, -18, -14, 'middletemporal', 'R'],
  [23, -30, -16, 'parahippocampal', 'R'],
  [9, -26, 56, 'paracentral', 'R'],
  [49, 10, 12, 'parsopercularis', 'R'],
  [41, 34, -10, 'parsorbitalis', 'R'],
  [45, 28, 2, 'parstriangularis', 'R'],
  [9, -76, 6, 'pericalcarine', 'R'],
  [45, -26, 48, 'postcentral', 'R'],
  [7, -30, 32, 'posteriorcingulate', 'R'],
  [39, -10, 52, 'precentral', 'R'],
  [9, -58, 38, 'precuneus', 'R'],
  [7, 32, 8, 'rostralanteriorcingulate', 'R'],
  [33, 38, 22, 'rostralmiddlefrontal', 'R'],
  [13, 30, 44, 'superiorfrontal', 'R'],
  [25, -58, 52, 'superiorparietal', 'R'],
  [53, -12, -2, 'superiortemporal', 'R'],
  [51, -38, 32, 'supramarginal', 'R'],
  [9, 60, -10, 'frontalpole', 'R'],
  [37, 10, -34, 'temporalpole', 'R'],
  [45, -22, 8, 'transversetemporal', 'R'],
  [35, 0, 4, 'insula', 'R'],
];


// ─── TSV Parser ──────────────────────────────────────────────

/**
 * Parse a BIDS electrodes.tsv file.
 * @param {string} tsvText - raw TSV content
 * @returns {Map<string, {x: number, y: number, z: number}>}
 */
export function parseElectrodesTSV(tsvText) {
  const lines = tsvText.trim().split('\n');
  const contacts = new Map();

  // Skip BOM if present, find header
  const header = lines[0].replace(/^\uFEFF/, '').split('\t').map((h) => h.trim().toLowerCase());
  const nameIdx = header.indexOf('name');
  const xIdx = header.indexOf('x');
  const yIdx = header.indexOf('y');
  const zIdx = header.indexOf('z');

  if (nameIdx < 0 || xIdx < 0 || yIdx < 0 || zIdx < 0) {
    console.warn('electrodes.tsv missing required columns (name, x, y, z)');
    return contacts;
  }

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split('\t').map((c) => c.trim());
    const name = cols[nameIdx];
    const x = parseFloat(cols[xIdx]);
    const y = parseFloat(cols[yIdx]);
    const z = parseFloat(cols[zIdx]);

    if (name && !isNaN(x) && !isNaN(y) && !isNaN(z)) {
      contacts.set(name, { x, y, z });
    }
  }

  return contacts;
}


// ─── Nearest Region Lookup ───────────────────────────────────

function euclidean(a, b) {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

/**
 * Find the nearest DK atlas region for an xyz coordinate.
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @returns {{ region: string, hemisphere: string, type: string, distance: number, rgb: {r,g,b} }}
 */
export function findNearestRegion(x, y, z) {
  let bestDist = Infinity;
  let bestRegion = null;

  for (const [cx, cy, cz, name, hemi] of REGION_CENTROIDS) {
    const d = euclidean([x, y, z], [cx, cy, cz]);
    if (d < bestDist) {
      bestDist = d;
      bestRegion = { region: name, hemisphere: hemi };
    }
  }

  if (!bestRegion) {
    return { region: 'unknown', hemisphere: '?', type: 'unknown', distance: Infinity, rgb: { r: 113, g: 113, b: 122 } };
  }

  const isSubcortical = !!SUBCORTICAL[bestRegion.region];
  const rgb = getRegionColor(bestRegion.region) || { r: 113, g: 113, b: 122 };

  return {
    region: bestRegion.region,
    hemisphere: bestRegion.hemisphere,
    type: isSubcortical ? 'subcortical' : 'cortical',
    distance: bestDist,
    rgb,
  };
}


// ─── Per-Contact Color Assignment ────────────────────────────

/**
 * Build a color map for all contacts from an electrodes.tsv.
 * @param {string} tsvText
 * @returns {Map<string, { region, hemisphere, type, distance, rgb, hex }>}
 */
export function buildContactColorMap(tsvText) {
  const contacts = parseElectrodesTSV(tsvText);
  const colorMap = new Map();

  function rgbToHex({ r, g, b }) {
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    let scale = 1;
    if (lum < 60) scale = 60 / Math.max(lum, 1);
    const clamp = (v) => Math.min(255, Math.round(v * scale));
    return '#' + [r, g, b].map(clamp).map((v) => v.toString(16).padStart(2, '0')).join('');
  }

  for (const [name, { x, y, z }] of contacts) {
    const info = findNearestRegion(x, y, z);
    colorMap.set(name, {
      ...info,
      hex: rgbToHex(info.rgb),
    });
  }

  return colorMap;
}


/**
 * Get the color for a bipolar pair given a contact color map.
 * Uses the deeper contact's (first contact's) region.
 * @param {string} contact1Name - e.g. "RA1"
 * @param {string} contact2Name - e.g. "RA2"
 * @param {Map} contactColorMap - from buildContactColorMap
 * @returns {{ hex, region, hemisphere, type }}
 */
export function getBipolarPairColor(contact1Name, contact2Name, contactColorMap) {
  // Try deeper contact first (contact1), fall back to contact2
  const c1 = contactColorMap.get(contact1Name);
  if (c1) return c1;

  const c2 = contactColorMap.get(contact2Name);
  if (c2) return c2;

  // No coordinates for either contact
  return {
    hex: '#71717a',
    region: 'unknown',
    hemisphere: '?',
    type: 'unknown',
  };
}


export { REGION_CENTROIDS };
