/**
 * MS Key Findings v6 - Ship-Ready Version
 * 
 * Primary Source: PMC12471209 - "Metabolomics in Multiple Sclerosis" (2025)
 * Smusz et al., Int J Mol Sci. 2025;26(18):9207
 * 
 * Secondary Source: PMC8814376 - Cantoni et al. 2022 (iMSMS LEfSe)
 * 
 * Three strongest findings with metabolite data from Table 2:
 * 1. SCFA Depletion - Direct microbiome evidence
 * 2. Kynurenine Pathway - Neurotoxic shift  
 * 3. Energy Metabolism - TCA/glycolysis disruption
 */

const MS_KEY_FINDINGS = {
    
    // ════════════════════════════════════════════════════════════════════════
    // SCFA DEPLETION
    // ════════════════════════════════════════════════════════════════════════
    fermentation: {
        id: 'fermentation',
        title: 'SCFA Depletion',
        expansion: 'short-chain fatty acid',
        subtitle: 'immune disruption',
        color: '#06b6d4',
        
        quote: {
            text: "Dysregulation of lipid metabolism has emerged as a central feature of MS pathophysiology, influencing immune signaling, neuroinflammation, membrane integrity, mitochondrial function, and gut–brain communication.",
            source: "Smusz 2025, §3.3.5"
        },
        
        // From Table 2 - PMC12471209
        metabolites: [
            { name: 'Propionic acid', dir: '↓', p: '0.0016', source: 'Duscha 2020' },
            { name: 'Butyrate', dir: '↓', p: '<0.05', source: 'multiple', note: 'colonocyte fuel' },
            { name: 'Acetate', dir: '↓', p: '0.021', source: 'Olsson 2021' },
            { name: 'Phenyllactate', dir: '↓', p: '<10⁻¹⁹', source: 'Fitzgerald 2021' },
            { name: 'Indolelactate', dir: '↓', p: '<10⁻¹⁵', source: 'Fitzgerald 2021' },
        ],
        
        inference: {
            pathways: [
                // Propionate production
                { id: 'CENTFERM-PWY', name: 'Pyruvate fermentation to propanoate I (canonical)', dir: '↓', lda: '1.31' },
                { id: 'P108-PWY', name: 'Pyruvate fermentation to propanoate II', dir: '↓' },
                // Acetate/lactate production
                { id: 'PWY-5100', name: 'Pyruvate fermentation to acetate + lactate', dir: '↓' },
                // Butyrate cross-feeding
                { id: 'PWY-5676', name: 'Acetyl-CoA → butanoate (cross-feeding)', dir: '↓', note: 'Anaerostipes, Eubacterium' },
            ],
            text: "SCFAs (propionate, acetate, butyrate) are produced exclusively by bacterial fermentation. Their systemic depletion directly indicates reduced gut bacterial fermentation capacity and loss of immunoregulatory metabolites.",
        },
        
        clinical: "Patients with MS also showed reduced correlations between SCFAs and cytokines, suggesting impaired gut–immune communication.",
        
        cantoniPathways: ['CENTFERM-PWY', 'P108-PWY', 'PWY-5100', 'PWY-5676'],
    },
    
    // ════════════════════════════════════════════════════════════════════════
    // KYNURENINE PATHWAY
    // ════════════════════════════════════════════════════════════════════════
    kynurenine: {
        id: 'kynurenine',
        title: 'Kynurenine Pathway',
        subtitle: 'neurotoxic shift',
        color: '#8b5cf6',
        
        quote: {
            text: "The kynurenine pathway is the primary route of tryptophan catabolism, generating metabolites with immunomodulatory and neuroactive properties. The shift toward quinolinic acid (neurotoxic) over kynurenic acid (neuroprotective) may contribute to neurodegeneration.",
            source: "Smusz 2025, §3.1"
        },
        
        // From Table 2 - Staats Pires 2025
        metabolites: [
            { name: 'Kynurenic acid (KYNA)', dir: '↓', p: '0.039', note: 'neuroprotective' },
            { name: '3-Hydroxykynurenine', dir: '↓', p: '0.0008', note: '' },
            { name: 'Anthranilic acid', dir: '↑', p: '<0.0001', note: '3.1-fold' },
            { name: 'QUIN/KYNA ratio', dir: '↑', p: '<0.05', note: 'neurotoxic shift' },
            { name: 'Tryptophan', dir: '↑', p: '<0.001', note: 'upstream accumulation' },
        ],
        
        inference: {
            // Mode-specific pathway mappings
            pathways: {
                composed: [
                    { id: 'TRPSYN-PWY', name: 'L-tryptophan biosynthesis', dir: '↓', lda: '0.77' },
                    { id: 'TRPKYNCAT-PWY', name: 'L-tryptophan degradation IV (via indole-3-lactate)', dir: '↓', note: 'bacterial indolelactate pathway' },
                ],
                consonance: [
                    { id: 'TRPSYN-PWY', name: 'L-tryptophan biosynthesis', dir: '↓', lda: '0.77' },
                    { id: 'PWY-6309', name: 'L-tryptophan degradation XI (mammalian, via kynurenine)', dir: '↓', note: 'HUMAnN3 raw data' },
                ],
            },
            text: {
                composed: "Gut bacteria produce protective indoles (ILA→IPA) from tryptophan. When bacterial tryptophan metabolism is depleted, more tryptophan enters the host kynurenine pathway, shifting toward neurotoxic metabolites.",
                consonance: "The mammalian kynurenine pathway (PWY-6309) appears in HUMAnN3 data as gap-filled host pathway. Tryptophan biosynthesis depletion leaves more substrate for neurotoxic kynurenine metabolism.",
            },
            limitation: "The kynurenine pathway itself operates in host tissue. The gut connection is through tryptophan competition and reduced protective indole production.",
        },
        
        clinical: "The neurotoxic shift correlates directly with brain atrophy measurements, suggesting a mechanistic link to neurodegeneration.",
        
        cantoniPathways: {
            composed: ['TRPSYN-PWY', 'TRPKYNCAT-PWY'],
            consonance: ['TRPSYN-PWY', 'PWY-6309'],
        },
    },
    
    // ════════════════════════════════════════════════════════════════════════
    // ENERGY METABOLISM
    // ════════════════════════════════════════════════════════════════════════
    energy: {
        id: 'energy',
        title: 'Energy Metabolism',
        subtitle: 'mitochondrial stress',
        color: '#22c55e',
        
        quote: {
            text: "Multiple studies have highlighted extensive alterations in energy metabolism in MS, including disruptions in glycolysis, mitochondrial function, and the utilization of alternative energy substrates. ",
            source: "Smusz 2025, §3.2"
        },
        
        // From Table 2 - Alwahsh 2024, Wicks 2025
        metabolites: [
            { name: 'Succinate', dir: '↑', p: '<10⁻⁵', note: 'TCA blockade' },
            { name: 'ATP', dir: '↑', p: '<10⁻⁴', note: '1.98-fold' },
            { name: 'Lactate', dir: '↑', p: '<0.05', note: 'anaerobic shift' },
            { name: 'Pantothenate', dir: '↑', p: '<0.05', note: '1.37-fold' },
            { name: 'β-hydroxybutyrate', dir: '↑', p: '0.005', note: 'ketone body' },
            { name: 'Creatine', dir: '↓', p: '<10⁻⁵', note: '0.46-fold' },
        ],
        
        inference: {
            // Mode-specific pathway mappings
            pathways: {
                composed: [
                    // TCA Cycle pathways (only those in COMPOSED_RATIOS)
                    { id: 'TCA', name: 'TCA cycle I (prokaryotic)', dir: '↓', lda: '1.50' },
                    { id: 'TCA-GLYOX-BYPASS', name: 'TCA + glyoxylate bypass', dir: '↓', lda: '1.05' },
                    // Glycolysis - canonical bacterial pathway for composed
                    { id: 'PWY-1042', name: 'Glycolysis IV (canonical)', dir: '↓', lda: '1.17' },
                    { id: 'PWY-5464', name: 'Glycolysis + pyruvate dehydrogenase + TCA', dir: '↓', lda: '1.18' },
                    // Glyoxylate bypass
                    { id: 'GLYOXYLATE-BYPASS', name: 'Glyoxylate cycle', dir: '↓', lda: '1.08' },
                    // CoA synthesis - elevated (ketone body utilization)
                    { id: 'PANTOSYN-PWY', name: 'Pantothenate biosynthesis I', dir: '↑', note: 'ketone shift' },
                    { id: 'COA-PWY', name: 'Coenzyme A biosynthesis I', dir: '↑', note: 'ketone shift' },
                ],
                consonance: [
                    // TCA Cycle pathways (full set from raw HUMAnN3)
                    { id: 'TCA', name: 'TCA cycle I (prokaryotic)', dir: '↓', lda: '1.50' },
                    { id: 'PWY-5690', name: 'TCA cycle II (eukaryotic)', dir: '↓', lda: '1.50' },
                    { id: 'P42-PWY', name: 'Incomplete reductive TCA cycle', dir: '↓', lda: '1.55' },
                    { id: 'P105-PWY', name: 'TCA cycle IV (2-oxoglutarate decarboxylase)', dir: '↓', lda: '1.33' },
                    { id: 'TCA-GLYOX-BYPASS', name: 'TCA + glyoxylate bypass', dir: '↓', lda: '1.05' },
                    // Glycolysis - raw HUMAnN3 pathway for consonance
                    { id: 'GLYCOLYSIS', name: 'Glycolysis I (from glucose 6-phosphate)', dir: '↓', lda: '1.17' },
                    { id: 'PWY-5464', name: 'Glycolysis + pyruvate dehydrogenase + TCA', dir: '↓', lda: '1.18' },
                    // Glyoxylate bypass
                    { id: 'GLYOXYLATE-BYPASS', name: 'Glyoxylate cycle', dir: '↓', lda: '1.08' },
                    // CoA synthesis - elevated (ketone body utilization)
                    { id: 'PANTOSYN-PWY', name: 'Pantothenate biosynthesis I', dir: '↑', note: 'ketone shift' },
                    { id: 'COA-PWY', name: 'Coenzyme A biosynthesis I', dir: '↑', note: 'ketone shift' },
                ],
            },
            text: {
                composed: "Succinate accumulation signals TCA cycle blockade. Elevated lactate indicates anaerobic glycolysis compensation. Increased pantothenate and CoA biosynthesis supports the metabolic shift to ketone body utilization as mitochondrial capacity fails.",
                consonance: "Succinate accumulation signals TCA cycle blockade. Elevated lactate indicates anaerobic glycolysis compensation. Increased pantothenate and CoA biosynthesis supports the metabolic shift to ketone body utilization as mitochondrial capacity fails.",
            },
            limitation: "Metabolite measurements are from serum/CSF. Pathway depletion is from gut microbiome LEfSe analysis - the connection is through microbial-host metabolic crosstalk.",
        },
        
        clinical: "Elevated ketones bodies such as β-hydroxybutyrate and acetoacetate correlate with EDSS and MSSS disability scores, marking metabolic exhaustion in progressive disease.",
        
        cantoniPathways: {
            composed: ['TCA', 'TCA-GLYOX-BYPASS', 'PWY-1042', 'GLYOXYLATE-BYPASS', 'PWY-5464'],
            consonance: ['TCA', 'PWY-5690', 'GLYCOLYSIS', 'P42-PWY', 'P105-PWY', 'TCA-GLYOX-BYPASS', 'GLYOXYLATE-BYPASS', 'PWY-5464'],
        },
    },
};


