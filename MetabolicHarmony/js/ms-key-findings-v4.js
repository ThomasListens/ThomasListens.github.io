/**
 * MS Key Findings v4 - Refined Presentation
 * 
 * Source: PMC12471209 - "Metabolomics in Multiple Sclerosis" (2025)
 * Smusz et al., Int J Mol Sci. 2025;26(18):9207
 * 
 * Changes from v3:
 * - No emojis or symbols
 * - Lead with scientific conclusion, not flavor
 * - Primary pathway ID for each finding (for auto-focus)
 * - Alternating highlight for multi-pathway findings
 * - Direct quotes condensed for impact
 */

const MS_KEY_FINDINGS = {
    
    // ════════════════════════════════════════════════════════════════════════
    // KYNURENINE PATHWAY
    // ════════════════════════════════════════════════════════════════════════
    kynurenine: {
        id: 'kynurenine',
        title: 'Kynurenine Pathway',
        subtitle: 'Neurotoxic Imbalance',
        color: '#8b5cf6',
        
        // Primary pathway for auto-focus and pathway ID display
        primaryPathway: 'PWY-6309',
        
        // Quote - lead with the conclusion
        quote: {
            text: "The kynurenine pathway is the primary route of tryptophan catabolism, generating metabolites with immunomodulatory and neuroactive properties. The shift toward quinolinic acid (neurotoxic) over kynurenic acid (neuroprotective) may contribute to neurodegeneration.",
            section: "3.1 The Kynurenine Pathway",
        },
        
        metaboliteData: [
            { name: 'Kynurenic acid (KYNA)', direction: 'down', fold: '1.2x', pValue: '<0.05', note: 'neuroprotective' },
            { name: '3-Hydroxykynurenine', direction: 'down', fold: '1.5x', pValue: '<0.05', note: '' },
            { name: 'Anthranilic acid', direction: 'up', fold: '3.1x', pValue: '<0.0001', note: '' },
            { name: 'QUIN/KYNA ratio', direction: 'up', fold: '1.27x', pValue: '<0.05', note: 'neurotoxic shift' },
            { name: 'Tryptophan', direction: 'up', fold: '3.3x', pValue: '<0.001', note: 'upstream blockade' },
        ],
        
        inference: {
            logic: "When tryptophan accumulates while downstream metabolites are depleted, this indicates impaired degradation through the kynurenine pathway. The elevated QUIN/KYNA ratio reflects a shift toward neurotoxic products.",
            limitation: "This pathway operates primarily in host tissue. Gut bacteria influence tryptophan availability and produce competing indole metabolites.",
        },
        
        clinicalNote: "The neurotoxic shift correlates with brain atrophy and choroid plexus volume changes, suggesting direct contribution to neurodegeneration.",
        
        pathways: {
            primary: [
                { id: 'PWY-6309', name: 'L-tryptophan degradation XI (mammalian, via kynurenine)' },
            ],
            related: [
                { id: 'TRPSYN-PWY', name: 'L-tryptophan biosynthesis' },
            ],
        },
        
        citation: {
            authors: 'Staats Pires 2025',
            table: 'Table 2',
        },
    },
    
    // ════════════════════════════════════════════════════════════════════════
    // AMINO ACID METABOLISM
    // ════════════════════════════════════════════════════════════════════════
    aminoAcids: {
        id: 'aminoAcids',
        title: 'Amino Acid Depletion',
        subtitle: 'Reduced Microbial Biosynthesis',
        color: '#3b82f6',
        
        primaryPathway: 'HISTSYN-PWY',
        
        quote: {
            text: "Multiple studies have consistently reported decreased serum levels of several proteinogenic amino acids, including lysine, glycine, threonine, tyrosine, cysteine, serine, and glutamate. These amino acid disturbances appear to be functionally linked with disease activity and neurodegeneration.",
            section: "3.4.1 Amino Acid Disturbances",
        },
        
        metaboliteData: [
            { name: 'Lysine', direction: 'down', fold: '0.48x', pValue: '<10^-19', note: 'strongly depleted' },
            { name: 'Histidine', direction: 'down', fold: '-', pValue: '0.006', note: 'correlates with EDSS' },
            { name: 'Isoleucine', direction: 'down', fold: '-', pValue: '<0.001', note: 'BCAA' },
            { name: 'Threonine', direction: 'down', fold: '0.38x', pValue: '<10^-15', note: '' },
            { name: 'Glycine', direction: 'down', fold: '0.45x', pValue: '<10^-14', note: '' },
        ],
        
        inference: {
            logic: "Serum amino acid depletion may reflect reduced production by gut bacteria. The microbial biosynthesis pathways that normally synthesize these amino acids appear less active in MS patients.",
            limitation: "Cross-kingdom inference: human serum metabolites mapped to microbial gut pathways. Depletion could also reflect increased host consumption during inflammation.",
        },
        
        clinicalNote: "Histidine levels correlate negatively with EDSS disability scores at 1 and 2 years, suggesting these changes track disease severity.",
        
        pathways: {
            primary: [
                { id: 'HISTSYN-PWY', name: 'L-histidine biosynthesis' },
                { id: 'ILEUSYN-PWY', name: 'L-isoleucine biosynthesis' },
                { id: 'DAPLYSINESYN-PWY', name: 'L-lysine biosynthesis' },
            ],
            related: [
                { id: 'BRANCHED-CHAIN-AA-SYN-PWY', name: 'Branched-chain amino acid biosynthesis' },
                { id: 'VALSYN-PWY', name: 'L-valine biosynthesis' },
            ],
        },
        
        citation: {
            authors: 'Alwahsh 2024, Zido 2023',
            table: 'Table 2',
        },
    },
    
    // ════════════════════════════════════════════════════════════════════════
    // ENERGY METABOLISM
    // ════════════════════════════════════════════════════════════════════════
    energy: {
        id: 'energy',
        title: 'Energy Metabolism',
        subtitle: 'Mitochondrial Dysfunction',
        color: '#22c55e',
        
        primaryPathway: 'TCA',
        
        quote: {
            text: "Consistent alterations in central carbon metabolism have been reported, including disruptions in glycolysis, mitochondrial function, and the utilization of alternative energy substrates. These data outline a metabolic transition from glycolysis-driven immune activation in early stages to ketone body utilization and mitochondrial exhaustion in progression.",
            section: "3.2 Energy Metabolism",
        },
        
        metaboliteData: [
            { name: 'Succinate', direction: 'up', fold: '1.58x', pValue: '<10^-5', note: 'TCA intermediate' },
            { name: 'ATP', direction: 'up', fold: '1.98x', pValue: '<10^-4', note: '' },
            { name: 'Lactate', direction: 'up', fold: '-', pValue: '<0.05', note: 'anaerobic shift' },
            { name: 'Beta-hydroxybutyrate', direction: 'up', fold: '1.43x', pValue: '0.005', note: 'ketone (PMS)' },
            { name: 'Creatine', direction: 'down', fold: '0.46x', pValue: '<10^-5', note: 'energy buffer' },
        ],
        
        inference: {
            logic: "Elevated glucose with altered TCA intermediates suggests metabolic blockades. Increased succinate and lactate indicate a shift toward anaerobic metabolism, affecting both host and bacterial pathways.",
            limitation: "TCA and glycolysis are universal pathways present in both bacteria and host. The gut microbiome contribution is one component of systemic dysfunction.",
        },
        
        clinicalNote: "Ketone bodies are elevated specifically in progressive MS and correlate with EDSS and MSSS disability scores.",
        
        pathways: {
            primary: [
                { id: 'TCA', name: 'TCA cycle I (prokaryotic)' },
                { id: 'GLYCOLYSIS', name: 'Glycolysis I' },
            ],
            related: [
                { id: 'GLYOXYLATE-BYPASS', name: 'Glyoxylate bypass' },
                { id: 'TCA-GLYOX-BYPASS', name: 'TCA/glyoxylate superpathway' },
                { id: 'PWY-5690', name: 'TCA cycle II' },
            ],
        },
        
        citation: {
            authors: 'Alwahsh 2024, Wicks 2025',
            table: 'Table 2',
        },
    },
    
    // ════════════════════════════════════════════════════════════════════════
    // LIPID METABOLISM
    // ════════════════════════════════════════════════════════════════════════
    lipids: {
        id: 'lipids',
        title: 'Lipid Remodeling',
        subtitle: 'Membrane and Signaling Disruption',
        color: '#ec4899',
        
        primaryPathway: 'FAO-PWY',
        
        quote: {
            text: "Dysregulation of lipid metabolism has emerged as a central feature of MS pathophysiology, influencing immune signaling, neuroinflammation, membrane integrity, mitochondrial function, and gut-brain communication. In brain tissue, lesion cores were enriched in ceramides and sphingomyelins, whereas lysophospholipids and endocannabinoids were depleted.",
            section: "3.3 Lipid Metabolism",
        },
        
        metaboliteData: [
            { name: 'Sphingomyelin', direction: 'up', fold: '-', pValue: '<10^-8', note: 'lesion cores' },
            { name: 'Ceramides', direction: 'up', fold: '-', pValue: '<10^-8', note: 'lesion cores' },
            { name: 'Sphingosine-1-phosphate', direction: 'down', fold: '-', pValue: '<0.001', note: 'signaling' },
            { name: 'Spermidine', direction: 'up', fold: '-', pValue: '<0.05', note: 'immune proliferation' },
            { name: 'Choline', direction: 'down', fold: '0.50x', pValue: '<10^-11', note: 'membrane' },
        ],
        
        inference: {
            logic: "Elevated sphingomyelin and ceramides in lesions may reflect myelin breakdown releasing membrane components. Reduced sphingosine-1-phosphate disrupts immunomodulatory signaling.",
            limitation: "Most sphingolipid changes occur in host tissue. Gut microbial contribution is indirect through polyamine metabolism and membrane lipid precursors.",
        },
        
        clinicalNote: "Sphingosine-1-phosphate is the target of fingolimod therapy. Its depletion in MS may explain why S1P receptor modulators are therapeutically effective.",
        
        pathways: {
            primary: [
                { id: 'POLYAMSYN-PWY', name: 'Polyamine biosynthesis' },
                { id: 'FAO-PWY', name: 'Fatty acid beta-oxidation' },
            ],
            related: [
                { id: 'PWY-6467', name: 'Kdo transfer to lipid IVA' },
            ],
        },
        
        citation: {
            authors: 'Ladakis 2024, Yang 2021',
            table: 'Table 2',
        },
    },
    
    // ════════════════════════════════════════════════════════════════════════
    // FERMENTATION / SCFAs
    // ════════════════════════════════════════════════════════════════════════
    fermentation: {
        id: 'fermentation',
        title: 'SCFA Depletion',
        subtitle: 'Gut-Brain Axis Disruption',
        color: '#06b6d4',
        
        primaryPathway: 'CENTFERM-PWY',
        
        quote: {
            text: "Short-chain fatty acids, particularly propionate and acetate, were consistently reduced in serum and feces. Propionic acid supplementation (1000 mg/day) restored regulatory T cell function, reduced Th1/Th17 responses, stabilized EDSS, and lowered relapse rates.",
            section: "3.3.5 Short-Chain Fatty Acids",
        },
        
        metaboliteData: [
            { name: 'Propionic acid', direction: 'down', fold: '-', pValue: '0.0016', note: 'therapeutic target' },
            { name: 'Acetate', direction: 'down', fold: '-', pValue: '0.021', note: 'serum and feces' },
            { name: 'Acetate/Butyrate ratio', direction: 'down', fold: '-', pValue: '0.005', note: '' },
            { name: 'Phenyllactate', direction: 'down', fold: '-', pValue: '<10^-19', note: 'aromatic AA fermentation' },
            { name: 'Indolelactate', direction: 'down', fold: '-', pValue: '<10^-15', note: 'microbial indoles' },
        ],
        
        inference: {
            logic: "This is the clearest gut microbiome to disease link. Reduced SCFAs directly indicate decreased bacterial fermentation. These metabolites are produced exclusively by gut bacteria, so their depletion unambiguously reflects dysbiosis.",
            limitation: "Minimal. This is direct measurement of microbial products. The therapeutic effect of propionic acid supplementation provides causal evidence.",
        },
        
        clinicalNote: "Propionic acid supplementation is being investigated as adjunct therapy. Clinical studies show 1000mg/day can restore regulatory T cell function and stabilize disability scores.",
        
        pathways: {
            primary: [
                { id: 'CENTFERM-PWY', name: 'Pyruvate fermentation to propanoate I' },
                { id: 'PWY-6590', name: 'Superpathway of Clostridium acetobutylicum fermentation' },
            ],
            related: [],
        },
        
        citation: {
            authors: 'Duscha 2020, Fitzgerald 2021',
            table: 'Table 2',
        },
    },
};


