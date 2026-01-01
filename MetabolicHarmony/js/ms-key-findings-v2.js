/**
 * MS Key Findings - Metabolite-to-Pathway Inference (v2 - Fixed)
 * 
 * FIXED: Only includes pathways that exist in MS_COMPARISON_DATA
 * FIXED: Colors now match CONFIG.colors categories
 */

const MS_KEY_FINDINGS = {
    
    // ════════════════════════════════════════════════════════════════════════
    // KYNURENINE PATHWAY - Neurotoxicity focus
    // ════════════════════════════════════════════════════════════════════════
    kynurenine: {
        id: 'kynurenine',
        title: 'Kynurenine Pathway',
        subtitle: '↓ Depleted',
        color: '#8b5cf6',  // Purple - special (neurotoxicity)
        
        pathways: {
            primary: [
                { id: 'PWY-6309', direction: 'dysregulated', organism: 'host', 
                  note: 'L-tryptophan degradation XI (mammalian, via kynurenine)' },
            ],
            related: [],
        },
        
        summary: `The kynurenine pathway shows neurotoxic imbalance in MS. 
The shift toward quinolinic acid over kynurenic acid may contribute to neurodegeneration.`,
        
        keyFindings: [
            { text: 'KYNA decreased', value: '↓', note: 'neuroprotective' },
            { text: 'QUIN/KYNA ratio elevated', value: '↑', note: 'neurotoxic shift' },
        ],
        
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
        title: 'Amino Acids',
        subtitle: '↑ Biosynthesis',
        color: '#3b82f6',  // Blue - biosynthesis
        
        pathways: {
            primary: [
                { id: 'HISTSYN-PWY', direction: 'depleted', organism: 'microbial',
                  note: 'Histidine biosynthesis' },
                { id: 'ILEUSYN-PWY', direction: 'depleted', organism: 'microbial',
                  note: 'Isoleucine biosynthesis' },
                { id: 'DAPLYSINESYN-PWY', direction: 'depleted', organism: 'microbial',
                  note: 'Lysine biosynthesis' },
            ],
            related: [
                { id: 'BRANCHED-CHAIN-AA-SYN-PWY', direction: 'depleted', organism: 'microbial',
                  note: 'Branched-chain amino acid biosynthesis' },
                { id: 'VALSYN-PWY', direction: 'depleted', organism: 'microbial',
                  note: 'Valine biosynthesis' },
            ],
        },
        
        summary: `Amino acid biosynthesis pathways are depleted in MS, indicating reduced microbial production.`,
        
        keyFindings: [
            { text: 'Histidine decreased', value: '↓', note: '' },
            { text: 'Isoleucine decreased', value: '↓', note: '' },
            { text: 'Lysine decreased', value: '↓', note: '' },
        ],
        
        citation: {
            section: '§3.4.1',
            title: 'Amino Acid Disturbances',
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
        subtitle: '↓ TCA/Glycolysis',
        color: '#22c55e',  // Green - energy
        
        pathways: {
            primary: [
                { id: 'TCA', direction: 'depleted', organism: 'mixed',
                  note: 'TCA cycle I' },
                { id: 'GLYCOLYSIS', direction: 'depleted', organism: 'mixed',
                  note: 'Glycolysis I' },
            ],
            related: [
                { id: 'GLYOXYLATE-BYPASS', direction: 'depleted', organism: 'microbial',
                  note: 'Glyoxylate bypass' },
                { id: 'TCA-GLYOX-BYPASS', direction: 'depleted', organism: 'mixed',
                  note: 'TCA/glyoxylate superpathway' },
                { id: 'PWY-5690', direction: 'depleted', organism: 'mixed',
                  note: 'TCA cycle II' },
            ],
        },
        
        summary: `Central energy metabolism pathways show depletion, suggesting metabolic dysfunction.`,
        
        keyFindings: [
            { text: 'TCA cycle depleted', value: '↓', note: '' },
            { text: 'Glycolysis reduced', value: '↓', note: '' },
        ],
        
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
        subtitle: '↑ Synthesis',
        color: '#3b82f6',  // Blue - biosynthesis
        
        pathways: {
            primary: [
                { id: 'POLYAMSYN-PWY', direction: 'elevated', organism: 'mixed',
                  note: 'Polyamine synthesis' },
                { id: 'FAO-PWY', direction: 'mixed', organism: 'mixed',
                  note: 'Fatty acid β-oxidation' },
            ],
            related: [
                { id: 'PWY-6467', direction: 'depleted', organism: 'mixed',
                  note: 'Sphingolipid signaling' },
            ],
        },
        
        summary: `Lipid metabolism shows bidirectional changes reflecting myelin remodeling.`,
        
        keyFindings: [
            { text: 'Polyamine synthesis elevated', value: '↑', note: '' },
            { text: 'S1P signaling depleted', value: '↓', note: '' },
        ],
        
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
        title: 'Fermentation',
        subtitle: '↓ SCFAs',
        color: '#22c55e',  // Green - energy/fermentation
        
        pathways: {
            primary: [
                { id: 'CENTFERM-PWY', direction: 'depleted', organism: 'microbial',
                  note: 'Central fermentation' },
                { id: 'PWY-6590', direction: 'depleted', organism: 'microbial',
                  note: 'Acetate fermentation' },
            ],
            related: [],
        },
        
        summary: `SCFA production by gut bacteria is reduced in MS, affecting Treg function.`,
        
        keyFindings: [
            { text: 'Acetate decreased', value: '↓', note: '' },
            { text: 'Propionate decreased', value: '↓', note: '' },
        ],
        
        citation: {
            section: '§3.5',
            title: 'SCFAs and Gut-Brain Axis',
            source: 'PMC12471209',
            year: 2025,
        },
    },
};

// Validate pathways exist in MS_COMPARISON_DATA
function validateKeyFindings() {
    if (typeof PATHWAY_DATA === 'undefined' || !PATHWAY_DATA.MS_COMPARISON_DATA) {
        console.warn('MS_COMPARISON_DATA not loaded yet');
        return;
    }
    
    const msData = PATHWAY_DATA.MS_COMPARISON_DATA;
    let total = 0, found = 0;
    
    for (const [findingId, finding] of Object.entries(MS_KEY_FINDINGS)) {
        const allPathways = [...(finding.pathways.primary || []), ...(finding.pathways.related || [])];
        for (const p of allPathways) {
            total++;
            if (msData[p.id]) {
                found++;
            } else {
                console.warn(`⚠ ${findingId}: pathway ${p.id} NOT in MS_COMPARISON_DATA`);
            }
        }
    }
    
    console.log(`Key Findings validation: ${found}/${total} pathways found in MS data`);
}

// Export
window.MS_KEY_FINDINGS = MS_KEY_FINDINGS;
window.validateKeyFindings = validateKeyFindings;

// Validate on load if data is ready
if (typeof PATHWAY_DATA !== 'undefined' && PATHWAY_DATA.MS_COMPARISON_DATA) {
    validateKeyFindings();
}