// ════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS  
// ════════════════════════════════════════════════════════════════════════════

/**
 * Get pathways for a finding, respecting current mode
 */
function getPathwaysForMode(finding, mode) {
    const pathways = finding.inference.pathways;
    // If pathways is mode-specific object, return appropriate mode
    if (pathways.composed && pathways.consonance) {
        return pathways[mode] || pathways.composed;
    }
    // Otherwise return flat array
    return pathways;
}

/**
 * Get inference text for a finding, respecting current mode
 */
function getInferenceText(finding, mode) {
    const text = finding.inference.text;
    if (typeof text === 'object') {
        return text[mode] || text.composed;
    }
    return text;
}

/**
 * Get cantoni pathways for a finding, respecting current mode
 */
function getCantoniPathways(finding, mode) {
    const paths = finding.cantoniPathways;
    if (paths && typeof paths === 'object' && !Array.isArray(paths)) {
        return paths[mode] || paths.composed;
    }
    return paths || [];
}

/**
 * Generate metabolite table HTML
 */
function generateMetaboliteTableHTML(finding) {
    let html = '<table class="metabolite-table">';
    html += '<thead><tr><th>Metabolite</th><th>Change</th><th>p-value</th></tr></thead>';
    html += '<tbody>';
    
    finding.metabolites.forEach(m => {
        const dirClass = m.dir === '↓' ? 'depleted' : 'elevated';
        const noteSpan = m.note ? ` <span class="note">${m.note}</span>` : '';
        html += `<tr>
            <td>${m.name}${noteSpan}</td>
            <td class="${dirClass}">${m.dir}</td>
            <td>${m.p}</td>
        </tr>`;
    });
    
    html += '</tbody></table>';
    return html;
}

