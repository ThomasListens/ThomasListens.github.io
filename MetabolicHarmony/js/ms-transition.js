// ═══════════════════════════════════════════════════════════════════════════════
// MS COMPARISON - Phase-Based Guided Attention System
// ═══════════════════════════════════════════════════════════════════════════════
// 
// This is NOT a cinematic animation. It is a guided attention system.
// Each phase answers ONE question:
//   AFFECTED: "Which pathways differ?"
//   DEPLETED: "Which are reduced in MS?"
//   ELEVATED: "Which are elevated in MS?"
//   SETTLED:  "Now see the full picture"
//
// Design principles:
//   - Each phase modifies ONE primary visual channel
//   - All values smoothed (no pops)
//   - Variables have ONE meaning (no semantic overloading)
//   - Fast enough to feel responsive (~1.5s total)
//   - Restart-safe under rapid interaction
// ═══════════════════════════════════════════════════════════════════════════════

const MSTransition = (function() {
    'use strict';
    
    // ═══════════════════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════════════════
    
    let msMode = false;
    
    // Phase progress values (each 0→1, independent)
    const msPhase = {
        affected: 0,    // Phase 1: Show which pathways are affected
        depleted: 0,    // Phase 2: Shrink depleted pathways  
        elevated: 0,    // Phase 3: Grow elevated pathways
        settled: 0,     // Phase 4: Final state emphasis
    };
    
    // Timing (in seconds) - keep SHORT for responsiveness
    const MS_PHASE_DURATION = {
        affected: 0.5,   // Quick identification
        depleted: 0.5,   // Direction reveal
        elevated: 0.5,   // Direction reveal  
        settled: 0.3,    // Settle into final state
        out: 1.5,        // Return to healthy (slower, gentler)
    };
    
    // Phase sequencing
    let msPhaseIndex = -1;  // -1=idle, 0=affected, 1=depleted, 2=elevated, 3=settled, 4=out
    let msPhaseStartTime = 0;
    let msOutCompleteTime = null;  // Track when OUT finished for graceful decay
    
    // Per-pathway smoothed states (the smoothing eliminates all pops)
    const msPathwayState = new Map();  // pathway.id -> { alpha, scale, width, dot }
    
    // MS pathway classifications (populated on mode change)
    const MS_AFFECTED_PATHWAYS = new Set();
    const MS_DEPLETED_PATHWAYS = new Set();
    const MS_ELEVATED_PATHWAYS = new Set();
    
    // ═══════════════════════════════════════════════════════════════════════════
    // PUBLIC API
    // ═══════════════════════════════════════════════════════════════════════════
    
    function isEnabled() {
        return msMode;
    }
    
    function getPhase() {
        return { ...msPhase };
    }
    
    function getPhaseIndex() {
        return msPhaseIndex;
    }
    
    function isAffected(pathwayId) {
        return MS_AFFECTED_PATHWAYS.has(pathwayId);
    }
    
    function isDepleted(pathwayId) {
        return MS_DEPLETED_PATHWAYS.has(pathwayId);
    }
    
    function isElevated(pathwayId) {
        return MS_ELEVATED_PATHWAYS.has(pathwayId);
    }
    
    function getPathwayState(pathwayId) {
        return msPathwayState.get(pathwayId) || { alpha: 0, scale: 0, width: 0, dot: 0 };
    }
    
    function getAffectedCount() {
        return MS_AFFECTED_PATHWAYS.size;
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // ENABLE/DISABLE
    // ═══════════════════════════════════════════════════════════════════════════
    
    function enable(msComparisonData) {
        msMode = true;
        
        // Start phase sequence: AFFECTED → DEPLETED → ELEVATED → SETTLED
        msPhaseIndex = 0;
        msPhaseStartTime = performance.now();
        
        // Reset phase progress
        msPhase.affected = 0;
        msPhase.depleted = 0;
        msPhase.elevated = 0;
        msPhase.settled = 0;
        
        // Clear per-pathway states (will rebuild with smoothing)
        msPathwayState.clear();
        
        // Build pathway classifications
        MS_AFFECTED_PATHWAYS.clear();
        MS_DEPLETED_PATHWAYS.clear();
        MS_ELEVATED_PATHWAYS.clear();
        
        if (msComparisonData) {
            for (const id of Object.keys(msComparisonData)) {
                MS_AFFECTED_PATHWAYS.add(id);
                const info = msComparisonData[id];
                if (info.enrichedIn === 'healthy') {
                    MS_DEPLETED_PATHWAYS.add(id);
                } else {
                    MS_ELEVATED_PATHWAYS.add(id);
                }
            }
        }
        
        console.log(`MS Transition: Phase 0 (AFFECTED) - ${MS_AFFECTED_PATHWAYS.size} pathways`);
    }
    
    function disable() {
        // Start OUT phase
        msPhaseIndex = 4;  // OUT
        msPhaseStartTime = performance.now();
        console.log('MS Transition: Phase 4 (OUT)');
    }
    
    function reset() {
        msMode = false;
        msPhaseIndex = -1;
        msPhase.affected = 0;
        msPhase.depleted = 0;
        msPhase.elevated = 0;
        msPhase.settled = 0;
        msPathwayState.clear();
        MS_AFFECTED_PATHWAYS.clear();
        MS_DEPLETED_PATHWAYS.clear();
        MS_ELEVATED_PATHWAYS.clear();
        msOutCompleteTime = null;
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // UPDATE (called once per frame)
    // ═══════════════════════════════════════════════════════════════════════════
    
    function update() {
        const now = performance.now();
        const phaseElapsed = (now - msPhaseStartTime) / 1000;
        
        // Phase durations
        const D = MS_PHASE_DURATION;
        const phaseNames = ['AFFECTED', 'DEPLETED', 'ELEVATED', 'SETTLED', 'OUT'];
        
        // Update current phase progress
        if (msPhaseIndex >= 0 && msPhaseIndex < 4) {
            // IN phases (0-3)
            const phaseDurations = [D.affected, D.depleted, D.elevated, D.settled];
            const duration = phaseDurations[msPhaseIndex];
            const progress = Math.min(phaseElapsed / duration, 1);
            
            // Update the appropriate phase
            if (msPhaseIndex === 0) msPhase.affected = progress;
            else if (msPhaseIndex === 1) msPhase.depleted = progress;
            else if (msPhaseIndex === 2) msPhase.elevated = progress;
            else if (msPhaseIndex === 3) msPhase.settled = progress;
            
            // Advance to next phase when complete
            if (progress >= 1 && msPhaseIndex < 3) {
                msPhaseIndex++;
                msPhaseStartTime = now;
                console.log(`MS Transition: Phase ${msPhaseIndex} (${phaseNames[msPhaseIndex]})`);
            }
            
        } else if (msPhaseIndex === 4) {
            // OUT phase - reverse everything
            const outProgress = Math.min(phaseElapsed / D.out, 1);
            const ease = 1 - Math.pow(1 - outProgress, 2);  // Ease out
            
            msPhase.affected = 1 - ease;
            msPhase.depleted = 1 - ease;
            msPhase.elevated = 1 - ease;
            msPhase.settled = 1 - ease;
            
            if (outProgress >= 1) {
                msPhaseIndex = -1;  // Idle
                msMode = false;
                // DO NOT clear msPathwayState yet - let it decay naturally
                msOutCompleteTime = performance.now();
                console.log('MS Transition: Idle (decaying)');
            }
        }
        
        // After OUT complete: clear state only when visually gone
        if (msPhaseIndex === -1 && msOutCompleteTime) {
            if (performance.now() - msOutCompleteTime > 800) {
                msPathwayState.clear();
                msOutCompleteTime = null;
                console.log('MS Transition: Fully reset');
            }
        }
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // APPLY TO PATHWAY (called per pathway per frame)
    // Returns visual modifications: { alpha, scale, width, dotOpacity }
    // ═══════════════════════════════════════════════════════════════════════════
    
    function applyToPathway(pathway, msComparisonData) {
        const pathwayId = pathway.id;
        const msInfo = msComparisonData ? msComparisonData[pathwayId] : null;
        const pathwayIsAffected = MS_AFFECTED_PATHWAYS.has(pathwayId);
        const pathwayIsDepleted = MS_DEPLETED_PATHWAYS.has(pathwayId);
        const pathwayIsElevated = MS_ELEVATED_PATHWAYS.has(pathwayId);
        const ldaScore = msInfo?.ldaScore || 0.5;
        
        // Get or create smoothed state for this pathway
        let pState = msPathwayState.get(pathwayId);
        if (!pState) {
            pState = { alpha: 0, scale: 0, width: 0, dot: 0 };
            msPathwayState.set(pathwayId, pState);
        }
        
        // Calculate TARGET values based on phase progress
        let targetAlpha = 0;
        let targetScale = 0;
        let targetWidth = 0;
        let targetDot = 0;
        
        // Only apply if any phase is active
        if (msPhaseIndex >= 0 || msPhase.affected > 0) {
            
            if (pathwayIsAffected) {
                // ── AFFECTED PATHWAYS ────────────────────────────
                
                // Phase 1 (AFFECTED): Brighten + thicken to show "these differ"
                targetAlpha = msPhase.affected * 0.35;
                targetWidth = msPhase.affected * 1.5;
                
                // Phase 2 (DEPLETED): Shrink height
                if (pathwayIsDepleted) {
                    targetScale = -ldaScore * 0.35 * msPhase.depleted;
                    targetDot = msPhase.depleted;  // Red dot appears
                }
                
                // Phase 3 (ELEVATED): Grow height
                if (pathwayIsElevated) {
                    targetScale = ldaScore * 0.5 * msPhase.elevated;
                    targetDot = msPhase.elevated;  // Green dot appears
                    
                    // Extra boost for small pathways
                    const baseAmp = pathway.amplitude || pathway.prevalence || 0.5;
                    if (baseAmp < 0.4) {
                        const boost = (0.4 - baseAmp) * 2.5;
                        targetScale += boost * msPhase.elevated;
                    }
                }
                
                // Phase 4 (SETTLED): Maintain emphasis
                if (msPhase.settled > 0) {
                    targetAlpha = 0.25;  // Settled emphasis
                    targetWidth = 1.0;
                }
                
            } else {
                // ── NON-AFFECTED PATHWAYS ────────────────────────
                // Duck during comparison (negative alpha = dimming)
                targetAlpha = -msPhase.affected * 0.6;
                targetWidth = -msPhase.affected * 0.5;
                
                // Extra duck during DEPLETED and ELEVATED phases
                if (msPhase.depleted > 0 || msPhase.elevated > 0) {
                    const maxDepleteElevate = Math.max(msPhase.depleted, msPhase.elevated);
                    targetAlpha = Math.min(targetAlpha, -0.7 * maxDepleteElevate);
                }
                
                // Settled: partial return
                if (msPhase.settled > 0) {
                    targetAlpha = -0.4;
                }
            }
        }
        
        // SMOOTH all values (this eliminates pops)
        const smooth = 0.12;  // Smoothing factor
        pState.alpha += (targetAlpha - pState.alpha) * smooth;
        pState.scale += (targetScale - pState.scale) * smooth;
        pState.width += (targetWidth - pState.width) * smooth;
        pState.dot += (targetDot - pState.dot) * smooth;
        
        // After OUT complete: let residual state decay gracefully (no pop)
        if (msPhaseIndex === -1 && msOutCompleteTime) {
            const decay = 0.96;  // Slower decay for smoother blend
            pState.alpha *= decay;
            pState.scale *= decay;
            pState.width *= decay;
            pState.dot *= decay;
        }
        
        // Return the modifications to apply
        return {
            alphaMod: pState.alpha,
            scaleMod: pState.scale,
            widthMod: pState.width,
            dotOpacity: pState.dot,
            isAffected: pathwayIsAffected,
            isDepleted: pathwayIsDepleted,
            isElevated: pathwayIsElevated,
            enrichedIn: msInfo?.enrichedIn
        };
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // EXPORT PUBLIC API
    // ═══════════════════════════════════════════════════════════════════════════
    
    return {
        // State queries
        isEnabled,
        getPhase,
        getPhaseIndex,
        isAffected,
        isDepleted,
        isElevated,
        getPathwayState,
        getAffectedCount,
        
        // Control
        enable,
        disable,
        reset,
        
        // Per-frame
        update,
        applyToPathway,
        
        // Constants (for external reference)
        PHASE_DURATION: MS_PHASE_DURATION
    };
})();

// Make available globally
window.MSTransition = MSTransition;
