/**
 * MS Key Findings v3 - Evidence-Based Pathway Inference
 * 
 * Source: PMC12471209 - "Metabolomics in Multiple Sclerosis" (2025)
 * Smusz et al., Int J Mol Sci. 2025 Sep 20;26(18):9207
 * 
 * Each finding includes:
 * - Direct quote from the paper
 * - Measured metabolite data with statistics
 * - Inference logic: how metabolite changes map to gut microbial pathways
 * - Pathways affected in our visualization
 */

const MS_KEY_FINDINGS = {
    
    // ════════════════════════════════════════════════════════════════════════
    // KYNURENINE PATHWAY - Neurotoxic Shift
    // ════════════════════════════════════════════════════════════════════════
    kynurenine: {
        id: 'kynurenine',
        title: 'Kynurenine Pathway',
        subtitle: 'Neurotoxic Imbalance',
        color: '#8b5cf6',  // Purple - neurotoxicity
        icon: '⚠️',
        
        // Direct quote from the paper
        quote: {
            text: "The kynurenine pathway is the primary route of tryptophan catabolism, generating metabolites with immunomodulatory and neuroactive properties ... The shift toward quinolinic acid (neurotoxic) over kynurenic acid (neuroprotective) may contribute to neurodegeneration.",
            section: "§3.1 The Kynurenine Pathway",
            context: "The kynurenine pathway is the primary route of tryptophan catabolism, generating metabolites with immunomodulatory and neuroactive properties."
        },
        
        // Measured metabolite data from the study
        metaboliteData: [
            { name: 'KYNA (kynurenic acid)', direction: '↓', fold: '1.2×', pValue: '<0.05', fdr: '0.039', note: 'Neuroprotective' },
            { name: '3-HK (3-hydroxykynurenine)', direction: '↓', fold: '1.5×', pValue: '<0.05', fdr: '0.0008', note: '' },
            { name: 'Anthranilic acid', direction: '↑', fold: '3.1×', pValue: '<0.0001', fdr: '<0.0001', note: '' },
            { name: 'QUIN/KYNA ratio', direction: '↑', fold: '1.27×', pValue: '<0.05', fdr: 'NR', note: 'Neurotoxic shift' },
            { name: 'Tryptophan', direction: '↑', fold: '3.3×', pValue: '<0.001', fdr: '<0.05', note: 'Upstream blockade' },
        ],
        
        // How we infer pathway effects
        inference: {
            logic: "When tryptophan accumulates (↑3.3×) while downstream metabolites are depleted, this indicates impaired degradation through the kynurenine pathway. The elevated QUIN/KYNA ratio reflects a shift toward neurotoxic products.",
            limitation: "This pathway operates in host tissue (not gut microbiome). We include it because gut bacteria can influence tryptophan availability and produce competing indole metabolites.",
        },
        
        // Clinical significance
        clinicalNote: "The neurotoxic shift in kynurenine metabolites correlates with brain atrophy and choroid plexus volume. This imbalance may directly contribute to neurodegeneration in MS.",
        
        // Pathways in our visualization (must exist in MS_COMPARISON_DATA)
        pathways: {
            primary: [
                { id: 'PWY-6309', name: 'L-tryptophan degradation XI (mammalian, via kynurenine)' },
            ],
            related: [
                { id: 'TRPSYN-PWY', name: 'L-tryptophan biosynthesis' },
            ],
        },
        
        citation: {
            authors: 'Staats Pires et al. 2025',
            table: 'Table 2',
            doi: '10.3390/ijms26189207',
        },
    },
    
    // ════════════════════════════════════════════════════════════════════════
    // AMINO ACID BIOSYNTHESIS - Microbial Production Reduced
    // ════════════════════════════════════════════════════════════════════════
    aminoAcids: {
        id: 'aminoAcids',
        title: 'Amino Acid Depletion',
        subtitle: 'Reduced Microbial Biosynthesis',
        color: '#3b82f6',  // Blue - biosynthesis
        icon: '🧬',
        
        quote: {
            text: "Multiple studies have consistently reported decreased serum levels of several proteinogenic amino acids, including lysine, glycine, threonine, tyrosine, cysteine, serine, and glutamate, particularly in patients with RRMS.",
            section: "§3.4.1 Amino Acid Disturbances",
            context: "Amino acid disturbances appear to be functionally linked with disease activity and neurodegeneration."
        },
        
        metaboliteData: [
            { name: 'Lysine', direction: '↓', fold: '0.48×', pValue: '<10⁻¹⁹', fdr: '<0.001', note: 'Strongly depleted' },
            { name: 'Histidine', direction: '↓', fold: '—', pValue: '0.006', fdr: '<0.05', note: 'Correlates with EDSS' },
            { name: 'Isoleucine', direction: '↓', fold: '—', pValue: '<0.001', fdr: '<0.05', note: 'BCAA' },
            { name: 'Threonine', direction: '↓', fold: '0.38×', pValue: '<10⁻¹⁵', fdr: '<0.001', note: '' },
            { name: 'Glycine', direction: '↓', fold: '0.45×', pValue: '<10⁻¹⁴', fdr: '<0.001', note: '' },
            { name: 'Glutamate', direction: '↓', fold: '0.57×', pValue: '<10⁻¹⁶', fdr: '<0.001', note: '' },
        ],
        
        inference: {
            logic: "When serum amino acids are depleted, this may reflect reduced production by gut bacteria. We map these to microbial biosynthesis pathways—the bacteria that normally synthesize these amino acids appear less active in MS patients.",
            limitation: "Cross-kingdom inference: human serum metabolites → microbial gut pathways. Depletion could also reflect increased host consumption during inflammation.",
        },
        
        clinicalNote: "Histidine levels correlate negatively with EDSS disability scores at 1 and 2 years, suggesting these amino acid changes track with disease severity.",
        
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
            authors: 'Alwahsh et al. 2024, Židó et al. 2023',
            table: 'Table 2',
            doi: '10.3390/ijms26189207',
        },
    },
    
    // ════════════════════════════════════════════════════════════════════════
    // ENERGY METABOLISM - Mitochondrial Dysfunction
    // ════════════════════════════════════════════════════════════════════════
    energy: {
        id: 'energy',
        title: 'Energy Metabolism',
        subtitle: 'Mitochondrial Dysfunction',
        color: '#22c55e',  // Green - energy
        icon: '',
        
        quote: {
            text: "These data outline a metabolic transition from glycolysis-driven immune activation in early stages to ketone body utilization and mitochondrial exhaustion in progression.",
            section: "§3.2 Energy Metabolism",
            context: "Consistent alterations in central carbon metabolism have been reported, including disruptions in glycolysis, mitochondrial function, and the utilization of alternative energy substrates."
        },
        
        metaboliteData: [
            { name: 'Succinate', direction: '↑', fold: '1.58×', pValue: '<10⁻⁵', fdr: '<0.05', note: 'TCA intermediate' },
            { name: 'ATP', direction: '↑', fold: '1.98×', pValue: '<10⁻⁴', fdr: '<0.05', note: 'Energy currency' },
            { name: 'Lactate', direction: '↑', fold: '—', pValue: '<0.05', fdr: 'NR', note: 'Anaerobic shift (PPMS)' },
            { name: 'β-hydroxybutyrate', direction: '↑', fold: '1.43×', pValue: '0.005', fdr: 'NR', note: 'Ketone body (PMS)' },
            { name: 'Creatine', direction: '↓', fold: '0.46×', pValue: '<10⁻⁵', fdr: '<0.001', note: 'Energy buffer depleted' },
            { name: 'Glucose', direction: '↑', fold: '—', pValue: '<0.05', fdr: 'NR', note: 'Correlates with inflammation' },
        ],
        
        inference: {
            logic: "Elevated glucose with altered TCA intermediates suggests metabolic blockades. Increased succinate and lactate indicate a shift toward anaerobic metabolism. We infer that bacterial pathways involved in central carbon metabolism are affected by this systemic metabolic reprogramming.",
            limitation: "TCA and glycolysis are universal pathways (bacteria and host). The gut microbiome contribution is one component of systemic dysfunction.",
        },
        
        clinicalNote: "Ketone bodies (BHB, acetoacetate) are elevated specifically in progressive MS and correlate with EDSS and MSSS disability scores, reflecting increased reliance on alternative energy sources.",
        
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
            authors: 'Alwahsh et al. 2024, Wicks et al. 2025',
            table: 'Table 2',
            doi: '10.3390/ijms26189207',
        },
    },
    
    // ════════════════════════════════════════════════════════════════════════
    // LIPID METABOLISM - Membrane Remodeling
    // ════════════════════════════════════════════════════════════════════════
    lipids: {
        id: 'lipids',
        title: 'Lipid Remodeling',
        subtitle: 'Sphingolipid Dysregulation',
        color: '#ec4899',  // Pink - lipids
        icon: '🔬',
        
        quote: {
            text: "In brain tissue, lesion cores were enriched in ceramides and sphingomyelins, whereas lysophospholipids and endocannabinoids were depleted.",
            section: "§3.3 Lipid Metabolism",
            context: "Dysregulation of lipid metabolism has emerged as a central feature of MS pathophysiology, influencing immune signaling, neuroinflammation, membrane integrity, and gut–brain communication."
        },
        
        metaboliteData: [
            { name: 'Sphingomyelin', direction: '↑', fold: '—', pValue: '<10⁻⁸', fdr: '<10⁻⁷', note: 'Lesion cores' },
            { name: 'Ceramides', direction: '↑', fold: '—', pValue: '<10⁻⁸', fdr: '<10⁻⁷', note: 'Lesion cores' },
            { name: 'Sphingosine-1-phosphate', direction: '↓', fold: '—', pValue: '<0.001', fdr: '<0.05', note: 'Signaling disrupted' },
            { name: 'Spermidine', direction: '↑', fold: '—', pValue: '<0.05', fdr: '<0.05', note: 'Immune proliferation' },
            { name: 'Choline', direction: '↓', fold: '0.50×', pValue: '<10⁻¹¹', fdr: '<0.001', note: 'Membrane component' },
        ],
        
        inference: {
            logic: "Elevated sphingomyelin and ceramides in lesions may reflect myelin breakdown releasing membrane components. Reduced S1P disrupts immunomodulatory signaling. We map these to bacterial polyamine and lipid synthesis pathways that may be responding to or contributing to this remodeling.",
            limitation: "Most sphingolipid changes occur in host tissue. Gut microbial contribution is indirect, through polyamine metabolism and membrane lipid precursors.",
        },
        
        clinicalNote: "Sphingosine-1-phosphate (S1P) is the target of fingolimod therapy. Its depletion in MS may explain why S1P receptor modulators are therapeutically effective.",
        
        pathways: {
            primary: [
                { id: 'POLYAMSYN-PWY', name: 'Polyamine biosynthesis' },
                { id: 'FAO-PWY', name: 'Fatty acid β-oxidation' },
            ],
            related: [
                { id: 'PWY-6467', name: 'Sphingolipid signaling' },
            ],
        },
        
        citation: {
            authors: 'Ladakis et al. 2024, Yang et al. 2021',
            table: 'Table 2',
            doi: '10.3390/ijms26189207',
        },
    },
    
    // ════════════════════════════════════════════════════════════════════════
    // FERMENTATION / SCFAs - Gut-Brain Axis
    // ════════════════════════════════════════════════════════════════════════
    fermentation: {
        id: 'fermentation',
        title: 'SCFA Depletion',
        subtitle: 'Gut-Brain Axis Disruption',
        color: '#06b6d4',  // Cyan - gut microbiome
        icon: '🦠',
        
        quote: {
            text: "PA supplementation (1000 mg/day) restored regulatory T cell (Treg) function, reduced Th1/Th17 responses, stabilized EDSS, and lowered relapse rates.",
            section: "§3.3.5 Short-Chain Fatty Acids",
            context: "SCFAs, particularly propionate and acetate, were consistently reduced in serum and feces, with supplementation shown to restore Treg function and stabilize EDSS."
        },
        
        metaboliteData: [
            { name: 'Propionic acid', direction: '↓', fold: '—', pValue: '0.0016', fdr: '<0.05', note: 'Therapeutic target' },
            { name: 'Acetate', direction: '↓', fold: '—', pValue: '0.021', fdr: '0.067', note: 'Serum and feces' },
            { name: 'Acetate/Butyrate ratio', direction: '↓', fold: '—', pValue: '0.005', fdr: '0.06', note: '' },
            { name: 'Phenyllactate', direction: '↓', fold: '—', pValue: '<10⁻¹⁹', fdr: '<0.001', note: 'Aromatic AA fermentation' },
            { name: 'Indolelactate', direction: '↓', fold: '—', pValue: '<10⁻¹⁵', fdr: '<0.001', note: 'Microbial indoles' },
        ],
        
        inference: {
            logic: "This is the clearest gut microbiome → disease link. Reduced SCFAs directly indicate decreased bacterial fermentation. These metabolites are produced exclusively by gut bacteria, so their depletion unambiguously reflects dysbiosis.",
            limitation: "Minimal—this is direct measurement of microbial products. The therapeutic effect of PA supplementation provides causal evidence.",
        },
        
        clinicalNote: "Propionic acid supplementation is being investigated as an adjunct therapy. In clinical studies, 1000mg/day restored regulatory T cell function and stabilized disability scores.",
        
        pathways: {
            primary: [
                { id: 'CENTFERM-PWY', name: 'Central fermentation' },
                { id: 'PWY-6590', name: 'Acetate/formate fermentation' },
            ],
            related: [],
        },
        
        citation: {
            authors: 'Duscha et al. 2020, Fitzgerald et al. 2021',
            table: 'Table 2',
            doi: '10.3390/ijms26189207',
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
 * Validate that pathways exist in MS_COMPARISON_DATA
 */
function validateKeyFindings() {
    if (typeof PATHWAY_DATA === 'undefined' || !PATHWAY_DATA.MS_COMPARISON_DATA) {
        console.warn('MS_COMPARISON_DATA not loaded yet');
        return { valid: 0, missing: [], total: 0 };
    }
    
    const msData = PATHWAY_DATA.MS_COMPARISON_DATA;
    const results = { valid: 0, missing: [], total: 0 };
    
    for (const [findingId, finding] of Object.entries(MS_KEY_FINDINGS)) {
        const allPathways = [...(finding.pathways.primary || []), ...(finding.pathways.related || [])];
        for (const p of allPathways) {
            results.total++;
            if (msData[p.id]) {
                results.valid++;
            } else {
                results.missing.push({ finding: findingId, pathway: p.id, name: p.name });
            }
        }
    }
    
    if (results.missing.length > 0) {
        console.warn('Missing pathways in MS_COMPARISON_DATA:', results.missing);
    }
    console.log(`Key Findings: ${results.valid}/${results.total} pathways validated`);
    return results;
}

/**
 * Generate HTML for the metabolite data table
 */
function generateMetaboliteTable(finding) {
    if (!finding.metaboliteData || finding.metaboliteData.length === 0) {
        return '';
    }
    
    let html = '<table class="metabolite-table"><thead><tr>';
    html += '<th>Metabolite</th><th>Change</th><th>Fold</th><th>p-value</th><th>Note</th>';
    html += '</tr></thead><tbody>';
    
    for (const m of finding.metaboliteData) {
        const dirClass = m.direction === '↑' ? 'elevated' : 'depleted';
        html += `<tr>`;
        html += `<td>${m.name}</td>`;
        html += `<td class="${dirClass}">${m.direction}</td>`;
        html += `<td>${m.fold}</td>`;
        html += `<td>${m.pValue}</td>`;
        html += `<td class="note">${m.note}</td>`;
        html += `</tr>`;
    }
    
    html += '</tbody></table>';
    return html;
}

// Export
window.MS_KEY_FINDINGS = MS_KEY_FINDINGS;
window.getPathwayIds = getPathwayIds;
window.validateKeyFindings = validateKeyFindings;
window.generateMetaboliteTable = generateMetaboliteTable;

// Validate on load if data is ready
if (typeof PATHWAY_DATA !== 'undefined' && PATHWAY_DATA.MS_COMPARISON_DATA) {
    validateKeyFindings();
}

console.log('MS Key Findings v3 loaded - Evidence-based with quotes and data');
