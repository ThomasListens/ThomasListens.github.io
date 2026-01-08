// ═══════════════════════════════════════════════════════════════════════════════
// METABOLIC HARMONY v4.0 - JavaScript Additions
// Include this AFTER pathways_v5.js, BEFORE the main script
// ═══════════════════════════════════════════════════════════════════════════════

const MetabolicHarmonyExtensions = (function() {
    'use strict';
    
    // ═══════════════════════════════════════════════════════════════════════════
    // PRIME-BASED COLOR SHADING
    // Keep base category colors, add subtle prime-based variation
    // ═══════════════════════════════════════════════════════════════════════════
    
    // Base category colors (preserved from original)
    const CATEGORY_COLORS = {
        energy: '#22c55e',
        biosynthesis: '#3b82f6',
        degradation: '#ef4444',
        salvage: '#eab308',
        other: '#6b7280',
        superpathways: '#8b5cf6'
    };
    
    // Convert hex to HSL
    function hexToHSL(hex) {
        let r = parseInt(hex.slice(1, 3), 16) / 255;
        let g = parseInt(hex.slice(3, 5), 16) / 255;
        let b = parseInt(hex.slice(5, 7), 16) / 255;
        
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;
        
        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                case g: h = ((b - r) / d + 2) / 6; break;
                case b: h = ((r - g) / d + 4) / 6; break;
            }
        }
        
        return { h: h * 360, s: s * 100, l: l * 100 };
    }
    
    // Get the highest prime factor
    function getPrimeLimit(n, d) {
        let primeLimit = 1;
        for (const num of [n, d]) {
            let temp = Math.abs(num);
            for (let p = 2; p * p <= temp; p++) {
                while (temp % p === 0) {
                    primeLimit = Math.max(primeLimit, p);
                    temp /= p;
                }
            }
            if (temp > 1) primeLimit = Math.max(primeLimit, temp);
        }
        return primeLimit;
    }
    
    // Get pathway color with subtle prime-based shading
    function getPathwayColor(pathway, options = {}) {
        const category = pathway.category || 'other';
        const baseHex = CATEGORY_COLORS[category] || CATEGORY_COLORS.other;
        const base = hexToHSL(baseHex);
        
        // Get prime limit
        const n = pathway.n || 1;
        const d = pathway.d || 1;
        const primeLimit = getPrimeLimit(n, d);
        const consonance = n * d;
        
        // SUBTLE prime-based adjustments (keep category identity strong)
        // Higher primes → slightly darker, slightly less saturated
        const primeFactor = Math.min(1, Math.log2(primeLimit + 1) / 4);  // 0-1 range
        
        let h = base.h;
        let s = base.s * (1 - primeFactor * 0.15);  // Max 15% saturation reduction
        let l = base.l * (1 - primeFactor * 0.2);   // Max 20% lightness reduction
        
        // Consonance affects brightness slightly (simpler = brighter)
        const consonanceFactor = Math.min(1, Math.log2(consonance + 1) / 10);
        l = l * (1 - consonanceFactor * 0.1);  // Max 10% additional darkening
        
        // Optional boost for hover/focus
        if (options.boost) {
            s = Math.min(100, s * 1.15);
            l = Math.min(75, l * 1.1);
        }
        
        // Optional dim for background
        if (options.dim) {
            s = s * 0.5;
            l = Math.min(85, l * 1.4);
        }
        
        return `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // MODE SWITCHING
    // ═══════════════════════════════════════════════════════════════════════════
    
    let currentMode = 'composed';
    let onModeChangeCallbacks = [];
    
    function getCurrentMode() {
        return currentMode;
    }
    
    function switchMode(newMode) {
        if (newMode === currentMode) return;
        if (newMode !== 'composed' && newMode !== 'consonance') return;
        
        const oldMode = currentMode;
        currentMode = newMode;
        
        console.log(`Mode switch: ${oldMode} → ${newMode}`);
        
        // Notify listeners
        onModeChangeCallbacks.forEach(cb => {
            try { cb(newMode, oldMode); } catch (e) { console.error(e); }
        });
        
        return newMode;
    }
    
    function onModeChange(callback) {
        onModeChangeCallbacks.push(callback);
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // SUBCATEGORY MAP BY MODE
    // ═══════════════════════════════════════════════════════════════════════════
    
    const SUBCATEGORY_MAP_COMPOSED = {
        energy: [
            { id: 'Glycolysis/Gluconeogenesis', label: 'Glycolysis' },
            { id: 'Pentose Phosphate', label: 'Pentose Phosphate' },
            { id: 'TCA Cycle', label: 'TCA Cycle' },
            { id: 'Fermentation', label: 'Fermentation' },
            { id: 'Glyoxylate Cycle', label: 'Glyoxylate' },
            { id: 'Respiration', label: 'Respiration' }
        ],
        biosynthesis: [
            { id: 'Amino Acids', label: 'Amino Acids' },
            { id: 'Nucleotides', label: 'Nucleotides' },
            { id: 'Cofactors/Vitamins', label: 'Cofactors' },
            { id: 'Fatty Acid Synthesis', label: 'Fatty Acid Syn' },
            { id: 'Fatty Acids / Lipids', label: 'Fatty Acids' },
            { id: 'Lipids & Membranes', label: 'Membranes' },
            { id: 'Cell Envelope', label: 'Cell Envelope' },
            { id: 'Polyamines', label: 'Polyamines' },
            { id: 'Isoprenoids', label: 'Isoprenoids' },
            { id: 'tRNA Modifications', label: 'tRNA Mods' },
            { id: 'Specialized', label: 'Specialized' },
            { id: 'Other', label: 'Other' },
            { id: 'Carbon Storage', label: 'Carbon Storage' },
            { id: 'Stress / Decision', label: 'Stress Response' }
        ],
        degradation: [
            { id: 'Amino Acids', label: 'Amino Acids' },
            { id: 'Nucleotides', label: 'Nucleotides' },
            { id: 'Other', label: 'Other' }
        ],
        salvage: [{ id: 'Salvage/Recycling', label: 'Salvage/Recycling' }],
        other: [{ id: 'Unclassified', label: 'Unclassified' }],
        superpathways: [{ id: 'Superpathways', label: 'Superpathways' }]
    };
    
    const SUBCATEGORY_MAP_CONSONANCE = {
        energy: [
            { id: 'Glycolysis/Gluconeogenesis', label: 'Glycolysis' },
            { id: 'Pentose Phosphate', label: 'Pentose Phosphate' },
            { id: 'TCA Cycle', label: 'TCA Cycle' },
            { id: 'Fermentation', label: 'Fermentation' },
            { id: 'Glyoxylate Cycle', label: 'Glyoxylate' },
            { id: 'Respiration', label: 'Respiration' }
        ],
        biosynthesis: [
            { id: 'Amino Acids', label: 'Amino Acids' },
            { id: 'Nucleotides', label: 'Nucleotides' },
            { id: 'Cofactors/Vitamins', label: 'Cofactors' },
            { id: 'Fatty Acids/Lipids', label: 'Lipids' },
            { id: 'Cell Wall', label: 'Cell Wall' },
            { id: 'Polyamines', label: 'Polyamines' },
            { id: 'Other', label: 'Other' }
        ],
        degradation: [
            { id: 'Amino Acids', label: 'Amino Acids' },
            { id: 'Nucleotides', label: 'Nucleotides' },
            { id: 'Aromatics', label: 'Aromatics' },
            { id: 'Carbohydrates', label: 'Carbohydrates' },
            { id: 'Other', label: 'Other' }
        ],
        salvage: [{ id: 'Salvage/Recycling', label: 'Salvage/Recycling' }],
        other: [{ id: 'Unclassified', label: 'Unclassified' }],
        superpathways: [{ id: 'Superpathways', label: 'Superpathways' }]
    };
    
    function getSubcategoryMap() {
        return currentMode === 'composed' 
            ? SUBCATEGORY_MAP_COMPOSED 
            : SUBCATEGORY_MAP_CONSONANCE;
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // EXPORT
    // ═══════════════════════════════════════════════════════════════════════════
    
    return {
        // Colors
        CATEGORY_COLORS,
        getPathwayColor,
        getPrimeLimit,
        
        // Mode
        getCurrentMode,
        switchMode,
        onModeChange,
        
        // Subcategories
        getSubcategoryMap,
        SUBCATEGORY_MAP_COMPOSED,
        SUBCATEGORY_MAP_CONSONANCE
    };
})();

// Make available globally
window.MHExtensions = MetabolicHarmonyExtensions;