// ════════════════════════════════════════════════════════════════════════════
// VISUAL EMPHASIS HELPERS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Get all pathway IDs for a finding (for visual highlighting)
 */
function getPathwayIds(findingId) {
    const finding = MS_KEY_FINDINGS[findingId];
    if (!finding) return [];
    
    const ids = [];
    for (const p of (finding.pathways.primary || [])) {
        ids.push(p.id);
    }
    for (const p of (finding.pathways.related || [])) {
        ids.push(p.id);
    }
    return ids;
}

/**
 * Get primary pathway ID (for pathway ID display and auto-focus)
 */
function getPrimaryPathway(findingId) {
    const finding = MS_KEY_FINDINGS[findingId];
    return finding?.primaryPathway || finding?.pathways?.primary?.[0]?.id || null;
}

/**
 * Get alternating highlight index for multi-pathway findings
 * Used to create visual rhythm when multiple pathways need attention
 */
function getAlternatingPathwayIndex(findingId, time) {
    const finding = MS_KEY_FINDINGS[findingId];
    if (!finding) return 0;
    
    const allPathways = getPathwayIds(findingId);
    if (allPathways.length <= 1) return 0;
    
    // Alternate every 1.5 seconds
    const cycleTime = 1500;
    const index = Math.floor(time / cycleTime) % allPathways.length;
    return index;
}

/**
 * Check if pathway should be emphasized right now (for alternating highlight)
 */
function isPathwayCurrentlyEmphasized(pathwayId, findingId, time) {
    const finding = MS_KEY_FINDINGS[findingId];
    if (!finding) return false;
    
    const allPathways = getPathwayIds(findingId);
    if (allPathways.length <= 1) {
        return allPathways.includes(pathwayId);
    }
    
    // For multi-pathway findings, alternate emphasis
    const currentIndex = getAlternatingPathwayIndex(findingId, time);
    return allPathways[currentIndex] === pathwayId;
}

/**
 * Generate direction arrow (no emoji)
 */
function directionSymbol(dir) {
    if (dir === 'up') return '+';
    if (dir === 'down') return '-';
    return '';
}

// Export
window.MS_KEY_FINDINGS = MS_KEY_FINDINGS;
window.getPathwayIds = getPathwayIds;
window.getPrimaryPathway = getPrimaryPathway;
window.getAlternatingPathwayIndex = getAlternatingPathwayIndex;
window.isPathwayCurrentlyEmphasized = isPathwayCurrentlyEmphasized;

console.log('MS Key Findings v4 loaded');
