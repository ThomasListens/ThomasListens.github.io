/**
 * Metabolic Pathway Data - Master File
 * 600 Curated Pathways from Healthy Human Gut Microbiome
 * 
 * RATIO MAPPING SYSTEM:
 * Edit RATIO_MAPS to test different harmonic assignments.
 * Ratios are assigned by PREVALENCE TIER first,
 * then by ABUNDANCE (highest first) within each tier,
 * within each subcategory.
 * 
 * Generated from: healthy_gut_pathways_organized.csv
 * Engineered pathways removed: 8
 */

// ╔════════════════════════════════════════════════════════════════════════════╗
// ║  RATIO MAPS - EDIT THESE TO TEST DIFFERENT HARMONIC MAPPINGS!              ║
// ╠════════════════════════════════════════════════════════════════════════════╣
// ║  Format: 'Subcategory': [[n,d], [n,d], ...]                                ║
// ║  Ratios assigned in order of ABUNDANCE (highest abundance → first ratio)  ║
// ║  If more pathways than ratios, last ratio repeats                          ║
// ╚════════════════════════════════════════════════════════════════════════════╝

const RATIO_MAPS = {
    
    // ═══════════════════════════════════════════════════════════════════════
    // ENERGY (55 pathways) - Prime limits 2-5
    // ═══════════════════════════════════════════════════════════════════════
    
    // Glycolysis/Gluconeogenesis (11 pathways)
    'Glycolysis/Gluconeogenesis': [
    [1,1],   // PWY-1042 - glycolysis IV (highest abundance)
    [2,1],   // ANAGLYCOLYSIS-PWY - glycolysis III
    [3,1],   // GLYCOLYSIS - glycolysis I
    [4,1],   // PWY66-400 - glycolysis VI
    [6,1],  // GLUCONEO-PWY - gluconeogenesis I
    [8,1],  // PWY-5484 - glycolysis II
    [12,1],   // PWY66-399 - gluconeogenesis III
    [16,1],   // GLYCOLYSIS-E-D - superpathway glycolysis/Entner-Doudoroff
    [24,1],   // GLYCOLYSIS-TCA-GLYOX-BYPASS - superpathway
    [32,1],  // PWY-5464 - superpathway cytosolic glycolysis
    [64,3]   // PWY-7446 - sulfoglycolysis (lowest)
],
    
    // Fermentation (16 pathways) - Prime 5
    'Fermentation': [
    [4,3],   // ANAEROFRUCAT-PWY - homolactic (highest)
    [5,3],   // PWY-5100 - pyruvate to acetate/lactate
    [6,5],   // FERMENTATION-PWY - mixed acid
    [8,5],  // PWY-5676 - acetyl-CoA to butanoate
    [8,7],   // P461-PWY - hexitol fermentation
    [4,5],   // PWY-6590 - Clostridium acidogenic
    [8,5],  // CENTFERM-PWY - pyruvate to butanoate
    [8,6],  // P108-PWY - pyruvate to propanoate
    [4,5],   // PWY4LZ-257 - Chlamydomonas fermentation
    [3,5],   // PWY-6588 - pyruvate to acetone
    [2,3],   // P122-PWY - heterolactic
    [5,18],  // PROPFERM-PWY - L-alanine fermentation
    [4,15],  // PWY-5677 - succinate to butanoate
    [8,15],  // P163-PWY - L-lysine fermentation
    [2,5],   // (spare)
    [4,9]    // (spare)
],
    
    // TCA Cycle (14 pathways)
    'TCA Cycle': [
    [3,2],   // TCA - TCA cycle I (highest)
    [9,4],   // PWY-5913 - TCA VI
    [27,8],   // PWY-5690 - TCA II
    [27,16],  // PWY-6969 - TCA V
    [18,1],  // P42-PWY - incomplete reductive
    [3,2],   // P105-PWY - TCA IV
    [9,2],   // TCA-GLYOX-BYPASS - superpathway
    [27,1],  // PWY-7254 - TCA VII
    [9,4],   // REDCITCYC - TCA VIII
    [27,2],  // PWY66-398 - TCA III
    [9,8],   // PWY-5747 - 2-methylcitrate II
    [27,4],  // P23-PWY - reductive TCA I
    [27,8],  // PWY0-42 - 2-methylcitrate I
    [27,16]  // PWY-5392 - reductive TCA II
],
    
    // Glyoxylate Cycle (4 pathways)
    'Glyoxylate Cycle': [
    [16,9],   // PWY-561 - superpathway glyoxylate (highest)
    [32,9],   // GLYOXYLATE-BYPASS - glyoxylate cycle
    [64,9],  // PWY-5705 - allantoin degradation III
    [128,9]  // PWY-5692 - allantoin degradation II
],
    
    // Pentose Phosphate (3 pathways)
    'Pentose Phosphate': [
    [9,1],   // NONOXIPENT-PWY - non-oxidative branch (highest)
    [9,2],   // PENTOSE-P-PWY - pentose phosphate pathway
    [81,16]   // (or use 3,2 if you want variety)
],
    
    // Respiration (3 pathways)
    'Respiration': [
    [32,3],   // PWY-3781 - aerobic respiration I (highest)
    [32,9],   // PWY-7279 - aerobic respiration II
    [32,27]    // (spare or combine)
],
    
    // ═══════════════════════════════════════════════════════════════════════
    // BIOSYNTHESIS (288 pathways) - Prime limits 7-13 (harmonics)
    // ═══════════════════════════════════════════════════════════════════════
    
    // Amino Acids (50 pathways)
    'Amino Acids': [
        [7,1], [7,2], [7,3], [7,4], [7,5], [7,6], [14,1], [14,3], [21,2], [21,4],
        [8,7], [9,7], [10,7], [11,7], [12,7], [13,7], [14,5], [14,9], [21,8], [21,16],
        [11,1], [11,2], [11,3], [11,4], [11,5], [11,6], [11,7], [11,8], [11,9], [11,10],
        [13,1], [13,2], [13,3], [13,4], [13,5], [13,6], [13,7], [13,8], [13,9], [13,10],
        [13,11], [13,12], [22,1], [22,3], [26,1], [26,3], [28,1], [28,3], [33,1], [39,1]
    ],
    
    // Nucleotides (22 pathways)
    'Nucleotides': [
        [9,7], [11,9], [13,11], [15,13], [17,15], [19,17],
        [7,1], [9,1], [11,1], [13,1], [7,2], [9,2], [11,2], [13,2],
        [7,4], [9,4], [11,4], [13,4], [7,8], [9,8], [11,8], [13,8]
    ],
    
    // Cofactors/Vitamins (22 pathways)
    'Cofactors/Vitamins': [
        [8,7], [10,9], [12,11], [14,13], [16,15], [18,17],
        [7,1], [7,2], [7,3], [7,4], [9,1], [9,2], [9,4], [11,1],
        [11,2], [11,4], [13,1], [13,2], [13,4], [14,1], [14,3], [21,2]
    ],
    
    // Fatty Acids/Lipids (13 pathways)
    'Fatty Acids/Lipids': [
        [7,4], [7,5], [7,6], [9,5], [9,7], [11,6], [11,7],
        [13,7], [13,8], [13,9], [13,10], [13,11], [13,12]
    ],
    
    // Cell Wall (6 pathways)
    'Cell Wall': [
        [11,8], [11,9], [11,10], [13,9], [13,10], [13,11]
    ],
    
    // Polyamines (6 pathways)
    'Polyamines': [
        [7,3], [9,4], [11,5], [13,6], [15,7], [17,8]
    ],
    
    // Biosynthesis Other (172 pathways) - Extended prime range
    'Biosynthesis_Other': [
        // Will use generated ratios - 172 is a lot!
    ],
    
    // ═══════════════════════════════════════════════════════════════════════
    // DEGRADATION (160 pathways) - Prime limits 7-13 (subharmonics)
    // ═══════════════════════════════════════════════════════════════════════
    
    // Amino Acids Degradation (21 pathways)
    'Degradation_Amino Acids': [
        [1,7], [2,7], [3,7], [4,7], [5,7], [6,7], [1,9], [2,9], [4,9], [8,9],
        [1,11], [2,11], [3,11], [4,11], [5,11], [6,11],
        [1,13], [2,13], [3,13], [4,13], [5,13]
    ],
    
    // Nucleotides Degradation (14 pathways)
    'Degradation_Nucleotides': [
        [1,7], [1,9], [1,11], [1,13], [2,7], [2,9], [2,11], [2,13],
        [4,7], [4,9], [4,11], [4,13], [8,7], [8,9]
    ],
    
    // Aromatics Degradation (13 pathways)
    'Degradation_Aromatics': [
        [3,7], [3,11], [3,13], [5,7], [5,11], [5,13],
        [6,7], [6,11], [6,13], [9,7], [9,11], [9,13], [12,7]
    ],
    
    // Carbohydrates Degradation (9 pathways)
    'Degradation_Carbohydrates': [
        [1,2], [1,3], [1,4], [1,5], [1,6], [1,7], [1,8], [1,9], [1,10]
    ],
    
    // Degradation Other (103 pathways)
    'Degradation_Other': [
        // Will use generated ratios
    ],
    
    // ═══════════════════════════════════════════════════════════════════════
    // SALVAGE (17 pathways) - Prime limits 2-5 (subharmonics)
    // ═══════════════════════════════════════════════════════════════════════
    
    'Salvage/Recycling': [
        [1,2], [1,3], [2,3], [1,4], [3,4], [1,5], [2,5], [3,5], [4,5],
        [1,6], [5,6], [1,8], [3,8], [5,8], [1,9], [2,9], [4,9]
    ],
    
    // ═══════════════════════════════════════════════════════════════════════
    // OTHER (74 pathways) - Prime 17+
    // ═══════════════════════════════════════════════════════════════════════
    
    'Unclassified': [
        // Will use generated ratios with higher primes
    ],
    
    // ═══════════════════════════════════════════════════════════════════════
    // SUPERPATHWAYS (10 pathways)
    // ═══════════════════════════════════════════════════════════════════════
    
    'Superpathways': [
        [1,1], [2,1], [3,2], [4,3], [5,4], [6,5], [7,6], [8,7], [9,8], [10,9]
    ]
};

// ============================================================
// AUTO-GENERATE RATIOS FOR LARGE SUBCATEGORIES
// ============================================================

 function generatePrimeRatios(count, primeBase, harmonic = true) {
    const ratios = [];
    const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23];
    
    for (let i = 1; ratios.length < count; i++) {
        for (const p of primes) {
            if (ratios.length >= count) break;
            if (harmonic) {
                ratios.push([primeBase * i, p]);
            } else {
                ratios.push([p, primeBase * i]);
            }
        }
    }
    return ratios;
}

 //Fill in large subcategories
