// ============================================================
// METABOLIC HARMONY - DOCUMENTATION CONTENT
// Version: 1.0 (January 2026)
// ============================================================
// 
// This file contains all text content for the documentation
// and methods sections, organized for easy editing and export.
//
// USAGE:
//   Include this file before the main script
//   Access via: DOCS.healthy, DOCS.ms, DOCS.modals, etc.
//
// ============================================================

const DOCS = {
    
    // ════════════════════════════════════════════════════════
    // APP METADATA
    // ════════════════════════════════════════════════════════
    meta: {
        title: "Metabolic Harmony",
        tagline: "Listen to your Gut",
        version: "5.1",
        author: "Love Grows Within",
        year: "2025"
    },

    // ════════════════════════════════════════════════════════
    // HEALTHY REFERENCE VIEW
    // ════════════════════════════════════════════════════════
    healthy: {
        title: "The Human Gut Microbiome",
        subtitle: "600 Curated Metabolic Pathways Sonified",
        
        intro: `What you are hearing is a harmonic model of the human gut microbiome, 
constructed from metabolic pathway data across 4,869 healthy adult samples.`,
        
        sections: [
            {
                label: "Data",
                content: `<a href="#" onclick="openModal('healthySamples'); return false;">4,869 healthy samples</a> 
                from curatedMetagenomicData, filtered to ~600 pathways organized by metabolic category.`
            },
            {
                label: "Modes",
                content: `<strong>Composed</strong> — <a href="#" onclick="openModal('composedMode'); return false;">170 curated pathways</a> 
                with hand-crafted harmonic ratios based on prime architecture<br>
                <strong>Consonance</strong> — All 600 pathways ranked by prevalence, mapped to consonant intervals`
            },
            {
                label: "Method",
                content: `Pathways are assigned harmonic ratios reflecting their metabolic domain. 
                Energy metabolism centers on the perfect fifth (3/2). 
                <a href="#" onclick="openModal('harmonicTheory'); return false;">Learn about the harmonic theory →</a>`
            }
        ],
        
        sources: [
            { name: "MetaCyc", url: "https://metacyc.org/", desc: "Metabolic Pathway Library" },
            { name: "curatedMetagenomicData", url: "https://waldronlab.io/curatedMetagenomicData/", desc: "Healthy Samples" },
            { name: "Enteropathway", url: "https://enteropathway.org/", desc: "Gut Pathway Curation" }
        ]
    },

    // ════════════════════════════════════════════════════════
    // MULTIPLE SCLEROSIS VIEW
    // ════════════════════════════════════════════════════════
    ms: {
        title: "MS Microbiome Comparison",
        subtitle: "Pathway-level changes inferred from metabolomics data",
        
        intro: `Based on a systematic review of 29 metabolomics studies in MS patients, 
we infer pathway-level alterations from reported metabolite changes. 
Highlighted pathways show hypothesized dysregulation.`,
        
        sections: [
            {
                label: "Primary",
                content: `<strong>64 pathways</strong> from LEfSe analysis<br>
                <a href="https://pubmed.ncbi.nlm.nih.gov/35059609/" target="_blank">Cantoni et al. 2022</a> (iMSMS cohort)`
            },
            {
                label: "Inferred",
                content: `<strong>23 pathways</strong> <a href="#" onclick="openModal('msInference'); return false;">inferred from metabolomics</a><br>
                <a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC12471209/" target="_blank">Smusz et al. 2025</a> (systematic review)`
            },
            {
                label: "Summary",
                content: `62 depleted · 2 elevated · 23 inferred<br>
                Magnitude from LDA effect size (threshold 0.5)`
            }
        ],
        
        disclaimer: `Elevated pathways may indicate compensatory activation or upstream accumulation. 
Depleted pathways suggest reduced microbial function or increased host consumption.`,
        
        sources: [
            { name: "Cantoni et al. 2022", url: "https://pubmed.ncbi.nlm.nih.gov/35059609/", desc: "iMSMS LEfSe Analysis" },
            { name: "PMC12471209", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC12471209/", desc: "MS Metabolomics Review" },
            { name: "MetaCyc", url: "https://metacyc.org/", desc: "Pathway Definitions" }
        ]
    },

    // ════════════════════════════════════════════════════════
    // KEY FINDINGS (MS)
    // ════════════════════════════════════════════════════════
    keyFindings: {
        scfa: {
            id: "scfa",
            title: "SCFA Depletion",
            subtitle: "gut-brain axis / immune disruption",
            color: "#06b6d4",
            
            summary: `Short-chain fatty acids (SCFAs) are bacterial fermentation products 
critical for gut barrier integrity and immune regulation. MS patients show consistent 
depletion of SCFA-producing pathways.`,
            
            evidence: {
                direct: [
                    { pathway: "CENTFERM-PWY", name: "Butanoate fermentation", lda: 1.31 }
                ],
                inferred: [
                    { pathway: "P108-PWY", name: "Propionate biosynthesis", note: "metabolite ↓" },
                    { pathway: "PWY-5100", name: "Acetate biosynthesis", note: "metabolite ↓" }
                ]
            },
            
            clinical: `Propionate supplementation restored Treg function and stabilized 
disability scores in clinical trials (Duscha 2020). SCFAs may be protective factors 
whose deficiency contributes to MS progression.`,
            
            quote: {
                text: "Most fecal metabolites associated with MS progression are decreased, suggesting deficiency of protective factors.",
                source: "Schwerdtfeger 2025"
            },
            
            pathwayIds: ["CENTFERM-PWY", "P108-PWY", "PWY-5100", "PWY-5022", "PWY-5676"]
        },
        
        kynurenine: {
            id: "kynurenine",
            title: "Kynurenine Pathway",
            subtitle: "neurotoxic shift",
            color: "#8b5cf6",
            
            summary: `When tryptophan accumulates while downstream metabolites are depleted, 
this indicates impaired degradation through the kynurenine pathway. Gut bacteria influence 
tryptophan availability and produce competing indole metabolites that may be protective.`,
            
            evidence: {
                direct: [
                    { pathway: "TRPSYN-PWY", name: "Tryptophan biosynthesis", lda: 0.77 }
                ],
                inferred: [
                    { pathway: "PWY-6309", name: "Kynurenine metabolism", note: "KYNA ↓, QUIN/KYNA ↑" }
                ]
            },
            
            clinical: `The neurotoxic shift in kynurenine metabolites correlates directly 
with brain atrophy measurements, suggesting a mechanistic link to neurodegeneration.`,
            
            limitation: `This pathway operates primarily in host tissue. The gut microbiome 
connection is through tryptophan competition and indole production.`,
            
            quote: {
                text: "MS patients are depleted in bacteria producing indolelactate, an intermediate for neuroprotective indolepropionate.",
                source: "Levi 2021"
            },
            
            pathwayIds: ["TRPSYN-PWY", "PWY-6309", "COMPLETE-ARO-PWY"]
        },
        
        energy: {
            id: "energy",
            title: "Energy Metabolism",
            subtitle: "mitochondrial stress",
            color: "#22c55e",
            
            summary: `Multiple energy metabolism pathways show significant depletion in MS, 
particularly the TCA cycle and glycolysis. This pattern suggests systemic metabolic stress 
affecting both host mitochondria and bacterial energy production.`,
            
            evidence: {
                direct: [
                    { pathway: "TCA", name: "TCA cycle", lda: 1.50 },
                    { pathway: "PWY-5690", name: "TCA cycle II", lda: 1.50 },
                    { pathway: "P42-PWY", name: "Incomplete TCA", lda: 1.55 },
                    { pathway: "P105-PWY", name: "TCA cycle IV", lda: 1.33 },
                    { pathway: "GLYCOLYSIS", name: "Glycolysis", lda: 1.17 }
                ],
                inferred: []
            },
            
            clinical: `Disturbances in energy metabolism are deeply intertwined with 
neuroinflammation, disease progression, and therapeutic response in MS.`,
            
            quote: {
                text: "Energy metabolism disruption represents a convergence point for multiple MS pathogenic mechanisms.",
                source: "Iyer 2024"
            },
            
            pathwayIds: ["TCA", "PWY-5690", "P42-PWY", "P105-PWY", "GLYCOLYSIS", "PWY-5084", "GLYCOLYSIS-E-D"]
        }
    },

    // ════════════════════════════════════════════════════════
    // MODAL CONTENT
    // ════════════════════════════════════════════════════════
    modals: {
        healthySamples: {
            title: "Healthy Gut Reference Cohort",
            subtitle: "curatedMetagenomicData filtering methodology",
            content: `
<h3>Filtering Criteria</h3>
<ul>
    <li><strong>Disease status:</strong> healthy / control only</li>
    <li><strong>Body site:</strong> stool samples</li>
    <li><strong>Age:</strong> 18–65 years</li>
    <li><strong>Antibiotics:</strong> excluded current users</li>
    <li><strong>Pregnancy/lactation:</strong> excluded</li>
    <li><strong>BMI:</strong> 18.5–30 (normal to overweight)</li>
    <li><strong>Excluded:</strong> disease-focused study cohorts</li>
</ul>

<h3>Cohort Summary</h3>
<table class="modal-table">
    <tr><td>Total samples</td><td><strong>4,869</strong></td></tr>
    <tr><td>Studies included</td><td>40</td></tr>
    <tr><td>Initial pathways</td><td>67,175</td></tr>
    <tr><td>After filtering</td><td>~600</td></tr>
</table>

<h3>Demographics</h3>
<table class="modal-table">
    <tr><td>Age (mean ± SD)</td><td>40.0 ± 13.3</td></tr>
    <tr><td>Female</td><td>2,888 (59%)</td></tr>
    <tr><td>Male</td><td>1,915 (39%)</td></tr>
    <tr><td>Not reported</td><td>66 (2%)</td></tr>
</table>

<p class="modal-note">Generated 2025-12-25 using R 4.5.2</p>
            `
        },
        
        composedMode: {
            title: "Composed Mode: Harmonic Architecture",
            subtitle: "Prime-based ratio assignments for metabolic pathways",
            content: `
<h3>The Harmonic Philosophy</h3>
<p>In Composed mode, each metabolic pathway is assigned a specific harmonic ratio 
based on its biological function. This creates a "harmonic fingerprint" where 
related pathways cluster in consonant regions.</p>

<h3>Prime Family Assignments</h3>
<table class="modal-table">
    <tr><th>Prime</th><th>Domain</th><th>Rationale</th></tr>
    <tr><td><strong>2, 3</strong></td><td>Energy metabolism</td><td>Most fundamental processes</td></tr>
    <tr><td><strong>5</strong></td><td>Information/signaling</td><td>Nucleotides, vitamins</td></tr>
    <tr><td><strong>7</strong></td><td>Structural</td><td>Cell wall, lipids</td></tr>
    <tr><td><strong>11</strong></td><td>Catalytic</td><td>Cofactors, metals</td></tr>
    <tr><td><strong>13</strong></td><td>Aromatic</td><td>Amino acids, secondary metabolites</td></tr>
</table>

<h3>Example Assignments</h3>
<ul>
    <li><strong>3/2</strong> (perfect fifth) — Butyrate fermentation (the healthy gut interval)</li>
    <li><strong>4/3</strong> (perfect fourth) — TCA cycle</li>
    <li><strong>5/4</strong> (major third) — Nucleotide biosynthesis</li>
    <li><strong>7/4</strong> (harmonic seventh) — Cell wall synthesis</li>
</ul>

<p><a href="https://github.com/your-repo/metabolic-harmony" target="_blank">
View the full harmonic map on GitHub →</a></p>
            `
        },
        
        msInference: {
            title: "MS Pathway Inference Methodology",
            subtitle: "Two-tier data integration approach",
            content: `
<h3>Data Sources</h3>

<h4>Tier 1: Direct Evidence (Cantoni et al. 2022)</h4>
<p>LEfSe analysis of gut microbiome samples from the iMSMS cohort, 
comparing MS patients to healthy controls.</p>
<ul>
    <li>64 pathways with LDA effect size > 0.5</li>
    <li>Confidence: <strong>High</strong> (direct measurement)</li>
    <li>62 depleted, 2 elevated in MS</li>
</ul>

<h4>Tier 2: Metabolite-Inferred (Smusz et al. 2025)</h4>
<p>Systematic review of 29 MS metabolomics studies, mapping reported 
metabolite changes back to producing pathways.</p>
<ul>
    <li>23 additional pathways inferred</li>
    <li>Confidence: <strong>Medium</strong> (indirect inference)</li>
    <li>Based on metabolite-pathway relationships in MetaCyc</li>
</ul>

<h3>Limitations</h3>
<ul>
    <li>Metabolite changes may reflect host or microbial activity</li>
    <li>Pathway directionality cannot always be determined</li>
    <li>Some inferred pathways operate primarily in host tissue</li>
</ul>

<h3>Visual Indicators</h3>
<table class="modal-table">
    <tr><th>Source</th><th>Indicator</th></tr>
    <tr><td>Cantoni (direct)</td><td>Solid dot</td></tr>
    <tr><td>Metabolite (high conf)</td><td>Hollow dot</td></tr>
    <tr><td>Metabolite (medium)</td><td>Small dot</td></tr>
</table>
            `
        },
        
        harmonicTheory: {
            title: "Harmonic Theory: Why Ratios?",
            subtitle: "The mathematics of consonance",
            content: `
<h3>Just Intonation & Consonance</h3>
<p>In just intonation, musical intervals are defined by simple whole-number ratios. 
The simpler the ratio, the more "consonant" or stable the interval sounds.</p>

<table class="modal-table">
    <tr><th>Ratio</th><th>Interval</th><th>n×d</th><th>Perception</th></tr>
    <tr><td>1/1</td><td>Unison</td><td>1</td><td>Perfect stability</td></tr>
    <tr><td>2/1</td><td>Octave</td><td>2</td><td>Complete</td></tr>
    <tr><td>3/2</td><td>Perfect fifth</td><td>6</td><td>Strong consonance</td></tr>
    <tr><td>4/3</td><td>Perfect fourth</td><td>12</td><td>Consonant</td></tr>
    <tr><td>5/4</td><td>Major third</td><td>20</td><td>Sweet</td></tr>
    <tr><td>7/4</td><td>Harmonic seventh</td><td>28</td><td>Bluesy</td></tr>
</table>

<h3>The n×d Consonance Measure</h3>
<p>We use <strong>n × d</strong> (numerator times denominator) as a simple 
consonance metric. Lower values indicate more consonant intervals.</p>

<h3>Prime Limits</h3>
<p>The highest prime factor in a ratio determines its "prime limit." 
Higher prime limits create more complex, exotic intervals:</p>
<ul>
    <li><strong>3-limit:</strong> Pythagorean (fifths and fourths only)</li>
    <li><strong>5-limit:</strong> Classical harmony (adds thirds)</li>
    <li><strong>7-limit:</strong> Blues, barbershop</li>
    <li><strong>11-limit:</strong> Microtonal, experimental</li>
</ul>

<p><a href="https://en.xen.wiki/w/Just_intonation" target="_blank">
Learn more about just intonation →</a></p>
            `
        }
    },

    // ════════════════════════════════════════════════════════
    // HELPER FUNCTIONS
    // ════════════════════════════════════════════════════════
    
    // Generate HTML for documentation panel based on current view
    generateDocsHTML: function(view) {
        const data = view === 'ms' ? this.ms : this.healthy;
        
        let html = `
            <p class="docs-intro">${data.intro}</p>
            <div class="docs-grid">
        `;
        
        data.sections.forEach(section => {
            html += `
                <div class="docs-item">
                    <span class="docs-label">${section.label}</span>
                    <span class="docs-value">${section.content}</span>
                </div>
            `;
        });
        
        html += `</div>`;
        
        // Add disclaimer for MS view
        if (view === 'ms' && data.disclaimer) {
            html += `<p class="docs-disclaimer">${data.disclaimer}</p>`;
        }
        
        // Add sources
        html += `<div class="docs-sources"><strong>Sources:</strong> `;
        html += data.sources.map(s => 
            `<a href="${s.url}" target="_blank" title="${s.desc}">${s.name}</a>`
        ).join(' · ');
        html += `</div>`;
        
        return html;
    },
    
    // Generate finding detail HTML
    generateFindingHTML: function(findingId) {
        const finding = this.keyFindings[findingId];
        if (!finding) return '';
        
        let html = `
            <div class="finding-header" style="border-left: 3px solid ${finding.color}; padding-left: 12px;">
                <h3 class="finding-title">${finding.title}</h3>
                <p class="finding-subtitle">${finding.subtitle}</p>
            </div>
            
            <p class="finding-summary">${finding.summary}</p>
        `;
        
        // Evidence section
        if (finding.evidence.direct.length > 0) {
            html += `<div class="finding-evidence">
                <h4>Direct Evidence</h4>
                <ul>`;
            finding.evidence.direct.forEach(e => {
                html += `<li><strong>${e.pathway}</strong> — ${e.name} (LDA ${e.lda})</li>`;
            });
            html += `</ul></div>`;
        }
        
        if (finding.evidence.inferred.length > 0) {
            html += `<div class="finding-evidence inferred">
                <h4>Inferred</h4>
                <ul>`;
            finding.evidence.inferred.forEach(e => {
                html += `<li><strong>${e.pathway}</strong> — ${e.name} <span class="note">${e.note}</span></li>`;
            });
            html += `</ul></div>`;
        }
        
        // Limitation if present
        if (finding.limitation) {
            html += `<p class="finding-limitation"><strong>Limitation:</strong> ${finding.limitation}</p>`;
        }
        
        // Clinical relevance
        html += `
            <div class="finding-clinical">
                <h4>Clinical Relevance</h4>
                <p>${finding.clinical}</p>
            </div>
        `;
        
        // Quote
        if (finding.quote) {
            html += `
                <blockquote class="finding-quote">
                    "${finding.quote.text}"
                    <cite>— ${finding.quote.source}</cite>
                </blockquote>
            `;
        }
        
        return html;
    }
};

// Export for use in browser
if (typeof window !== 'undefined') {
    window.DOCS = DOCS;
}

// Export for Node.js (if generating static files)
if (typeof module !== 'undefined') {
    module.exports = DOCS;
}