/**
 * Generate pathway inference HTML (mode-aware)
 */
function generateInferenceHTML(finding, mode) {
    const pathways = getPathwaysForMode(finding, mode || 'composed');
    const text = getInferenceText(finding, mode || 'composed');
    
    let html = '<div class="inference-pathways">';
    
    pathways.forEach(p => {
        const ldaText = p.lda ? ` <span class="lda">LDA ${p.lda}</span>` : '';
        const noteText = p.note ? ` <span class="pathway-note">${p.note}</span>` : '';
        const dirClass = p.dir === '↓' ? 'depleted' : 'elevated';
        html += `<div class="inferred-pathway">
            <span class="pathway-id">${p.id}</span>
            <span class="pathway-name">${p.name}</span>
            <span class="pathway-dir ${dirClass}">${p.dir}</span>${ldaText}${noteText}
        </div>`;
    });
    
    html += '</div>';
    html += `<p class="inference-text">${text}</p>`;
    
    if (finding.inference.limitation) {
        html += `<p class="inference-limitation">⚠️ ${finding.inference.limitation}</p>`;
    }
    
    return html;
}

/**
 * Get all pathway IDs for highlighting (mode-aware)
 */
function getPathwayIds(findingId, mode) {
    const finding = MS_KEY_FINDINGS[findingId];
    if (!finding) return [];
    
    const currentMode = mode || 'composed';
    const ids = new Set();
    
    // Add inference pathways
    const pathways = getPathwaysForMode(finding, currentMode);
    pathways.forEach(p => ids.add(p.id));
    
    // Add Cantoni pathways
    const cantoni = getCantoniPathways(finding, currentMode);
    cantoni.forEach(id => ids.add(id));
    
    return Array.from(ids);
}

/**
 * Get primary pathway ID (mode-aware)
 */
function getPrimaryPathway(findingId, mode) {
    const finding = MS_KEY_FINDINGS[findingId];
    if (!finding) return null;
    
    const pathways = getPathwaysForMode(finding, mode || 'composed');
    return pathways?.[0]?.id || null;
}

// Export
window.MS_KEY_FINDINGS = MS_KEY_FINDINGS;
window.getPathwaysForMode = getPathwaysForMode;
window.getInferenceText = getInferenceText;
window.getCantoniPathways = getCantoniPathways;
window.generateMetaboliteTableHTML = generateMetaboliteTableHTML;
window.generateInferenceHTML = generateInferenceHTML;
window.getPathwayIds = getPathwayIds;
window.getPrimaryPathway = getPrimaryPathway;

console.log('MS Key Findings v6 loaded - Ship-ready with metabolite data');