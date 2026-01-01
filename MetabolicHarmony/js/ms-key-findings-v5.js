/**
 * MS Key Findings v5 - Consolidated to Strongest Points
 * 
 * Source: PMC12471209 - "Metabolomics in Multiple Sclerosis" (2025)
 * Smusz et al., Int J Mol Sci. 2025;26(18):9207
 * 
 * Consolidated from 5 findings to 3 strongest:
 * 1. SCFA Depletion - Direct microbiome evidence, therapeutic intervention worked
 * 2. Kynurenine Pathway - Neurotoxic shift, dramatic clinical correlation
 * 3. Energy Metabolism - TCA/glycolysis disruption, ketone body shift
 * 
 * Removed:
 * - Lipids (mostly host tissue, indirect gut connection)
 * - Amino Acids (overlaps with nitrogen metabolism, weaker signal)
 */

const MS_KEY_FINDINGS = {
    
    // ════════════════════════════════════════════════════════════════════════
    // SCFA DEPLETION - Our Strongest Finding
    // Direct microbiome evidence with therapeutic proof
    // ════════════════════════════════════════════════════════════════════════
    fermentation: {
        id: 'fermentation',
        title: 'Short-Chain Fatty Acid Depletion',
        subtitle: 'Direct Gut-Brain Evidence',
        color: '#06b6d4',
        
        primaryPathway: 'CENTFERM-PWY',
        
        quote: {
            text: "Short-chain fatty acids, particularly propionate and acetate, were consistently reduced in serum and feces. Propionic acid supplementation restored regulatory T cell function, reduced Th1/Th17 responses, stabilized EDSS, and lowered relapse rates. This represents the clearest gut microbiome to disease link.",
            section: "3.3.5 Short-Chain Fatty Acids",
        },
        
        metaboliteData: [
            { name: 'Propionic acid', direction: 'down', fold: '-', pValue: '0.0016', note: 'therapeutic target' },
            { name: 'Acetate', direction: 'down', fold: '-', pValue: '0.021', note: 'serum and feces' },
            { name: 'Phenyllactate', direction: 'down', fold: '-', pValue: '<10^-19', note: 'aromatic fermentation' },
            { name: 'Indolelactate', direction: 'down', fold: '-', pValue: '<10^-15', note: 'microbial indoles' },
        ],
        
        inference: {
            logic: "Reduced SCFAs directly indicate decreased bacterial fermentation. These metabolites are produced exclusively by gut bacteria, so their depletion unambiguously reflects dysbiosis. The therapeutic effect of propionic acid supplementation provides causal evidence for the gut-brain connection in MS.",
            limitation: "This is direct measurement of microbial products with minimal inference required.",
        },
        
        clinicalNote: "Propionic acid supplementation (1000mg/day) is being investigated as adjunct therapy. Clinical studies show restored T-cell regulation and stabilized disability scores.",
        
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
    
    // ════════════════════════════════════════════════════════════════════════
    // KYNURENINE PATHWAY - Neurotoxic Shift
    // ════════════════════════════════════════════════════════════════════════
    kynurenine: {
        id: 'kynurenine',
        title: 'Kynurenine Pathway',
        subtitle: 'Neurotoxic Imbalance',
        color: '#8b5cf6',
        
        primaryPathway: 'PWY-6309',
        
        quote: {
            text: "The kynurenine pathway is the primary route of tryptophan catabolism, generating metabolites with immunomodulatory and neuroactive properties. The shift toward quinolinic acid (neurotoxic) over kynurenic acid (neuroprotective) may contribute to neurodegeneration. These alterations correlate with brain atrophy and choroid plexus volume.",
            section: "3.1 The Kynurenine Pathway",
        },
        
        metaboliteData: [
            { name: 'Kynurenic acid', direction: 'down', fold: '1.2x', pValue: '<0.05', note: 'neuroprotective' },
            { name: '3-Hydroxykynurenine', direction: 'down', fold: '1.5x', pValue: '<0.05', note: '' },
            { name: 'Anthranilic acid', direction: 'up', fold: '3.1x', pValue: '<0.0001', note: '' },
            { name: 'QUIN/KYNA ratio', direction: 'up', fold: '1.27x', pValue: '<0.05', note: 'neurotoxic shift' },
            { name: 'Tryptophan', direction: 'up', fold: '3.3x', pValue: '<0.001', note: 'upstream accumulation' },
        ],
        
        inference: {
            logic: "When tryptophan accumulates while downstream metabolites are depleted, this indicates impaired degradation through the kynurenine pathway. Gut bacteria influence tryptophan availability and produce competing indole metabolites that may be protective.",
            limitation: "This pathway operates primarily in host tissue. The gut microbiome connection is through tryptophan competition and indole production.",
        },
        
        clinicalNote: "The neurotoxic shift in kynurenine metabolites correlates directly with brain atrophy measurements, suggesting a mechanistic link to neurodegeneration.",
        
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
    // ENERGY METABOLISM - Mitochondrial Dysfunction
    // ════════════════════════════════════════════════════════════════════════
    energy: {
        id: 'energy',
        title: 'Energy Metabolism',
        subtitle: 'Mitochondrial Dysfunction',
        color: '#22c55e',
        
        primaryPathway: 'TCA',
        
        quote: {
            text: "These data outline a metabolic transition from glycolysis-driven immune activation in early stages to ketone body utilization and mitochondrial exhaustion in progression. Increased circulating levels of 3-hydroxyisobutyrate, 3-aminoisobutyrate, and glycerol suggest enhanced short-chain fatty acid catabolism as an alternative energy source.",
            section: "3.2 Energy Metabolism",
        },
        
        metaboliteData: [
            { name: 'Succinate', direction: 'up', fold: '1.58x', pValue: '<10^-5', note: 'TCA intermediate' },
            { name: 'ATP', direction: 'up', fold: '1.98x', pValue: '<10^-4', note: '' },
            { name: 'Lactate', direction: 'up', fold: '-', pValue: '<0.05', note: 'anaerobic shift' },
            { name: 'Beta-hydroxybutyrate', direction: 'up', fold: '1.43x', pValue: '0.005', note: 'ketone (progressive MS)' },
            { name: 'Creatine', direction: 'down', fold: '0.46x', pValue: '<10^-5', note: 'energy buffer depleted' },
        ],
        
        inference: {
            logic: "Elevated glucose with altered TCA intermediates suggests metabolic blockades. The shift toward anaerobic metabolism and ketone body utilization reflects mitochondrial stress affecting both host cells and gut bacteria.",
            limitation: "TCA and glycolysis are universal pathways present in both bacteria and host. Changes reflect systemic metabolic reprogramming.",
        },
        
        clinicalNote: "Ketone bodies are elevated specifically in progressive MS and correlate with EDSS and MSSS disability scores, marking metabolic exhaustion in advanced disease.",
        
        pathways: {
            primary: [
                { id: 'TCA', name: 'TCA cycle I (prokaryotic)' },
                { id: 'GLYCOLYSIS', name: 'Glycolysis I' },
            ],
            related: [
                { id: 'GLYOXYLATE-BYPASS', name: 'Glyoxylate bypass' },
                { id: 'TCA-GLYOX-BYPASS', name: 'TCA/glyoxylate superpathway' },
            ],
        },
        
        citation: {
            authors: 'Alwahsh 2024, Wicks 2025, Keller 2021',
            table: 'Table 2',
        },
    },
};


// ════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Get all pathway IDs for a finding
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
 * Get primary pathway ID
 */
function getPrimaryPathway(findingId) {
    const finding = MS_KEY_FINDINGS[findingId];
    return finding?.primaryPathway || finding?.pathways?.primary?.[0]?.id || null;
}

// Export
window.MS_KEY_FINDINGS = MS_KEY_FINDINGS;
window.getPathwayIds = getPathwayIds;
window.getPrimaryPathway = getPrimaryPathway;

console.log('MS Key Findings v5 loaded - 3 strongest findings');
