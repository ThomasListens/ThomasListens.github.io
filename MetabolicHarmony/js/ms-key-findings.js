/**
 * MS Key Findings - Metabolite-to-Pathway Inference
 * 
 * Based on PMC12471209: "Metabolomic Alterations in Multiple Sclerosis" (2025)
 * 
 * METHODOLOGY:
 * We infer pathway-level effects from metabolite changes reported in recent research.
 * When a metabolite is elevated/depleted in MS patients, we identify MetaCyc pathways
 * that produce or consume that metabolite. This is hypothesis-generating, not confirmatory.
 * 
 * The pathway mappings use MS_PATHWAY_EFFECTS_2025 which was derived from:
 * 1. 81 metabolites with consensus directions from the meta-analysis
 * 2. Keyword matching to MetaCyc pathway names
 * 3. Manual curation for key pathways
 */

const MS_KEY_FINDINGS = {
    
    // ════════════════════════════════════════════════════════════════════════
    // KYNURENINE PATHWAY - The star finding, gets special treatment
    // ════════════════════════════════════════════════════════════════════════
    kynurenine: {
        id: 'kynurenine',
        title: 'Kynurenine Pathway',
        subtitle: 'Tryptophan degradation dysregulation',
        icon: '🧬',
        color: '#8b5cf6',  // Purple
        
        // Pathways to highlight (from MS_PATHWAY_EFFECTS_2025)
        pathways: {
            primary: ['PWY-6309'],  // L-tryptophan degradation XI (mammalian, via kynurenine)
            related: ['TRPSYN-PWY', 'PWY-6629'],  // Tryptophan biosynthesis pathways
        },
        
        direction: 'depleted',  // Downstream products depleted
        
        summary: `The kynurenine pathway (KP) is the primary route of tryptophan catabolism, 
generating metabolites with immunomodulatory and neuroactive properties. In MS, 
neuroprotective metabolites are depleted while neurotoxic ratios increase.`,
        
        keyFindings: [
            { text: 'KYNA decreased', value: '↓1.2-fold', note: 'neuroprotective' },
            { text: '3HK decreased', value: '↓1.5-fold', note: '' },
            { text: 'Anthranilic acid elevated', value: '↑3.1-fold', note: '' },
            { text: 'QUIN/KYNA ratio elevated', value: '↑', note: 'neurotoxic shift' },
            { text: 'Tryptophan accumulated', value: '↑3.3-fold in RRMS', note: 'upstream blockade' },
        ],
        
        interpretation: `Tryptophan accumulates because downstream degradation is impaired. 
The shift toward quinolinic acid (neurotoxic) over kynurenic acid (neuroprotective) 
may contribute to neurodegeneration in MS.`,
        
        citation: {
            section: '§3.1',
            title: 'The Kynurenine Pathway',
            source: 'PMC12471209',
            year: 2025,
        },
    },
    
    // ════════════════════════════════════════════════════════════════════════
    // AMINO ACID BIOSYNTHESIS
    // ════════════════════════════════════════════════════════════════════════
    aminoAcids: {
        id: 'aminoAcids',
        title: 'Amino Acid Biosynthesis',
        subtitle: 'Widespread depletion of proteinogenic amino acids',
        icon: '🔗',
        color: '#22c55e',  // Green (biosynthesis)
        
        pathways: {
            primary: [
                'SER-GLYSYN-PWY',    // Serine-glycine biosynthesis
                'HISTSYN-PWY',       // Histidine biosynthesis
                'ILEUSYN-PWY',       // Isoleucine biosynthesis
                'THRESYN-PWY',       // Threonine biosynthesis
                'DAPLYSINESYN-PWY',  // Lysine biosynthesis
            ],
            related: [
                'BRANCHED-CHAIN-AA-SYN-PWY',
                'PWY-6630',  // Tyrosine biosynthesis
                'PWY-6628',  // Phenylalanine biosynthesis
            ],
        },
        
        direction: 'depleted',
        
        summary: `Multiple proteinogenic amino acids are depleted in MS patients, 
suggesting impaired biosynthetic capacity or increased consumption during inflammation.`,
        
        keyFindings: [
            { text: 'Serine decreased', value: '↓', note: 'one-carbon metabolism' },
            { text: 'Glycine decreased', value: '↓', note: '' },
            { text: 'Threonine decreased', value: '↓', note: '' },
            { text: 'Tyrosine decreased', value: '↓', note: 'dopamine precursor' },
            { text: 'Lysine decreased', value: '↓', note: '' },
            { text: 'Histidine decreased', value: '↓', note: 'correlates with EDSS' },
            { text: 'Glutamate decreased', value: '↓', note: 'despite excitotoxicity concerns' },
        ],
        
        interpretation: `The widespread amino acid depletion may reflect:
1) Increased demand during immune activation
2) Impaired gut absorption
3) Altered microbial amino acid production
Histidine levels correlate negatively with disability scores.`,
        
        citation: {
            section: '§3.4.1',
            title: 'Amino Acid Disturbances and Disease Phenotype',
            source: 'PMC12471209',
            year: 2025,
        },
    },
    
    // ════════════════════════════════════════════════════════════════════════
    // ENERGY METABOLISM
    // ════════════════════════════════════════════════════════════════════════
    energy: {
        id: 'energy',
        title: 'Energy Metabolism',
        subtitle: 'Glycolysis and TCA cycle impairment',
        icon: '⚡',
        color: '#f59e0b',  // Amber (energy)
        
        pathways: {
            primary: [
                'TCA',              // TCA cycle
                'GLYCOLYSIS',       // Glycolysis
                'PWY-5484',         // Glycolysis II
                'GLYOXYLATE-BYPASS', // Glyoxylate bypass
            ],
            related: [
                'TCA-GLYOX-BYPASS',
                'ANAGLYCOLYSIS-PWY',
                'PWY-5464',
            ],
        },
        
        direction: 'depleted',
        
        summary: `Central carbon metabolism shows complex alterations in MS. Despite elevated 
glucose, glycolytic and TCA cycle activity appears reduced, suggesting metabolic blockades 
or mitochondrial dysfunction.`,
        
        keyFindings: [
            { text: 'Glucose elevated', value: '↑', note: 'correlates with inflammation' },
            { text: 'Succinate findings', value: 'mixed', note: '↑ in some, ↓ in progressive' },
            { text: 'Lactate elevated in PPMS', value: '↑', note: 'anaerobic shift' },
            { text: 'Creatine decreased', value: '↓', note: 'energy buffer depleted' },
            { text: 'Ketone bodies elevated', value: '↑ BHB, AcAc', note: 'progressive MS only' },
        ],
        
        interpretation: `The pattern suggests a "stuck engine" - glucose is available but not 
efficiently processed through normal pathways. Progressive MS shows increased reliance on 
ketone bodies, indicating lipid-derived energy compensation.`,
        
        citation: {
            section: '§3.2',
            title: 'Energy Metabolism',
            source: 'PMC12471209',
            year: 2025,
        },
    },
    
    // ════════════════════════════════════════════════════════════════════════
    // LIPID METABOLISM
    // ════════════════════════════════════════════════════════════════════════
    lipids: {
        id: 'lipids',
        title: 'Lipid Remodeling',
        subtitle: 'Sphingolipids, fatty acids, and membrane changes',
        icon: '🔬',
        color: '#ec4899',  // Pink (lipids)
        
        pathways: {
            primary: [
                'SPHINGOLIPID-SYN-PWY',  // Sphingolipid biosynthesis
                'FASYN-INITIAL-PWY',     // Fatty acid biosynthesis initiation
                'FASYN-ELONG-PWY',       // Fatty acid elongation
                'FAO-PWY',               // Fatty acid oxidation
            ],
            related: [
                'PWY-6467',      // Ceramide biosynthesis
                'POLYAMSYN-PWY', // Polyamine (linked to lipid signaling)
                'NAGLIPASYN-PWY',
            ],
        },
        
        direction: 'elevated',
        
        summary: `Lipid metabolism shows extensive remodeling in MS, with elevated sphingolipids 
(likely from myelin breakdown), increased fatty acid synthesis, and altered membrane composition.`,
        
        keyFindings: [
            { text: 'Sphingomyelin elevated', value: '↑', note: 'myelin component' },
            { text: 'Ceramides elevated', value: '↑', note: 'in lesion cores' },
            { text: 'S1P decreased', value: '↓', note: 'signaling disrupted' },
            { text: 'Palmitate, oleate elevated', value: '↑', note: 'FA synthesis' },
            { text: 'Arachidonic acid elevated', value: '↑', note: 'proinflammatory' },
            { text: 'Spermidine elevated', value: '↑', note: 'polyamine pathway' },
        ],
        
        interpretation: `Elevated serum sphingolipids may reflect myelin breakdown releasing 
membrane components. The increase in spermidine suggests immune cell proliferation and 
sustained inflammation. S1P depletion disrupts immunomodulatory signaling.`,
        
        citation: {
            section: '§3.3',
            title: 'Lipid Metabolism',
            source: 'PMC12471209',
            year: 2025,
        },
    },
    
    // ════════════════════════════════════════════════════════════════════════
    // FERMENTATION / SCFA
    // ════════════════════════════════════════════════════════════════════════
    fermentation: {
        id: 'fermentation',
        title: 'Fermentation & SCFAs',
        subtitle: 'Gut microbial metabolite production',
        icon: '🦠',
        color: '#06b6d4',  // Cyan (gut/microbe)
        
        pathways: {
            primary: [
                'PROPFERM-PWY',     // Propionate fermentation
                'CENTFERM-PWY',     // Central fermentation
                'FERMENTATION-PWY', // Mixed acid fermentation
                'PWY-6590',         // Acetate fermentation
            ],
            related: [
                'ANAEROFRUCAT-PWY',
                'P461-PWY',
                'PWY4LZ-257',
            ],
        },
        
        direction: 'depleted',
        
        summary: `Short-chain fatty acid (SCFA) production by gut bacteria is reduced in MS. 
These metabolites are critical for immune regulation and gut-brain communication.`,
        
        keyFindings: [
            { text: 'Acetate decreased', value: '↓', note: 'serum and feces' },
            { text: 'Propionate decreased', value: '↓', note: 'Treg support reduced' },
            { text: 'Butyrate-related pathways', value: '↓', note: '' },
            { text: 'PA supplementation beneficial', value: '1000mg/day', note: 'restored Treg function' },
            { text: 'Phenyllactate decreased', value: '↓', note: 'aromatic AA fermentation' },
        ],
        
        interpretation: `Reduced SCFA production indicates dysbiosis - a loss of beneficial 
microbial functions. Propionic acid supplementation has shown therapeutic promise, 
restoring Treg function and stabilizing disease progression.`,
        
        citation: {
            section: '§3.3.5',
            title: 'Short-Chain Fatty Acids and Gut–Brain Crosstalk',
            source: 'PMC12471209',
            year: 2025,
        },
    },
};