if (RATIO_MAPS['Biosynthesis_Other'].length === 0) {
    RATIO_MAPS['Biosynthesis_Other'] = generatePrimeRatios(172, 7, true);
}
if (RATIO_MAPS['Degradation_Other'].length === 0) {
    RATIO_MAPS['Degradation_Other'] = generatePrimeRatios(103, 7, false);
}
if (RATIO_MAPS['Unclassified'].length === 0) {
    RATIO_MAPS['Unclassified'] = generatePrimeRatios(74, 17, true);
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function ratioInfo(n, d) {
    const value = n / d;
    const cents = 1200 * Math.log2(value);
    const consonance = n * d;
    
    const primeFactors = (num) => {
        const factors = new Set();
        let temp = num;
        let div = 2;
        while (div * div <= temp) {
            while (temp % div === 0) {
                factors.add(div);
                temp = Math.floor(temp / div);
            }
            div++;
        }
        if (temp > 1) factors.add(temp);
        return factors;
    };
    
    const allPrimes = new Set([...primeFactors(n), ...primeFactors(d)]);
    const primeLimit = Math.max(...allPrimes, 1);
    
    return { n, d, value, cents, consonance, primeLimit };
}

function formatAbundance(value, maxValue) {
    if (value === 0) return '< 0.01%';
    const percent = (value / maxValue) * 100;
    if (percent >= 1) return percent.toFixed(0) + '%';
    if (percent >= 0.1) return percent.toFixed(1) + '%';
    return percent.toFixed(2) + '%';
}


// ╔════════════════════════════════════════════════════════════════════════════╗
// ║  PATHWAY DATA - Sorted by abundance within each subcategory                ║
// ╚════════════════════════════════════════════════════════════════════════════╝

const ALL_PATHWAYS_RAW = [
    { id: 'VALSYN-PWY', name: "L-valine biosynthesis", category: 'biosynthesis', subcategory: 'Amino Acids', prevalence: 0.999177801, tier: 'UNIVERSAL', medianAbundance: 0.000548051, meanAbundance: 0.000558411 },
    { id: 'PWY-6386', name: "UDP-N-acetylmuramoyl-pentapeptide biosynthesis II (lysine-containing)", category: 'biosynthesis', subcategory: 'Amino Acids', prevalence: 0.999177801, tier: 'UNIVERSAL', medianAbundance: 0.000544442, meanAbundance: 0.000547687 },
    { id: 'ILEUSYN-PWY', name: "L-isoleucine biosynthesis I (from threonine)", category: 'biosynthesis', subcategory: 'Amino Acids', prevalence: 0.998972251, tier: 'UNIVERSAL', medianAbundance: 0.000548051, meanAbundance: 0.000558378 },
    { id: 'BRANCHED-CHAIN-AA-SYN-PWY', name: "superpathway of branched amino acid biosynthesis", category: 'biosynthesis', subcategory: 'Amino Acids', prevalence: 0.998972251, tier: 'UNIVERSAL', medianAbundance: 0.000445759, meanAbundance: 0.000461325 },
    { id: 'PWY-5097', name: "L-lysine biosynthesis VI", category: 'biosynthesis', subcategory: 'Amino Acids', prevalence: 0.998972251, tier: 'UNIVERSAL', medianAbundance: 0.000443246, meanAbundance: 0.000448348 },
    { id: 'ARGSYNBSUB-PWY', name: "L-arginine biosynthesis II (acetyl cycle)", category: 'biosynthesis', subcategory: 'Amino Acids', prevalence: 0.998972251, tier: 'UNIVERSAL', medianAbundance: 0.000430276, meanAbundance: 0.000418151 },
    { id: 'PWY-5103', name: "L-isoleucine biosynthesis III", category: 'biosynthesis', subcategory: 'Amino Acids', prevalence: 0.998972251, tier: 'UNIVERSAL', medianAbundance: 0.000421819, meanAbundance: 0.000440768 },
    { id: 'HISTSYN-PWY', name: "L-histidine biosynthesis", category: 'biosynthesis', subcategory: 'Amino Acids', prevalence: 0.998972251, tier: 'UNIVERSAL', medianAbundance: 0.000368397, meanAbundance: 0.000377299 },
    { id: 'PWY-7400', name: "L-arginine biosynthesis IV (archaebacteria)", category: 'biosynthesis', subcategory: 'Amino Acids', prevalence: 0.998766701, tier: 'UNIVERSAL', medianAbundance: 0.000430291, meanAbundance: 0.000419104 },
    { id: 'ARGSYN-PWY', name: "L-arginine biosynthesis I (via L-ornithine)", category: 'biosynthesis', subcategory: 'Amino Acids', prevalence: 0.998766701, tier: 'UNIVERSAL', medianAbundance: 0.000429981, meanAbundance: 0.000419011 },
    { id: 'PWY-2942', name: "L-lysine biosynthesis III", category: 'biosynthesis', subcategory: 'Amino Acids', prevalence: 0.998766701, tier: 'UNIVERSAL', medianAbundance: 0.000407016, meanAbundance: 0.000416004 },
    { id: 'PWY-3001', name: "superpathway of L-isoleucine biosynthesis I", category: 'biosynthesis', subcategory: 'Amino Acids', prevalence: 0.998766701, tier: 'UNIVERSAL', medianAbundance: 0.000339195, meanAbundance: 0.000342277 },
    { id: 'THRESYN-PWY', name: "superpathway of L-threonine biosynthesis", category: 'biosynthesis', subcategory: 'Amino Acids', prevalence: 0.998766701, tier: 'UNIVERSAL', medianAbundance: 0.000290123, meanAbundance: 0.00029476 },
    { id: 'PYRIDNUCSYN-PWY', name: "NAD biosynthesis I (from aspartate)", category: 'biosynthesis', subcategory: 'Amino Acids', prevalence: 0.998561151, tier: 'UNIVERSAL', medianAbundance: 0.000288774, meanAbundance: 0.000293396 },
    { id: 'HSERMETANA-PWY', name: "L-methionine biosynthesis III", category: 'biosynthesis', subcategory: 'Amino Acids', prevalence: 0.998561151, tier: 'UNIVERSAL', medianAbundance: 0.000271169, meanAbundance: 0.000272231 },
    { id: 'SER-GLYSYN-PWY', name: "superpathway of L-serine and glycine biosynthesis I", category: 'biosynthesis', subcategory: 'Amino Acids', prevalence: 0.998561151, tier: 'UNIVERSAL', medianAbundance: 0.000259368, meanAbundance: 0.000260385 },
    { id: 'COMPLETE-ARO-PWY', name: "superpathway of aromatic amino acid biosynthesis", category: 'biosynthesis', subcategory: 'Amino Acids', prevalence: 0.998355601, tier: 'UNIVERSAL', medianAbundance: 0.000442414, meanAbundance: 0.000438332 },
    { id: 'PWY-724', name: "superpathway of L-lysine, L-threonine and L-methionine biosynthesis II", category: 'biosynthesis', subcategory: 'Amino Acids', prevalence: 0.998355601, tier: 'UNIVERSAL', medianAbundance: 0.000364367, meanAbundance: 0.000359529 },
    { id: 'PWY-6936', name: "seleno-amino acid biosynthesis", category: 'biosynthesis', subcategory: 'Amino Acids', prevalence: 0.998355601, tier: 'UNIVERSAL', medianAbundance: 0.00024742, meanAbundance: 0.000249019 },
    { id: 'ASPASN-PWY', name: "superpathway of L-aspartate and L-asparagine biosynthesis", category: 'biosynthesis', subcategory: 'Amino Acids', prevalence: 0.998355601, tier: 'UNIVERSAL', medianAbundance: 0.000188444, meanAbundance: 0.000213891 },
    { id: 'TRPSYN-PWY', name: "L-tryptophan biosynthesis", category: 'biosynthesis', subcategory: 'Amino Acids', prevalence: 0.998150051, tier: 'UNIVERSAL', medianAbundance: 0.00025553, meanAbundance: 0.000253914 },
    { id: 'PWY-5154', name: "L-arginine biosynthesis III (via N-acetyl-L-citrulline)", category: 'biosynthesis', subcategory: 'Amino Acids', prevalence: 0.996711202, tier: 'UNIVERSAL', medianAbundance: 0.000171412, meanAbundance: 0.000180577 },
    { id: 'PWY-4981', name: "L-proline biosynthesis II (from arginine)", category: 'biosynthesis', subcategory: 'Amino Acids', prevalence: 0.995272354, tier: 'UNIVERSAL', medianAbundance: 9.92E-05, meanAbundance: 0.000111509 },
    { id: 'PWY-5188', name: "tetrapyrrole biosynthesis I (from glutamate)", category: 'biosynthesis', subcategory: 'Amino Acids', prevalence: 0.994655704, tier: 'UNIVERSAL', medianAbundance: 0.000128702, meanAbundance: 0.000131938 },
    { id: 'PWY-5104', name: "L-isoleucine biosynthesis IV", category: 'biosynthesis', subcategory: 'Amino Acids', prevalence: 0.992189106, tier: 'UNIVERSAL', medianAbundance: 0.000112167, meanAbundance: 0.000124661 },
    { id: 'PWY-2941', name: "L-lysine biosynthesis II", category: 'biosynthesis', subcategory: 'Amino Acids', prevalence: 0.988900308, tier: 'VERY_COMMON', medianAbundance: 8.82E-05, meanAbundance: 0.000100507 },
    { id: 'MET-SAM-PWY', name: "superpathway of S-adenosyl-L-methionine biosynthesis", category: 'biosynthesis', subcategory: 'Amino Acids', prevalence: 0.988078109, tier: 'VERY_COMMON', medianAbundance: 9.30E-05, meanAbundance: 0.000101413 },
    { id: 'PWY-5347', name: "superpathway of L-methionine biosynthesis (transsulfuration)", category: 'biosynthesis', subcategory: 'Amino Acids', prevalence: 0.988078109, tier: 'VERY_COMMON', medianAbundance: 9.14E-05, meanAbundance: 9.82E-05 },
    { id: 'METSYN-PWY', name: "L-homoserine and L-methionine biosynthesis", category: 'biosynthesis', subcategory: 'Amino Acids', prevalence: 0.988078109, tier: 'VERY_COMMON', medianAbundance: 8.45E-05, meanAbundance: 9.32E-05 },
    { id: 'HOMOSER-METSYN-PWY', name: "L-methionine biosynthesis I", category: 'biosynthesis', subcategory: 'Amino Acids', prevalence: 0.988078109, tier: 'VERY_COMMON', medianAbundance: 4.66E-05, meanAbundance: 5.47E-05 },
    { id: 'DAPLYSINESYN-PWY', name: "L-lysine biosynthesis I", category: 'biosynthesis', subcategory: 'Amino Acids', prevalence: 0.981911614, tier: 'VERY_COMMON', medianAbundance: 8.14E-05, meanAbundance: 0.00010162 },
    { id: 'PWY0-1061', name: "superpathway of L-alanine biosynthesis", category: 'biosynthesis', subcategory: 'Amino Acids', prevalence: 0.980472765, tier: 'VERY_COMMON', medianAbundance: 6.34E-05, meanAbundance: 8.17E-05 },
    { id: 'PWY-5505', name: "L-glutamate and L-glutamine biosynthesis", category: 'biosynthesis', subcategory: 'Amino Acids', prevalence: 0.980472765, tier: 'VERY_COMMON', medianAbundance: 5.27E-05, meanAbundance: 5.31E-05 },
    { id: 'PWY-6549', name: "L-glutamine biosynthesis III", category: 'biosynthesis', subcategory: 'Amino Acids', prevalence: 0.978211716, tier: 'VERY_COMMON', medianAbundance: 5.26E-05, meanAbundance: 5.59E-05 },
    { id: 'ARG+POLYAMINE-SYN', name: "superpathway of arginine and polyamine biosynthesis", category: 'biosynthesis', subcategory: 'Amino Acids', prevalence: 0.977800617, tier: 'VERY_COMMON', medianAbundance: 4.82E-05, meanAbundance: 5.77E-05 },
    { id: 'PRPP-PWY', name: "superpathway of histidine, purine, and pyrimidine biosynthesis", category: 'biosynthesis', subcategory: 'Amino Acids', prevalence: 0.967934224, tier: 'VERY_COMMON', medianAbundance: 0.000118417, meanAbundance: 0.000113676 },
    { id: 'P4-PWY', name: "superpathway of L-lysine, L-threonine and L-methionine biosynthesis I", category: 'biosynthesis', subcategory: 'Amino Acids', prevalence: 0.954779034, tier: 'VERY_COMMON', medianAbundance: 5.49E-05, meanAbundance: 6.85E-05 },
    { id: 'SULFATE-CYS-PWY', name: "superpathway of sulfate assimilation and cysteine biosynthesis", category: 'biosynthesis', subcategory: 'Amino Acids', prevalence: 0.890853032, tier: 'MODERATE', medianAbundance: 2.51E-05, meanAbundance: 4.01E-05 },
    { id: 'PWY-5345', name: "superpathway of L-methionine biosynthesis (by sulfhydrylation)", category: 'biosynthesis', subcategory: 'Amino Acids', prevalence: 0.890441932, tier: 'MODERATE', medianAbundance: 3.04E-05, meanAbundance: 4.67E-05 },
    { id: 'PWY-5189', name: "tetrapyrrole biosynthesis II (from glycine)", category: 'biosynthesis', subcategory: 'Amino Acids', prevalence: 0.828776978, tier: 'MODERATE', medianAbundance: 5.13E-06, meanAbundance: 1.12E-05 },
    { id: 'PWY-5918', name: "superpathay of heme biosynthesis from glutamate", category: 'biosynthesis', subcategory: 'Amino Acids', prevalence: 0.730318602, tier: 'MODERATE', medianAbundance: 4.81E-06, meanAbundance: 1.09E-05 },
    { id: 'PWY-821', name: "superpathway of sulfur amino acid biosynthesis (Saccharomyces cerevisiae)", category: 'biosynthesis', subcategory: 'Amino Acids', prevalence: 0.697019527, tier: 'MODERATE', medianAbundance: 5.31E-06, meanAbundance: 1.36E-05 },
    { id: 'PWY-6628', name: "superpathway of L-phenylalanine biosynthesis", category: 'biosynthesis', subcategory: 'Amino Acids', prevalence: 0.69352518, tier: 'MODERATE', medianAbundance: 8.89E-06, meanAbundance: 2.90E-05 },
    { id: 'PWY-6630', name: "superpathway of L-tyrosine biosynthesis", category: 'biosynthesis', subcategory: 'Amino Acids', prevalence: 0.540184995, tier: 'MODERATE', medianAbundance: 2.65E-06, meanAbundance: 1.38E-05 },
    { id: 'PWY-6629', name: "superpathway of L-tryptophan biosynthesis", category: 'biosynthesis', subcategory: 'Amino Acids', prevalence: 0.502363823, tier: 'MODERATE', medianAbundance: 1.06E-06, meanAbundance: 2.06E-05 },
    { id: 'PWY-5101', name: "L-isoleucine biosynthesis II", category: 'biosynthesis', subcategory: 'Amino Acids', prevalence: 0.444193217, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 9.07E-06 },
    { id: 'PWY-5920', name: "superpathway of heme biosynthesis from glycine", category: 'biosynthesis', subcategory: 'Amino Acids', prevalence: 0.388900308, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 4.14E-06 },
    { id: 'PWY-6281', name: "L-selenocysteine biosynthesis II (archaea and eukaryotes)", category: 'biosynthesis', subcategory: 'Amino Acids', prevalence: 0.032682425, tier: 'RARE', medianAbundance: 0, meanAbundance: 5.75E-08 },
    { id: 'NADSYN-PWY', name: "NAD biosynthesis II (from tryptophan)", category: 'biosynthesis', subcategory: 'Amino Acids', prevalence: 0.001027749, tier: 'RARE', medianAbundance: 0, meanAbundance: 1.89E-09 },
    { id: 'LYSINE-AMINOAD-PWY', name: "L-lysine biosynthesis IV", category: 'biosynthesis', subcategory: 'Amino Acids', prevalence: 0.00020555, tier: 'RARE', medianAbundance: 0, meanAbundance: 1.16E-10 },
    { id: 'PEPTIDOGLYCANSYN-PWY', name: "peptidoglycan biosynthesis I (meso-diaminopimelate containing)", category: 'biosynthesis', subcategory: 'Cell Wall', prevalence: 0.998972251, tier: 'UNIVERSAL', medianAbundance: 0.000529434, meanAbundance: 0.000537655 },
    { id: 'PWY-6385', name: "peptidoglycan biosynthesis III (mycobacteria)", category: 'biosynthesis', subcategory: 'Cell Wall', prevalence: 0.998972251, tier: 'UNIVERSAL', medianAbundance: 0.00051488, meanAbundance: 0.000523088 },
    { id: 'PWY-6471', name: "peptidoglycan biosynthesis IV (Enterococcus faecium)", category: 'biosynthesis', subcategory: 'Cell Wall', prevalence: 0.962589928, tier: 'VERY_COMMON', medianAbundance: 0.000129528, meanAbundance: 0.000130519 },
    { id: 'PWY-6470', name: "peptidoglycan biosynthesis V (&beta;-lactam resistance)", category: 'biosynthesis', subcategory: 'Cell Wall', prevalence: 0.951490236, tier: 'VERY_COMMON', medianAbundance: 6.76E-05, meanAbundance: 7.13E-05 },
    { id: 'PWY-5265', name: "peptidoglycan biosynthesis II (staphylococci)", category: 'biosynthesis', subcategory: 'Cell Wall', prevalence: 0.34717369, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 9.46E-06 },
    { id: 'LPSSYN-PWY', name: "superpathway of lipopolysaccharide biosynthesis", category: 'biosynthesis', subcategory: 'Cell Wall', prevalence: 0.228160329, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 1.91E-06 },
    { id: 'COA-PWY', name: "coenzyme A biosynthesis I", category: 'biosynthesis', subcategory: 'Cofactors/Vitamins', prevalence: 0.999177801, tier: 'UNIVERSAL', medianAbundance: 0.000414035, meanAbundance: 0.000414154 },
    { id: 'COA-PWY-1', name: "coenzyme A biosynthesis II (mammalian)", category: 'biosynthesis', subcategory: 'Cofactors/Vitamins', prevalence: 0.998972251, tier: 'UNIVERSAL', medianAbundance: 0.000491978, meanAbundance: 0.000488684 },
    { id: 'PWY-4242', name: "pantothenate and coenzyme A biosynthesis III", category: 'biosynthesis', subcategory: 'Cofactors/Vitamins', prevalence: 0.998972251, tier: 'UNIVERSAL', medianAbundance: 0.000414723, meanAbundance: 0.000411736 },
    { id: '1CMET2-PWY', name: "N10-formyl-tetrahydrofolate biosynthesis", category: 'biosynthesis', subcategory: 'Cofactors/Vitamins', prevalence: 0.998766701, tier: 'UNIVERSAL', medianAbundance: 0.000407773, meanAbundance: 0.000406754 },
    { id: 'THISYNARA-PWY', name: "superpathway of thiamin diphosphate biosynthesis III (eukaryotes)", category: 'biosynthesis', subcategory: 'Cofactors/Vitamins', prevalence: 0.997738952, tier: 'UNIVERSAL', medianAbundance: 0.00019096, meanAbundance: 0.000197068 },
    { id: 'PANTOSYN-PWY', name: "pantothenate and coenzyme A biosynthesis I", category: 'biosynthesis', subcategory: 'Cofactors/Vitamins', prevalence: 0.997533402, tier: 'UNIVERSAL', medianAbundance: 0.000344734, meanAbundance: 0.000344838 },
    { id: 'THISYN-PWY', name: "superpathway of thiamin diphosphate biosynthesis I", category: 'biosynthesis', subcategory: 'Cofactors/Vitamins', prevalence: 0.994039054, tier: 'UNIVERSAL', medianAbundance: 0.000200657, meanAbundance: 0.00019623 },
    { id: 'BIOTIN-BIOSYNTHESIS-PWY', name: "biotin biosynthesis I", category: 'biosynthesis', subcategory: 'Cofactors/Vitamins', prevalence: 0.967112025, tier: 'VERY_COMMON', medianAbundance: 5.70E-05, meanAbundance: 6.93E-05 },
    { id: 'PWY-6895', name: "superpathway of thiamin diphosphate biosynthesis II", category: 'biosynthesis', subcategory: 'Cofactors/Vitamins', prevalence: 0.96032888, tier: 'VERY_COMMON', medianAbundance: 8.63E-05, meanAbundance: 9.22E-05 },
    { id: 'HEMESYN2-PWY', name: "heme biosynthesis II (anaerobic)", category: 'biosynthesis', subcategory: 'Cofactors/Vitamins', prevalence: 0.941418294, tier: 'COMMON', medianAbundance: 1.07E-05, meanAbundance: 1.46E-05 },
    { id: 'PWY-5005', name: "biotin biosynthesis II", category: 'biosynthesis', subcategory: 'Cofactors/Vitamins', prevalence: 0.914080164, tier: 'COMMON', medianAbundance: 1.62E-05, meanAbundance: 2.04E-05 },
    { id: 'FOLSYN-PWY', name: "superpathway of tetrahydrofolate biosynthesis and salvage", category: 'biosynthesis', subcategory: 'Cofactors/Vitamins', prevalence: 0.885097636, tier: 'MODERATE', medianAbundance: 2.30E-05, meanAbundance: 2.82E-05 },
    { id: 'PWY-6612', name: "superpathway of tetrahydrofolate biosynthesis", category: 'biosynthesis', subcategory: 'Cofactors/Vitamins', prevalence: 0.885097636, tier: 'MODERATE', medianAbundance: 1.56E-05, meanAbundance: 1.97E-05 },
    { id: 'HEME-BIOSYNTHESIS-II', name: "heme biosynthesis I (aerobic)", category: 'biosynthesis', subcategory: 'Cofactors/Vitamins', prevalence: 0.829599178, tier: 'MODERATE', medianAbundance: 4.63E-06, meanAbundance: 9.18E-06 },
    { id: 'PWY0-1415', name: "superpathway of heme biosynthesis from uroporphyrinogen-III", category: 'biosynthesis', subcategory: 'Cofactors/Vitamins', prevalence: 0.551490236, tier: 'MODERATE', medianAbundance: 1.03E-06, meanAbundance: 5.55E-06 },
    { id: 'PWY-6823', name: "molybdenum cofactor biosynthesis", category: 'biosynthesis', subcategory: 'Cofactors/Vitamins', prevalence: 0.367317575, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 2.16E-06 },
    { id: 'P241-PWY', name: "coenzyme B biosynthesis", category: 'biosynthesis', subcategory: 'Cofactors/Vitamins', prevalence: 0.042343268, tier: 'RARE', medianAbundance: 0, meanAbundance: 6.22E-08 },
    { id: 'P261-PWY', name: "coenzyme M biosynthesis I", category: 'biosynthesis', subcategory: 'Cofactors/Vitamins', prevalence: 0.033504625, tier: 'RARE', medianAbundance: 0, meanAbundance: 1.06E-07 },
    { id: 'PWY-5509', name: "adenosylcobalamin biosynthesis from cobyrinate a,c-diamide I", category: 'biosynthesis', subcategory: 'Cofactors/Vitamins', prevalence: 0.024871531, tier: 'RARE', medianAbundance: 0, meanAbundance: 1.09E-07 },
    { id: 'PWY-3502', name: "superpathway of NAD biosynthesis in eukaryotes", category: 'biosynthesis', subcategory: 'Cofactors/Vitamins', prevalence: 0.000822199, tier: 'RARE', medianAbundance: 0, meanAbundance: 2.28E-09 },
    { id: 'PWY-5508', name: "adenosylcobalamin biosynthesis from cobyrinate a,c-diamide II", category: 'biosynthesis', subcategory: 'Cofactors/Vitamins', prevalence: 0.0004111, tier: 'RARE', medianAbundance: 0, meanAbundance: 2.30E-09 },
    { id: 'PWY-5507', name: "adenosylcobalamin biosynthesis I (early cobalt insertion)", category: 'biosynthesis', subcategory: 'Cofactors/Vitamins', prevalence: 0.00020555, tier: 'RARE', medianAbundance: 0, meanAbundance: 2.95E-10 },
    { id: 'PHOSLIPSYN-PWY', name: "superpathway of phospholipid biosynthesis I (bacteria)", category: 'biosynthesis', subcategory: 'Fatty Acids/Lipids', prevalence: 0.995066804, tier: 'UNIVERSAL', medianAbundance: 0.000154576, meanAbundance: 0.000162052 },
    { id: 'FASYN-INITIAL-PWY', name: "superpathway of fatty acid biosynthesis initiation (E. coli)", category: 'biosynthesis', subcategory: 'Fatty Acids/Lipids', prevalence: 0.976772867, tier: 'VERY_COMMON', medianAbundance: 4.95E-05, meanAbundance: 6.71E-05 },
    { id: 'NAGLIPASYN-PWY', name: "lipid IVA biosynthesis", category: 'biosynthesis', subcategory: 'Fatty Acids/Lipids', prevalence: 0.94676259, tier: 'COMMON', medianAbundance: 3.22E-05, meanAbundance: 4.82E-05 },
    { id: 'PWY-6284', name: "superpathway of unsaturated fatty acids biosynthesis (E. coli)", category: 'biosynthesis', subcategory: 'Fatty Acids/Lipids', prevalence: 0.818910586, tier: 'MODERATE', medianAbundance: 1.51E-05, meanAbundance: 2.13E-05 },
    { id: 'PWY-6285', name: "superpathway of fatty acids biosynthesis (E. coli)", category: 'biosynthesis', subcategory: 'Fatty Acids/Lipids', prevalence: 0.367934224, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 1.36E-05 },
    { id: 'PWY0-881', name: "superpathway of fatty acid biosynthesis I (E. coli)", category: 'biosynthesis', subcategory: 'Fatty Acids/Lipids', prevalence: 0.365878726, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 6.17E-06 },
    { id: 'KDO-NAGLIPASYN-PWY', name: "superpathway of (Kdo)2-lipid A biosynthesis", category: 'biosynthesis', subcategory: 'Fatty Acids/Lipids', prevalence: 0.296197328, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 1.64E-06 },
    { id: 'PWY-5156', name: "superpathway of fatty acid biosynthesis II (plant)", category: 'biosynthesis', subcategory: 'Fatty Acids/Lipids', prevalence: 0.007810894, tier: 'RARE', medianAbundance: 0, meanAbundance: 5.97E-08 },
    { id: 'PWY-5080', name: "very long chain fatty acid biosynthesis I", category: 'biosynthesis', subcategory: 'Fatty Acids/Lipids', prevalence: 0.0004111, tier: 'RARE', medianAbundance: 0, meanAbundance: 6.21E-11 },
    { id: 'PWY-5129', name: "sphingolipid biosynthesis (plants)", category: 'biosynthesis', subcategory: 'Fatty Acids/Lipids', prevalence: 0.00020555, tier: 'RARE', medianAbundance: 0, meanAbundance: 1.08E-10 },
    { id: 'SPHINGOLIPID-SYN-PWY', name: "sphingolipid biosynthesis (yeast)", category: 'biosynthesis', subcategory: 'Fatty Acids/Lipids', prevalence: 0.00020555, tier: 'RARE', medianAbundance: 0, meanAbundance: 7.19E-11 },
    { id: 'PWY-7036', name: "very long chain fatty acid biosynthesis II", category: 'biosynthesis', subcategory: 'Fatty Acids/Lipids', prevalence: 0.00020555, tier: 'RARE', medianAbundance: 0, meanAbundance: 3.97E-11 },
    { id: 'PWY-6433', name: "hydroxylated fatty acid biosynthesis (plants)", category: 'biosynthesis', subcategory: 'Fatty Acids/Lipids', prevalence: 0, tier: 'RARE', medianAbundance: 0, meanAbundance: 0 },
    { id: 'PWY-7219', name: "adenosine ribonucleotides de novo biosynthesis", category: 'biosynthesis', subcategory: 'Nucleotides', prevalence: 0.999177801, tier: 'UNIVERSAL', medianAbundance: 0.000559285, meanAbundance: 0.00057247 },
    { id: 'PWY-6122', name: "5-aminoimidazole ribonucleotide biosynthesis II", category: 'biosynthesis', subcategory: 'Nucleotides', prevalence: 0.999177801, tier: 'UNIVERSAL', medianAbundance: 0.000471518, meanAbundance: 0.000484114 },
    { id: 'PWY-6277', name: "superpathway of 5-aminoimidazole ribonucleotide biosynthesis", category: 'biosynthesis', subcategory: 'Nucleotides', prevalence: 0.999177801, tier: 'UNIVERSAL', medianAbundance: 0.000471518, meanAbundance: 0.000484114 },
    { id: 'PWY-6121', name: "5-aminoimidazole ribonucleotide biosynthesis I", category: 'biosynthesis', subcategory: 'Nucleotides', prevalence: 0.999177801, tier: 'UNIVERSAL', medianAbundance: 0.000442097, meanAbundance: 0.000443227 },
    { id: 'PWY-7221', name: "guanosine ribonucleotides de novo biosynthesis", category: 'biosynthesis', subcategory: 'Nucleotides', prevalence: 0.998972251, tier: 'UNIVERSAL', medianAbundance: 0.000538931, meanAbundance: 0.000548942 },
    { id: 'PWY-7220', name: "adenosine deoxyribonucleotides de novo biosynthesis II", category: 'biosynthesis', subcategory: 'Nucleotides', prevalence: 0.998561151, tier: 'UNIVERSAL', medianAbundance: 0.000249926, meanAbundance: 0.000254215 },
    { id: 'PWY-7222', name: "guanosine deoxyribonucleotides de novo biosynthesis II", category: 'biosynthesis', subcategory: 'Nucleotides', prevalence: 0.998561151, tier: 'UNIVERSAL', medianAbundance: 0.000249926, meanAbundance: 0.000254215 },
    { id: 'PWY-7229', name: "superpathway of adenosine nucleotides de novo biosynthesis I", category: 'biosynthesis', subcategory: 'Nucleotides', prevalence: 0.998150051, tier: 'UNIVERSAL', medianAbundance: 0.000368508, meanAbundance: 0.000368509 },
    { id: 'PWY-6126', name: "superpathway of adenosine nucleotides de novo biosynthesis II", category: 'biosynthesis', subcategory: 'Nucleotides', prevalence: 0.998150051, tier: 'UNIVERSAL', medianAbundance: 0.000333024, meanAbundance: 0.000332161 },
    { id: 'PWY-6125', name: "superpathway of guanosine nucleotides de novo biosynthesis II", category: 'biosynthesis', subcategory: 'Nucleotides', prevalence: 0.997327852, tier: 'UNIVERSAL', medianAbundance: 0.000190483, meanAbundance: 0.000201514 },
    { id: 'PWY-7228', name: "superpathway of guanosine nucleotides de novo biosynthesis I", category: 'biosynthesis', subcategory: 'Nucleotides', prevalence: 0.997327852, tier: 'UNIVERSAL', medianAbundance: 0.000183165, meanAbundance: 0.000199126 },
    { id: 'PWY-841', name: "superpathway of purine nucleotides de novo biosynthesis I", category: 'biosynthesis', subcategory: 'Nucleotides', prevalence: 0.997122302, tier: 'UNIVERSAL', medianAbundance: 0.000234657, meanAbundance: 0.000238374 },
    { id: 'DENOVOPURINE2-PWY', name: "superpathway of purine nucleotides de novo biosynthesis II", category: 'biosynthesis', subcategory: 'Nucleotides', prevalence: 0.997122302, tier: 'UNIVERSAL', medianAbundance: 0.000232911, meanAbundance: 0.000235223 },
    { id: 'PWY-7187', name: "pyrimidine deoxyribonucleotides de novo biosynthesis II", category: 'biosynthesis', subcategory: 'Nucleotides', prevalence: 0.997122302, tier: 'UNIVERSAL', medianAbundance: 0.000194492, meanAbundance: 0.000193634 },
    { id: 'PWY-6545', name: "pyrimidine deoxyribonucleotides de novo biosynthesis III", category: 'biosynthesis', subcategory: 'Nucleotides', prevalence: 0.996711202, tier: 'UNIVERSAL', medianAbundance: 0.000124173, meanAbundance: 0.000125316 },
    { id: 'PWY0-166', name: "superpathway of pyrimidine deoxyribonucleotides de novo biosynthesis (E. coli)", category: 'biosynthesis', subcategory: 'Nucleotides', prevalence: 0.996505653, tier: 'UNIVERSAL', medianAbundance: 0.000194947, meanAbundance: 0.000195343 },
    { id: 'PWY-7184', name: "pyrimidine deoxyribonucleotides de novo biosynthesis I", category: 'biosynthesis', subcategory: 'Nucleotides', prevalence: 0.996505653, tier: 'UNIVERSAL', medianAbundance: 0.000138548, meanAbundance: 0.000144655 },
    { id: 'PWY0-162', name: "superpathway of pyrimidine ribonucleotides de novo biosynthesis", category: 'biosynthesis', subcategory: 'Nucleotides', prevalence: 0.995272354, tier: 'UNIVERSAL', medianAbundance: 0.000154231, meanAbundance: 0.000160058 },
    { id: 'PWY-7198', name: "pyrimidine deoxyribonucleotides de novo biosynthesis IV", category: 'biosynthesis', subcategory: 'Nucleotides', prevalence: 0.984789311, tier: 'VERY_COMMON', medianAbundance: 6.14E-05, meanAbundance: 6.61E-05 },
    { id: 'PWY-7211', name: "superpathway of pyrimidine deoxyribonucleotides de novo biosynthesis", category: 'biosynthesis', subcategory: 'Nucleotides', prevalence: 0.971223022, tier: 'VERY_COMMON', medianAbundance: 8.30E-05, meanAbundance: 8.05E-05 },
    { id: 'PWY-7282', name: "4-amino-2-methyl-5-phosphomethylpyrimidine biosynthesis (yeast)", category: 'biosynthesis', subcategory: 'Nucleotides', prevalence: 0.956217883, tier: 'VERY_COMMON', medianAbundance: 0.000113586, meanAbundance: 0.000116336 },
    { id: 'PWY-7210', name: "pyrimidine deoxyribonucleotides biosynthesis from CTP", category: 'biosynthesis', subcategory: 'Nucleotides', prevalence: 0.744295992, tier: 'MODERATE', medianAbundance: 1.06E-05, meanAbundance: 1.80E-05 },
    { id: 'DTDPRHAMSYN-PWY', name: "dTDP-L-rhamnose biosynthesis I", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.99938335, tier: 'UNIVERSAL', medianAbundance: 0.000541803, meanAbundance: 0.000579591 },
    { id: 'PWY-5686', name: "UMP biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.999177801, tier: 'UNIVERSAL', medianAbundance: 0.000549603, meanAbundance: 0.000559694 },
    { id: 'PWY-6700', name: "queuosine biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.999177801, tier: 'UNIVERSAL', medianAbundance: 0.000452934, meanAbundance: 0.000461838 },
    { id: 'PWY-6387', name: "UDP-N-acetylmuramoyl-pentapeptide biosynthesis I (meso-diaminopimelate containing)", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.998972251, tier: 'UNIVERSAL', medianAbundance: 0.000536877, meanAbundance: 0.000543909 },
    { id: 'GLUTORN-PWY', name: "L-ornithine biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.998972251, tier: 'UNIVERSAL', medianAbundance: 0.000364956, meanAbundance: 0.000358672 },
    { id: 'PWY-6123', name: "inosine-5\'-phosphate biosynthesis I", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.998561151, tier: 'UNIVERSAL', medianAbundance: 0.000333908, meanAbundance: 0.000336236 },
    { id: 'PWY-6124', name: "inosine-5\'-phosphate biosynthesis II", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.998561151, tier: 'UNIVERSAL', medianAbundance: 0.000314442, meanAbundance: 0.00031704 },
    { id: 'PWY-6163', name: "chorismate biosynthesis from 3-dehydroquinate", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.998355601, tier: 'UNIVERSAL', medianAbundance: 0.000490648, meanAbundance: 0.000486687 },
    { id: 'ARO-PWY', name: "chorismate biosynthesis I", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.998355601, tier: 'UNIVERSAL', medianAbundance: 0.000467789, meanAbundance: 0.000460302 },
    { id: 'PANTO-PWY', name: "phosphopantothenate biosynthesis I", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.998355601, tier: 'UNIVERSAL', medianAbundance: 0.000320705, meanAbundance: 0.000323503 },
    { id: 'GLYCOGENSYNTH-PWY', name: "glycogen biosynthesis I (from ADP-D-Glucose)", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.998355601, tier: 'UNIVERSAL', medianAbundance: 0.000290847, meanAbundance: 0.000303944 },
    { id: 'PWY-5667', name: "CDP-diacylglycerol biosynthesis I", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.998150051, tier: 'UNIVERSAL', medianAbundance: 0.000404056, meanAbundance: 0.000397125 },
    { id: 'PWY0-1319', name: "CDP-diacylglycerol biosynthesis II", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.998150051, tier: 'UNIVERSAL', medianAbundance: 0.000404056, meanAbundance: 0.000397129 },
    { id: 'PWY-5695', name: "urate biosynthesis/inosine 5\'-phosphate degradation", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.998150051, tier: 'UNIVERSAL', medianAbundance: 0.000401105, meanAbundance: 0.000407512 },
    { id: 'PWY-5973', name: "cis-vaccenate biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.998150051, tier: 'UNIVERSAL', medianAbundance: 0.000243589, meanAbundance: 0.000242642 },
    { id: 'PWY-7663', name: "gondoate biosynthesis (anaerobic)", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.998150051, tier: 'UNIVERSAL', medianAbundance: 0.000217685, meanAbundance: 0.000220962 },
    { id: 'RIBOSYN2-PWY', name: "flavin biosynthesis I (bacteria and plants)", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.997738952, tier: 'UNIVERSAL', medianAbundance: 0.000345745, meanAbundance: 0.000364579 },
    { id: 'OANTIGEN-PWY', name: "O-antigen building blocks biosynthesis (E. coli)", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.997327852, tier: 'UNIVERSAL', medianAbundance: 0.00025001, meanAbundance: 0.000253516 },
    { id: 'UDPNAGSYN-PWY', name: "UDP-N-acetyl-D-glucosamine biosynthesis I", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.997327852, tier: 'UNIVERSAL', medianAbundance: 0.00018532, meanAbundance: 0.000198886 },
    { id: 'PWY-6168', name: "flavin biosynthesis III (fungi)", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.996300103, tier: 'UNIVERSAL', medianAbundance: 0.00027735, meanAbundance: 0.000273278 },
    { id: 'PWY-6703', name: "preQ0 biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.995889003, tier: 'UNIVERSAL', medianAbundance: 0.000213342, meanAbundance: 0.000227655 },
    { id: 'PWY4FS-7', name: "phosphatidylglycerol biosynthesis I (plastidic)", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.995889003, tier: 'UNIVERSAL', medianAbundance: 0.00011225, meanAbundance: 0.000124796 },
    { id: 'PWY4FS-8', name: "phosphatidylglycerol biosynthesis II (non-plastidic)", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.995889003, tier: 'UNIVERSAL', medianAbundance: 0.00011225, meanAbundance: 0.000124796 },
    { id: 'PWY-5659', name: "GDP-mannose biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.995272354, tier: 'UNIVERSAL', medianAbundance: 0.000104956, meanAbundance: 0.000109723 },
    { id: 'PWY-6892', name: "thiazole biosynthesis I (E. coli)", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.995066804, tier: 'UNIVERSAL', medianAbundance: 0.000174276, meanAbundance: 0.000179555 },
    { id: 'PWY-6147', name: "6-hydroxymethyl-dihydropterin diphosphate biosynthesis I", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.994861254, tier: 'UNIVERSAL', medianAbundance: 0.000139838, meanAbundance: 0.000171028 },
    { id: 'PWY-7539', name: "6-hydroxymethyl-dihydropterin diphosphate biosynthesis III (Chlamydia)", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.994655704, tier: 'UNIVERSAL', medianAbundance: 0.000138423, meanAbundance: 0.000168401 },
    { id: 'PWY-1269', name: "CMP-3-deoxy-D-manno-octulosonate biosynthesis I", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.994244604, tier: 'UNIVERSAL', medianAbundance: 7.69E-05, meanAbundance: 0.000114393 },
    { id: 'COLANSYN-PWY', name: "colanic acid building blocks biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.992189106, tier: 'UNIVERSAL', medianAbundance: 8.78E-05, meanAbundance: 8.90E-05 },
    { id: 'PWY-7323', name: "superpathway of GDP-mannose-derived O-antigen building blocks biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.991366906, tier: 'UNIVERSAL', medianAbundance: 7.42E-05, meanAbundance: 7.86E-05 },
    { id: 'PWY-7234', name: "inosine-5\'-phosphate biosynthesis III", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.990133607, tier: 'UNIVERSAL', medianAbundance: 9.84E-05, meanAbundance: 0.000109071 },
    { id: 'PWY-5989', name: "stearate biosynthesis II (bacteria and plants)", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.982322713, tier: 'VERY_COMMON', medianAbundance: 5.27E-05, meanAbundance: 6.76E-05 },
    { id: 'CITRULBIO-PWY', name: "L-citrulline biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.980883864, tier: 'VERY_COMMON', medianAbundance: 8.51E-05, meanAbundance: 0.000100445 },
    { id: 'PWY0-862', name: "(5Z)-dodec-5-enoate biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.977183967, tier: 'VERY_COMMON', medianAbundance: 5.22E-05, meanAbundance: 6.87E-05 },
    { id: 'PWY-7664', name: "oleate biosynthesis IV (anaerobic)", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.976567318, tier: 'VERY_COMMON', medianAbundance: 5.81E-05, meanAbundance: 7.47E-05 },
    { id: 'PWY-6282', name: "palmitoleate biosynthesis I (from (5Z)-dodec-5-enoate)", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.976567318, tier: 'VERY_COMMON', medianAbundance: 5.17E-05, meanAbundance: 6.82E-05 },
    { id: 'PWY-7388', name: "octanoyl-[acyl-carrier protein] biosynthesis (mitochondria, yeast)", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.976567318, tier: 'VERY_COMMON', medianAbundance: 4.91E-05, meanAbundance: 6.64E-05 },
    { id: 'TEICHOICACID-PWY', name: "teichoic acid (poly-glycerol) biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.975539568, tier: 'VERY_COMMON', medianAbundance: 5.52E-05, meanAbundance: 5.68E-05 },
    { id: 'PWYG-321', name: "mycolate biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.972250771, tier: 'VERY_COMMON', medianAbundance: 6.06E-05, meanAbundance: 7.75E-05 },
    { id: 'ARGININE-SYN4-PWY', name: "L-ornithine de novo  biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.971839671, tier: 'VERY_COMMON', medianAbundance: 6.58E-05, meanAbundance: 9.34E-05 },
    { id: 'PPGPPMET-PWY', name: "ppGpp biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.968139774, tier: 'VERY_COMMON', medianAbundance: 2.55E-05, meanAbundance: 3.06E-05 },
    { id: 'PWY-6519', name: "8-amino-7-oxononanoate biosynthesis I", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.967523124, tier: 'VERY_COMMON', medianAbundance: 5.08E-05, meanAbundance: 6.40E-05 },
    { id: 'PWY0-1241', name: "ADP-L-glycero-&beta;-D-manno-heptose biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.963412127, tier: 'VERY_COMMON', medianAbundance: 2.10E-05, meanAbundance: 3.00E-05 },
    { id: 'PWY-6891', name: "thiazole biosynthesis II (Bacillus)", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.963001028, tier: 'VERY_COMMON', medianAbundance: 3.15E-05, meanAbundance: 4.05E-05 },
    { id: 'PYRIDOXSYN-PWY', name: "pyridoxal 5\'-phosphate biosynthesis I", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.95971223, tier: 'VERY_COMMON', medianAbundance: 5.49E-05, meanAbundance: 7.74E-05 },
    { id: 'POLYISOPRENSYN-PWY', name: "polyisoprenoid biosynthesis (E. coli)", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.958890031, tier: 'VERY_COMMON', medianAbundance: 3.52E-05, meanAbundance: 4.33E-05 },
    { id: 'PWY0-845', name: "superpathway of pyridoxal 5\'-phosphate biosynthesis and salvage", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.953340185, tier: 'VERY_COMMON', medianAbundance: 6.59E-05, meanAbundance: 8.44E-05 },
    { id: 'PWY-6859', name: "all-trans-farnesol biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.927235355, tier: 'COMMON', medianAbundance: 2.32E-05, meanAbundance: 3.03E-05 },
    { id: 'PWY-7328', name: "superpathway of UDP-glucose-derived O-antigen building blocks biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.922096608, tier: 'COMMON', medianAbundance: 1.84E-05, meanAbundance: 2.92E-05 },
    { id: 'PWY-7315', name: "dTDP-N-acetylthomosamine biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.914902364, tier: 'COMMON', medianAbundance: 1.07E-05, meanAbundance: 2.02E-05 },
    { id: 'PWY-6270', name: "isoprene biosynthesis I", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.896402878, tier: 'MODERATE', medianAbundance: 3.54E-05, meanAbundance: 6.38E-05 },
    { id: 'PWY-5121', name: "superpathway of geranylgeranyl diphosphate biosynthesis II (via MEP)", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.889208633, tier: 'MODERATE', medianAbundance: 3.11E-05, meanAbundance: 3.69E-05 },
    { id: 'PWY-5367', name: "petroselinate biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.825693731, tier: 'MODERATE', medianAbundance: 6.20E-06, meanAbundance: 1.15E-05 },
    { id: 'PWY-5971', name: "palmitate biosynthesis II (bacteria and plants)", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.819116136, tier: 'MODERATE', medianAbundance: 5.06E-05, meanAbundance: 6.18E-05 },
    { id: 'PWY-6113', name: "superpathway of mycolate biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.816855087, tier: 'MODERATE', medianAbundance: 3.41E-05, meanAbundance: 4.19E-05 },
    { id: 'PWY-622', name: "starch biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.728057554, tier: 'MODERATE', medianAbundance: 1.53E-05, meanAbundance: 3.32E-05 },
    { id: 'PWY-5173', name: "superpathway of acetyl-CoA biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.713874615, tier: 'MODERATE', medianAbundance: 2.25E-06, meanAbundance: 8.74E-06 },
    { id: 'PWY-5791', name: "1,4-dihydroxy-2-naphthoate biosynthesis II (plants)", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.682836588, tier: 'MODERATE', medianAbundance: 3.46E-06, meanAbundance: 8.66E-06 },
    { id: 'PWY-5837', name: "1,4-dihydroxy-2-naphthoate biosynthesis I", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.682836588, tier: 'MODERATE', medianAbundance: 3.46E-06, meanAbundance: 8.66E-06 },
    { id: 'PWY-5897', name: "superpathway of menaquinol-11 biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.682631038, tier: 'MODERATE', medianAbundance: 9.89E-06, meanAbundance: 1.99E-05 },
    { id: 'PWY-5898', name: "superpathway of menaquinol-12 biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.682631038, tier: 'MODERATE', medianAbundance: 9.89E-06, meanAbundance: 1.99E-05 },
    { id: 'PWY-5899', name: "superpathway of menaquinol-13 biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.682631038, tier: 'MODERATE', medianAbundance: 9.89E-06, meanAbundance: 1.99E-05 },
    { id: 'PWY-5863', name: "superpathway of phylloquinol biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.680986639, tier: 'MODERATE', medianAbundance: 3.79E-06, meanAbundance: 8.12E-06 },
    { id: 'PWY-5838', name: "superpathway of menaquinol-8 biosynthesis I", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.674203494, tier: 'MODERATE', medianAbundance: 1.06E-05, meanAbundance: 2.07E-05 },
    { id: 'PWY-5861', name: "superpathway of demethylmenaquinol-8 biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.674203494, tier: 'MODERATE', medianAbundance: 7.21E-06, meanAbundance: 1.52E-05 },
    { id: 'PWY-6263', name: "superpathway of menaquinol-8 biosynthesis II", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.665981501, tier: 'MODERATE', medianAbundance: 4.05E-06, meanAbundance: 7.25E-06 },
    { id: 'PWY-5840', name: "superpathway of menaquinol-7 biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.650976362, tier: 'MODERATE', medianAbundance: 8.34E-06, meanAbundance: 1.58E-05 },
    { id: 'PWY-5845', name: "superpathway of menaquinol-9 biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.583556012, tier: 'MODERATE', medianAbundance: 5.54E-06, meanAbundance: 1.43E-05 },
    { id: 'PWY-5862', name: "superpathway of demethylmenaquinol-9 biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.583556012, tier: 'MODERATE', medianAbundance: 3.72E-06, meanAbundance: 1.03E-05 },
    { id: 'PWY-7371', name: "1,4-dihydroxy-6-naphthoate biosynthesis II", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.560739979, tier: 'MODERATE', medianAbundance: 1.36E-06, meanAbundance: 4.67E-06 },
    { id: 'PWY-7332', name: "superpathway of UDP-N-acetylglucosamine-derived O-antigen building blocks biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.539773895, tier: 'MODERATE', medianAbundance: 4.40E-06, meanAbundance: 1.90E-05 },
    { id: 'PWY-5994', name: "palmitate biosynthesis I (animals and fungi)", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.486742035, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 1.26E-05 },
    { id: 'P125-PWY', name: "superpathway of (R,R)-butanediol biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.4668037, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 2.86E-06 },
    { id: 'PWY-6749', name: "CMP-legionaminate biosynthesis I", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.395272354, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 3.08E-06 },
    { id: 'PWY-6143', name: "CMP-pseudaminate biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.394244604, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 3.32E-06 },
    { id: 'PWY-7312', name: "dTDP-D-&beta;-fucofuranose biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.393011305, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 7.49E-06 },
    { id: 'PWY-5850', name: "superpathway of menaquinol-6 biosynthesis I", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.387461459, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 9.59E-06 },
    { id: 'PWY-5860', name: "superpathway of demethylmenaquinol-6 biosynthesis I", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.387461459, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 7.08E-06 },
    { id: 'PWY-5896', name: "superpathway of menaquinol-10 biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.38643371, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 9.57E-06 },
    { id: 'PWY3O-355', name: "stearate biosynthesis III (fungi)", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.378417266, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 2.84E-06 },
    { id: 'PWY-6876', name: "isopropanol biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.372250771, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 1.22E-06 },
    { id: 'PWY-5656', name: "mannosylglycerate biosynthesis I", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.363617677, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 3.58E-06 },
    { id: 'PWY-7316', name: "dTDP-N-acetylviosamine biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.349434738, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 3.59E-06 },
    { id: 'PWY-6435', name: "4-hydroxybenzoate biosynthesis V", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.311202467, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 1.85E-06 },
    { id: 'PWY-5855', name: "ubiquinol-7 biosynthesis (prokaryotic)", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.308530319, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 1.63E-06 },
    { id: 'PWY-5856', name: "ubiquinol-9 biosynthesis (prokaryotic)", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.308530319, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 1.63E-06 },
    { id: 'PWY-5857', name: "ubiquinol-10 biosynthesis (prokaryotic)", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.308530319, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 1.63E-06 },
    { id: 'PWY-6708', name: "ubiquinol-8 biosynthesis (prokaryotic)", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.308530319, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 1.63E-06 },
    { id: 'PWY-6478', name: "GDP-D-glycero-&alpha;-D-manno-heptose biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.30709147, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 1.44E-06 },
    { id: 'ENTBACSYN-PWY', name: "enterobactin biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.30688592, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 1.07E-05 },
    { id: 'ECASYN-PWY', name: "enterobacterial common antigen biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.300308325, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 2.35E-06 },
    { id: 'PWY-7286', name: "7-(3-amino-3-carboxypropyl)-wyosine biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.297636177, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 3.28E-06 },
    { id: 'PWY-5198', name: "factor 420 biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.296608428, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 2.64E-06 },
    { id: 'UBISYN-PWY', name: "superpathway of ubiquinol-8 biosynthesis (prokaryotic)", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.290030832, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 1.77E-06 },
    { id: 'PWY-6349', name: "CDP-archaeol biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.282425488, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 2.88E-06 },
    { id: 'PWY-6167', name: "flavin biosynthesis II (archaea)", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.273792395, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 6.58E-06 },
    { id: 'PWY-5910', name: "superpathway of geranylgeranyldiphosphate biosynthesis I (via mevalonate)", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.264337102, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 1.16E-06 },
    { id: 'PWY3DJ-35471', name: "L-ascorbate biosynthesis IV", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.175128469, tier: 'RARE', medianAbundance: 0, meanAbundance: 1.38E-06 },
    { id: 'PWY-6165', name: "chorismate biosynthesis II (archaea)", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.171634121, tier: 'RARE', medianAbundance: 0, meanAbundance: 1.36E-06 },
    { id: 'PWY-6953', name: "dTDP-3-acetamido-3,6-dideoxy-&alpha;-D-galactose biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.158273381, tier: 'RARE', medianAbundance: 0, meanAbundance: 1.26E-06 },
    { id: 'PWY-6396', name: "superpathway of 2,3-butanediol biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.101747174, tier: 'RARE', medianAbundance: 0, meanAbundance: 5.16E-07 },
    { id: 'PWY1G-0', name: "mycothiol biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.09373073, tier: 'RARE', medianAbundance: 0, meanAbundance: 1.77E-07 },
    { id: 'AEROBACTINSYN-PWY', name: "aerobactin biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.069064748, tier: 'RARE', medianAbundance: 0, meanAbundance: 2.73E-07 },
    { id: 'UDPNACETYLGALSYN-PWY', name: "UDP-N-acetyl-D-glucosamine biosynthesis II", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.064953751, tier: 'RARE', medianAbundance: 0, meanAbundance: 1.34E-07 },
    { id: 'PWY-5754', name: "4-hydroxybenzoate biosynthesis I (eukaryotes)", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.060431655, tier: 'RARE', medianAbundance: 0, meanAbundance: 7.98E-08 },
    { id: 'PWY3O-1109', name: "superpathway of 4-hydroxybenzoate biosynthesis (yeast)", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.058376156, tier: 'RARE', medianAbundance: 0, meanAbundance: 9.33E-08 },
    { id: 'URSIN-PWY', name: "ureide biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.05364851, tier: 'RARE', medianAbundance: 0, meanAbundance: 3.50E-07 },
    { id: 'PWY-7374', name: "1,4-dihydroxy-6-naphthoate biosynthesis I", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.029599178, tier: 'RARE', medianAbundance: 0, meanAbundance: 6.76E-08 },
    { id: 'PWY-7007', name: "methyl ketone biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.029188078, tier: 'RARE', medianAbundance: 0, meanAbundance: 3.67E-07 },
    { id: 'PWY-6138', name: "CMP-N-acetylneuraminate biosynthesis I (eukaryotes)", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.025488181, tier: 'RARE', medianAbundance: 0, meanAbundance: 5.58E-08 },
    { id: 'PWY-5514', name: "UDP-N-acetyl-D-galactosamine biosynthesis II", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.025282631, tier: 'RARE', medianAbundance: 0, meanAbundance: 3.52E-08 },
    { id: 'PWY-6145', name: "superpathway of sialic acids and CMP-sialic acids biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.024871531, tier: 'RARE', medianAbundance: 0, meanAbundance: 7.76E-08 },
    { id: 'PWY-7317', name: "superpathway of dTDP-glucose-derived O-antigen building blocks biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.01377184, tier: 'RARE', medianAbundance: 0, meanAbundance: 3.79E-08 },
    { id: 'PWY1F-823', name: "leucopelargonidin and leucocyanidin biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.011305242, tier: 'RARE', medianAbundance: 0, meanAbundance: 3.06E-08 },
    { id: 'PWY-7235', name: "superpathway of ubiquinol-6 biosynthesis (eukaryotic)", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.009249743, tier: 'RARE', medianAbundance: 0, meanAbundance: 1.94E-08 },
    { id: 'PWY-7373', name: "superpathway of demethylmenaquinol-6 biosynthesis II", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.005755396, tier: 'RARE', medianAbundance: 0, meanAbundance: 1.60E-08 },
    { id: 'PWY-7290', name: "Escherichia coli serotype O86 O-antigen biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.005138746, tier: 'RARE', medianAbundance: 0, meanAbundance: 1.83E-08 },
    { id: 'P101-PWY', name: "ectoine biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.004316547, tier: 'RARE', medianAbundance: 0, meanAbundance: 1.83E-08 },
    { id: 'PWY-5871', name: "ubiquinol-9 biosynthesis (eukaryotic)", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.004110997, tier: 'RARE', medianAbundance: 0, meanAbundance: 5.87E-09 },
    { id: 'PWY-5873', name: "ubiquinol-7 biosynthesis (eukaryotic)", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.004110997, tier: 'RARE', medianAbundance: 0, meanAbundance: 5.87E-09 },
    { id: 'PWY-6797', name: "6-hydroxymethyl-dihydropterin diphosphate biosynthesis II (archaea)", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.003699897, tier: 'RARE', medianAbundance: 0, meanAbundance: 3.13E-08 },
    { id: 'PWY-5870', name: "ubiquinol-8 biosynthesis (eukaryotic)", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.003699897, tier: 'RARE', medianAbundance: 0, meanAbundance: 6.82E-09 },
    { id: 'PWY-7413', name: "dTDP-6-deoxy-&alpha;-D-allose biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.002672148, tier: 'RARE', medianAbundance: 0, meanAbundance: 5.38E-09 },
    { id: 'PWY-6350', name: "archaetidylinositol biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.001027749, tier: 'RARE', medianAbundance: 0, meanAbundance: 2.52E-09 },
    { id: 'PWY-5751', name: "phenylethanol biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.001027749, tier: 'RARE', medianAbundance: 0, meanAbundance: 1.40E-09 },
    { id: 'PWY-5757', name: "fosfomycin biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.000822199, tier: 'RARE', medianAbundance: 0, meanAbundance: 1.44E-09 },
    { id: 'PWY-7090', name: "UDP-2,3-diacetamido-2,3-dideoxy-&alpha;-D-mannuronate biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.000822199, tier: 'RARE', medianAbundance: 0, meanAbundance: 1.40E-09 },
    { id: 'PWY-6148', name: "tetrahydromethanopterin biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.000822199, tier: 'RARE', medianAbundance: 0, meanAbundance: 1.95E-09 },
    { id: 'PWY-7411', name: "superpathway of phosphatidate biosynthesis (yeast)", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.000822199, tier: 'RARE', medianAbundance: 0, meanAbundance: 5.93E-10 },
    { id: 'PWY-6351', name: "D-myo-inositol (1,4,5)-trisphosphate biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.000822199, tier: 'RARE', medianAbundance: 0, meanAbundance: 4.74E-10 },
    { id: 'PWY-7255', name: "ergothioneine biosynthesis I (bacteria)", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.000822199, tier: 'RARE', medianAbundance: 0, meanAbundance: 1.02E-09 },
    { id: 'PWY-5067', name: "glycogen biosynthesis II (from UDP-D-Glucose)", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.00061665, tier: 'RARE', medianAbundance: 0, meanAbundance: 7.53E-10 },
    { id: 'PWY3O-19', name: "ubiquinol-6 biosynthesis from 4-hydroxybenzoate (eukaryotic)", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.00061665, tier: 'RARE', medianAbundance: 0, meanAbundance: 7.46E-10 },
    { id: 'PWY-5872', name: "ubiquinol-10 biosynthesis (eukaryotic)", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.00061665, tier: 'RARE', medianAbundance: 0, meanAbundance: 5.28E-10 },
    { id: 'PWY-6415', name: "L-ascorbate biosynthesis V", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.00061665, tier: 'RARE', medianAbundance: 0, meanAbundance: 1.27E-09 },
    { id: 'PWY-6660', name: "2-heptyl-3-hydroxy-4(1H)-quinolone biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.0004111, tier: 'RARE', medianAbundance: 0, meanAbundance: 1.78E-09 },
    { id: 'PWY-6383', name: "mono-trans, poly-cis decaprenyl phosphate biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.0004111, tier: 'RARE', medianAbundance: 0, meanAbundance: 3.85E-10 },
    { id: 'PWY-6598', name: "sciadonate biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.0004111, tier: 'RARE', medianAbundance: 0, meanAbundance: 6.21E-11 },
    { id: 'PWY-7619', name: "juniperonate biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.0004111, tier: 'RARE', medianAbundance: 0, meanAbundance: 6.21E-11 },
    { id: 'PWY1F-FLAVSYN', name: "flavonoid biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.0004111, tier: 'RARE', medianAbundance: 0, meanAbundance: 4.70E-10 },
    { id: 'PWY-7546', name: "diphthamide biosynthesis (eukaryotes)", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.0004111, tier: 'RARE', medianAbundance: 0, meanAbundance: 3.11E-10 },
    { id: 'PWY-5109', name: "2-methylbutanoate biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.0004111, tier: 'RARE', medianAbundance: 0, meanAbundance: 1.13E-09 },
    { id: 'TRIGLSYN-PWY', name: "diacylglycerol and triacylglycerol biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.00020555, tier: 'RARE', medianAbundance: 0, meanAbundance: 3.82E-11 },
    { id: 'PWY-7377', name: "cob(II)yrinate a,c-diamide biosynthesis I (early cobalt insertion)", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.00020555, tier: 'RARE', medianAbundance: 0, meanAbundance: 2.50E-10 },
    { id: 'PWY-7238', name: "sucrose biosynthesis II", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.00020555, tier: 'RARE', medianAbundance: 0, meanAbundance: 5.35E-10 },
    { id: 'PWY-7347', name: "sucrose biosynthesis III", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.00020555, tier: 'RARE', medianAbundance: 0, meanAbundance: 2.73E-10 },
    { id: 'PWY-6662', name: "superpathway of quinolone and alkylquinolone biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.00020555, tier: 'RARE', medianAbundance: 0, meanAbundance: 1.75E-09 },
    { id: 'PWY-7283', name: "wybutosine biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.00020555, tier: 'RARE', medianAbundance: 0, meanAbundance: 7.47E-11 },
    { id: 'PWY-6075', name: "ergosterol biosynthesis I", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.00020555, tier: 'RARE', medianAbundance: 0, meanAbundance: 6.07E-11 },
    { id: 'PWY-5823', name: "superpathway of CDP-glucose-derived O-antigen building blocks biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.00020555, tier: 'RARE', medianAbundance: 0, meanAbundance: 3.47E-09 },
    { id: 'PWY-7053', name: "docosahexaenoate biosynthesis I (lower eukaryotes)", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.00020555, tier: 'RARE', medianAbundance: 0, meanAbundance: 4.34E-11 },
    { id: 'PWY-7592', name: "arachidonate biosynthesis III (metazoa)", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.00020555, tier: 'RARE', medianAbundance: 0, meanAbundance: 3.47E-11 },
    { id: 'PWY-7606', name: "docosahexaenoate biosynthesis III (mammals)", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.00020555, tier: 'RARE', medianAbundance: 0, meanAbundance: 4.55E-11 },
    { id: 'PWY-7049', name: "icosapentaenoate biosynthesis II (metazoa)", category: 'biosynthesis', subcategory: 'Other', prevalence: 0.00020555, tier: 'RARE', medianAbundance: 0, meanAbundance: 4.14E-11 },
    { id: 'PWY-7376', name: "cob(II)yrinate a,c-diamide biosynthesis II (late cobalt incorporation)", category: 'biosynthesis', subcategory: 'Other', prevalence: 0, tier: 'RARE', medianAbundance: 0, meanAbundance: 0 },
    { id: 'PWY-6098', name: "diploterol and cycloartenol biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0, tier: 'RARE', medianAbundance: 0, meanAbundance: 0 },
    { id: 'PWY-6981', name: "chitin biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0, tier: 'RARE', medianAbundance: 0, meanAbundance: 0 },
    { id: 'PWY-6857', name: "retinol biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0, tier: 'RARE', medianAbundance: 0, meanAbundance: 0 },
    { id: 'PWY-6352', name: "3-phosphoinositide biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0, tier: 'RARE', medianAbundance: 0, meanAbundance: 0 },
    { id: 'PWY-6886', name: "1-butanol autotrophic biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0, tier: 'RARE', medianAbundance: 0, meanAbundance: 0 },
    { id: 'PWY-6654', name: "phosphopantothenate biosynthesis III", category: 'biosynthesis', subcategory: 'Other', prevalence: 0, tier: 'RARE', medianAbundance: 0, meanAbundance: 0 },
    { id: 'PWY4FS-5', name: "superpathway of phosphatidylcholine biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0, tier: 'RARE', medianAbundance: 0, meanAbundance: 0 },
    { id: 'PWY-6763', name: "salicortin biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0, tier: 'RARE', medianAbundance: 0, meanAbundance: 0 },
    { id: 'PWY-7059', name: "fumigaclavine biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0, tier: 'RARE', medianAbundance: 0, meanAbundance: 0 },
    { id: 'PWY-6569', name: "chondroitin sulfate biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0, tier: 'RARE', medianAbundance: 0, meanAbundance: 0 },
    { id: 'PWY66-374', name: "C20 prostanoid biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0, tier: 'RARE', medianAbundance: 0, meanAbundance: 0 },
    { id: 'PWY-6571', name: "dermatan sulfate biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0, tier: 'RARE', medianAbundance: 0, meanAbundance: 0 },
    { id: 'PWY-6557', name: "glycoaminoglycan-protein linkage region biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0, tier: 'RARE', medianAbundance: 0, meanAbundance: 0 },
    { id: 'PWY-5466', name: "matairesinol biosynthesis", category: 'biosynthesis', subcategory: 'Other', prevalence: 0, tier: 'RARE', medianAbundance: 0, meanAbundance: 0 },
    { id: 'PWY-6305', name: "putrescine biosynthesis IV", category: 'biosynthesis', subcategory: 'Polyamines', prevalence: 0.997533402, tier: 'UNIVERSAL', medianAbundance: 0.000112805, meanAbundance: 0.000121302 },
    { id: 'POLYAMSYN-PWY', name: "superpathway of polyamine biosynthesis I", category: 'biosynthesis', subcategory: 'Polyamines', prevalence: 0.980883864, tier: 'VERY_COMMON', medianAbundance: 2.83E-05, meanAbundance: 3.74E-05 },
    { id: 'POLYAMINSYN3-PWY', name: "superpathway of polyamine biosynthesis II", category: 'biosynthesis', subcategory: 'Polyamines', prevalence: 0.811305242, tier: 'MODERATE', medianAbundance: 1.03E-05, meanAbundance: 1.64E-05 },
    { id: 'PWY-6562', name: "norspermidine biosynthesis", category: 'biosynthesis', subcategory: 'Polyamines', prevalence: 0.168756423, tier: 'RARE', medianAbundance: 0, meanAbundance: 7.78E-07 },
    { id: 'PWY-6565', name: "superpathway of polyamine biosynthesis III", category: 'biosynthesis', subcategory: 'Polyamines', prevalence: 0.050565262, tier: 'RARE', medianAbundance: 0, meanAbundance: 1.15E-07 },
    { id: 'PWY-6834', name: "spermidine biosynthesis III", category: 'biosynthesis', subcategory: 'Polyamines', prevalence: 0.001438849, tier: 'RARE', medianAbundance: 0, meanAbundance: 8.75E-09 },
    { id: 'PWY-5177', name: "glutaryl-CoA degradation", category: 'degradation', subcategory: 'Amino Acids', prevalence: 0.996505653, tier: 'UNIVERSAL', medianAbundance: 7.58E-05, meanAbundance: 8.08E-05 },
    { id: 'HISDEG-PWY', name: "L-histidine degradation I", category: 'degradation', subcategory: 'Amino Acids', prevalence: 0.993011305, tier: 'UNIVERSAL', medianAbundance: 8.59E-05, meanAbundance: 0.000107804 },
    { id: 'PWY-5030', name: "L-histidine degradation III", category: 'degradation', subcategory: 'Amino Acids', prevalence: 0.960945529, tier: 'VERY_COMMON', medianAbundance: 5.68E-05, meanAbundance: 7.96E-05 },
    { id: 'P162-PWY', name: "L-glutamate degradation V (via hydroxyglutarate)", category: 'degradation', subcategory: 'Amino Acids', prevalence: 0.565262076, tier: 'MODERATE', medianAbundance: 1.47E-06, meanAbundance: 3.57E-06 },
    { id: 'PWY-6318', name: "L-phenylalanine degradation IV (mammalian, via side chain)", category: 'degradation', subcategory: 'Amino Acids', prevalence: 0.353545735, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 1.72E-06 },
    { id: 'AST-PWY', name: "L-arginine degradation II (AST pathway)", category: 'degradation', subcategory: 'Amino Acids', prevalence: 0.334635149, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 3.61E-06 },
    { id: 'ARGDEG-PWY', name: "superpathway of L-arginine, putrescine, and 4-aminobutanoate degradation", category: 'degradation', subcategory: 'Amino Acids', prevalence: 0.31983556, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 5.77E-06 },
    { id: 'ORNARGDEG-PWY', name: "superpathway of L-arginine and L-ornithine degradation", category: 'degradation', subcategory: 'Amino Acids', prevalence: 0.31983556, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 5.77E-06 },
    { id: 'PWY-5088', name: "L-glutamate degradation VIII (to propanoate)", category: 'degradation', subcategory: 'Amino Acids', prevalence: 0.194450154, tier: 'RARE', medianAbundance: 0, meanAbundance: 9.02E-07 },
    { id: 'PWY-4321', name: "L-glutamate degradation IV", category: 'degradation', subcategory: 'Amino Acids', prevalence: 0.075025694, tier: 'RARE', medianAbundance: 0, meanAbundance: 3.67E-07 },
    { id: 'PWY-5028', name: "L-histidine degradation II", category: 'degradation', subcategory: 'Amino Acids', prevalence: 0.036176773, tier: 'RARE', medianAbundance: 0, meanAbundance: 1.77E-07 },
    { id: 'PWY-6307', name: "L-tryptophan degradation X (mammalian, via tryptamine)", category: 'degradation', subcategory: 'Amino Acids', prevalence: 0.010071942, tier: 'RARE', medianAbundance: 0, meanAbundance: 5.43E-09 },
    { id: 'VALDEG-PWY', name: "L-valine degradation I", category: 'degradation', subcategory: 'Amino Acids', prevalence: 0.008427544, tier: 'RARE', medianAbundance: 0, meanAbundance: 1.53E-08 },
    { id: 'TYRFUMCAT-PWY', name: "L-tyrosine degradation I", category: 'degradation', subcategory: 'Amino Acids', prevalence: 0.006783145, tier: 'RARE', medianAbundance: 0, meanAbundance: 2.55E-08 },
    { id: 'LYSINE-DEG1-PWY', name: "L-lysine degradation XI (mammalian)", category: 'degradation', subcategory: 'Amino Acids', prevalence: 0.001438849, tier: 'RARE', medianAbundance: 0, meanAbundance: 1.38E-09 },
    { id: 'PWY-6309', name: "L-tryptophan degradation XI (mammalian, via kynurenine)", category: 'degradation', subcategory: 'Amino Acids', prevalence: 0.001233299, tier: 'RARE', medianAbundance: 0, meanAbundance: 5.68E-10 },
    { id: 'PWY-5079', name: "L-phenylalanine degradation III", category: 'degradation', subcategory: 'Amino Acids', prevalence: 0.001027749, tier: 'RARE', medianAbundance: 0, meanAbundance: 1.89E-09 },
    { id: 'PWY-5651', name: "L-tryptophan degradation to 2-amino-3-carboxymuconate semialdehyde", category: 'degradation', subcategory: 'Amino Acids', prevalence: 0.001027749, tier: 'RARE', medianAbundance: 0, meanAbundance: 1.19E-09 },
    { id: 'GLUDEG-II-PWY', name: "L-glutamate degradation VII (to butanoate)", category: 'degradation', subcategory: 'Amino Acids', prevalence: 0.0004111, tier: 'RARE', medianAbundance: 0, meanAbundance: 4.28E-10 },
    { id: 'PWY-5081', name: "L-tryptophan degradation VIII (to tryptophol)", category: 'degradation', subcategory: 'Amino Acids', prevalence: 0.0004111, tier: 'RARE', medianAbundance: 0, meanAbundance: 2.56E-10 },
    { id: 'PWY-5655', name: "L-tryptophan degradation IX", category: 'degradation', subcategory: 'Amino Acids', prevalence: 0, tier: 'RARE', medianAbundance: 0, meanAbundance: 0 },
    { id: 'CATECHOL-ORTHO-CLEAVAGE-PWY', name: "catechol degradation to &beta;-ketoadipate", category: 'degradation', subcategory: 'Aromatics', prevalence: 0.094347379, tier: 'RARE', medianAbundance: 0, meanAbundance: 4.84E-07 },
    { id: 'PWY-6185', name: "4-methylcatechol degradation (ortho cleavage)", category: 'degradation', subcategory: 'Aromatics', prevalence: 0.07954779, tier: 'RARE', medianAbundance: 0, meanAbundance: 4.67E-07 },
    { id: 'PWY-5415', name: "catechol degradation I (meta-cleavage pathway)", category: 'degradation', subcategory: 'Aromatics', prevalence: 0.07954779, tier: 'RARE', medianAbundance: 0, meanAbundance: 1.37E-07 },
    { id: 'PWY-5417', name: "catechol degradation III (ortho-cleavage pathway)", category: 'degradation', subcategory: 'Aromatics', prevalence: 0.079136691, tier: 'RARE', medianAbundance: 0, meanAbundance: 5.53E-07 },
    { id: 'PWY-5431', name: "aromatic compounds degradation via &beta;-ketoadipate", category: 'degradation', subcategory: 'Aromatics', prevalence: 0.079136691, tier: 'RARE', medianAbundance: 0, meanAbundance: 5.53E-07 },
    { id: 'PWY-5182', name: "toluene degradation II (aerobic) (via 4-methylcatechol)", category: 'degradation', subcategory: 'Aromatics', prevalence: 0.064953751, tier: 'RARE', medianAbundance: 0, meanAbundance: 7.83E-07 },
    { id: 'PWY-6210', name: "2-aminophenol degradation", category: 'degradation', subcategory: 'Aromatics', prevalence: 0.064337102, tier: 'RARE', medianAbundance: 0, meanAbundance: 7.63E-08 },
    { id: 'PWY-6215', name: "4-chlorobenzoate degradation", category: 'degradation', subcategory: 'Aromatics', prevalence: 0.060431655, tier: 'RARE', medianAbundance: 0, meanAbundance: 1.19E-07 },
    { id: 'PWY-5178', name: "toluene degradation IV (aerobic) (via catechol)", category: 'degradation', subcategory: 'Aromatics', prevalence: 0.014182939, tier: 'RARE', medianAbundance: 0, meanAbundance: 2.15E-08 },
    { id: 'PWY-7431', name: "aromatic biogenic amine degradation (bacteria)", category: 'degradation', subcategory: 'Aromatics', prevalence: 0.009660843, tier: 'RARE', medianAbundance: 0, meanAbundance: 3.60E-09 },
    { id: 'PWY-5647', name: "2-nitrobenzoate degradation I", category: 'degradation', subcategory: 'Aromatics', prevalence: 0.003699897, tier: 'RARE', medianAbundance: 0, meanAbundance: 2.27E-09 },
    { id: 'PWY-5420', name: "catechol degradation II (meta-cleavage pathway)", category: 'degradation', subcategory: 'Aromatics', prevalence: 0.001644399, tier: 'RARE', medianAbundance: 0, meanAbundance: 4.23E-09 },
    { id: 'PWY-5419', name: "catechol degradation to 2-oxopent-4-enoate II", category: 'degradation', subcategory: 'Aromatics', prevalence: 0.001644399, tier: 'RARE', medianAbundance: 0, meanAbundance: 2.57E-09 },
    { id: 'PWY-6737', name: "starch degradation V", category: 'degradation', subcategory: 'Carbohydrates', prevalence: 0.998766701, tier: 'UNIVERSAL', medianAbundance: 0.000561182, meanAbundance: 0.000550369 },
    { id: 'PWY66-422', name: "D-galactose degradation V (Leloir pathway)", category: 'degradation', subcategory: 'Carbohydrates', prevalence: 0.998561151, tier: 'UNIVERSAL', medianAbundance: 0.000284489, meanAbundance: 0.000283985 },
    { id: 'PWY-6317', name: "galactose degradation I (Leloir pathway)", category: 'degradation', subcategory: 'Carbohydrates', prevalence: 0.997327852, tier: 'UNIVERSAL', medianAbundance: 0.000255248, meanAbundance: 0.000254858 },
    { id: 'PWY-6901', name: "superpathway of glucose and xylose degradation", category: 'degradation', subcategory: 'Carbohydrates', prevalence: 0.982117163, tier: 'VERY_COMMON', medianAbundance: 0.000119885, meanAbundance: 0.000119595 },
    { id: 'LACTOSECAT-PWY', name: "lactose and galactose degradation I", category: 'degradation', subcategory: 'Carbohydrates', prevalence: 0.960945529, tier: 'VERY_COMMON', medianAbundance: 3.44E-05, meanAbundance: 4.81E-05 },
    { id: 'GLUCOSE1PMETAB-PWY', name: "glucose and glucose-1-phosphate degradation", category: 'degradation', subcategory: 'Carbohydrates', prevalence: 0.917985612, tier: 'COMMON', medianAbundance: 1.57E-05, meanAbundance: 2.88E-05 },
    { id: 'PWY-6731', name: "starch degradation III", category: 'degradation', subcategory: 'Carbohydrates', prevalence: 0.89373073, tier: 'MODERATE', medianAbundance: 1.68E-05, meanAbundance: 2.55E-05 },
    { id: 'DHGLUCONATE-PYR-CAT-PWY', name: "glucose degradation (oxidative)", category: 'degradation', subcategory: 'Carbohydrates', prevalence: 0.024254882, tier: 'RARE', medianAbundance: 0, meanAbundance: 5.38E-08 },
    { id: 'PWY-6724', name: "starch degradation II", category: 'degradation', subcategory: 'Carbohydrates', prevalence: 0.00020555, tier: 'RARE', medianAbundance: 0, meanAbundance: 1.03E-10 },
    { id: 'PWY0-1296', name: "purine ribonucleosides degradation", category: 'degradation', subcategory: 'Nucleotides', prevalence: 0.997944502, tier: 'UNIVERSAL', medianAbundance: 0.000344976, meanAbundance: 0.000340983 },
    { id: 'PWY-6608', name: "guanosine nucleotides degradation III", category: 'degradation', subcategory: 'Nucleotides', prevalence: 0.993216855, tier: 'UNIVERSAL', medianAbundance: 8.35E-05, meanAbundance: 9.35E-05 },
    { id: 'SALVADEHYPOX-PWY', name: "adenosine nucleotides degradation II", category: 'degradation', subcategory: 'Nucleotides', prevalence: 0.989311408, tier: 'VERY_COMMON', medianAbundance: 5.67E-05, meanAbundance: 6.55E-05 },
    { id: 'PWY-6606', name: "guanosine nucleotides degradation II", category: 'degradation', subcategory: 'Nucleotides', prevalence: 0.983761562, tier: 'VERY_COMMON', medianAbundance: 4.32E-05, meanAbundance: 4.70E-05 },
    { id: 'PWY-6353', name: "purine nucleotides degradation II (aerobic)", category: 'degradation', subcategory: 'Nucleotides', prevalence: 0.982528263, tier: 'VERY_COMMON', medianAbundance: 8.09E-05, meanAbundance: 8.42E-05 },
    { id: 'PWY0-1297', name: "superpathway of purine deoxyribonucleosides degradation", category: 'degradation', subcategory: 'Nucleotides', prevalence: 0.970195272, tier: 'VERY_COMMON', medianAbundance: 3.17E-05, meanAbundance: 4.67E-05 },
    { id: 'PWY0-1298', name: "superpathway of pyrimidine deoxyribonucleosides degradation", category: 'degradation', subcategory: 'Nucleotides', prevalence: 0.96053443, tier: 'VERY_COMMON', medianAbundance: 1.78E-05, meanAbundance: 2.61E-05 },
    { id: 'P164-PWY', name: "purine nucleobases degradation I (anaerobic)", category: 'degradation', subcategory: 'Nucleotides', prevalence: 0.956834532, tier: 'VERY_COMMON', medianAbundance: 4.92E-05, meanAbundance: 5.23E-05 },
    { id: 'PWY-6595', name: "superpathway of guanosine nucleotides degradation (plants)", category: 'degradation', subcategory: 'Nucleotides', prevalence: 0.870298047, tier: 'MODERATE', medianAbundance: 8.60E-06, meanAbundance: 1.19E-05 },
    { id: 'PWY-7209', name: "superpathway of pyrimidine ribonucleosides degradation", category: 'degradation', subcategory: 'Nucleotides', prevalence: 0.770811922, tier: 'MODERATE', medianAbundance: 7.15E-06, meanAbundance: 1.33E-05 },
    { id: 'PWY-5532', name: "adenosine nucleotides degradation IV", category: 'degradation', subcategory: 'Nucleotides', prevalence: 0.015621788, tier: 'RARE', medianAbundance: 0, meanAbundance: 1.62E-08 },
    { id: 'P165-PWY', name: "superpathway of purines degradation in plants", category: 'degradation', subcategory: 'Nucleotides', prevalence: 0.009044193, tier: 'RARE', medianAbundance: 0, meanAbundance: 1.85E-08 },
    { id: 'PWY-5044', name: "purine nucleotides degradation I (plants)", category: 'degradation', subcategory: 'Nucleotides', prevalence: 0.000822199, tier: 'RARE', medianAbundance: 0, meanAbundance: 9.29E-10 },
    { id: 'PWY-6596', name: "adenosine nucleotides degradation I", category: 'degradation', subcategory: 'Nucleotides', prevalence: 0.000822199, tier: 'RARE', medianAbundance: 0, meanAbundance: 5.63E-10 },
    { id: 'PWY-6527', name: "stachyose degradation", category: 'degradation', subcategory: 'Other', prevalence: 0.997533402, tier: 'UNIVERSAL', medianAbundance: 0.000251107, meanAbundance: 0.000251682 },
    { id: 'RHAMCAT-PWY', name: "L-rhamnose degradation I", category: 'degradation', subcategory: 'Other', prevalence: 0.996300103, tier: 'UNIVERSAL', medianAbundance: 9.61E-05, meanAbundance: 0.000108858 },
    { id: 'PWY-7242', name: "D-fructuronate degradation", category: 'degradation', subcategory: 'Other', prevalence: 0.995683453, tier: 'UNIVERSAL', medianAbundance: 5.19E-05, meanAbundance: 5.76E-05 },
    { id: 'GLCMANNANAUT-PWY', name: "superpathway of N-acetylglucosamine, N-acetylmannosamine and N-acetylneuraminate degradation", category: 'degradation', subcategory: 'Other', prevalence: 0.995066804, tier: 'UNIVERSAL', medianAbundance: 7.48E-05, meanAbundance: 8.05E-05 },
    { id: 'GLUCUROCAT-PWY', name: "superpathway of &beta;-D-glucuronide and D-glucuronate degradation", category: 'degradation', subcategory: 'Other', prevalence: 0.994861254, tier: 'UNIVERSAL', medianAbundance: 6.37E-05, meanAbundance: 6.87E-05 },
    { id: 'PWY-6507', name: "4-deoxy-L-threo-hex-4-enopyranuronate degradation", category: 'degradation', subcategory: 'Other', prevalence: 0.994861254, tier: 'UNIVERSAL', medianAbundance: 4.25E-05, meanAbundance: 4.86E-05 },
    { id: 'GALACTUROCAT-PWY', name: "D-galacturonate degradation I", category: 'degradation', subcategory: 'Other', prevalence: 0.994655704, tier: 'UNIVERSAL', medianAbundance: 4.84E-05, meanAbundance: 5.45E-05 },
    { id: 'PWY-621', name: "sucrose degradation III (sucrose invertase)", category: 'degradation', subcategory: 'Other', prevalence: 0.993216855, tier: 'UNIVERSAL', medianAbundance: 9.59E-05, meanAbundance: 0.00010169 },
    { id: 'GALACT-GLUCUROCAT-PWY', name: "superpathway of hexuronide and hexuronate degradation", category: 'degradation', subcategory: 'Other', prevalence: 0.991983556, tier: 'UNIVERSAL', medianAbundance: 5.46E-05, meanAbundance: 6.01E-05 },
    { id: 'PWY-7456', name: "mannan degradation", category: 'degradation', subcategory: 'Other', prevalence: 0.989105858, tier: 'VERY_COMMON', medianAbundance: 7.63E-05, meanAbundance: 7.93E-05 },
    { id: 'HEXITOLDEGSUPER-PWY', name: "superpathway of hexitol degradation (bacteria)", category: 'degradation', subcategory: 'Other', prevalence: 0.981294964, tier: 'VERY_COMMON', medianAbundance: 8.57E-05, meanAbundance: 8.86E-05 },
    { id: 'PWY-5384', name: "sucrose degradation IV (sucrose phosphorylase)", category: 'degradation', subcategory: 'Other', prevalence: 0.974306269, tier: 'VERY_COMMON', medianAbundance: 2.95E-05, meanAbundance: 4.47E-05 },
    { id: 'FUCCAT-PWY', name: "fucose degradation", category: 'degradation', subcategory: 'Other', prevalence: 0.974100719, tier: 'VERY_COMMON', medianAbundance: 2.34E-05, meanAbundance: 2.88E-05 },
    { id: 'P441-PWY', name: "superpathway of N-acetylneuraminate degradation", category: 'degradation', subcategory: 'Other', prevalence: 0.966495375, tier: 'VERY_COMMON', medianAbundance: 5.86E-05, meanAbundance: 6.28E-05 },
    { id: 'GOLPDLCAT-PWY', name: "superpathway of glycerol degradation to 1,3-propanediol", category: 'degradation', subcategory: 'Other', prevalence: 0.948201439, tier: 'COMMON', medianAbundance: 1.63E-05, meanAbundance: 1.99E-05 },
    { id: 'PWY-7237', name: "myo-, chiro- and scillo-inositol degradation", category: 'degradation', subcategory: 'Other', prevalence: 0.945940391, tier: 'COMMON', medianAbundance: 0.000232808, meanAbundance: 0.000240994 },
    { id: 'FUC-RHAMCAT-PWY', name: "superpathway of fucose and rhamnose degradation", category: 'degradation', subcategory: 'Other', prevalence: 0.928879753, tier: 'COMMON', medianAbundance: 3.06E-05, meanAbundance: 3.48E-05 },
    { id: 'PWY-7013', name: "L-1,2-propanediol degradation", category: 'degradation', subcategory: 'Other', prevalence: 0.91963001, tier: 'COMMON', medianAbundance: 1.78E-05, meanAbundance: 2.48E-05 },
    { id: 'PWY-5022', name: "4-aminobutanoate degradation V", category: 'degradation', subcategory: 'Other', prevalence: 0.912641316, tier: 'COMMON', medianAbundance: 1.03E-05, meanAbundance: 1.46E-05 },
    { id: 'GLYCOCAT-PWY', name: "glycogen degradation I (bacterial)", category: 'degradation', subcategory: 'Other', prevalence: 0.90626927, tier: 'COMMON', medianAbundance: 2.94E-05, meanAbundance: 4.90E-05 },
    { id: 'P161-PWY', name: "acetylene degradation", category: 'degradation', subcategory: 'Other', prevalence: 0.905447071, tier: 'COMMON', medianAbundance: 7.64E-06, meanAbundance: 1.56E-05 },
    { id: 'PWY-2723', name: "trehalose degradation V", category: 'degradation', subcategory: 'Other', prevalence: 0.896197328, tier: 'MODERATE', medianAbundance: 1.49E-05, meanAbundance: 2.70E-05 },
    { id: 'PWY-5941', name: "glycogen degradation II (eukaryotic)", category: 'degradation', subcategory: 'Other', prevalence: 0.840698869, tier: 'MODERATE', medianAbundance: 2.14E-05, meanAbundance: 3.46E-05 },
    { id: 'PWY-7003', name: "glycerol degradation to butanol", category: 'degradation', subcategory: 'Other', prevalence: 0.834121274, tier: 'MODERATE', medianAbundance: 1.47E-05, meanAbundance: 1.66E-05 },
    { id: 'PWY-7046', name: "4-coumarate degradation (anaerobic)", category: 'degradation', subcategory: 'Other', prevalence: 0.797122302, tier: 'MODERATE', medianAbundance: 3.06E-06, meanAbundance: 6.43E-06 },
    { id: 'METHGLYUT-PWY', name: "superpathway of methylglyoxal degradation", category: 'degradation', subcategory: 'Other', prevalence: 0.778417266, tier: 'MODERATE', medianAbundance: 4.35E-06, meanAbundance: 8.66E-06 },
    { id: 'GALACTARDEG-PWY', name: "D-galactarate degradation I", category: 'degradation', subcategory: 'Other', prevalence: 0.77389517, tier: 'MODERATE', medianAbundance: 3.49E-06, meanAbundance: 1.14E-05 },
    { id: 'GLUCARGALACTSUPER-PWY', name: "superpathway of D-glucarate and D-galactarate degradation", category: 'degradation', subcategory: 'Other', prevalence: 0.77389517, tier: 'MODERATE', medianAbundance: 3.49E-06, meanAbundance: 1.14E-05 },
    { id: 'GLUCARDEG-PWY', name: "D-glucarate degradation I", category: 'degradation', subcategory: 'Other', prevalence: 0.744912641, tier: 'MODERATE', medianAbundance: 2.35E-06, meanAbundance: 7.89E-06 },
    { id: 'PWY66-389', name: "phytol degradation", category: 'degradation', subcategory: 'Other', prevalence: 0.619527235, tier: 'MODERATE', medianAbundance: 6.54E-07, meanAbundance: 7.45E-06 },
    { id: 'PWY-6572', name: "chondroitin sulfate degradation I (bacterial)", category: 'degradation', subcategory: 'Other', prevalence: 0.512641316, tier: 'MODERATE', medianAbundance: 8.91E-07, meanAbundance: 4.56E-06 },
    { id: 'ALLANTOINDEG-PWY', name: "superpathway of allantoin degradation in yeast", category: 'degradation', subcategory: 'Other', prevalence: 0.457348407, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 2.03E-06 },
    { id: 'PWY-4702', name: "phytate degradation I", category: 'degradation', subcategory: 'Other', prevalence: 0.433710175, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 5.99E-06 },
    { id: 'GLYCOL-GLYOXDEG-PWY', name: "superpathway of glycol metabolism and degradation", category: 'degradation', subcategory: 'Other', prevalence: 0.396094553, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 1.56E-06 },
    { id: 'ORNDEG-PWY', name: "superpathway of ornithine degradation", category: 'degradation', subcategory: 'Other', prevalence: 0.324768756, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 1.02E-05 },
    { id: 'HCAMHPDEG-PWY', name: "3-phenylpropanoate and 3-(3-hydroxyphenyl)propanoate degradation to 2-oxopent-4-enoate", category: 'degradation', subcategory: 'Other', prevalence: 0.317780062, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 3.89E-06 },
    { id: 'PWY-6690', name: "cinnamate and 3-hydroxycinnamate degradation to 2-oxopent-4-enoate", category: 'degradation', subcategory: 'Other', prevalence: 0.317780062, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 3.89E-06 },
    { id: 'P621-PWY', name: "nylon-6 oligomer degradation", category: 'degradation', subcategory: 'Other', prevalence: 0.311819116, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 4.35E-06 },
    { id: 'PWY0-1277', name: "3-phenylpropanoate and 3-(3-hydroxyphenyl)propanoate degradation", category: 'degradation', subcategory: 'Other', prevalence: 0.304008222, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 4.88E-06 },
    { id: 'PROTOCATECHUATE-ORTHO-CLEAVAGE-PWY', name: "protocatechuate degradation II (ortho-cleavage pathway)", category: 'degradation', subcategory: 'Other', prevalence: 0.246865365, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 7.72E-07 },
    { id: 'PWY0-41', name: "allantoin degradation IV (anaerobic)", category: 'degradation', subcategory: 'Other', prevalence: 0.23967112, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 8.89E-07 },
    { id: 'PWY0-1533', name: "methylphosphonate degradation I", category: 'degradation', subcategory: 'Other', prevalence: 0.229188078, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 6.57E-07 },
    { id: 'URDEGR-PWY', name: "superpathway of allantoin degradation in plants", category: 'degradation', subcategory: 'Other', prevalence: 0.224049332, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 5.11E-07 },
    { id: 'CRNFORCAT-PWY', name: "creatinine degradation I", category: 'degradation', subcategory: 'Other', prevalence: 0.210277492, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 6.79E-07 },
    { id: '3-HYDROXYPHENYLACETATE-DEGRADATION-PWY', name: "4-hydroxyphenylacetate degradation", category: 'degradation', subcategory: 'Other', prevalence: 0.194039054, tier: 'RARE', medianAbundance: 0, meanAbundance: 1.91E-06 },
    { id: 'P562-PWY', name: "myo-inositol degradation I", category: 'degradation', subcategory: 'Other', prevalence: 0.137718397, tier: 'RARE', medianAbundance: 0, meanAbundance: 5.09E-07 },
    { id: 'PWY-4722', name: "creatinine degradation II", category: 'degradation', subcategory: 'Other', prevalence: 0.137718397, tier: 'RARE', medianAbundance: 0, meanAbundance: 2.34E-07 },
    { id: 'PWY0-321', name: "phenylacetate degradation I (aerobic)", category: 'degradation', subcategory: 'Other', prevalence: 0.108324769, tier: 'RARE', medianAbundance: 0, meanAbundance: 4.47E-07 },
    { id: 'PWY-6071', name: "superpathway of phenylethylamine degradation", category: 'degradation', subcategory: 'Other', prevalence: 0.10606372, tier: 'RARE', medianAbundance: 0, meanAbundance: 4.81E-07 },
    { id: 'PWY-7294', name: "xylose degradation IV", category: 'degradation', subcategory: 'Other', prevalence: 0.08036999, tier: 'RARE', medianAbundance: 0, meanAbundance: 3.15E-07 },
    { id: 'PWY-5180', name: "toluene degradation I (aerobic) (via o-cresol)", category: 'degradation', subcategory: 'Other', prevalence: 0.064953751, tier: 'RARE', medianAbundance: 0, meanAbundance: 7.83E-07 },
    { id: 'PWY-3801', name: "sucrose degradation II (sucrose synthase)", category: 'degradation', subcategory: 'Other', prevalence: 0.063103803, tier: 'RARE', medianAbundance: 0, meanAbundance: 1.40E-06 },
    { id: 'PWY-7345', name: "superpathway of anaerobic sucrose degradation", category: 'degradation', subcategory: 'Other', prevalence: 0.063103803, tier: 'RARE', medianAbundance: 0, meanAbundance: 1.35E-06 },
    { id: 'PWY-5181', name: "toluene degradation III (aerobic) (via p-cresol)", category: 'degradation', subcategory: 'Other', prevalence: 0.059815005, tier: 'RARE', medianAbundance: 0, meanAbundance: 5.21E-07 },
    { id: 'PWY-6992', name: "1,5-anhydrofructose degradation", category: 'degradation', subcategory: 'Other', prevalence: 0.059403905, tier: 'RARE', medianAbundance: 0, meanAbundance: 8.07E-07 },
    { id: 'PWY-5654', name: "2-amino-3-carboxymuconate semialdehyde degradation to 2-oxopentenoate", category: 'degradation', subcategory: 'Other', prevalence: 0.057348407, tier: 'RARE', medianAbundance: 0, meanAbundance: 7.07E-08 },
    { id: 'PWY-6182', name: "superpathway of salicylate degradation", category: 'degradation', subcategory: 'Other', prevalence: 0.056937307, tier: 'RARE', medianAbundance: 0, meanAbundance: 3.89E-07 },
    { id: 'PWY-6906', name: "chitin derivatives degradation", category: 'degradation', subcategory: 'Other', prevalence: 0.05282631, tier: 'RARE', medianAbundance: 0, meanAbundance: 1.61E-07 },
    { id: 'PWY-7399', name: "methylphosphonate degradation II", category: 'degradation', subcategory: 'Other', prevalence: 0.044809866, tier: 'RARE', medianAbundance: 0, meanAbundance: 5.69E-08 },
    { id: 'PWY-1541', name: "superpathway of taurine degradation", category: 'degradation', subcategory: 'Other', prevalence: 0.035765673, tier: 'RARE', medianAbundance: 0, meanAbundance: 1.73E-07 },
    { id: 'PWY5F9-12', name: "biphenyl degradation", category: 'degradation', subcategory: 'Other', prevalence: 0.021377184, tier: 'RARE', medianAbundance: 0, meanAbundance: 5.27E-08 },
    { id: 'PWY-7118', name: "chitin degradation to ethanol", category: 'degradation', subcategory: 'Other', prevalence: 0.017471737, tier: 'RARE', medianAbundance: 0, meanAbundance: 3.16E-08 },
    { id: '7ALPHADEHYDROX-PWY', name: "cholate degradation (bacteria, anaerobic)", category: 'degradation', subcategory: 'Other', prevalence: 0.014182939, tier: 'RARE', medianAbundance: 0, meanAbundance: 3.67E-08 },
    { id: 'PWY-1361', name: "benzoyl-CoA degradation I (aerobic)", category: 'degradation', subcategory: 'Other', prevalence: 0.01377184, tier: 'RARE', medianAbundance: 0, meanAbundance: 5.50E-08 },
    { id: 'PWY-1501', name: "mandelate degradation I", category: 'degradation', subcategory: 'Other', prevalence: 0.011921891, tier: 'RARE', medianAbundance: 0, meanAbundance: 1.73E-08 },
    { id: 'PWY-6313', name: "serotonin degradation", category: 'degradation', subcategory: 'Other', prevalence: 0.009660843, tier: 'RARE', medianAbundance: 0, meanAbundance: 3.66E-09 },
    { id: 'PWY-6107', name: "chlorosalicylate degradation", category: 'degradation', subcategory: 'Other', prevalence: 0.009044193, tier: 'RARE', medianAbundance: 0, meanAbundance: 1.13E-08 },
    { id: 'PWY-5055', name: "nicotinate degradation III", category: 'degradation', subcategory: 'Other', prevalence: 0.006372045, tier: 'RARE', medianAbundance: 0, meanAbundance: 7.60E-09 },
    { id: 'PWY-5534', name: "propylene degradation", category: 'degradation', subcategory: 'Other', prevalence: 0.005960946, tier: 'RARE', medianAbundance: 0, meanAbundance: 1.47E-08 },
    { id: 'PWY-4361', name: "S-methyl-5-thio-&alpha;-D-ribose 1-phosphate degradation", category: 'degradation', subcategory: 'Other', prevalence: 0.004522097, tier: 'RARE', medianAbundance: 0, meanAbundance: 1.41E-08 },
    { id: 'PWY-6641', name: "superpathway of sulfolactate degradation", category: 'degradation', subcategory: 'Other', prevalence: 0.004110997, tier: 'RARE', medianAbundance: 0, meanAbundance: 6.24E-09 },
    { id: 'LEU-DEG2-PWY', name: "L-leucine degradation I", category: 'degradation', subcategory: 'Other', prevalence: 0.001849949, tier: 'RARE', medianAbundance: 0, meanAbundance: 5.93E-09 },
    { id: 'PWY-5724', name: "superpathway of atrazine degradation", category: 'degradation', subcategory: 'Other', prevalence: 0.001027749, tier: 'RARE', medianAbundance: 0, meanAbundance: 3.53E-10 },
    { id: 'PWY-7337', name: "10-cis-heptadecenoyl-CoA degradation (yeast)", category: 'degradation', subcategory: 'Other', prevalence: 0.000822199, tier: 'RARE', medianAbundance: 0, meanAbundance: 6.21E-10 },
    { id: 'PWY-7338', name: "10-trans-heptadecenoyl-CoA degradation (reductase-dependent, yeast)", category: 'degradation', subcategory: 'Other', prevalence: 0.000822199, tier: 'RARE', medianAbundance: 0, meanAbundance: 6.21E-10 },
    { id: 'PWY-5183', name: "superpathway of aerobic toluene degradation", category: 'degradation', subcategory: 'Other', prevalence: 0.00061665, tier: 'RARE', medianAbundance: 0, meanAbundance: 9.93E-10 },
    { id: 'METHYLGALLATE-DEGRADATION-PWY', name: "methylgallate degradation", category: 'degradation', subcategory: 'Other', prevalence: 0.00061665, tier: 'RARE', medianAbundance: 0, meanAbundance: 3.48E-09 },
    { id: 'GALLATE-DEGRADATION-I-PWY', name: "gallate degradation II", category: 'degradation', subcategory: 'Other', prevalence: 0.00061665, tier: 'RARE', medianAbundance: 0, meanAbundance: 2.87E-09 },
    { id: 'ILEUDEG-PWY', name: "L-isoleucine degradation I", category: 'degradation', subcategory: 'Other', prevalence: 0.00061665, tier: 'RARE', medianAbundance: 0, meanAbundance: 1.64E-09 },
    { id: 'PWY-6760', name: "xylose degradation III", category: 'degradation', subcategory: 'Other', prevalence: 0.00061665, tier: 'RARE', medianAbundance: 0, meanAbundance: 1.25E-09 },
    { id: 'PWY-5499', name: "vitamin B6 degradation", category: 'degradation', subcategory: 'Other', prevalence: 0.0004111, tier: 'RARE', medianAbundance: 0, meanAbundance: 1.48E-10 },
    { id: 'GALLATE-DEGRADATION-II-PWY', name: "gallate degradation I", category: 'degradation', subcategory: 'Other', prevalence: 0.0004111, tier: 'RARE', medianAbundance: 0, meanAbundance: 2.17E-09 },
    { id: 'PWY-6948', name: "sitosterol degradation to androstenedione", category: 'degradation', subcategory: 'Other', prevalence: 0.0004111, tier: 'RARE', medianAbundance: 0, meanAbundance: 8.56E-10 },
    { id: 'PWY-6060', name: "malonate degradation II (biotin-dependent)", category: 'degradation', subcategory: 'Other', prevalence: 0.0004111, tier: 'RARE', medianAbundance: 0, meanAbundance: 3.53E-09 },
    { id: 'PWY-6339', name: "syringate degradation", category: 'degradation', subcategory: 'Other', prevalence: 0.0004111, tier: 'RARE', medianAbundance: 0, meanAbundance: 3.76E-09 },
    { id: 'PWY-6957', name: "mandelate degradation to acetyl-CoA", category: 'degradation', subcategory: 'Other', prevalence: 0.00020555, tier: 'RARE', medianAbundance: 0, meanAbundance: 3.38E-10 },
    { id: 'PWY-722', name: "nicotinate degradation I", category: 'degradation', subcategory: 'Other', prevalence: 0.00020555, tier: 'RARE', medianAbundance: 0, meanAbundance: 4.35E-10 },
    { id: 'PWY-6486', name: "D-galacturonate degradation II", category: 'degradation', subcategory: 'Other', prevalence: 0.00020555, tier: 'RARE', medianAbundance: 0, meanAbundance: 2.67E-10 },
    { id: 'PWY-6344', name: "L-ornithine degradation II (Stickland reaction)", category: 'degradation', subcategory: 'Other', prevalence: 0.00020555, tier: 'RARE', medianAbundance: 0, meanAbundance: 1.41E-08 },
    { id: 'PWY-7295', name: "L-arabinose degradation IV", category: 'degradation', subcategory: 'Other', prevalence: 0.00020555, tier: 'RARE', medianAbundance: 0, meanAbundance: 6.79E-10 },
    { id: 'P184-PWY', name: "protocatechuate degradation I (meta-cleavage pathway)", category: 'degradation', subcategory: 'Other', prevalence: 0.00020555, tier: 'RARE', medianAbundance: 0, meanAbundance: 6.58E-10 },
    { id: 'PWY-5328', name: "superpathway of L-methionine salvage and degradation", category: 'degradation', subcategory: 'Other', prevalence: 0.00020555, tier: 'RARE', medianAbundance: 0, meanAbundance: 5.05E-10 },
    { id: 'PWY6666-2', name: "dopamine degradation", category: 'degradation', subcategory: 'Other', prevalence: 0, tier: 'RARE', medianAbundance: 0, meanAbundance: 0 },
    { id: 'PWY66-201', name: "nicotine degradation IV", category: 'degradation', subcategory: 'Other', prevalence: 0, tier: 'RARE', medianAbundance: 0, meanAbundance: 0 },
    { id: '4-HYDROXYMANDELATE-DEGRADATION-PWY', name: "4-hydroxymandelate degradation", category: 'degradation', subcategory: 'Other', prevalence: 0, tier: 'RARE', medianAbundance: 0, meanAbundance: 0 },
    { id: 'PWY-6342', name: "noradrenaline and adrenaline degradation", category: 'degradation', subcategory: 'Other', prevalence: 0, tier: 'RARE', medianAbundance: 0, meanAbundance: 0 },
    { id: 'PWY-6538', name: "caffeine degradation III (bacteria, via demethylation)", category: 'degradation', subcategory: 'Other', prevalence: 0, tier: 'RARE', medianAbundance: 0, meanAbundance: 0 },
    { id: 'PWY-7562', name: "3,6-anhydro-&alpha;-L-galactopyranose degradation", category: 'degradation', subcategory: 'Other', prevalence: 0, tier: 'RARE', medianAbundance: 0, meanAbundance: 0 },
    { id: 'P3-PWY', name: "gallate degradation III (anaerobic)", category: 'degradation', subcategory: 'Other', prevalence: 0, tier: 'RARE', medianAbundance: 0, meanAbundance: 0 },
    { id: 'PWY66-373', name: "sucrose degradation V (sucrose &alpha;-glucosidase)", category: 'degradation', subcategory: 'Other', prevalence: 0, tier: 'RARE', medianAbundance: 0, meanAbundance: 0 },
    { id: 'P281-PWY', name: "3-phenylpropanoate degradation", category: 'degradation', subcategory: 'Other', prevalence: 0, tier: 'RARE', medianAbundance: 0, meanAbundance: 0 },
    { id: 'PWY-6769', name: "rhamnogalacturonan type I degradation I (fungi)", category: 'degradation', subcategory: 'Other', prevalence: 0, tier: 'RARE', medianAbundance: 0, meanAbundance: 0 },
    { id: 'PWY-3661', name: "glycine betaine degradation I", category: 'degradation', subcategory: 'Other', prevalence: 0, tier: 'RARE', medianAbundance: 0, meanAbundance: 0 },
    { id: 'PWY-5100', name: "pyruvate fermentation to acetate and lactate II", category: 'energy', subcategory: 'Fermentation', prevalence: 0.998355601, tier: 'UNIVERSAL', medianAbundance: 0.000217782, meanAbundance: 0.000226131 },
    { id: 'ANAEROFRUCAT-PWY', name: "homolactic fermentation", category: 'energy', subcategory: 'Fermentation', prevalence: 0.996916752, tier: 'UNIVERSAL', medianAbundance: 0.000260682, meanAbundance: 0.000258511 },
    { id: 'PWY-5676', name: "acetyl-CoA fermentation to butanoate II", category: 'energy', subcategory: 'Fermentation', prevalence: 0.976156218, tier: 'VERY_COMMON', medianAbundance: 4.11E-05, meanAbundance: 4.62E-05 },
    { id: 'P461-PWY', name: "hexitol fermentation to lactate, formate, ethanol and acetate", category: 'energy', subcategory: 'Fermentation', prevalence: 0.968345324, tier: 'VERY_COMMON', medianAbundance: 2.97E-05, meanAbundance: 4.25E-05 },
    { id: 'FERMENTATION-PWY', name: "mixed acid fermentation", category: 'energy', subcategory: 'Fermentation', prevalence: 0.967112025, tier: 'VERY_COMMON', medianAbundance: 5.72E-05, meanAbundance: 6.69E-05 },
    { id: 'PWY-6590', name: "superpathway of Clostridium acetobutylicum acidogenic fermentation", category: 'energy', subcategory: 'Fermentation', prevalence: 0.960945529, tier: 'VERY_COMMON', medianAbundance: 3.85E-05, meanAbundance: 3.96E-05 },
    { id: 'CENTFERM-PWY', name: "pyruvate fermentation to butanoate", category: 'energy', subcategory: 'Fermentation', prevalence: 0.960945529, tier: 'VERY_COMMON', medianAbundance: 3.12E-05, meanAbundance: 3.22E-05 },
    { id: 'P108-PWY', name: "pyruvate fermentation to propanoate I", category: 'energy', subcategory: 'Fermentation', prevalence: 0.96032888, tier: 'VERY_COMMON', medianAbundance: 2.66E-05, meanAbundance: 3.03E-05 },
    { id: 'PWY4LZ-257', name: "superpathway of fermentation (Chlamydomonas reinhardtii)", category: 'energy', subcategory: 'Fermentation', prevalence: 0.905035971, tier: 'COMMON', medianAbundance: 9.38E-06, meanAbundance: 1.66E-05 },
    { id: 'PWY-6588', name: "pyruvate fermentation to acetone", category: 'energy', subcategory: 'Fermentation', prevalence: 0.894552929, tier: 'MODERATE', medianAbundance: 9.07E-06, meanAbundance: 1.12E-05 },
    { id: 'P122-PWY', name: "heterolactic fermentation", category: 'energy', subcategory: 'Fermentation', prevalence: 0.464953751, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 4.33E-06 },
    { id: 'PROPFERM-PWY', name: "L-alanine fermentation to propanoate and acetate", category: 'energy', subcategory: 'Fermentation', prevalence: 0.281397739, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 1.03E-06 },
    { id: 'PWY-5677', name: "succinate fermentation to butanoate", category: 'energy', subcategory: 'Fermentation', prevalence: 0.235971223, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 8.27E-07 },
    { id: 'P163-PWY', name: "L-lysine fermentation to acetate and butanoate", category: 'energy', subcategory: 'Fermentation', prevalence: 0.166495375, tier: 'RARE', medianAbundance: 0, meanAbundance: 4.65E-07 },
    { id: 'PWY-6883', name: "pyruvate fermentation to butanol II", category: 'energy', subcategory: 'Fermentation', prevalence: 0.0004111, tier: 'RARE', medianAbundance: 0, meanAbundance: 2.92E-09 },
    { id: 'PWY-6863', name: "pyruvate fermentation to hexanol", category: 'energy', subcategory: 'Fermentation', prevalence: 0.0004111, tier: 'RARE', medianAbundance: 0, meanAbundance: 2.91E-09 },
    { id: 'PWY-1042', name: "glycolysis IV (plant cytosol)", category: 'energy', subcategory: 'Glycolysis/Gluconeogenesis', prevalence: 0.998972251, tier: 'UNIVERSAL', medianAbundance: 0.000589427, meanAbundance: 0.000591877 },
    { id: 'ANAGLYCOLYSIS-PWY', name: "glycolysis III (from glucose)", category: 'energy', subcategory: 'Glycolysis/Gluconeogenesis', prevalence: 0.998150051, tier: 'UNIVERSAL', medianAbundance: 0.000362733, meanAbundance: 0.000357883 },
    { id: 'GLYCOLYSIS', name: "glycolysis I (from glucose 6-phosphate)", category: 'energy', subcategory: 'Glycolysis/Gluconeogenesis', prevalence: 0.997738952, tier: 'UNIVERSAL', medianAbundance: 0.000209571, meanAbundance: 0.000217277 },
    { id: 'PWY-5484', name: "glycolysis II (from fructose 6-phosphate)", category: 'energy', subcategory: 'Glycolysis/Gluconeogenesis', prevalence: 0.997738952, tier: 'UNIVERSAL', medianAbundance: 0.000185968, meanAbundance: 0.000193278 },
    { id: 'PWY66-400', name: "glycolysis VI (metazoan)", category: 'energy', subcategory: 'Glycolysis/Gluconeogenesis', prevalence: 0.996094553, tier: 'UNIVERSAL', medianAbundance: 0.000204281, meanAbundance: 0.000210635 },
    { id: 'GLUCONEO-PWY', name: "gluconeogenesis I", category: 'energy', subcategory: 'Glycolysis/Gluconeogenesis', prevalence: 0.994039054, tier: 'UNIVERSAL', medianAbundance: 0.000192474, meanAbundance: 0.000190245 },
    { id: 'GLYCOLYSIS-E-D', name: "superpathway of glycolysis and Entner-Doudoroff", category: 'energy', subcategory: 'Glycolysis/Gluconeogenesis', prevalence: 0.978622816, tier: 'VERY_COMMON', medianAbundance: 7.82E-05, meanAbundance: 7.98E-05 },
    { id: 'PWY66-399', name: "gluconeogenesis III", category: 'energy', subcategory: 'Glycolysis/Gluconeogenesis', prevalence: 0.976772867, tier: 'VERY_COMMON', medianAbundance: 8.74E-05, meanAbundance: 8.58E-05 },
    { id: 'PWY-5464', name: "superpathway of cytosolic glycolysis (plants), pyruvate dehydrogenase and TCA cycle", category: 'energy', subcategory: 'Glycolysis/Gluconeogenesis', prevalence: 0.677492292, tier: 'MODERATE', medianAbundance: 5.82E-06, meanAbundance: 8.69E-06 },
    { id: 'GLYCOLYSIS-TCA-GLYOX-BYPASS', name: "superpathway of glycolysis, pyruvate dehydrogenase, TCA, and glyoxylate bypass", category: 'energy', subcategory: 'Glycolysis/Gluconeogenesis', prevalence: 0.504419322, tier: 'MODERATE', medianAbundance: 1.18E-06, meanAbundance: 1.90E-05 },
    { id: 'PWY-7446', name: "sulfoglycolysis", category: 'energy', subcategory: 'Glycolysis/Gluconeogenesis', prevalence: 0.263309353, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 1.42E-06 },
    { id: 'GLYOXYLATE-BYPASS', name: "glyoxylate cycle", category: 'energy', subcategory: 'Glyoxylate Cycle', prevalence: 0.606783145, tier: 'MODERATE', medianAbundance: 1.40E-06, meanAbundance: 1.01E-05 },
    { id: 'PWY-561', name: "superpathway of glyoxylate cycle and fatty acid degradation", category: 'energy', subcategory: 'Glyoxylate Cycle', prevalence: 0.445837616, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 1.09E-05 },
    { id: 'PWY-5705', name: "allantoin degradation to glyoxylate III", category: 'energy', subcategory: 'Glyoxylate Cycle', prevalence: 0.300102775, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 1.22E-06 },
    { id: 'PWY-5692', name: "allantoin degradation to glyoxylate II", category: 'energy', subcategory: 'Glyoxylate Cycle', prevalence: 0.224049332, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 5.11E-07 },
    { id: 'NONOXIPENT-PWY', name: "pentose phosphate pathway (non-oxidative branch)", category: 'energy', subcategory: 'Pentose Phosphate', prevalence: 0.998972251, tier: 'UNIVERSAL', medianAbundance: 0.0002641, meanAbundance: 0.000268674 },
    { id: 'PENTOSE-P-PWY', name: "pentose phosphate pathway", category: 'energy', subcategory: 'Pentose Phosphate', prevalence: 0.984583762, tier: 'VERY_COMMON', medianAbundance: 0.000105161, meanAbundance: 0.00010875 },
    { id: 'PWY-2221', name: "Entner-Doudoroff pathway III (semi-phosphorylative)", category: 'energy', subcategory: 'Pentose Phosphate', prevalence: 0.018293936, tier: 'RARE', medianAbundance: 0, meanAbundance: 4.39E-08 },
    { id: 'PWY-3781', name: "aerobic respiration I (cytochrome c)", category: 'energy', subcategory: 'Respiration', prevalence: 0.507913669, tier: 'MODERATE', medianAbundance: 3.35E-07, meanAbundance: 3.73E-06 },
    { id: 'PWY-7279', name: "aerobic respiration II (cytochrome c) (yeast)", category: 'energy', subcategory: 'Respiration', prevalence: 0.198150051, tier: 'RARE', medianAbundance: 0, meanAbundance: 6.18E-07 },
    { id: 'PWY-181', name: "photorespiration", category: 'energy', subcategory: 'Respiration', prevalence: 0.005960946, tier: 'RARE', medianAbundance: 0, meanAbundance: 3.67E-08 },
    { id: 'PWY-5690', name: "TCA cycle II (plants and fungi)", category: 'energy', subcategory: 'TCA Cycle', prevalence: 0.988078109, tier: 'VERY_COMMON', medianAbundance: 4.57E-05, meanAbundance: 4.93E-05 },
    { id: 'TCA', name: "TCA cycle I (prokaryotic)", category: 'energy', subcategory: 'TCA Cycle', prevalence: 0.98684481, tier: 'VERY_COMMON', medianAbundance: 6.60E-05, meanAbundance: 7.12E-05 },
    { id: 'PWY-5913', name: "TCA cycle VI (obligate autotrophs)", category: 'energy', subcategory: 'TCA Cycle', prevalence: 0.969373073, tier: 'VERY_COMMON', medianAbundance: 4.19E-05, meanAbundance: 6.10E-05 },
    { id: 'P42-PWY', name: "incomplete reductive TCA cycle", category: 'energy', subcategory: 'TCA Cycle', prevalence: 0.931140802, tier: 'COMMON', medianAbundance: 2.01E-05, meanAbundance: 2.60E-05 },
    { id: 'PWY-6969', name: "TCA cycle V (2-oxoglutarate:ferredoxin oxidoreductase)", category: 'energy', subcategory: 'TCA Cycle', prevalence: 0.927235355, tier: 'COMMON', medianAbundance: 4.17E-05, meanAbundance: 4.45E-05 },
    { id: 'REDCITCYC', name: "TCA cycle VIII (helicobacter)", category: 'energy', subcategory: 'TCA Cycle', prevalence: 0.585405961, tier: 'MODERATE', medianAbundance: 1.43E-06, meanAbundance: 4.64E-06 },
    { id: 'PWY66-398', name: "TCA cycle III (animals)", category: 'energy', subcategory: 'TCA Cycle', prevalence: 0.560739979, tier: 'MODERATE', medianAbundance: 2.55E-06, meanAbundance: 4.58E-06 },
    { id: 'PWY-7254', name: "TCA cycle VII (acetate-producers)", category: 'energy', subcategory: 'TCA Cycle', prevalence: 0.515313464, tier: 'MODERATE', medianAbundance: 7.19E-07, meanAbundance: 1.05E-05 },
    { id: 'TCA-GLYOX-BYPASS', name: "superpathway of glyoxylate bypass and TCA", category: 'energy', subcategory: 'TCA Cycle', prevalence: 0.504830421, tier: 'MODERATE', medianAbundance: 5.97E-07, meanAbundance: 1.27E-05 },
    { id: 'P23-PWY', name: "reductive TCA cycle I", category: 'energy', subcategory: 'TCA Cycle', prevalence: 0.47934224, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 4.02E-06 },
    { id: 'P105-PWY', name: "TCA cycle IV (2-oxoglutarate decarboxylase)", category: 'energy', subcategory: 'TCA Cycle', prevalence: 0.449948613, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 1.28E-05 },
    { id: 'PWY-5747', name: "2-methylcitrate cycle II", category: 'energy', subcategory: 'TCA Cycle', prevalence: 0.432476876, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 4.30E-06 },
    { id: 'PWY0-42', name: "2-methylcitrate cycle I", category: 'energy', subcategory: 'TCA Cycle', prevalence: 0.371017472, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 3.94E-06 },
    { id: 'PWY-5392', name: "reductive TCA cycle II", category: 'energy', subcategory: 'TCA Cycle', prevalence: 0.264953751, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 8.64E-07 },
    { id: 'PWY-6151', name: "S-adenosyl-L-methionine cycle I", category: 'other', subcategory: 'Unclassified', prevalence: 0.999177801, tier: 'UNIVERSAL', medianAbundance: 0.000454777, meanAbundance: 0.000467437 },
    { id: 'PWY-7357', name: "thiamin formation from pyrithiamine and oxythiamine (yeast)", category: 'other', subcategory: 'Unclassified', prevalence: 0.998972251, tier: 'UNIVERSAL', medianAbundance: 0.000292767, meanAbundance: 0.000295614 },
    { id: 'PWY-3841', name: "folate transformations II", category: 'other', subcategory: 'Unclassified', prevalence: 0.998766701, tier: 'UNIVERSAL', medianAbundance: 0.000451515, meanAbundance: 0.000456586 },
    { id: 'PWY0-1586', name: "peptidoglycan maturation (meso-diaminopimelate containing)", category: 'other', subcategory: 'Unclassified', prevalence: 0.998766701, tier: 'UNIVERSAL', medianAbundance: 0.000333838, meanAbundance: 0.000349056 },
    { id: 'TRNA-CHARGING-PWY', name: "tRNA charging", category: 'other', subcategory: 'Unclassified', prevalence: 0.998561151, tier: 'UNIVERSAL', medianAbundance: 0.000521161, meanAbundance: 0.000530732 },
    { id: 'PWY-7197', name: "pyrimidine deoxyribonucleotide phosphorylation", category: 'other', subcategory: 'Unclassified', prevalence: 0.996711202, tier: 'UNIVERSAL', medianAbundance: 9.72E-05, meanAbundance: 0.000102518 },
    { id: 'PWY-4041', name: "&gamma;-glutamyl cycle", category: 'other', subcategory: 'Unclassified', prevalence: 0.990544707, tier: 'UNIVERSAL', medianAbundance: 5.95E-05, meanAbundance: 6.81E-05 },
    { id: 'PWY0-1479', name: "tRNA processing", category: 'other', subcategory: 'Unclassified', prevalence: 0.983350462, tier: 'VERY_COMMON', medianAbundance: 4.75E-05, meanAbundance: 5.80E-05 },
    { id: 'PWY0-1261', name: "anhydromuropeptides recycling", category: 'other', subcategory: 'Unclassified', prevalence: 0.979856115, tier: 'VERY_COMMON', medianAbundance: 0.000127426, meanAbundance: 0.000127535 },
    { id: 'PWY-7383', name: "anaerobic energy metabolism (invertebrates, cytosol)", category: 'other', subcategory: 'Unclassified', prevalence: 0.979239466, tier: 'VERY_COMMON', medianAbundance: 7.44E-05, meanAbundance: 7.98E-05 },
    { id: 'FASYN-ELONG-PWY', name: "fatty acid elongation -- saturated", category: 'other', subcategory: 'Unclassified', prevalence: 0.978006166, tier: 'VERY_COMMON', medianAbundance: 6.35E-05, meanAbundance: 8.02E-05 },
    { id: 'PWY-7117', name: "C4 photosynthetic carbon assimilation cycle, PEPCK type", category: 'other', subcategory: 'Unclassified', prevalence: 0.966906475, tier: 'VERY_COMMON', medianAbundance: 4.99E-05, meanAbundance: 6.76E-05 },
    { id: 'PWY-241', name: "C4 photosynthetic carbon assimilation cycle, NADP-ME type", category: 'other', subcategory: 'Unclassified', prevalence: 0.966289825, tier: 'VERY_COMMON', medianAbundance: 4.62E-05, meanAbundance: 6.00E-05 },
    { id: 'PWY-4984', name: "urea cycle", category: 'other', subcategory: 'Unclassified', prevalence: 0.962178828, tier: 'VERY_COMMON', medianAbundance: 6.45E-05, meanAbundance: 7.99E-05 },
    { id: 'PWY-7115', name: "C4 photosynthetic carbon assimilation cycle, NAD-ME type", category: 'other', subcategory: 'Unclassified', prevalence: 0.956012333, tier: 'VERY_COMMON', medianAbundance: 3.50E-05, meanAbundance: 4.27E-05 },
    { id: 'METH-ACETATE-PWY', name: "methanogenesis from acetate", category: 'other', subcategory: 'Unclassified', prevalence: 0.944707091, tier: 'COMMON', medianAbundance: 6.21E-05, meanAbundance: 7.26E-05 },
    { id: 'FAO-PWY', name: "fatty acid &beta;-oxidation I", category: 'other', subcategory: 'Unclassified', prevalence: 0.93299075, tier: 'COMMON', medianAbundance: 1.53E-05, meanAbundance: 2.58E-05 },
    { id: 'PWY-5136', name: "fatty acid &beta;-oxidation II (peroxisome)", category: 'other', subcategory: 'Unclassified', prevalence: 0.932168551, tier: 'COMMON', medianAbundance: 1.35E-05, meanAbundance: 2.28E-05 },
    { id: 'PWY-1861', name: "formaldehyde assimilation II (RuMP Cycle)", category: 'other', subcategory: 'Unclassified', prevalence: 0.929085303, tier: 'COMMON', medianAbundance: 4.31E-05, meanAbundance: 6.06E-05 },
    { id: 'P185-PWY', name: "formaldehyde assimilation III (dihydroxyacetone cycle)", category: 'other', subcategory: 'Unclassified', prevalence: 0.927852004, tier: 'COMMON', medianAbundance: 1.18E-05, meanAbundance: 1.71E-05 },
    { id: 'GLUDEG-I-PWY', name: "GABA shunt", category: 'other', subcategory: 'Unclassified', prevalence: 0.907708119, tier: 'COMMON', medianAbundance: 1.07E-05, meanAbundance: 1.54E-05 },
    { id: 'ARGORNPROST-PWY', name: "arginine, ornithine and proline interconversion", category: 'other', subcategory: 'Unclassified', prevalence: 0.905652621, tier: 'COMMON', medianAbundance: 1.32E-05, meanAbundance: 1.52E-05 },
    { id: 'NONMEVIPP-PWY', name: "methylerythritol phosphate pathway I", category: 'other', subcategory: 'Unclassified', prevalence: 0.899486125, tier: 'MODERATE', medianAbundance: 7.74E-05, meanAbundance: 0.000112082 },
    { id: 'PWY-7560', name: "methylerythritol phosphate pathway II", category: 'other', subcategory: 'Unclassified', prevalence: 0.898047276, tier: 'MODERATE', medianAbundance: 3.57E-05, meanAbundance: 6.33E-05 },
    { id: 'SO4ASSIM-PWY', name: "sulfate reduction I (assimilatory)", category: 'other', subcategory: 'Unclassified', prevalence: 0.891058582, tier: 'MODERATE', medianAbundance: 1.21E-05, meanAbundance: 2.47E-05 },
    { id: 'P124-PWY', name: "Bifidobacterium shunt", category: 'other', subcategory: 'Unclassified', prevalence: 0.859198356, tier: 'MODERATE', medianAbundance: 2.09E-05, meanAbundance: 4.33E-05 },
    { id: 'PWY-5083', name: "NAD/NADH phosphorylation and dephosphorylation", category: 'other', subcategory: 'Unclassified', prevalence: 0.83946557, tier: 'MODERATE', medianAbundance: 7.01E-06, meanAbundance: 1.94E-05 },
    { id: 'PWY-6531', name: "mannitol cycle", category: 'other', subcategory: 'Unclassified', prevalence: 0.821171634, tier: 'MODERATE', medianAbundance: 5.37E-06, meanAbundance: 1.15E-05 },
    { id: 'RUMP-PWY', name: "formaldehyde oxidation I", category: 'other', subcategory: 'Unclassified', prevalence: 0.779239466, tier: 'MODERATE', medianAbundance: 6.87E-06, meanAbundance: 1.20E-05 },
    { id: 'PWY-5138', name: "unsaturated, even numbered fatty acid &beta;-oxidation", category: 'other', subcategory: 'Unclassified', prevalence: 0.632065776, tier: 'MODERATE', medianAbundance: 2.11E-06, meanAbundance: 7.36E-06 },
    { id: 'PWY-6803', name: "phosphatidylcholine acyl editing", category: 'other', subcategory: 'Unclassified', prevalence: 0.557451182, tier: 'MODERATE', medianAbundance: 9.02E-07, meanAbundance: 7.38E-06 },
    { id: 'PWY-5675', name: "nitrate reduction V (assimilatory)", category: 'other', subcategory: 'Unclassified', prevalence: 0.531963001, tier: 'MODERATE', medianAbundance: 4.50E-07, meanAbundance: 1.02E-05 },
    { id: 'PWY-5723', name: "Rubisco shunt", category: 'other', subcategory: 'Unclassified', prevalence: 0.517780062, tier: 'MODERATE', medianAbundance: 8.27E-07, meanAbundance: 1.45E-05 },
    { id: 'PWY490-3', name: "nitrate reduction VI (assimilatory)", category: 'other', subcategory: 'Unclassified', prevalence: 0.488386434, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 1.18E-06 },
    { id: 'KETOGLUCONMET-PWY', name: "ketogluconate metabolism", category: 'other', subcategory: 'Unclassified', prevalence: 0.462076053, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 5.53E-06 },
    { id: 'PWY-7288', name: "fatty acid &beta;-oxidation (peroxisome, yeast)", category: 'other', subcategory: 'Unclassified', prevalence: 0.440698869, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 2.07E-06 },
    { id: 'PWY66-391', name: "fatty acid &beta;-oxidation VI (peroxisome)", category: 'other', subcategory: 'Unclassified', prevalence: 0.44049332, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 3.14E-06 },
    { id: 'P221-PWY', name: "octane oxidation", category: 'other', subcategory: 'Unclassified', prevalence: 0.359301131, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 1.49E-06 },
    { id: 'PWY-6837', name: "fatty acid beta-oxidation V (unsaturated, odd number, di-isomerase-dependent)", category: 'other', subcategory: 'Unclassified', prevalence: 0.351284687, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 1.49E-06 },
    { id: 'PWY-7616', name: "methanol oxidation to carbon dioxide", category: 'other', subcategory: 'Unclassified', prevalence: 0.345734841, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 7.77E-07 },
    { id: 'METHANOGENESIS-PWY', name: "methanogenesis from H2 and CO2", category: 'other', subcategory: 'Unclassified', prevalence: 0.312846865, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 3.97E-06 },
    { id: 'PWY0-1338', name: "polymyxin resistance", category: 'other', subcategory: 'Unclassified', prevalence: 0.295375128, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 1.87E-06 },
    { id: 'PWY-7269', name: "NAD/NADP-NADH/NADPH mitochondrial interconversion (yeast)", category: 'other', subcategory: 'Unclassified', prevalence: 0.29331963, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 2.68E-06 },
    { id: 'PWY-922', name: "mevalonate pathway I", category: 'other', subcategory: 'Unclassified', prevalence: 0.272559096, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 1.20E-06 },
    { id: 'PWY66-367', name: "ketogenesis", category: 'other', subcategory: 'Unclassified', prevalence: 0.171839671, tier: 'RARE', medianAbundance: 0, meanAbundance: 2.62E-07 },
    { id: 'PWY66-388', name: "fatty acid &alpha;-oxidation III", category: 'other', subcategory: 'Unclassified', prevalence: 0.134635149, tier: 'RARE', medianAbundance: 0, meanAbundance: 2.77E-07 },
    { id: 'PWY-7409', name: "phospholipid remodeling (phosphatidylethanolamine, yeast)", category: 'other', subcategory: 'Unclassified', prevalence: 0.132579651, tier: 'RARE', medianAbundance: 0, meanAbundance: 6.98E-07 },
    { id: 'PWY-6785', name: "hydrogen production VIII", category: 'other', subcategory: 'Unclassified', prevalence: 0.098869476, tier: 'RARE', medianAbundance: 0, meanAbundance: 1.42E-07 },
    { id: 'PWY-7031', name: "protein N-glycosylation (bacterial)", category: 'other', subcategory: 'Unclassified', prevalence: 0.090441932, tier: 'RARE', medianAbundance: 0, meanAbundance: 3.41E-07 },
    { id: 'DENITRIFICATION-PWY', name: "nitrate reduction I (denitrification)", category: 'other', subcategory: 'Unclassified', prevalence: 0.07954779, tier: 'RARE', medianAbundance: 0, meanAbundance: 1.20E-07 },
    { id: 'PWY-6174', name: "mevalonate pathway II (archaea)", category: 'other', subcategory: 'Unclassified', prevalence: 0.073997945, tier: 'RARE', medianAbundance: 0, meanAbundance: 2.15E-07 },
    { id: 'PWY-7039', name: "phosphatidate metabolism, as a signaling molecule", category: 'other', subcategory: 'Unclassified', prevalence: 0.068242549, tier: 'RARE', medianAbundance: 0, meanAbundance: 2.60E-07 },
    { id: 'PWY-7384', name: "anaerobic energy metabolism (invertebrates, mitochondrial)", category: 'other', subcategory: 'Unclassified', prevalence: 0.052620761, tier: 'RARE', medianAbundance: 0, meanAbundance: 1.20E-07 },
    { id: 'PWY-7268', name: "NAD/NADP-NADH/NADPH cytosolic interconversion (yeast)", category: 'other', subcategory: 'Unclassified', prevalence: 0.048304214, tier: 'RARE', medianAbundance: 0, meanAbundance: 3.34E-07 },
    { id: 'LIPASYN-PWY', name: "phospholipases", category: 'other', subcategory: 'Unclassified', prevalence: 0.032887975, tier: 'RARE', medianAbundance: 0, meanAbundance: 5.17E-08 },
    { id: 'PWY-6467', name: "Kdo transfer to lipid IVA III (Chlamydia)", category: 'other', subcategory: 'Unclassified', prevalence: 0.025693731, tier: 'RARE', medianAbundance: 0, meanAbundance: 1.12E-07 },
    { id: 'CODH-PWY', name: "reductive acetyl coenzyme A pathway", category: 'other', subcategory: 'Unclassified', prevalence: 0.005344296, tier: 'RARE', medianAbundance: 0, meanAbundance: 8.77E-09 },
    { id: 'PWY-1622', name: "formaldehyde assimilation I (serine pathway)", category: 'other', subcategory: 'Unclassified', prevalence: 0.004110997, tier: 'RARE', medianAbundance: 0, meanAbundance: 9.69E-09 },
    { id: 'PWY-6748', name: "nitrate reduction VII (denitrification)", category: 'other', subcategory: 'Unclassified', prevalence: 0.003494347, tier: 'RARE', medianAbundance: 0, meanAbundance: 6.23E-09 },
    { id: 'PWY-5381', name: "pyridine nucleotide cycling (plants)", category: 'other', subcategory: 'Unclassified', prevalence: 0.001233299, tier: 'RARE', medianAbundance: 0, meanAbundance: 1.22E-09 },
    { id: 'PWY-2201', name: "folate transformations I", category: 'other', subcategory: 'Unclassified', prevalence: 0.001027749, tier: 'RARE', medianAbundance: 0, meanAbundance: 2.11E-09 },
    { id: 'PWY-6728', name: "methylaspartate cycle", category: 'other', subcategory: 'Unclassified', prevalence: 0.00061665, tier: 'RARE', medianAbundance: 0, meanAbundance: 3.36E-09 },
    { id: 'PWY-7420', name: "monoacylglycerol metabolism (yeast)", category: 'other', subcategory: 'Unclassified', prevalence: 0.0004111, tier: 'RARE', medianAbundance: 0, meanAbundance: 7.34E-11 },
    { id: 'PWY-6829', name: "tRNA methylation (yeast)", category: 'other', subcategory: 'Unclassified', prevalence: 0.00020555, tier: 'RARE', medianAbundance: 0, meanAbundance: 7.49E-11 },
    { id: 'PWY-5430', name: "meta cleavage pathway of aromatic compounds", category: 'other', subcategory: 'Unclassified', prevalence: 0.00020555, tier: 'RARE', medianAbundance: 0, meanAbundance: 4.36E-10 },
    { id: 'PWY-4202', name: "arsenate detoxification I (glutaredoxin)", category: 'other', subcategory: 'Unclassified', prevalence: 0, tier: 'RARE', medianAbundance: 0, meanAbundance: 0 },
    { id: 'PWY-5741', name: "ethylmalonyl-CoA pathway", category: 'other', subcategory: 'Unclassified', prevalence: 0, tier: 'RARE', medianAbundance: 0, meanAbundance: 0 },
    { id: 'PWY-4061', name: "glutathione-mediated detoxification I", category: 'other', subcategory: 'Unclassified', prevalence: 0, tier: 'RARE', medianAbundance: 0, meanAbundance: 0 },
    { id: 'PWY-7112', name: "4-hydroxy-2-nonenal detoxification", category: 'other', subcategory: 'Unclassified', prevalence: 0, tier: 'RARE', medianAbundance: 0, meanAbundance: 0 },
    { id: 'PWY-7433', name: "mucin core 1 and core 2 O-glycosylation", category: 'other', subcategory: 'Unclassified', prevalence: 0, tier: 'RARE', medianAbundance: 0, meanAbundance: 0 },
    { id: 'PWY-6861', name: "the visual cycle I (vertebrates)", category: 'other', subcategory: 'Unclassified', prevalence: 0, tier: 'RARE', medianAbundance: 0, meanAbundance: 0 },
    { id: 'PWY-7434', name: "terminal O-glycans residues modification", category: 'other', subcategory: 'Unclassified', prevalence: 0, tier: 'RARE', medianAbundance: 0, meanAbundance: 0 },
    { id: 'PWY-6367', name: "D-myo-inositol-5-phosphate metabolism", category: 'other', subcategory: 'Unclassified', prevalence: 0, tier: 'RARE', medianAbundance: 0, meanAbundance: 0 },
    { id: 'PWY-7185', name: "UTP and CTP dephosphorylation I", category: 'other', subcategory: 'Unclassified', prevalence: 0, tier: 'RARE', medianAbundance: 0, meanAbundance: 0 },
    { id: 'PWY-6609', name: "adenine and adenosine salvage III", category: 'salvage', subcategory: 'Salvage/Recycling', prevalence: 0.998561151, tier: 'UNIVERSAL', medianAbundance: 0.000523349, meanAbundance: 0.000524405 },
    { id: 'PWY-6897', name: "thiamin salvage II", category: 'salvage', subcategory: 'Salvage/Recycling', prevalence: 0.998150051, tier: 'UNIVERSAL', medianAbundance: 0.000234917, meanAbundance: 0.00024283 },
    { id: 'PWY-7199', name: "pyrimidine deoxyribonucleosides salvage", category: 'salvage', subcategory: 'Salvage/Recycling', prevalence: 0.997944502, tier: 'UNIVERSAL', medianAbundance: 0.000335261, meanAbundance: 0.00033698 },
    { id: 'PWY-7208', name: "superpathway of pyrimidine nucleobases salvage", category: 'salvage', subcategory: 'Salvage/Recycling', prevalence: 0.997327852, tier: 'UNIVERSAL', medianAbundance: 0.000146888, meanAbundance: 0.000156312 },
    { id: 'COBALSYN-PWY', name: "adenosylcobalamin salvage from cobinamide I", category: 'salvage', subcategory: 'Salvage/Recycling', prevalence: 0.996711202, tier: 'UNIVERSAL', medianAbundance: 0.000157681, meanAbundance: 0.000158831 },
    { id: 'PWY66-409', name: "superpathway of purine nucleotide salvage", category: 'salvage', subcategory: 'Salvage/Recycling', prevalence: 0.955601233, tier: 'VERY_COMMON', medianAbundance: 6.96E-05, meanAbundance: 8.08E-05 },
    { id: 'PWY-7196', name: "superpathway of pyrimidine ribonucleosides salvage", category: 'salvage', subcategory: 'Salvage/Recycling', prevalence: 0.955395683, tier: 'VERY_COMMON', medianAbundance: 6.97E-05, meanAbundance: 6.77E-05 },
    { id: 'NAD-BIOSYNTHESIS-II', name: "NAD salvage pathway II", category: 'salvage', subcategory: 'Salvage/Recycling', prevalence: 0.894552929, tier: 'MODERATE', medianAbundance: 1.45E-05, meanAbundance: 2.28E-05 },
    { id: 'PYRIDNUCSAL-PWY', name: "NAD salvage pathway I", category: 'salvage', subcategory: 'Salvage/Recycling', prevalence: 0.876875642, tier: 'MODERATE', medianAbundance: 3.72E-05, meanAbundance: 5.65E-05 },
    { id: 'PWY-7204', name: "pyridoxal 5\'-phosphate salvage II (plants)", category: 'salvage', subcategory: 'Salvage/Recycling', prevalence: 0.361151079, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 4.26E-06 },
    { id: 'PWY-7094', name: "fatty acid salvage", category: 'salvage', subcategory: 'Salvage/Recycling', prevalence: 0.330113052, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 2.35E-06 },
    { id: 'PWY-7200', name: "superpathway of pyrimidine deoxyribonucleoside salvage", category: 'salvage', subcategory: 'Salvage/Recycling', prevalence: 0.17389517, tier: 'RARE', medianAbundance: 0, meanAbundance: 1.77E-06 },
    { id: 'PWY-7527', name: "L-methionine salvage cycle III", category: 'salvage', subcategory: 'Salvage/Recycling', prevalence: 0.003494347, tier: 'RARE', medianAbundance: 0, meanAbundance: 9.65E-09 },
    { id: 'PWY-7528', name: "L-methionine salvage cycle I (bacteria and plants)", category: 'salvage', subcategory: 'Salvage/Recycling', prevalence: 0.001438849, tier: 'RARE', medianAbundance: 0, meanAbundance: 4.61E-09 },
    { id: 'PWY-6269', name: "adenosylcobalamin salvage from cobinamide II", category: 'salvage', subcategory: 'Salvage/Recycling', prevalence: 0.00061665, tier: 'RARE', medianAbundance: 0, meanAbundance: 7.08E-09 },
    { id: 'PWY-7224', name: "purine deoxyribonucleosides salvage", category: 'salvage', subcategory: 'Salvage/Recycling', prevalence: 0.00061665, tier: 'RARE', medianAbundance: 0, meanAbundance: 1.47E-09 },
    { id: 'PWY-7270', name: "L-methionine salvage cycle II (plants)", category: 'salvage', subcategory: 'Salvage/Recycling', prevalence: 0, tier: 'RARE', medianAbundance: 0, meanAbundance: 0 },
    { id: 'PWY-5304', name: "superpathway of sulfur oxidation (Acidianus ambivalens)", category: 'superpathways', subcategory: 'Superpathways', prevalence: 0.962795478, tier: 'VERY_COMMON', medianAbundance: 2.43E-05, meanAbundance: 3.12E-05 },
    { id: 'PWY0-781', name: "aspartate superpathway", category: 'superpathways', subcategory: 'Superpathways', prevalence: 0.954162384, tier: 'VERY_COMMON', medianAbundance: 5.69E-05, meanAbundance: 6.80E-05 },
    { id: 'PWY-5004', name: "superpathway of L-citrulline metabolism", category: 'superpathways', subcategory: 'Superpathways', prevalence: 0.408427544, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 2.60E-06 },
    { id: 'THREOCAT-PWY', name: "superpathway of L-threonine metabolism", category: 'superpathways', subcategory: 'Superpathways', prevalence: 0.221171634, tier: 'UNCOMMON', medianAbundance: 0, meanAbundance: 2.73E-06 },
    { id: 'PWY-7389', name: "superpathway of anaerobic energy metabolism (invertebrates)", category: 'superpathways', subcategory: 'Superpathways', prevalence: 0.052209661, tier: 'RARE', medianAbundance: 0, meanAbundance: 1.86E-07 },
    { id: 'PWY-7245', name: "superpathway NAD/NADP - NADH/NADPH interconversion (yeast)", category: 'superpathways', subcategory: 'Superpathways', prevalence: 0.045015416, tier: 'RARE', medianAbundance: 0, meanAbundance: 2.60E-07 },
    { id: 'ALL-CHORISMATE-PWY', name: "superpathway of chorismate metabolism", category: 'superpathways', subcategory: 'Superpathways', prevalence: 0.003083248, tier: 'RARE', medianAbundance: 0, meanAbundance: 3.07E-08 },
    { id: 'PWY-5306', name: "superpathway of thiosulfate metabolism (Desulfovibrio sulfodismutans)", category: 'superpathways', subcategory: 'Superpathways', prevalence: 0.000822199, tier: 'RARE', medianAbundance: 0, meanAbundance: 1.84E-09 },
    { id: 'PWY-1882', name: "superpathway of C1 compounds oxidation to CO2", category: 'superpathways', subcategory: 'Superpathways', prevalence: 0.00020555, tier: 'RARE', medianAbundance: 0, meanAbundance: 3.36E-10 },
    { id: 'PWY-6676', name: "superpathway of sulfide oxidation (phototrophic sulfur bacteria)", category: 'superpathways', subcategory: 'Superpathways', prevalence: 0.00020555, tier: 'RARE', medianAbundance: 0, meanAbundance: 1.18E-10 },
];

// ============================================================
// APPLY RATIO MAPS TO PATHWAYS
// ============================================================

const TIER_PRIORITY = {
    UNIVERSAL: 0,
    VERY_COMMON: 1,
    COMMON: 2,
    MODERATE: 3,
    UNCOMMON: 4,
    RARE: 5
};

function applyRatioMaps(pathways) {
    // Group by subcategory
    const bySubcategory = {};
    pathways.forEach(p => {
        // Handle special mapping keys for categories with same subcategory names
        let mapKey = p.subcategory;
        if (p.category === 'biosynthesis' && p.subcategory === 'Other') {
            mapKey = 'Biosynthesis_Other';
        } else if (p.category === 'degradation' && p.subcategory === 'Other') {
            mapKey = 'Degradation_Other';
        } else if (p.category === 'degradation' && p.subcategory === 'Amino Acids') {
            mapKey = 'Degradation_Amino Acids';
        } else if (p.category === 'degradation' && p.subcategory === 'Nucleotides') {
            mapKey = 'Degradation_Nucleotides';
        } else if (p.category === 'degradation' && p.subcategory === 'Aromatics') {
            mapKey = 'Degradation_Aromatics';
        } else if (p.category === 'degradation' && p.subcategory === 'Carbohydrates') {
            mapKey = 'Degradation_Carbohydrates';
        }
        
        p._mapKey = mapKey;
        
        if (!bySubcategory[mapKey]) {
            bySubcategory[mapKey] = [];
        }
        bySubcategory[mapKey].push(p);
    });
    
    // Sort each subcategory by abundance (descending)
        for (const key in bySubcategory) {
            bySubcategory[key].sort((a, b) => {
                // 1️⃣ Tier precedence
                const tierDiff =
                    (TIER_PRIORITY[a.tier] ?? 999) -
                    (TIER_PRIORITY[b.tier] ?? 999);

                if (tierDiff !== 0) return tierDiff;

                // 2️⃣ Abundance within same tier
                const aAbund = a.medianAbundance > 0 ? a.medianAbundance : a.meanAbundance;
                const bAbund = b.medianAbundance > 0 ? b.medianAbundance : b.meanAbundance;

                if (bAbund !== aAbund) return bAbund - aAbund;

                // 3️⃣ Stable fallback (prevents reshuffling)
                return a.id.localeCompare(b.id);
            });
        }
    
    // Apply ratios
    for (const key in bySubcategory) {
        const ratios = RATIO_MAPS[key] || [[1,1]];
        const pathwayList = bySubcategory[key];
        
        pathwayList.forEach((p, index) => {
            const ratio = ratios[index] || ratios[ratios.length - 1];
            p.ratio = ratio;
        });
        
        // Verify mapping
        if (pathwayList.length > ratios.length) {
            console.warn(`${key}: ${pathwayList.length} pathways but only ${ratios.length} ratios (last ratio repeats)`);
        }
    }
    
    return pathways;
}

// ============================================================
// PROCESS AND EXPORT
// ============================================================

const ALL_PATHWAYS = applyRatioMaps([...ALL_PATHWAYS_RAW]);

// Find max abundance for normalization
const maxAbundance = Math.max(...ALL_PATHWAYS.map(p => p.medianAbundance || p.meanAbundance || 0.0001));

// Process pathways
ALL_PATHWAYS.forEach(p => {
    const info = ratioInfo(p.ratio[0], p.ratio[1]);
    p.ratioValue = info.value;
    p.cents = info.cents;
    p.consonance = info.consonance;
    p.primeLimit = info.primeLimit;
    
    const abundance = p.medianAbundance > 0 ? p.medianAbundance : p.meanAbundance;
    p.normalizedAbundance = abundance / maxAbundance;
    p.amplitude = Math.max(0.02, Math.sqrt(p.normalizedAbundance));
    p.abundanceDisplay = formatAbundance(abundance, maxAbundance);
    p.abundanceRaw = abundance;
});

// Get unique subcategories
const SUBCATEGORIES = [...new Set(ALL_PATHWAYS.map(p => p.subcategory))];

// Category metadata
const CATEGORIES = {
    energy: {
        name: 'Energy',
        color: '#22c55e',
        primeRange: '2-5',
        subcategories: ['Glycolysis/Gluconeogenesis', 'Fermentation', 'TCA Cycle', 'Glyoxylate Cycle', 'Pentose Phosphate', 'Respiration', 'Carbon Fixation']
    },
    biosynthesis: {
        name: 'Biosynthesis',
        color: '#3b82f6',
        primeRange: '7-13 harmonics',
        subcategories: ['Amino Acids', 'Nucleotides', 'Cofactors/Vitamins', 'Fatty Acids/Lipids', 'Cell Wall', 'Polyamines', 'Other']
    },
    degradation: {
        name: 'Degradation',
        color: '#ef4444',
        primeRange: '7-13 subharmonics',
        subcategories: ['Amino Acids', 'Nucleotides', 'Aromatics', 'Carbohydrates', 'Other']
    },
    salvage: {
        name: 'Salvage',
        color: '#eab308',
        primeRange: '2-5 subharmonics',
        subcategories: ['Salvage/Recycling']
    },
    other: {
        name: 'Other',
        color: '#6b7280',
        primeRange: '17+',
        subcategories: ['Unclassified']
    },
    superpathways: {
        name: 'Superpathways',
        color: '#8b5cf6',
        primeRange: 'mixed',
        subcategories: ['Superpathways']
    }
};

// Export
window.PATHWAY_DATA = {
    ALL_PATHWAYS,
    CATEGORIES,
    SUBCATEGORIES,
    RATIO_MAPS,
    maxAbundance,
    ratioInfo,
    formatAbundance
};

// ============================================================
// STARTUP LOG
// ============================================================

console.log('═══════════════════════════════════════════════════════════════');
console.log('METABOLIC HARMONY - Pathway Data Loaded');
console.log('═══════════════════════════════════════════════════════════════');
console.log(`Total pathways: ${ALL_PATHWAYS.length}`);
console.log('');
console.log('BY CATEGORY:');
const catCounts = {};
ALL_PATHWAYS.forEach(p => {
    catCounts[p.category] = (catCounts[p.category] || 0) + 1;
});
for (const cat in catCounts) {
    console.log(`  ${cat}: ${catCounts[cat]}`);
}
console.log('═══════════════════════════════════════════════════════════════');