// ════════════════════════════════════════════════════════════════════════════
// Helper: Get all pathways for a finding
// ════════════════════════════════════════════════════════════════════════════
function getKeyFindingPathways(findingId) {
    const finding = MS_KEY_FINDINGS[findingId];
    if (!finding) return [];
    return [
        ...(finding.pathways.primary || []),
        ...(finding.pathways.related || []),
    ];
}

// ════════════════════════════════════════════════════════════════════════════
// Helper: Check if a pathway is in any key finding
// ════════════════════════════════════════════════════════════════════════════
function getPathwayKeyFindings(pathwayId) {
    const findings = [];
    for (const [id, finding] of Object.entries(MS_KEY_FINDINGS)) {
        const allPathways = getKeyFindingPathways(id);
        if (allPathways.includes(pathwayId)) {
            findings.push({
                id,
                title: finding.title,
                isPrimary: finding.pathways.primary?.includes(pathwayId),
            });
        }
    }
    return findings;
}

// ════════════════════════════════════════════════════════════════════════════
// Export for use in visualization
// ════════════════════════════════════════════════════════════════════════════
if (typeof window !== 'undefined') {
    window.MS_KEY_FINDINGS = MS_KEY_FINDINGS;
    window.getKeyFindingPathways = getKeyFindingPathways;
    window.getPathwayKeyFindings = getPathwayKeyFindings;
}
