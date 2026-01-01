/**
 * MicrobiomeSonification v7.0 - THE LIVING OCEAN
 * 
 * "The foam on the beer" - enzymatic activity that catches the light
 * 
 * Engines:
 * - SharedContext     (state, timing, focus, fairness)
 * - MMCEngine         (conductor - gut motility cycle)
 * - ReferenceToneEngine (harmonic anchor - octave pyramid)
 * - DroneEngine       (600 always-on voices - the deep ocean)
 * - CategoryEngine    (6 categories cycling - sunlight on water)
 * - EnzymaticEngine   (shimmer + micro + ripples - foam and life)
 * - PostProcessor     (chorus + delay - the unified space)
 */

// ╔════════════════════════════════════════════════════════════════════════════╗
// ║  SHARED CONTEXT                                                            ║
// ║  State and utilities shared across all engines                             ║
// ╚════════════════════════════════════════════════════════════════════════════╝

class SharedContext {
    constructor() {
        // ═══════════════════════════════════════════════════════════════════
        // TIMING
        // ═══════════════════════════════════════════════════════════════════
        this.time = 0;
        this.sampleRate = 48000;
        this.blockSize = 128;
        this.dt = 0;
        
        // ═══════════════════════════════════════════════════════════════════
        // AUDIO SETTINGS
        // ═══════════════════════════════════════════════════════════════════
        this.fundamental = 660;
        this.masterVolume = 0.4;
        
        // ═══════════════════════════════════════════════════════════════════
        // PATHWAY DATA
        // ═══════════════════════════════════════════════════════════════════
        this.pathways = [];
        this.pathwayById = new Map();
        this.pathwaysByCategory = new Map();
        this.pathwaysBySubcategory = new Map();
        
        // Harmonic relationships (built on init)
        this.harmonicRelations = new Map(); // pathwayId -> [{id, relation, strength}]
        
        // ═══════════════════════════════════════════════════════════════════
        // MMC STATE (updated by MMCEngine)
        // ═══════════════════════════════════════════════════════════════════
        this.mmcPhase = 'quiescent';
        this.mmcActivity = {
            drone: 1.0,
            category: 0.5,
            shimmer: 0.5,
            micro: 0.5,
            ripples: 0.5,
            peristalsis: 0.5,
            chorus: 0.5,
            delay: 0.5,
        };
        
        // ═══════════════════════════════════════════════════════════════════
        // FOCUS STATE
        // ═══════════════════════════════════════════════════════════════════
        this.focus = {
            id: null,
            pathway: null,
            envelope: 0,
            target: 0,
            
            // How each engine responds
            droneBoost: 6.0,
            categoryBoost: 2.0,
            enzymaticBoost: 1.5,
            duckOthers: 0.55,
            
            // Focused tone behavior
            removeModulation: true,
            triggerRipples: true,
            
            // Abundance compensation
            abundanceCompensation: {
                enabled: true,
                targetLevel: 0.7,
                strength: 0.85,
            },
            
            // Frequency compensation (boost lows when focused)
            frequencyCompensation: {
                enabled: true,
                strength: 0.35,
            },
            
            // Envelope timing
            attackTime: 0.3,
            releaseTime: 0.6,
        };
        
        // ═══════════════════════════════════════════════════════════════════
        // GAIN CONTROLS
        // ═══════════════════════════════════════════════════════════════════
        this.categoryGains = {
            energy: 1.0,
            biosynthesis: 1.0,
            degradation: 1.0,
            salvage: 1.0,
            other: 1.0,
            superpathways: 1.0,
        };
        
        // Per-category effect sends (0-1)
        this.categorySends = {
            energy:        { chorus: 0.35, delay: 0.20 },
            biosynthesis:  { chorus: 0.40, delay: 0.25 },
            degradation:   { chorus: 0.30, delay: 0.30 },
            salvage:       { chorus: 0.45, delay: 0.20 },
            other:         { chorus: 0.35, delay: 0.35 },
            superpathways: { chorus: 0.50, delay: 0.25 },
        };
        
        // ═══════════════════════════════════════════════════════════════════
        // FAIRNESS TRACKING
        // Ensures all pathways get heard over time
        // ═══════════════════════════════════════════════════════════════════
        this.fairness = {
            lastSounded: new Map(),  // pathwayId -> time
            weight: 0.3,             // How much fairness affects selection
            decayTime: 30,           // Seconds until full fairness bonus
        };
        
        // ═══════════════════════════════════════════════════════════════════
        // MS COMPARISON MODE - 3-Phase Animation
        // Phase 1: Focus affected pathways, duck non-affected
        // Phase 2: Animate enriched UP, depleted DOWN  
        // Phase 3: Soften focus, settle into context
        // ═══════════════════════════════════════════════════════════════════
        this.msMode = {
            enabled: false,
            transition: 0,
            transitionSpeed: 0.012,  // Slower for dramatic effect
            data: {},
            affectedSet: new Set(),
            // Audio parameters
            focusBoostDb: 8,
            duckOthersDb: -12,
            settledDuckDb: -4,
        };
        
        // ═══════════════════════════════════════════════════════════════════
        // RIPPLE QUEUE (EnzymaticEngine reads this)
        // ═══════════════════════════════════════════════════════════════════
        this.rippleQueue = [];
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // TIMING
    // ═══════════════════════════════════════════════════════════════════════
    
    advance(blockSize, sampleRate) {
        this.blockSize = blockSize;
        this.sampleRate = sampleRate;
        this.dt = blockSize / sampleRate;
        this.time += this.dt;
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // FOCUS METHODS
    // ═══════════════════════════════════════════════════════════════════════
    
    updateFocus() {
        const f = this.focus;
        
        if (f.target > f.envelope) {
            const attackRate = this.dt / f.attackTime;
            f.envelope += (f.target - f.envelope) * attackRate * 3;
        } else {
            const releaseRate = this.dt / f.releaseTime;
            f.envelope += (f.target - f.envelope) * releaseRate * 2.5;
            
            if (f.envelope < 0.001 && f.target === 0) {
                f.envelope = 0;
            }
        }
        
        f.envelope = Math.max(0, Math.min(1, f.envelope));
    }
    
    setFocus(pathwayId) {
        const wasFocused = this.focus.id !== null;
        const newFocus = pathwayId !== null;
        
        // Trigger ripples on new focus
        if (newFocus && this.focus.triggerRipples && pathwayId !== this.focus.id) {
            this.queueRipplesFor(pathwayId, 'focus');
        }
        
        this.focus.id = pathwayId;
        this.focus.pathway = pathwayId ? this.pathwayById.get(pathwayId) : null;
        this.focus.target = pathwayId ? 1.0 : 0.0;
    }
    
    getFocusDuck() {
        return 1.0 - (1.0 - this.focus.duckOthers) * this.focus.envelope;
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // FAIRNESS
    // ═══════════════════════════════════════════════════════════════════════
    
    markSounded(pathwayId) {
        this.fairness.lastSounded.set(pathwayId, this.time);
    }
    
    getFairnessBonus(pathwayId) {
        const lastTime = this.fairness.lastSounded.get(pathwayId) || 0;
        const timeSince = this.time - lastTime;
        const bonus = Math.min(timeSince / this.fairness.decayTime, 1);
        return bonus * this.fairness.weight;
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // MS MODE
    // ═══════════════════════════════════════════════════════════════════════
    
    updateMSMode() {
        const ms = this.msMode;
        const target = ms.enabled ? 1 : 0;
        // Faster transition back to healthy for single smooth motion
        const speed = ms.enabled ? ms.transitionSpeed : ms.transitionSpeed * 1.8;
        ms.transition += (target - ms.transition) * speed;
    }
    
    getMSScale(pathwayId) {
        const ms = this.msMode;
        if (!ms.enabled && ms.transition < 0.01) {
            return 1.0;
        }
        
        const t = ms.transition;
        const msInfo = ms.data[pathwayId];
        const isAffected = ms.affectedSet.has(pathwayId);
        
        // Phase calculations - match visual (extended phase 1)
        const phase1 = t < 0.45 ? t / 0.45 : 1;
        const phase2 = t < 0.5 ? 0 : (t < 0.8 ? (t - 0.5) / 0.3 : 1);
        const phase3 = t < 0.8 ? 0 : (t - 0.8) / 0.2;
        
        if (isAffected && msInfo) {
            // AFFECTED PATHWAY - BOOST more dramatically
            // Phase 1: Strong volume boost
            const focusBoostDb = ms.focusBoostDb * phase1;
            const focusBoost = Math.pow(10, focusBoostDb / 20);
            
            // Phase 2: Scale based on enriched/depleted - MORE DRAMATIC
            let heightScale = 1.0;
            if (msInfo.enrichedIn === 'healthy') {
                // Depleted in MS - reduce more
                heightScale = 1 - (msInfo.ldaScore * 0.6 * phase2);
            } else {
                // Enriched in MS - increase more
                heightScale = 1 + (msInfo.ldaScore * 0.5 * phase2);
            }
            
            // Phase 3: Maintain strong emphasis
            const settleBoost = 1 + (1 - phase3) * 0.15;
            
            return focusBoost * heightScale * settleBoost;
            
        } else {
            // NON-AFFECTED PATHWAY - DUCK more aggressively
            // Phase 1: Strong duck
            const duckDb = ms.duckOthersDb * phase1;
            const duckGain = Math.pow(10, duckDb / 20);
            
            // Phase 3: Minimal recovery (keep focus on MS pathways)
            const recovery = 1 + phase3 * 0.1;
            
            return duckGain * recovery;
        }
    }
    
// ═══════════════════════════════════════════════════════════════════════════
// HARMONIC RELATIONS - SIMPLIFIED & MEANINGFUL
// 
// Two ripple modes:
// 1. CATEGORICAL - ripples within same category/subcategory (metabolic grouping)
// 2. CONSONANCE - ripples toward more consonant ratios (leads to 1/1)
// 
// "All roads lead to the fundamental"
// ═══════════════════════════════════════════════════════════════════════════

buildHarmonicRelations() {
    this.harmonicRelations.clear();
    
    for (const pathway of this.pathways) {
        const related = [];
        
        const sourceConsonance = this.getConsonanceScore(pathway.n, pathway.d);
        const sourceNxD = pathway.n * pathway.d;
        
        for (const other of this.pathways) {
            if (other.id === pathway.id) continue;
            
            const otherConsonance = this.getConsonanceScore(other.n, other.d);
            const otherNxD = other.n * other.d;
            
            let strength = 0;
            let type = null;
            
            // ─────────────────────────────────────────────────────────────
            // MODE 1: CATEGORICAL RESONANCE
            // Same metabolic function = sympathetic activation
            // ─────────────────────────────────────────────────────────────
            
            if (pathway.subcategory === other.subcategory) {
                // Same subcategory = strong bond
                strength += 0.5;
                type = 'subcategory';
            } else if (pathway.category === other.category) {
                // Same category = moderate bond
                strength += 0.3;
                type = 'category';
            }
            
            // ─────────────────────────────────────────────────────────────
            // MODE 2: CONSONANCE CASCADE
            // Ripples flow TOWARD more consonant ratios
            // All paths lead to 1/1
            // ─────────────────────────────────────────────────────────────
            
            if (otherConsonance > sourceConsonance) {
                // Other is MORE consonant - this is a valid ripple target
                const consonanceGain = otherConsonance - sourceConsonance;
                
                // Stronger connection if consonance step is moderate
                // (not too small, not too huge a jump)
                const stepBonus = Math.min(consonanceGain * 2, 0.5);
                strength += stepBonus;
                
                // Extra bonus for approaching perfect consonances
                if (otherNxD <= 4) {
                    // Approaching 1/1, 2/1, 1/2, etc.
                    strength += 0.25;
                    type = type || 'toward-fundamental';
                } else if (otherNxD <= 12) {
                    // Approaching 3/2, 4/3, 3/1, etc.
                    strength += 0.15;
                    type = type || 'toward-consonance';
                } else {
                    type = type || 'consonance-step';
                }
            }
            
            // ─────────────────────────────────────────────────────────────
            // SPECIAL: Octave relations (always connected)
            // ─────────────────────────────────────────────────────────────
            
            const ratioOfRatios = pathway.ratio / other.ratio;
            const log2Ratio = Math.log2(ratioOfRatios);
            const isOctave = Math.abs(log2Ratio - Math.round(log2Ratio)) < 0.01;
            
            if (isOctave && Math.abs(log2Ratio) > 0.5) {
                strength += 0.35;
                if (!type) type = 'octave';
            }
            
            // ─────────────────────────────────────────────────────────────
            // THRESHOLD
            // ─────────────────────────────────────────────────────────────
            
            if (strength >= 0.2) {
                related.push({
                    id: other.id,
                    relation: type,
                    strength: Math.min(1.0, strength),
                    consonanceGain: otherConsonance - sourceConsonance,
                    targetNxD: otherNxD,
                });
            }
        }
        
        // Sort by strength, prioritizing consonance-leading
        related.sort((a, b) => {
            // First priority: toward-fundamental
            if (a.relation === 'toward-fundamental' && b.relation !== 'toward-fundamental') return -1;
            if (b.relation === 'toward-fundamental' && a.relation !== 'toward-fundamental') return 1;
            // Then by strength
            return b.strength - a.strength;
        });
        
        // Keep top relations
        this.harmonicRelations.set(pathway.id, related.slice(0, 10));
    }
    
    console.log(`Built harmonic relations: consonance cascade toward 1/1`);
}

// ═══════════════════════════════════════════════════════════════════════════
// RIPPLE QUEUE - CONSONANCE CASCADE
// ═══════════════════════════════════════════════════════════════════════════

queueRipplesFor(pathwayId, source = 'category') {
    const related = this.harmonicRelations.get(pathwayId);
    if (!related || related.length === 0) return;
    
    const activity = this.mmcActivity.ripples || 0.5;
    if (activity < 0.1) return;
    
    const sourcePathway = this.pathwayById.get(pathwayId);
    const sourcePan = sourcePathway ? sourcePathway.pan || 0 : 0;
    
    // More ripples during high activity
    const maxRipples = Math.floor(1 + activity * 2.5);
    let count = 0;
    
    for (const rel of related) {
        if (count >= maxRipples) break;
        
        // Probability based on strength and activity
        const probability = rel.strength * activity;
        if (Math.random() > probability) continue;
        
        // Delay based on relation type
        // Categorical = quick (same metabolic group)
        // Consonance cascade = slightly delayed (energy flowing toward fundamental)
        let baseDelay;
        switch (rel.relation) {
            case 'subcategory':
                baseDelay = 0.02;
                break;
            case 'category':
                baseDelay = 0.03;
                break;
            case 'toward-fundamental':
                baseDelay = 0.04;
                break;
            case 'toward-consonance':
                baseDelay = 0.05;
                break;
            case 'octave':
                baseDelay = 0.025;
                break;
            default:
                baseDelay = 0.06;
        }
        
        // Add variation
        const delay = baseDelay + Math.random() * 0.05;
        
        // Strength scales with how close to fundamental we're getting
        let rippleStrength = rel.strength;
        if (rel.targetNxD <= 4) {
            rippleStrength *= 1.3;  // Boost ripples approaching 1/1
        }
        
        this.rippleQueue.push({
            pathwayId: rel.id,
            triggerTime: this.time + delay,
            strength: rippleStrength * (source === 'focus' ? 1.2 : 0.8),
            relation: rel.relation,
            source,
            sourcePan,
        });
        
        count++;
    }
}
    
    // ═══════════════════════════════════════════════════════════════════════
    // UTILITY
    // ═══════════════════════════════════════════════════════════════════════
    
    getConsonanceScore(n, d) {
        const nxd = n * d;
        return 1 / Math.log2(nxd + 1);
    }
}


// ╔════════════════════════════════════════════════════════════════════════════╗
// ║  MMC ENGINE - THE CONDUCTOR                                                ║
// ║  Migrating Motor Complex - controls activity with intensity scaling        ║
// ╚════════════════════════════════════════════════════════════════════════════╝

class MMCEngine {
    constructor() {
        this.config = {
            cycleDuration: 60,
            transitionSpeed: 0.5,
            intensity: 0.4,
            
            // Base activity (when intensity = 0)
            baseActivity: {
                drone: 1.0,
                category: 0.5,
                shimmer: 0.3,
                micro: 0.4,
                ripples: 0.3,
                peristalsis: 0.2,
                chorus: 0.4,
                delay: 0.4,
            },
            
            phases: {
                quiescent: {
                    duration: 0.40,
                    activity: {
                        drone: 1.0,
                        category: 0.3,
                        shimmer: 0.15,
                        micro: 0.25,
                        ripples: 0.1,
                        peristalsis: 0.05,
                        chorus: 0.3,
                        delay: 0.5,
                    },
                },
                irregular: {
                    duration: 0.30,
                    activity: {
                        drone: 1.0,
                        category: 0.6,
                        shimmer: 0.45,
                        micro: 0.55,
                        ripples: 0.4,
                        peristalsis: 0.4,
                        chorus: 0.5,
                        delay: 0.45,
                    },
                },
                intense: {
                    duration: 0.18,
                    activity: {
                        drone: 1.0,
                        category: 1.0,
                        shimmer: 1.0,
                        micro: 1.0,
                        ripples: 1.0,
                        peristalsis: 1.0,
                        chorus: 0.7,
                        delay: 0.35,
                    },
                },
                transition: {
                    duration: 0.12,
                    activity: {
                        drone: 1.0,
                        category: 0.5,
                        shimmer: 0.3,
                        micro: 0.4,
                        ripples: 0.25,
                        peristalsis: 0.3,
                        chorus: 0.45,
                        delay: 0.5,
                    },
                },
            },
        };
        
        this.currentPhase = 'quiescent';
        this.phaseTime = 0;
        this.cycleTime = 0;
        this.activity = { ...this.config.baseActivity };
    }
    
    update(ctx) {
        const cfg = this.config;
        
        this.cycleTime += ctx.dt;
        this.phaseTime += ctx.dt;
        
        // Check phase transition
        const phaseDuration = cfg.phases[this.currentPhase].duration * cfg.cycleDuration;
        
        if (this.phaseTime >= phaseDuration) {
            this.phaseTime = 0;
            this.advancePhase();
        }
        
        // Blend toward target
        const phaseTarget = cfg.phases[this.currentPhase].activity;
        const intensity = cfg.intensity;
        
        for (const key in this.activity) {
            const base = cfg.baseActivity[key] ?? 0.5;
            const target = phaseTarget[key] ?? 0.5;
            const scaledTarget = base + (target - base) * intensity;
            this.activity[key] += (scaledTarget - this.activity[key]) * cfg.transitionSpeed * ctx.dt;
        }
        
        // Write to context
        ctx.mmcPhase = this.currentPhase;
        ctx.mmcActivity = this.activity;
    }
    
    advancePhase() {
        const phases = ['quiescent', 'irregular', 'intense', 'transition'];
        const idx = phases.indexOf(this.currentPhase);
        this.currentPhase = phases[(idx + 1) % phases.length];
    }
    
    setIntensity(value) {
        this.config.intensity = Math.max(0, Math.min(1, value));
    }
    
    setCycleDuration(seconds) {
        this.config.cycleDuration = Math.max(10, seconds);
    }
    
    setPhase(phase) {
        if (this.config.phases[phase]) {
            this.currentPhase = phase;
            this.phaseTime = 0;
        }
    }
    
    setBaseActivity(layer, value) {
        if (this.config.baseActivity[layer] !== undefined) {
            this.config.baseActivity[layer] = Math.max(0, Math.min(1, value));
        }
    }
    
    getPhaseProgress() {
        const duration = this.config.phases[this.currentPhase].duration * this.config.cycleDuration;
        return this.phaseTime / duration;
    }
}

// ╔════════════════════════════════════════════════════════════════════════════╗
// ║  REFERENCE TONE ENGINE - THE HARMONIC ANCHOR                               ║
// ║  Octave pyramid that grounds the entire harmonic space                     ║
// ║  Ducks intelligently when focused ratio matches                            ║
// ╚════════════════════════════════════════════════════════════════════════════╝

class ReferenceToneEngine {
    constructor() {
        this.config = {
            mixLevel: 0.09,
            
            // Octave pyramid - symmetrical around the fundamental
            tones: [
                { n: 1, d: 4, amp: 0.06, pan: -0.7 },  // 2 octaves below
                { n: 1, d: 2, amp: 0.20, pan: -0.35 }, // 1 octave below
                { n: 1, d: 1, amp: 1.00, pan: 0.0 },   // Fundamental
                { n: 2, d: 1, amp: 0.20, pan: 0.35 },  // 1 octave above
                { n: 4, d: 1, amp: 0.06, pan: 0.7 },   // 2 octaves above
            ],
            
            // Focus behavior
            focus: {
                duckWhenMatches: true,
                duckMatchAmount: 0.85,
                duckOctaveRelated: true,
                duckOctaveAmount: 0.4,
                boostFundamental: 1.8,
                boostOthers: 1.3,
            },
            
            // Subtle breathing
            breathing: {
                enabled: true,
                rate: 0.02,
                depth: 0.06,
            },
        };
        
        this.voices = [];
        this.breathPhase = Math.random() * Math.PI * 2;
        this.initialized = false;
    }
    
    init(ctx) {
        this.voices = [];
        
        for (const tone of this.config.tones) {
            const ratio = tone.n / tone.d;
            
            this.voices.push({
                n: tone.n,
                d: tone.d,
                ratio,
                frequency: ctx.fundamental * ratio,
                baseAmplitude: tone.amp,
                pan: tone.pan,
                phase: Math.random() * Math.PI * 2,
                isFundamental: (tone.n === 1 && tone.d === 1),
            });
        }
        
        this.initialized = true;
    }
    
    ratiosMatch(r1, r2, tolerance = 0.001) {
        return Math.abs(r1 - r2) < tolerance;
    }
    
    areOctaveRelated(r1, r2) {
        if (r1 <= 0 || r2 <= 0) return false;
        const logRatio = Math.log2(r1 / r2);
        return Math.abs(logRatio - Math.round(logRatio)) < 0.01;
    }
    
    process(ctx, outputL, outputR) {
        if (!this.initialized || this.voices.length === 0) return;
        
        const cfg = this.config;
        const focusCfg = cfg.focus;
        const sr = ctx.sampleRate;
        const twoPi = Math.PI * 2;
        
        // Update breathing
        if (cfg.breathing.enabled) {
            this.breathPhase += twoPi * cfg.breathing.rate * ctx.dt;
            if (this.breathPhase > twoPi) this.breathPhase -= twoPi;
        }
        const breathMod = 1 + Math.sin(this.breathPhase) * cfg.breathing.depth;
        
        // Focus state
        const focusActive = ctx.focus.envelope > 0.01;
        const focusEnv = ctx.focus.envelope;
        const focusedRatio = ctx.focus.pathway?.ratio ?? null;
        
        for (const voice of this.voices) {
            // Apply cascade fade if active
            const cascadeFade = ctx.getCascadeFade ? ctx.getCascadeFade(voice.pathwayId) : 1;
            
            // Apply MS mode scaling - THIS IS KEY for hearing the difference
            const msScale = ctx.getMSScale ? ctx.getMSScale(voice.pathwayId) : 1;
            
            let amp = voice.baseAmplitude * cfg.mixLevel * ctx.masterVolume * breathMod * cascadeFade * msScale;
            
            // Focus interactions
            if (focusActive && focusedRatio !== null) {
                const exactMatch = this.ratiosMatch(voice.ratio, focusedRatio);
                const octaveMatch = focusCfg.duckOctaveRelated && 
                                   this.areOctaveRelated(voice.ratio, focusedRatio);
                
                if (exactMatch && focusCfg.duckWhenMatches) {
                    // Duck if we ARE the focused ratio
                    amp *= 1 - (focusEnv * focusCfg.duckMatchAmount);
                } else if (octaveMatch && !exactMatch) {
                    // Partial duck for octave relations
                    amp *= 1 - (focusEnv * focusCfg.duckOctaveAmount);
                } else {
                    // Boost to provide harmonic context
                    const boost = voice.isFundamental 
                        ? focusCfg.boostFundamental 
                        : focusCfg.boostOthers;
                    amp *= 1 + (boost - 1) * focusEnv;
                }
            }
            
            // Stereo
            const panAngle = (voice.pan + 1) * Math.PI / 4;
            const gainL = Math.cos(panAngle);
            const gainR = Math.sin(panAngle);
            
            const phaseInc = (twoPi * voice.frequency) / sr;
            
            for (let i = 0; i < ctx.blockSize; i++) {
                const sample = Math.sin(voice.phase) * amp;
                
                outputL[i] += sample * gainL;
                outputR[i] += sample * gainR;
                
                voice.phase += phaseInc;
                if (voice.phase > twoPi) voice.phase -= twoPi;
            }
        }
    }
    
    updateFrequencies(ctx) {
        for (const voice of this.voices) {
            voice.frequency = ctx.fundamental * voice.ratio;
        }
    }
    
    setMixLevel(value) {
        this.config.mixLevel = Math.max(0, Math.min(1, value));
    }
    
    setBreathing(options) {
        Object.assign(this.config.breathing, options);
    }
    
    setFocusBehavior(options) {
        Object.assign(this.config.focus, options);
    }
    
    getVoices() {
        return this.voices.map(v => ({
            ratio: `${v.n}/${v.d}`,
            frequency: v.frequency,
            amp: v.baseAmplitude,
            pan: v.pan,
            isFundamental: v.isFundamental,
        }));
    }
}


// ╔════════════════════════════════════════════════════════════════════════════╗
// ║  DRONE ENGINE - THE DEEP OCEAN                                             ║
// ║  600 always-on voices, each breathing independently                        ║
// ║  Peristaltic waves sweep through frequency space                           ║
// ║  Focus rises from the depths with abundance compensation                   ║
// ╚════════════════════════════════════════════════════════════════════════════╝

class DroneEngine {
    constructor() {
        this.config = {
            voiceCount: 600,
            mixLevel: 1.0,
            
            // Consonance decay - quieter as n×d increases
            consonanceDecay: {
                enabled: true,
                curve: 'logarithmic',  // 'exponential', 'linear', 'logarithmic'
                strength: 2.5,
                floor: 0.02,           // Minimum multiplier
            },
            
            // Individual voice breathing
            breathing: {
                rateRange: [0.05, 0.5],
                depthRange: [0.1, 1.1],
                wander: {
                    enabled: true,
                    speed: 0.012,
                    amount: 0.15,
                },
            },
            
            // Global modulation (whole drone breathes together too)
            globalMod: {
                rate: 0.025,
                depth: 0.16,
            },
            
            // Focus behavior
            focus: {
                boost: 25.0,
                removeModulation: true,
                abundanceCompensation: {
                    enabled: true,
                    targetLevel: 0.7,
                    strength: 0.85,
                },
                frequencyCompensation: {
                    enabled: true,
                    strength: 0.4,
                    lowBoost: true,    // Only boost frequencies below fundamental
                },
            },
            
            // Peristalsis - waves through frequency space
            peristalsis: {
                enabled: true,
                interval: 7,           // Seconds between waves
                intervalVariation: 4,
                duration: 3.5,         // How long wave takes to cross
                width: 0.7,            // Octaves
                boostAmount: 1.6,
                direction: 'random',   // 'up', 'down', 'both', 'random'
            },
        };
        
        this.voices = [];
        this.globalModPhase = Math.random() * Math.PI * 2;
        this.initialized = false;
        
        // Peristalsis state
        this.peristalsis = {
            active: false,
            progress: 0,
            direction: 1,
            nextWaveIn: 2 + Math.random() * 3,
        };
    }
    
    init(ctx) {
        this.selectVoices(ctx);
        this.initialized = true;
    }
    
    selectVoices(ctx) {
        const cfg = this.config;
        const breathCfg = cfg.breathing;
        const [minRate, maxRate] = breathCfg.rateRange;
        const [minDepth, maxDepth] = breathCfg.depthRange;
        
        // Score pathways by consonance + abundance
        const scored = ctx.pathways.map(p => {
            const consonance = ctx.getConsonanceScore(p.n, p.d);
            const score = consonance * 0.6 + p.abundance * 0.4;
            return { pathway: p, score };
        });
        
        scored.sort((a, b) => b.score - a.score);
        
        const count = Math.min(cfg.voiceCount, scored.length);
        this.voices = [];
        
        for (let i = 0; i < count; i++) {
            const { pathway } = scored[i];
            const nxd = pathway.n * pathway.d;
            
            // More dissonant = faster, shallower breathing
            const consonance = ctx.getConsonanceScore(pathway.n, pathway.d);
            const breathRate = maxRate - consonance * (maxRate - minRate) * 0.7 
                             + Math.random() * (maxRate - minRate) * 0.3;
            const breathDepth = minDepth + consonance * (maxDepth - minDepth) * 0.6
                              + Math.random() * (maxDepth - minDepth) * 0.4;
            
            this.voices.push({
                pathwayId: pathway.id,
                pathwayIndex: pathway.index,
                n: pathway.n,
                d: pathway.d,
                nxd,
                ratio: pathway.ratio,
                frequency: ctx.fundamental * pathway.ratio,
                category: pathway.category,
                abundance: pathway.abundance,
                baseAmplitude: pathway.baseVolume,
                
                // Oscillator
                phase: Math.random() * Math.PI * 2,
                
                // Breathing
                breathPhase: Math.random() * Math.PI * 2,
                breathRate,
                breathRateBase: breathRate,
                breathRateWander: Math.random() * Math.PI * 2,
                breathDepth,
                breathDepthBase: breathDepth,
                breathDepthWander: Math.random() * Math.PI * 2,
                
                // Stereo
                pan: (Math.random() - 0.5) * 0.5,
            });
        }
    }
    
    getConsonanceMultiplier(nxd) {
        const cfg = this.config.consonanceDecay;
        if (!cfg.enabled) return 1.0;
        
        let mult;
        switch (cfg.curve) {
            case 'exponential':
                mult = Math.exp(-cfg.strength * Math.log(nxd) * 0.3);
                break;
            case 'linear':
                mult = Math.max(cfg.floor, 1 - (nxd / 100) * cfg.strength * 0.1);
                break;
            case 'logarithmic':
            default:
                mult = 1 / Math.pow(Math.log2(nxd + 1), cfg.strength);
                break;
        }
        
        return Math.max(cfg.floor, mult);
    }
    
    updateBreathing(voice, ctx) {
        const cfg = this.config.breathing;
        const wander = cfg.wander;
        const twoPi = Math.PI * 2;
        
        if (wander.enabled) {
            voice.breathRateWander += twoPi * wander.speed * ctx.dt;
            voice.breathDepthWander += twoPi * wander.speed * 0.7 * ctx.dt;
            
            if (voice.breathRateWander > twoPi) voice.breathRateWander -= twoPi;
            if (voice.breathDepthWander > twoPi) voice.breathDepthWander -= twoPi;
            
            const [minRate, maxRate] = cfg.rateRange;
            const [minDepth, maxDepth] = cfg.depthRange;
            
            const rateOffset = Math.sin(voice.breathRateWander) * (maxRate - minRate) * wander.amount;
            const depthOffset = Math.sin(voice.breathDepthWander) * (maxDepth - minDepth) * wander.amount;
            
            voice.breathRate = Math.max(minRate, Math.min(maxRate, voice.breathRateBase + rateOffset));
            voice.breathDepth = Math.max(minDepth, Math.min(maxDepth, voice.breathDepthBase + depthOffset));
        }
        
        voice.breathPhase += twoPi * voice.breathRate * ctx.dt;
        if (voice.breathPhase > twoPi) voice.breathPhase -= twoPi;
    }
    
    updatePeristalsis(ctx) {
        const cfg = this.config.peristalsis;
        if (!cfg.enabled) return;
        
        const p = this.peristalsis;
        const activity = ctx.mmcActivity.peristalsis ?? 0.5;
        
        if (!p.active) {
            p.nextWaveIn -= ctx.dt;
            
            if (p.nextWaveIn <= 0 && activity > 0.1 && Math.random() < activity) {
                this.startPeristalticWave();
            } else if (p.nextWaveIn <= 0) {
                p.nextWaveIn = cfg.interval * 0.5 + Math.random() * cfg.intervalVariation;
            }
        } else {
            p.progress += ctx.dt / cfg.duration;
            
            if (p.progress >= 1) {
                p.active = false;
                p.nextWaveIn = cfg.interval + (Math.random() - 0.5) * cfg.intervalVariation * 2;
            }
        }
    }
    
    startPeristalticWave() {
        const cfg = this.config.peristalsis;
        const p = this.peristalsis;
        
        p.active = true;
        p.progress = 0;
        
        if (cfg.direction === 'random') {
            const roll = Math.random();
            if (roll < 0.4) p.direction = 1;       // Up
            else if (roll < 0.8) p.direction = -1; // Down
            else p.direction = 0;                   // Both (expanding)
        } else if (cfg.direction === 'up') {
            p.direction = 1;
        } else if (cfg.direction === 'down') {
            p.direction = -1;
        } else {
            p.direction = 0;
        }
    }
    
    getPeristalticBoost(voice) {
        const cfg = this.config.peristalsis;
        const p = this.peristalsis;
        
        if (!cfg.enabled || !p.active) return 1.0;
        
        // Voice position in octave space
        const voiceOctave = Math.log2(voice.ratio);
        const minOctave = -3;
        const maxOctave = 4;
        const octaveRange = maxOctave - minOctave;
        
        // Wave envelope (fade in/out)
        let waveEnv = 1.0;
        if (p.progress < 0.15) {
            waveEnv = p.progress / 0.15;
        } else if (p.progress > 0.85) {
            waveEnv = (1 - p.progress) / 0.15;
        }
        
        let boost = 1.0;
        
        if (p.direction === 0) {
            // Expanding from center
            const spread = p.progress * octaveRange / 2;
            const distFromCenter = Math.abs(voiceOctave);
            
            if (distFromCenter <= spread && distFromCenter >= spread - cfg.width) {
                const localPos = (spread - distFromCenter) / cfg.width;
                const shape = Math.sin(localPos * Math.PI);
                boost = 1 + (cfg.boostAmount - 1) * shape * waveEnv;
            }
        } else {
            // Sweeping up or down
            let waveCenter;
            if (p.direction > 0) {
                waveCenter = minOctave + p.progress * octaveRange;
            } else {
                waveCenter = maxOctave - p.progress * octaveRange;
            }
            
            const distance = Math.abs(voiceOctave - waveCenter);
            
            if (distance < cfg.width) {
                const localPos = 1 - (distance / cfg.width);
                const shape = Math.sin(localPos * Math.PI * 0.5);
                boost = 1 + (cfg.boostAmount - 1) * shape * waveEnv;
            }
        }
        
        return boost;
    }
    
    getFocusedAmplitude(voice, ctx) {
        const focusCfg = this.config.focus;
        const isFocused = ctx.focus.id === voice.pathwayId;
        
        if (!isFocused) {
            return voice.baseAmplitude * ctx.getFocusDuck();
        }
        
        // Abundance compensation
        const comp = focusCfg.abundanceCompensation;
        let baseLevel = voice.baseAmplitude;
        
        if (comp.enabled) {
            const target = comp.targetLevel;
            baseLevel = baseLevel + (target - baseLevel) * comp.strength;
        }
        
        // Frequency compensation (boost lows)
        const freqComp = focusCfg.frequencyCompensation;
        let freqMult = 1.0;
        
        if (freqComp.enabled && freqComp.lowBoost && voice.ratio < 1) {
            freqMult = 1 + (1 - voice.ratio) * freqComp.strength * 2;
        }
        
        const focusedLevel = baseLevel * focusCfg.boost * freqMult;
        
        // Blend based on focus envelope
        return voice.baseAmplitude + (focusedLevel - voice.baseAmplitude) * ctx.focus.envelope;
    }
    
    process(ctx, outputL, outputR, chorusSendL, chorusSendR, delaySendL, delaySendR) {
        if (!this.initialized || this.voices.length === 0) return;
        
        const cfg = this.config;
        const focusCfg = cfg.focus;
        const sr = ctx.sampleRate;
        const twoPi = Math.PI * 2;
        
        // Update peristalsis
        this.updatePeristalsis(ctx);
        
        // Global modulation
        this.globalModPhase += twoPi * cfg.globalMod.rate * ctx.dt;
        if (this.globalModPhase > twoPi) this.globalModPhase -= twoPi;
        const globalMod = 1 + Math.sin(this.globalModPhase) * cfg.globalMod.depth;
        
        // MMC activity
        const activity = ctx.mmcActivity.drone ?? 1.0;
        
        for (const voice of this.voices) {
            this.updateBreathing(voice, ctx);
            
            const isFocused = ctx.focus.id === voice.pathwayId;
            
            // Breathing envelope
            let breathEnv;
            if (isFocused && focusCfg.removeModulation) {
                const rawBreath = Math.sin(voice.breathPhase);
                const normalEnv = 1 - voice.breathDepth + voice.breathDepth * (rawBreath * rawBreath);
                breathEnv = normalEnv + (1.0 - normalEnv) * ctx.focus.envelope;
            } else {
                const rawBreath = Math.sin(voice.breathPhase);
                breathEnv = 1 - voice.breathDepth + voice.breathDepth * (rawBreath * rawBreath);
            }
            
            // Amplitude chain
            const consonanceMult = this.getConsonanceMultiplier(voice.nxd);
            const focusedAmp = this.getFocusedAmplitude(voice, ctx);
            const peristalticBoost = this.getPeristalticBoost(voice);
            const msMult = ctx.getMSScale(voice.pathwayId);
            const categoryGain = ctx.categoryGains[voice.category] ?? 1.0;
            
            // Global mod fades out when focused
            let globalModApplied = globalMod;
            if (isFocused && focusCfg.removeModulation) {
                globalModApplied = 1 + (globalMod - 1) * (1 - ctx.focus.envelope);
            }
            
            // Cascade fade
            const cascadeFade = ctx.getCascadeFade ? ctx.getCascadeFade(voice.pathwayId) : 1;
            
            const amp = focusedAmp *
                       consonanceMult *
                       breathEnv *
                       globalModApplied *
                       activity *
                       msMult *
                       categoryGain *
                       peristalticBoost *
                       cfg.mixLevel *
                       ctx.masterVolume *
                       cascadeFade;
            
            if (amp < 0.00001) continue;
            
            // Stereo
            const panAngle = (voice.pan + 1) * Math.PI / 4;
            const gainL = Math.cos(panAngle);
            const gainR = Math.sin(panAngle);
            
            // Effect sends (per-category)
            const sends = ctx.categorySends[voice.category] || { chorus: 0.3, delay: 0.3 };
            const chorusAmt = sends.chorus * 0.3;  // Drone is subtle in effects
            const delayAmt = sends.delay * 0.25;
            
            const phaseInc = (twoPi * voice.frequency) / sr;
            
            for (let i = 0; i < ctx.blockSize; i++) {
                const sample = Math.sin(voice.phase) * amp;
                const sampleL = sample * gainL;
                const sampleR = sample * gainR;
                
                outputL[i] += sampleL;
                outputR[i] += sampleR;
                
                // Effect sends
                chorusSendL[i] += sampleL * chorusAmt;
                chorusSendR[i] += sampleR * chorusAmt;
                delaySendL[i] += sampleL * delayAmt;
                delaySendR[i] += sampleR * delayAmt;
                
                voice.phase += phaseInc;
                if (voice.phase > twoPi) voice.phase -= twoPi;
            }
        }
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // CONFIGURATION API
    // ═══════════════════════════════════════════════════════════════════════
    
    setMixLevel(value) {
        this.config.mixLevel = Math.max(0, Math.min(1, value));
    }
    
    setVoiceCount(count, ctx) {
        this.config.voiceCount = Math.max(1, Math.min(650, count));
        if (ctx && this.initialized) {
            this.selectVoices(ctx);
        }
    }
    
    setConsonanceDecay(options) {
        Object.assign(this.config.consonanceDecay, options);
    }
    
    setBreathing(options) {
        if (options.rateRange) this.config.breathing.rateRange = options.rateRange;
        if (options.depthRange) this.config.breathing.depthRange = options.depthRange;
        if (options.wander) Object.assign(this.config.breathing.wander, options.wander);
    }
    
    setGlobalMod(options) {
        Object.assign(this.config.globalMod, options);
    }
    
    setFocusConfig(options) {
        if (options.boost !== undefined) this.config.focus.boost = options.boost;
        if (options.removeModulation !== undefined) this.config.focus.removeModulation = options.removeModulation;
        if (options.abundanceCompensation) {
            Object.assign(this.config.focus.abundanceCompensation, options.abundanceCompensation);
        }
        if (options.frequencyCompensation) {
            Object.assign(this.config.focus.frequencyCompensation, options.frequencyCompensation);
        }
    }
    
    setPeristalsis(options) {
        Object.assign(this.config.peristalsis, options);
    }
    
    triggerPeristalticWave(direction) {
        if (direction) this.config.peristalsis.direction = direction;
        this.peristalsis.nextWaveIn = 0;
    }
    
    updateFrequencies(ctx) {
        for (const voice of this.voices) {
            voice.frequency = ctx.fundamental * voice.ratio;
        }
    }
    
    getActiveVoices() {
        return this.voices.map(v => ({
            id: v.pathwayId,
            ratio: `${v.n}/${v.d}`,
            nxd: v.nxd,
            category: v.category,
            breathPhase: v.breathPhase,
        }));
    }
    
    getPeristalticState() {
        return {
            active: this.peristalsis.active,
            progress: this.peristalsis.progress,
            direction: this.peristalsis.direction,
            nextWaveIn: this.peristalsis.nextWaveIn,
        };
    }
}
// ╔════════════════════════════════════════════════════════════════════════════╗
// ║  CATEGORY ENGINE - SUNLIGHT ON WATER                                       ║
// ║                                                                            ║
// ║  6 metabolic categories, each with distinct sonic character                ║
// ║  Voices cycle through attack → sustain → release                           ║
// ║  Spawns trigger ripples in the EnzymaticEngine                            ║
// ║                                                                            ║
// ║  Categories:                                                               ║
// ║    Energy (51)        - Fast, shimmering, glycolysis core                 ║
// ║    Biosynthesis (288) - Warm, layered, building molecules                 ║
// ║    Degradation (160)  - Darker, varied, breaking down                     ║
// ║    Salvage (17)       - Pure, consonant, 3-limit recycling               ║
// ║    Other (74)         - Ambient, wide, atmospheric                        ║
// ║    Superpathways (10) - Smooth, integrative, superparticular             ║
// ╚════════════════════════════════════════════════════════════════════════════╝

class CategoryEngine {
    constructor() {
        // ═══════════════════════════════════════════════════════════════════
        // CATEGORY CONFIGURATIONS
        // ═══════════════════════════════════════════════════════════════════
        this.categoryConfigs = {
            
            // ───────────────────────────────────────────────────────────────
            // ENERGY - The metabolic heartbeat
            // Glycolysis, TCA cycle, fermentation, electron transport
            // Fast, present, vital
            // ───────────────────────────────────────────────────────────────
            energy: {
                enabled: true,
                mixLevel: 0.35,  // Slightly reduced
                
                spawn: {
                    baseRate: 2.5,        // SLOWER spawning for clarity
                    variation: 0.3,
                },
                
                envelope: {
                    attack: [1.5, 2.0],   // Slower attack
                    sustain: [4.0, 8.0],  // MUCH longer sustain
                    release: [1.5, 2.5],  // Longer release
                },
                
                weighting: {
                    consonance: 0.45,
                    abundance: 0.60,
                    fairness: 0.15,
                },
                
                maxVoices: 25,    // Reduced for clarity
                initialVoices: 15,
                panSpread: 0.7,
                
                // How strongly this category triggers ripples
                rippleStrength: 0.6,
                
                // Effect sends (additional to ctx.categorySends)
                effectBoost: { chorus: 1.0, delay: 0.8 },
            },
            
            // ───────────────────────────────────────────────────────────────
            // BIOSYNTHESIS - The builders
            // Amino acids, nucleotides, cofactors, lipids, cell structures
            // Warm, layered, constructive
            // ───────────────────────────────────────────────────────────────
            biosynthesis: {
                enabled: true,
                mixLevel: 0.32,  // Slightly reduced
                
                spawn: {
                    baseRate: 3.0,        // SLOWER
                    variation: 0.35,
                },
                
                envelope: {
                    attack: [1.2, 2.0],   // Slower
                    sustain: [5.0, 10.0], // MUCH longer
                    release: [2.0, 3.0],  // Longer
                },
                
                weighting: {
                    consonance: 0.35,
                    abundance: 0.60,
                    fairness: 0.15,
                },
                
                maxVoices: 35,    // Reduced
                initialVoices: 20,
                panSpread: 0.5,
                
                rippleStrength: 0.5,
                effectBoost: { chorus: 1.2, delay: 1.0 },
            },
            
            // ───────────────────────────────────────────────────────────────
            // DEGRADATION - The recyclers
            // Breaking down amino acids, nucleotides, aromatics, sugars
            // Darker, more active, varied
            // ───────────────────────────────────────────────────────────────
            degradation: {
                enabled: true,
                mixLevel: 0.28,
                
                spawn: {
                    baseRate: 2.5,       // SLOWER
                    variation: 0.4,
                },
                
                envelope: {
                    attack: [0.8, 1.5],   // Slower
                    sustain: [4.0, 8.0],  // Longer
                    release: [1.2, 2.0],  // Longer
                },
                
                weighting: {
                    consonance: 0.30,
                    abundance: 0.60,
                    fairness: 0.20,
                },
                
                maxVoices: 25,    // Reduced
                initialVoices: 15,
                panSpread: 0.65,
                
                rippleStrength: 0.55,
                effectBoost: { chorus: 0.9, delay: 1.3 },
            },
            
            // ───────────────────────────────────────────────────────────────
            // SALVAGE - The conservers
            // Nucleotide recycling, 3-limit harmonics (most pure)
            // Clear, bell-like, economical
            // ───────────────────────────────────────────────────────────────
            salvage: {
                enabled: true,
                mixLevel: 0.45,
                
                spawn: {
                    baseRate: 0.8,       // SLOWER - salvage is rare
                    variation: 0.25,
                },
                
                envelope: {
                    attack: [1.0, 2.0],   // Slower
                    sustain: [6.0, 10.0], // LONG
                    release: [2.0, 3.0],  // Long
                },
                
                weighting: {
                    consonance: 0.65,      // Heavily favor consonance
                    abundance: 0.45,
                    fairness: 0.10,
                },
                
                maxVoices: 12,    // Reduced
                initialVoices: 6,
                panSpread: 0.4,
                
                rippleStrength: 0.7,       // Pure tones ripple strongly
                effectBoost: { chorus: 1.4, delay: 0.9 },
            },
            
            // ───────────────────────────────────────────────────────────────
            // OTHER - The background
            // Unclassified pathways, metabolic miscellany
            // Wide, ambient, spacious
            // ───────────────────────────────────────────────────────────────
            other: {
                enabled: true,
                mixLevel: 0.35,
                
                spawn: {
                    baseRate: 2.0,       // SLOWER
                    variation: 0.5,
                },
                
                envelope: {
                    attack: [1.5, 2.5],   // Slower
                    sustain: [6.0, 10.0], // Longer
                    release: [2.5, 4.0],  // Longer
                },
                
                weighting: {
                    consonance: 0.35,
                    abundance: 0.65,
                    fairness: 0.25,
                },
                
                maxVoices: 20,    // Reduced
                initialVoices: 10,
                panSpread: 0.95,
                
                rippleStrength: 0.35,
                effectBoost: { chorus: 1.0, delay: 1.4 },
            },
            
            // ───────────────────────────────────────────────────────────────
            // SUPERPATHWAYS - The integrators
            // Large multi-step pathways, superparticular ratios (n+1/n)
            // Smooth, flowing, connected
            // ───────────────────────────────────────────────────────────────
            superpathways: {
                enabled: true,
                mixLevel: 0.45,
                
                spawn: {
                    baseRate: 1.5,       // SLOWER
                    variation: 0.3,
                },
                
                envelope: {
                    attack: [2.0, 3.0],   // Slow
                    sustain: [8.0, 12.0], // VERY long
                    release: [2.5, 4.0],  // Long
                },
                
                weighting: {
                    consonance: 0.50,
                    abundance: 0.35,
                    fairness: 0.35,
                },
                
                maxVoices: 6,
                initialVoices: 3,
                panSpread: 0.45,
                
                rippleStrength: 0.65,
                effectBoost: { chorus: 1.3, delay: 1.0 },
            },
        };
        
        // ═══════════════════════════════════════════════════════════════════
        // STATE
        // ═══════════════════════════════════════════════════════════════════
        this.categoryState = {};
        this.voices = [];
        this.initialized = false;
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════════════════
    
    init(ctx) {
        this.categoryState = {};
        this.voices = [];
        
        for (const [category, config] of Object.entries(this.categoryConfigs)) {
            const pathways = ctx.pathwaysByCategory.get(category) || [];
            
            // Build scored pool
            const pool = pathways.map(p => ({
                ...p,
                consonanceScore: ctx.getConsonanceScore(p.n, p.d),
            }));
            
            // Pre-sort by weighted score (will re-weight on selection for fairness)
            const w = config.weighting;
            pool.sort((a, b) => {
                const scoreA = a.consonanceScore * w.consonance + a.abundance * w.abundance;
                const scoreB = b.consonanceScore * w.consonance + b.abundance * w.abundance;
                return scoreB - scoreA;
            });
            
            this.categoryState[category] = {
                pool,
                spawnAccumulator: Math.random() * 0.5,  // Stagger initial spawns
            };
            
            // Pre-populate voices
            if (pool.length > 0 && config.initialVoices > 0) {
                this.prepopulateCategory(category, config, ctx);
            }
        }
        
        this.initialized = true;
        
        // Log stats
        const total = this.voices.length;
        const byCat = {};
        for (const v of this.voices) {
            byCat[v.category] = (byCat[v.category] || 0) + 1;
        }
        console.log(`CategoryEngine initialized: ${total} voices`, byCat);
    }
    
    prepopulateCategory(category, config, ctx) {
        const state = this.categoryState[category];
        const count = Math.min(config.initialVoices, config.maxVoices, state.pool.length);
        
        for (let i = 0; i < count; i++) {
            const pathway = this.selectPathway(category, ctx);
            if (!pathway) continue;
            
            const voice = this.createVoice(category, pathway, ctx);
            
            // Stagger lifecycle
            const totalDuration = voice.attackTime + voice.sustainTime + voice.releaseTime;
            const randomProgress = Math.random() * totalDuration;
            
            if (randomProgress < voice.attackTime) {
                voice.phase = 'attack';
                voice.time = randomProgress;
                voice.envelope = randomProgress / voice.attackTime;
            } else if (randomProgress < voice.attackTime + voice.sustainTime) {
                voice.phase = 'sustain';
                voice.time = randomProgress - voice.attackTime;
                voice.envelope = 1;
            } else {
                voice.phase = 'release';
                voice.time = randomProgress - voice.attackTime - voice.sustainTime;
                voice.envelope = 1 - (voice.time / voice.releaseTime);
            }
            
            this.voices.push(voice);
        }
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // PATHWAY SELECTION (with fairness)
    // ═══════════════════════════════════════════════════════════════════════
    
    selectPathway(category, ctx) {
        const state = this.categoryState[category];
        const config = this.categoryConfigs[category];
        const pool = state.pool;
        
        if (pool.length === 0) return null;
        
        const w = config.weighting;
        
        // Calculate weights including fairness and MS scaling
        const weights = pool.map(p => {
            const msScale = ctx.getMSScale(p.id);
            const effectiveAbundance = p.abundance * msScale;
            const fairnessBonus = ctx.getFairnessBonus(p.id);
            
            const score = p.consonanceScore * w.consonance +
                         effectiveAbundance * w.abundance +
                         fairnessBonus * w.fairness;
            
            return Math.max(0.01, score);
        });
        
        // Weighted random selection
        const totalWeight = weights.reduce((sum, w) => sum + w, 0);
        let r = Math.random() * totalWeight;
        
        for (let i = 0; i < pool.length; i++) {
            r -= weights[i];
            if (r <= 0) return pool[i];
        }
        
        return pool[0];
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // VOICE CREATION
    // ═══════════════════════════════════════════════════════════════════════
    
    createVoice(category, pathway, ctx) {
        const config = this.categoryConfigs[category];
        const env = config.envelope;
        const w = config.weighting;
        
        // More consonant = longer sustain
        const sustainBonus = 1 + pathway.consonanceScore * 0.5;
        
        const attackTime = this.randomInRange(env.attack);
        const sustainTime = this.randomInRange(env.sustain) * sustainBonus;
        const releaseTime = this.randomInRange(env.release);
        
        return {
            category,
            pathwayId: pathway.id,
            pathway,
            subcategory: pathway.subcategory,
            
            frequency: ctx.fundamental * pathway.ratio,
            ratio: pathway.ratio,
            n: pathway.n,
            d: pathway.d,
            consonanceScore: pathway.consonanceScore,
            
            phase: 'attack',
            time: 0,
            envelope: 0,
            attackTime,
            sustainTime,
            releaseTime,
            
            oscPhase: Math.random() * Math.PI * 2,
            pan: (Math.random() - 0.5) * config.panSpread,
            
            // Slight pitch drift for organic feel
            pitchDrift: (Math.random() - 0.5) * 0.002,
            pitchDriftPhase: Math.random() * Math.PI * 2,
            pitchDriftRate: 0.1 + Math.random() * 0.15,
        };
    }
    
    randomInRange([min, max]) {
        return min + Math.random() * (max - min);
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // VOICE COUNT
    // ═══════════════════════════════════════════════════════════════════════
    
    getVoiceCountForCategory(category) {
        let count = 0;
        for (const v of this.voices) {
            if (v.category === category) count++;
        }
        return count;
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // UPDATE
    // ═══════════════════════════════════════════════════════════════════════
    
    updateVoices(ctx) {
        for (let i = this.voices.length - 1; i >= 0; i--) {
            const voice = this.voices[i];
            voice.time += ctx.dt;
            
            // Pitch drift
            voice.pitchDriftPhase += voice.pitchDriftRate * ctx.dt * Math.PI * 2;
            
            switch (voice.phase) {
                case 'attack':
                    // Slight ease-in curve
                    const attackProgress = voice.time / voice.attackTime;
                    voice.envelope = attackProgress * attackProgress * (3 - 2 * attackProgress);
                    
                    if (voice.time >= voice.attackTime) {
                        voice.phase = 'sustain';
                        voice.time = 0;
                        voice.envelope = 1;
                    }
                    break;
                    
                case 'sustain':
                    // Gentle breathing during sustain
                    voice.envelope = 1 + Math.sin(voice.time * 0.8) * 0.03;
                    
                    if (voice.time >= voice.sustainTime) {
                        voice.phase = 'release';
                        voice.time = 0;
                    }
                    break;
                    
                case 'release':
                    // Ease-out curve
                    const releaseProgress = voice.time / voice.releaseTime;
                    voice.envelope = 1 - (releaseProgress * releaseProgress);
                    
                    if (voice.time >= voice.releaseTime) {
                        this.voices.splice(i, 1);
                        continue;
                    }
                    break;
            }
            
            voice.envelope = Math.max(0, Math.min(1.1, voice.envelope));
        }
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // SPAWN
    // ═══════════════════════════════════════════════════════════════════════
    
    trySpawn(ctx) {
        const baseActivity = ctx.mmcActivity.category ?? 0.5;
        
        for (const [category, config] of Object.entries(this.categoryConfigs)) {
            if (!config.enabled) continue;
            
            const state = this.categoryState[category];
            if (!state || !state.pool || state.pool.length === 0) continue;
            
            // Scale spawn rate by MMC activity
            const spawnRate = config.spawn.baseRate * (0.3 + baseActivity * 0.7);
            const variation = 1 + (Math.random() - 0.5) * config.spawn.variation * 2;
            
            state.spawnAccumulator += spawnRate * variation * ctx.dt;
            
            if (state.spawnAccumulator >= 1) {
                state.spawnAccumulator -= 1;
                
                const currentCount = this.getVoiceCountForCategory(category);
                const maxVoices = Math.floor(config.maxVoices * (0.4 + baseActivity * 0.6));
                
                if (currentCount < maxVoices) {
                    const pathway = this.selectPathway(category, ctx);
                    
                    if (pathway) {
                        const voice = this.createVoice(category, pathway, ctx);
                        this.voices.push(voice);
                        
                        // Mark as sounded for fairness
                        ctx.markSounded(pathway.id);
                        
                        // Queue ripples
                        if (config.rippleStrength > 0 && Math.random() < config.rippleStrength * baseActivity) {
                            ctx.queueRipplesFor(pathway.id, 'category');
                        }
                    }
                }
            }
        }
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // PROCESS
    // ═══════════════════════════════════════════════════════════════════════
    
    process(ctx, outputL, outputR, chorusSendL, chorusSendR, delaySendL, delaySendR) {
        if (!this.initialized) return;
        
        // Try to spawn new voices
        this.trySpawn(ctx);
        
        // Update existing voices
        this.updateVoices(ctx);
        
        // Render
        this.renderVoices(ctx, outputL, outputR, chorusSendL, chorusSendR, delaySendL, delaySendR);
    }
    
    renderVoices(ctx, outputL, outputR, chorusSendL, chorusSendR, delaySendL, delaySendR) {
        const sr = ctx.sampleRate;
        const twoPi = Math.PI * 2;
        
        for (const voice of this.voices) {
            const config = this.categoryConfigs[voice.category];
            if (!config || !config.enabled) continue;
            
            // Focus handling
            const isFocused = ctx.focus.id === voice.pathwayId;
            let focusMult = 1.0;
            
            if (ctx.focus.id) {
                if (isFocused) {
                    focusMult = 1 + (ctx.focus.categoryBoost - 1) * ctx.focus.envelope;
                } else {
                    focusMult = ctx.getFocusDuck();
                }
            }
            
            // Gains
            const categoryGain = ctx.categoryGains[voice.category] ?? 1.0;
            const msScale = ctx.getMSScale(voice.pathwayId);
            const activity = ctx.mmcActivity.category ?? 0.5;
            
            // Pitch drift
            const driftMult = 1 + Math.sin(voice.pitchDriftPhase) * voice.pitchDrift;
            const frequency = voice.frequency * driftMult;
            
            // Amplitude
            const cascadeFade = ctx.getCascadeFade ? ctx.getCascadeFade(voice.pathway?.id) : 1;
            const amp = voice.pathway.baseVolume *
                       voice.envelope *
                       activity *
                       categoryGain *
                       focusMult *
                       msScale *
                       config.mixLevel *
                       ctx.masterVolume *
                       cascadeFade;
            
            if (amp < 0.00005) continue;
            
            // Stereo
            const panAngle = (voice.pan + 1) * Math.PI / 4;
            const gainL = Math.cos(panAngle);
            const gainR = Math.sin(panAngle);
            
            // Effect sends
            const baseSends = ctx.categorySends[voice.category] || { chorus: 0.35, delay: 0.25 };
            const boost = config.effectBoost;
            const chorusAmt = baseSends.chorus * boost.chorus;
            const delayAmt = baseSends.delay * boost.delay;
            
            const phaseInc = (twoPi * frequency) / sr;
            
            for (let i = 0; i < ctx.blockSize; i++) {
                const sample = Math.sin(voice.oscPhase) * amp;
                const sampleL = sample * gainL;
                const sampleR = sample * gainR;
                
                outputL[i] += sampleL;
                outputR[i] += sampleR;
                
                // Effect sends
                chorusSendL[i] += sampleL * chorusAmt;
                chorusSendR[i] += sampleR * chorusAmt;
                delaySendL[i] += sampleL * delayAmt;
                delaySendR[i] += sampleR * delayAmt;
                
                voice.oscPhase += phaseInc;
                if (voice.oscPhase > twoPi) voice.oscPhase -= twoPi;
            }
        }
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // CONFIGURATION API
    // ═══════════════════════════════════════════════════════════════════════
    
    setCategoryEnabled(category, enabled) {
        if (this.categoryConfigs[category]) {
            this.categoryConfigs[category].enabled = enabled;
        }
    }
    
    setCategoryMixLevel(category, value) {
        if (this.categoryConfigs[category]) {
            this.categoryConfigs[category].mixLevel = Math.max(0, Math.min(1, value));
        }
    }
    
    setCategoryConfig(category, options) {
        if (!this.categoryConfigs[category]) return;
        
        const config = this.categoryConfigs[category];
        
        if (options.enabled !== undefined) config.enabled = options.enabled;
        if (options.mixLevel !== undefined) config.mixLevel = options.mixLevel;
        if (options.maxVoices !== undefined) config.maxVoices = options.maxVoices;
        if (options.panSpread !== undefined) config.panSpread = options.panSpread;
        if (options.rippleStrength !== undefined) config.rippleStrength = options.rippleStrength;
        
        if (options.spawn) Object.assign(config.spawn, options.spawn);
        if (options.envelope) Object.assign(config.envelope, options.envelope);
        if (options.weighting) Object.assign(config.weighting, options.weighting);
        if (options.effectBoost) Object.assign(config.effectBoost, options.effectBoost);
    }
    
    setAllMixLevels(multiplier) {
        for (const config of Object.values(this.categoryConfigs)) {
            config.mixLevel *= multiplier;
        }
    }
    
    updateFrequencies(ctx) {
        for (const voice of this.voices) {
            voice.frequency = ctx.fundamental * voice.ratio;
        }
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // STATE INFO
    // ═══════════════════════════════════════════════════════════════════════
    
    getState() {
        const categoryStats = {};
        
        for (const category of Object.keys(this.categoryConfigs)) {
            const config = this.categoryConfigs[category];
            categoryStats[category] = {
                enabled: config.enabled,
                poolSize: this.categoryState[category]?.pool?.length || 0,
                activeVoices: this.getVoiceCountForCategory(category),
                maxVoices: config.maxVoices,
            };
        }
        
        return {
            totalVoices: this.voices.length,
            categories: categoryStats,
        };
    }
    
    getVoices() {
        return this.voices.map(v => ({
            id: v.pathwayId,
            category: v.category,
            subcategory: v.subcategory,
            ratio: `${v.n}/${v.d}`,
            phase: v.phase,
            envelope: v.envelope,
        }));
    }
}

// ════════════════════════════════════════════════════════════════════════════
// END OF PART 3 — EnzymaticEngine follows in Part 4
// ════════════════════════════════════════════════════════════════════════════
// ╔════════════════════════════════════════════════════════════════════════════╗
// ║  ENZYMATIC ENGINE - THE FOAM ON THE BEER                                   ║
// ║                                                                            ║
// ║  Three sub-systems unified:                                                ║
// ║                                                                            ║
// ║  ┌─────────────────────────────────────────────────────────────────────┐  ║
// ║  │  SHIMMER                                                             │  ║
// ║  │  Brief sparkles (15-80ms), harmonic clusters                        │  ║
// ║  │  Weighted by abundance + consonance (like CategoryEngine)           │  ║
// ║  │  Like light catching the foam — reveals what's there                │  ║
// ║  └─────────────────────────────────────────────────────────────────────┘  ║
// ║                                                                            ║
// ║  ┌─────────────────────────────────────────────────────────────────────┐  ║
// ║  │  MICRO                                                               │  ║
// ║  │  Constant tiny gestures, Poisson-distributed                        │  ║
// ║  │  Bubbles rising, enzymes working, life happening                    │  ║
// ║  │  So quiet you feel it more than hear it                             │  ║
// ║  └─────────────────────────────────────────────────────────────────────┘  ║
// ║                                                                            ║
// ║  ┌─────────────────────────────────────────────────────────────────────┐  ║
// ║  │  RIPPLES                                                             │  ║
// ║  │  Harmonic responses triggered by other engines                      │  ║
// ║  │  Delayed sympathetic resonances                                     │  ║
// ║  │  The echo of metabolic activity                                     │  ║
// ║  └─────────────────────────────────────────────────────────────────────┘  ║
// ║                                                                            ║
// ║  Scientific principle: selection reflects actual pathway data             ║
// ║  Abundance and metabolic relationships drive what you hear                ║
// ╚════════════════════════════════════════════════════════════════════════════╝

class EnzymaticEngine {
    constructor() {
        // ═══════════════════════════════════════════════════════════════════
        // SHIMMER CONFIG
        // Brief sparkles that reveal pathway activity
        // ═══════════════════════════════════════════════════════════════════
        this.shimmerConfig = {
            enabled: true,
            mixLevel: 0.222,
            
            maxVoices: 28,
            
            // Spawn rate (Poisson-like, scaled by MMC)
            spawnRate: 3.5,
            spawnVariation: 0.4,
            
            // Very short envelopes
            envelope: {
                attack: [0.008, 0.025],
                sustain: [0.02, 0.06],
                release: [0.04, 0.12],
            },
            
            // Selection weighting - scientific, data-driven
            weighting: {
                consonance: 0.4,
                abundance: 0.45,
                fairness: 0.15,
            },
            
            // Harmonic clusters - sometimes spawn related pitches together
            // This IS scientifically meaningful: related pathways often co-activate
            clusters: {
                enabled: true,
                chance: 0.2,
                maxExtra: 2,
                // Harmonic relations that reflect metabolic relationships
                relations: [2, 0.5, 3/2, 2/3],
            },
            
            // Effect sends
            effectSend: { chorus: 0.7, delay: 0.55 },
            
            panSpread: 0.85,
        };
        
        // ═══════════════════════════════════════════════════════════════════
        // MICRO CONFIG  
        // Constant tiny bubbles - the background hum of metabolism
        // ═══════════════════════════════════════════════════════════════════
        this.microConfig = {
            enabled: true,
            mixLevel: 0.310,
            
            maxVoices: 40,
            
            // High spawn rate, very quiet
            spawnRate: 22.0,
            spawnVariation: 0.5,
            
            // Extremely short - granular
            envelope: {
                attack: [0.003, 0.012],
                sustain: [0.008, 0.025],
                release: [0.015, 0.045],
            },
            
            // Selection - abundance-heavy (most active pathways bubble most)
            weighting: {
                consonance: 0.25,
                abundance: 0.55,
                fairness: 0.20,
            },
            
            // Amplitude variation - metabolic activity fluctuates
            amplitudeRange: [0.1, 0.7],
            
            // Slight pitch variation (natural biological fluctuation)
            // ±15 cents max - subtle, organic
            detuneRange: [-0.000, 0.000],  // As ratio multiplier (≈±15 cents)
            
            // Effect sends
            effectSend: { chorus: 0.35, delay: 0.45 },
            
            panSpread: 0.95,
        };
        
        // ═══════════════════════════════════════════════════════════════════
        // RIPPLES CONFIG
        // Harmonic responses triggered by other engines
        // Scientifically: metabolic pathways don't exist in isolation
        // ═══════════════════════════════════════════════════════════════════
        this.rippleConfig = {
            enabled: true,
            mixLevel: 0.330,
            
            maxVoices: 40,
            
            // Envelope - longer than shimmer, creates resonant tail
            envelope: {
                attack: [0.12, 0.12],
                sustain: [0.10, 0.30],
                release: [0.12, 0.55],
            },
            
            // Amplitude based on harmonic relationship strength
            // (Defined in SharedContext.harmonicRelations)
            baseStrength: 0.7,
            
            // Effect sends
            effectSend: { chorus: 0.45, delay: 0.55 },
            
            panSpread: 0.5,
            
            // Inherit some pan position from triggering pathway
            panInheritance: 0.35,
        };
        
        // ═══════════════════════════════════════════════════════════════════
        // STATE
        // ═══════════════════════════════════════════════════════════════════
        this.shimmerVoices = [];
        this.microVoices = [];
        this.rippleVoices = [];
        
        this.shimmerAccumulator = 0;
        this.microAccumulator = 0;
        
        // Pathway pool (all pathways, scored)
        this.pathwayPool = [];
        
        this.initialized = false;
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════════════════
    
    init(ctx) {
        // Build pathway pool with pre-calculated scores
        this.pathwayPool = ctx.pathways.map(p => ({
            ...p,
            consonanceScore: ctx.getConsonanceScore(p.n, p.d),
        }));
        
        // Sort by combined score for efficient weighted selection
        this.pathwayPool.sort((a, b) => {
            const scoreA = a.consonanceScore * 0.4 + a.abundance * 0.6;
            const scoreB = b.consonanceScore * 0.4 + b.abundance * 0.6;
            return scoreB - scoreA;
        });
        
        this.shimmerVoices = [];
        this.microVoices = [];
        this.rippleVoices = [];
        
        this.shimmerAccumulator = Math.random() * 0.3;
        this.microAccumulator = Math.random() * 0.1;
        
        this.initialized = true;
        
        console.log(`EnzymaticEngine initialized: ${this.pathwayPool.length} pathways in pool`);
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // PATHWAY SELECTION
    // Weighted random selection respecting abundance, consonance, fairness
    // ═══════════════════════════════════════════════════════════════════════
    
    selectPathway(ctx, weighting) {
        if (this.pathwayPool.length === 0) return null;
        
        const weights = this.pathwayPool.map(p => {
            const msScale = ctx.getMSScale(p.id);
            const effectiveAbundance = p.abundance * msScale;
            const fairnessBonus = ctx.getFairnessBonus(p.id);
            
            const score = p.consonanceScore * weighting.consonance +
                         effectiveAbundance * weighting.abundance +
                         fairnessBonus * weighting.fairness;
            
            return Math.max(0.005, score);
        });
        
        const totalWeight = weights.reduce((sum, w) => sum + w, 0);
        let r = Math.random() * totalWeight;
        
        for (let i = 0; i < this.pathwayPool.length; i++) {
            r -= weights[i];
            if (r <= 0) return this.pathwayPool[i];
        }
        
        return this.pathwayPool[0];
    }
    
    // Find pathway closest to a target ratio (for clusters/ripples)
    findPathwayNearRatio(targetRatio, excludeId = null) {
        let closest = null;
        let closestDist = Infinity;
        
        for (const p of this.pathwayPool) {
            if (p.id === excludeId) continue;
            
            const dist = Math.abs(Math.log2(p.ratio / targetRatio));
            if (dist < closestDist && dist < 0.08) {  // Within ~8% (generous)
                closestDist = dist;
                closest = p;
            }
        }
        
        return closest;
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // SHIMMER
    // ═══════════════════════════════════════════════════════════════════════
    
    updateShimmer(ctx) {
        const cfg = this.shimmerConfig;
        if (!cfg.enabled) return;
        
        const activity = ctx.mmcActivity.shimmer ?? 0.5;
        if (activity < 0.05) return;
        
        // Spawn accumulator
        const spawnRate = cfg.spawnRate * activity;
        const variation = 1 + (Math.random() - 0.5) * cfg.spawnVariation * 2;
        this.shimmerAccumulator += spawnRate * variation * ctx.dt;
        
        while (this.shimmerAccumulator >= 1 && this.shimmerVoices.length < cfg.maxVoices) {
            this.shimmerAccumulator -= 1;
            this.spawnShimmer(ctx);
        }
        
        // Update existing
        this.updateShimmerVoices(ctx);
    }
    
    spawnShimmer(ctx) {
        const cfg = this.shimmerConfig;
        const pathway = this.selectPathway(ctx, cfg.weighting);
        if (!pathway) return;
        
        const voice = this.createShimmerVoice(pathway, ctx);
        this.shimmerVoices.push(voice);
        
        // Mark for fairness
        ctx.markSounded(pathway.id);
        
        // Maybe spawn cluster
        if (cfg.clusters.enabled && Math.random() < cfg.clusters.chance) {
            this.spawnShimmerCluster(pathway, ctx);
        }
    }
    
    spawnShimmerCluster(sourcePathway, ctx) {
        const cfg = this.shimmerConfig;
        const clusterCfg = cfg.clusters;
        
        const count = 1 + Math.floor(Math.random() * clusterCfg.maxExtra);
        
        for (let i = 0; i < count; i++) {
            if (this.shimmerVoices.length >= cfg.maxVoices) break;
            
            // Pick a harmonic relation
            const relation = clusterCfg.relations[Math.floor(Math.random() * clusterCfg.relations.length)];
            const targetRatio = sourcePathway.ratio * relation;
            
            const relatedPathway = this.findPathwayNearRatio(targetRatio, sourcePathway.id);
            if (relatedPathway) {
                // Slight delay for cluster members
                const voice = this.createShimmerVoice(relatedPathway, ctx);
                voice.delay = 0.01 + Math.random() * 0.03;
                voice.amplitude *= 0.7;  // Cluster members slightly quieter
                this.shimmerVoices.push(voice);
            }
        }
    }
    
    createShimmerVoice(pathway, ctx) {
        const cfg = this.shimmerConfig;
        const env = cfg.envelope;
        
        return {
            type: 'shimmer',
            pathwayId: pathway.id,
            pathway,
            category: pathway.category,
            
            frequency: ctx.fundamental * pathway.ratio,
            ratio: pathway.ratio,
            
            phase: 'delay',
            delay: 0,
            time: 0,
            envelope: 0,
            
            attackTime: this.randomInRange(env.attack),
            sustainTime: this.randomInRange(env.sustain),
            releaseTime: this.randomInRange(env.release),
            
            amplitude: 1.0,
            oscPhase: Math.random() * Math.PI * 2,
            pan: (Math.random() - 0.5) * cfg.panSpread,
        };
    }
    
    updateShimmerVoices(ctx) {
        for (let i = this.shimmerVoices.length - 1; i >= 0; i--) {
            const voice = this.shimmerVoices[i];
            
            // Handle delay (for cluster members)
            if (voice.phase === 'delay') {
                voice.delay -= ctx.dt;
                if (voice.delay <= 0) {
                    voice.phase = 'attack';
                    voice.time = 0;
                }
                continue;
            }
            
            voice.time += ctx.dt;
            
            switch (voice.phase) {
                case 'attack':
                    voice.envelope = voice.time / voice.attackTime;
                    if (voice.time >= voice.attackTime) {
                        voice.phase = 'sustain';
                        voice.time = 0;
                        voice.envelope = 1;
                    }
                    break;
                    
                case 'sustain':
                    voice.envelope = 1;
                    if (voice.time >= voice.sustainTime) {
                        voice.phase = 'release';
                        voice.time = 0;
                    }
                    break;
                    
                case 'release':
                    voice.envelope = 1 - (voice.time / voice.releaseTime);
                    if (voice.time >= voice.releaseTime) {
                        this.shimmerVoices.splice(i, 1);
                    }
                    break;
            }
        }
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // MICRO
    // ═══════════════════════════════════════════════════════════════════════
    
    updateMicro(ctx) {
        const cfg = this.microConfig;
        if (!cfg.enabled) return;
        
        const activity = ctx.mmcActivity.micro ?? 0.5;
        if (activity < 0.05) return;
        
        // High spawn rate, Poisson-distributed
        const spawnRate = cfg.spawnRate * activity;
        const variation = 1 + (Math.random() - 0.5) * cfg.spawnVariation * 2;
        this.microAccumulator += spawnRate * variation * ctx.dt;
        
        while (this.microAccumulator >= 1 && this.microVoices.length < cfg.maxVoices) {
            this.microAccumulator -= 1;
            this.spawnMicro(ctx);
        }
        
        // Update existing
        this.updateMicroVoices(ctx);
    }
    
    spawnMicro(ctx) {
        const cfg = this.microConfig;
        const pathway = this.selectPathway(ctx, cfg.weighting);
        if (!pathway) return;
        
        const voice = this.createMicroVoice(pathway, ctx);
        this.microVoices.push(voice);
        
        // Don't mark fairness for micro - they're too brief and numerous
    }
    
    createMicroVoice(pathway, ctx) {
        const cfg = this.microConfig;
        const env = cfg.envelope;
        
        // Slight detune for organic feel
        const detune = cfg.detuneRange[0] + Math.random() * (cfg.detuneRange[1] - cfg.detuneRange[0]);
        const detuneMultiplier = 1 + detune;
        
        // Random amplitude within range
        const ampRange = cfg.amplitudeRange;
        const amplitude = ampRange[0] + Math.random() * (ampRange[1] - ampRange[0]);
        
        return {
            type: 'micro',
            pathwayId: pathway.id,
            pathway,
            category: pathway.category,
            
            frequency: ctx.fundamental * pathway.ratio * detuneMultiplier,
            ratio: pathway.ratio,
            
            phase: 'attack',
            time: 0,
            envelope: 0,
            
            attackTime: this.randomInRange(env.attack),
            sustainTime: this.randomInRange(env.sustain),
            releaseTime: this.randomInRange(env.release),
            
            amplitude,
            oscPhase: Math.random() * Math.PI * 2,
            pan: (Math.random() - 0.5) * cfg.panSpread,
        };
    }
    
    updateMicroVoices(ctx) {
        for (let i = this.microVoices.length - 1; i >= 0; i--) {
            const voice = this.microVoices[i];
            voice.time += ctx.dt;
            
            switch (voice.phase) {
                case 'attack':
                    voice.envelope = voice.time / voice.attackTime;
                    if (voice.time >= voice.attackTime) {
                        voice.phase = 'sustain';
                        voice.time = 0;
                        voice.envelope = 1;
                    }
                    break;
                    
                case 'sustain':
                    if (voice.time >= voice.sustainTime) {
                        voice.phase = 'release';
                        voice.time = 0;
                    }
                    break;
                    
                case 'release':
                    voice.envelope = 1 - (voice.time / voice.releaseTime);
                    if (voice.time >= voice.releaseTime) {
                        this.microVoices.splice(i, 1);
                    }
                    break;
            }
        }
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // RIPPLES
    // Processes queue from SharedContext
    // ═══════════════════════════════════════════════════════════════════════
    
    updateRipples(ctx) {
        const cfg = this.rippleConfig;
        if (!cfg.enabled) return;
        
        // Process ripple queue
        for (let i = ctx.rippleQueue.length - 1; i >= 0; i--) {
            const queued = ctx.rippleQueue[i];
            
            if (ctx.time >= queued.triggerTime) {
                ctx.rippleQueue.splice(i, 1);
                
                if (this.rippleVoices.length < cfg.maxVoices) {
                    this.spawnRipple(queued, ctx);
                }
            }
        }
        
        // Update existing
        this.updateRippleVoices(ctx);
    }
    
    spawnRipple(queued, ctx) {
        const cfg = this.rippleConfig;
        const pathway = ctx.pathwayById.get(queued.pathwayId);
        if (!pathway) return;
        
        const env = cfg.envelope;
        
        // Pan: blend between random and source
        const randomPan = (Math.random() - 0.5) * cfg.panSpread;
        const sourcePan = queued.sourcePan ?? 0;
        const pan = randomPan * (1 - cfg.panInheritance) + sourcePan * cfg.panInheritance;
        
        const voice = {
            type: 'ripple',
            pathwayId: pathway.id,
            pathway,
            category: pathway.category,
            
            frequency: ctx.fundamental * pathway.ratio,
            ratio: pathway.ratio,
            
            relation: queued.relation,
            source: queued.source,
            
            phase: 'attack',
            time: 0,
            envelope: 0,
            
            attackTime: this.randomInRange(env.attack),
            sustainTime: this.randomInRange(env.sustain),
            releaseTime: this.randomInRange(env.release),
            
            amplitude: queued.strength * cfg.baseStrength,
            oscPhase: Math.random() * Math.PI * 2,
            pan,
        };
        
        this.rippleVoices.push(voice);
        
        // Mark for fairness
        ctx.markSounded(pathway.id);
    }
    
    updateRippleVoices(ctx) {
        for (let i = this.rippleVoices.length - 1; i >= 0; i--) {
            const voice = this.rippleVoices[i];
            voice.time += ctx.dt;
            
            switch (voice.phase) {
                case 'attack':
                    // Smooth attack curve
                    const attackProgress = voice.time / voice.attackTime;
                    voice.envelope = attackProgress * (2 - attackProgress);  // Ease out
                    if (voice.time >= voice.attackTime) {
                        voice.phase = 'sustain';
                        voice.time = 0;
                        voice.envelope = 1;
                    }
                    break;
                    
                case 'sustain':
                    // Gentle decay during sustain
                    voice.envelope = 1 - (voice.time / voice.sustainTime) * 0.1;
                    if (voice.time >= voice.sustainTime) {
                        voice.phase = 'release';
                        voice.time = 0;
                    }
                    break;
                    
                case 'release':
                    // Exponential-ish release
                    const releaseProgress = voice.time / voice.releaseTime;
                    voice.envelope = (1 - releaseProgress) * (1 - releaseProgress);
                    if (voice.time >= voice.releaseTime) {
                        this.rippleVoices.splice(i, 1);
                    }
                    break;
            }
        }
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // MAIN PROCESS
    // ═══════════════════════════════════════════════════════════════════════
    
    process(ctx, outputL, outputR, chorusSendL, chorusSendR, delaySendL, delaySendR) {
        if (!this.initialized) return;
        
        // Update all three sub-systems
        this.updateShimmer(ctx);
        this.updateMicro(ctx);
        this.updateRipples(ctx);
        
        // Render all voices
        this.renderVoices(ctx, outputL, outputR, chorusSendL, chorusSendR, delaySendL, delaySendR);
    }
    
    renderVoices(ctx, outputL, outputR, chorusSendL, chorusSendR, delaySendL, delaySendR) {
        const sr = ctx.sampleRate;
        const twoPi = Math.PI * 2;
        
        // Render shimmer
        this.renderVoiceArray(
            this.shimmerVoices, 
            this.shimmerConfig,
            ctx, outputL, outputR, 
            chorusSendL, chorusSendR, delaySendL, delaySendR
        );
        
        // Render micro
        this.renderVoiceArray(
            this.microVoices,
            this.microConfig,
            ctx, outputL, outputR,
            chorusSendL, chorusSendR, delaySendL, delaySendR
        );
        
        // Render ripples
        this.renderVoiceArray(
            this.rippleVoices,
            this.rippleConfig,
            ctx, outputL, outputR,
            chorusSendL, chorusSendR, delaySendL, delaySendR
        );
    }
    
    renderVoiceArray(voices, config, ctx, outputL, outputR, chorusSendL, chorusSendR, delaySendL, delaySendR) {
        if (!config.enabled) return;
        
        const sr = ctx.sampleRate;
        const twoPi = Math.PI * 2;
        const sends = config.effectSend;
        
        for (const voice of voices) {
            if (voice.phase === 'delay') continue;
            if (voice.envelope <= 0) continue;
            
            // Focus handling
            const isFocused = ctx.focus.id === voice.pathwayId;
            let focusMult = 1.0;
            
            if (ctx.focus.id) {
                if (isFocused) {
                    focusMult = 1 + (ctx.focus.enzymaticBoost - 1) * ctx.focus.envelope;
                } else {
                    focusMult = ctx.getFocusDuck();
                }
            }
            
            // Category gain and MS scale
            const categoryGain = ctx.categoryGains[voice.category] ?? 1.0;
            const msScale = ctx.getMSScale(voice.pathwayId);
            
            // Activity level for this voice type
            const activityKey = voice.type === 'shimmer' ? 'shimmer' : 
                               voice.type === 'micro' ? 'micro' : 'ripples';
            const activity = ctx.mmcActivity[activityKey] ?? 0.5;
            
            // Final amplitude
            const cascadeFade = ctx.getCascadeFade ? ctx.getCascadeFade(voice.pathway?.id) : 1;
            const amp = voice.pathway.baseVolume *
                       voice.envelope *
                       voice.amplitude *
                       activity *
                       categoryGain *
                       focusMult *
                       msScale *
                       config.mixLevel *
                       ctx.masterVolume *
                       cascadeFade;
            
            if (amp < 0.00002) continue;
            
            // Stereo
            const panAngle = (voice.pan + 1) * Math.PI / 4;
            const gainL = Math.cos(panAngle);
            const gainR = Math.sin(panAngle);
            
            // Effect sends (scaled by activity for organic fade)
            const chorusAmt = sends.chorus * (0.5 + activity * 0.5);
            const delayAmt = sends.delay * (0.5 + activity * 0.5);
            
            const phaseInc = (twoPi * voice.frequency) / sr;
            
            for (let i = 0; i < ctx.blockSize; i++) {
                const sample = Math.sin(voice.oscPhase) * amp;
                const sampleL = sample * gainL;
                const sampleR = sample * gainR;
                
                outputL[i] += sampleL;
                outputR[i] += sampleR;
                
                chorusSendL[i] += sampleL * chorusAmt;
                chorusSendR[i] += sampleR * chorusAmt;
                delaySendL[i] += sampleL * delayAmt;
                delaySendR[i] += sampleR * delayAmt;
                
                voice.oscPhase += phaseInc;
                if (voice.oscPhase > twoPi) voice.oscPhase -= twoPi;
            }
        }
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // UTILITY
    // ═══════════════════════════════════════════════════════════════════════
    
    randomInRange([min, max]) {
        return min + Math.random() * (max - min);
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // CONFIGURATION API
    // ═══════════════════════════════════════════════════════════════════════
    
    setShimmerConfig(options) {
        Object.assign(this.shimmerConfig, options);
    }
    
    setMicroConfig(options) {
        Object.assign(this.microConfig, options);
    }
    
    setRippleConfig(options) {
        Object.assign(this.rippleConfig, options);
    }
    
    setEnabled(type, enabled) {
        switch (type) {
            case 'shimmer': this.shimmerConfig.enabled = enabled; break;
            case 'micro': this.microConfig.enabled = enabled; break;
            case 'ripples': this.rippleConfig.enabled = enabled; break;
        }
    }
    
    setMixLevel(type, value) {
        const clamped = Math.max(0, Math.min(1, value));
        switch (type) {
            case 'shimmer': this.shimmerConfig.mixLevel = clamped; break;
            case 'micro': this.microConfig.mixLevel = clamped; break;
            case 'ripples': this.rippleConfig.mixLevel = clamped; break;
        }
    }
    
    updateFrequencies(ctx) {
        for (const voice of this.shimmerVoices) {
            voice.frequency = ctx.fundamental * voice.ratio;
        }
        for (const voice of this.microVoices) {
            // Micro voices keep their detune
            const detune = voice.frequency / (ctx.fundamental * voice.ratio);
            voice.frequency = ctx.fundamental * voice.ratio * detune;
        }
        for (const voice of this.rippleVoices) {
            voice.frequency = ctx.fundamental * voice.ratio;
        }
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // STATE INFO
    // ═══════════════════════════════════════════════════════════════════════
    
    getState() {
        return {
            shimmer: {
                enabled: this.shimmerConfig.enabled,
                activeVoices: this.shimmerVoices.length,
                maxVoices: this.shimmerConfig.maxVoices,
            },
            micro: {
                enabled: this.microConfig.enabled,
                activeVoices: this.microVoices.length,
                maxVoices: this.microConfig.maxVoices,
            },
            ripples: {
                enabled: this.rippleConfig.enabled,
                activeVoices: this.rippleVoices.length,
                maxVoices: this.rippleConfig.maxVoices,
                queueLength: 0,  // Would need ctx to report this
            },
        };
    }
    
    getVoices() {
        const voices = [];
        
        for (const v of this.shimmerVoices) {
            voices.push({
                type: 'shimmer',
                id: v.pathwayId,
                ratio: v.ratio,
                envelope: v.envelope,
                phase: v.phase,
            });
        }
        
        for (const v of this.microVoices) {
            voices.push({
                type: 'micro',
                id: v.pathwayId,
                ratio: v.ratio,
                envelope: v.envelope,
            });
        }
        
        for (const v of this.rippleVoices) {
            voices.push({
                type: 'ripple',
                id: v.pathwayId,
                ratio: v.ratio,
                envelope: v.envelope,
                relation: v.relation,
            });
        }
        
        return voices;
    }
}

// ════════════════════════════════════════════════════════════════════════════
// END OF PART 4 — PostProcessor + MainProcessor follow in Part 5
// ════════════════════════════════════════════════════════════════════════════

// ╔════════════════════════════════════════════════════════════════════════════╗
// ║  POST-PROCESSOR - THE UNIFIED SPACE                                        ║
// ║                                                                            ║
// ║  Chorus: Stereo widening, warmth, blends voices together                  ║
// ║  Delay: Multi-tap with filtering, creates depth and space                 ║
// ║                                                                            ║
// ║  The glue that makes 800+ oscillators feel like one living organism       ║
// ╚════════════════════════════════════════════════════════════════════════════╝

class PostProcessor {
    constructor() {
        // ═══════════════════════════════════════════════════════════════════
        // CHORUS CONFIG
        // ═══════════════════════════════════════════════════════════════════
        this.chorusConfig = {
            enabled: true,
            wetMix: 0.45,
            
            voices: 3,
            baseDelay: 12,        // ms
            modDepth: 4,          // ms
            rates: [0.11, 0.17, 0.24],  // Hz - slow, organic
            
            feedback: 0.08,
            stereoSpread: 0.4,    // Phase offset between L/R
        };
        
        // ═══════════════════════════════════════════════════════════════════
        // DELAY CONFIG
        // ═══════════════════════════════════════════════════════════════════
        this.delayConfig = {
            enabled: true,
            wetMix: 0.55,
            
            // Multi-tap delays (creates pseudo-reverb)
            taps: [
                { time: 185, level: 0.5, pan: -0.2 },
                { time: 310, level: 0.35, pan: 0.25 },
                { time: 470, level: 0.2, pan: -0.1 },
                { time: 620, level: 0.12, pan: 0.15 },
            ],
            
            feedback: 0.28,
            crossFeedback: 0.12,   // L→R and R→L
            
            // Filtering (darker = more reverb-like)
            highCut: 0.4,         // Lowpass coefficient
            lowCut: 0.03,         // Highpass coefficient
            
            // Subtle modulation
            modRate: 0.25,
            modDepth: 2,          // ms
        };
        
        // ═══════════════════════════════════════════════════════════════════
        // STATE
        // ═══════════════════════════════════════════════════════════════════
        this.sampleRate = 48000;
        this.initialized = false;
        
        // Chorus state
        this.chorusBufferL = null;
        this.chorusBufferR = null;
        this.chorusBufferSize = 0;
        this.chorusWriteIdx = 0;
        this.chorusPhases = [];
        this.chorusFeedbackL = 0;
        this.chorusFeedbackR = 0;
        
        // Delay state
        this.delayBufferL = null;
        this.delayBufferR = null;
        this.delayBufferSize = 0;
        this.delayWriteIdx = 0;
        this.delayFilterL = 0;
        this.delayFilterR = 0;
        this.delayHighpassL = 0;
        this.delayHighpassR = 0;
        this.delayModPhase = 0;
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════════════════
    
    init(sampleRate) {
        this.sampleRate = sampleRate;
        
        this.initChorus();
        this.initDelay();
        
        this.initialized = true;
        console.log('PostProcessor initialized');
    }
    
    initChorus() {
        const cfg = this.chorusConfig;
        const maxDelayMs = cfg.baseDelay + cfg.modDepth + 10;
        const maxSamples = Math.ceil(maxDelayMs * this.sampleRate / 1000);
        
        this.chorusBufferL = new Float32Array(maxSamples);
        this.chorusBufferR = new Float32Array(maxSamples);
        this.chorusBufferSize = maxSamples;
        this.chorusWriteIdx = 0;
        
        // Initialize phase offsets for each voice
        this.chorusPhases = [];
        for (let i = 0; i < cfg.voices; i++) {
            this.chorusPhases.push({
                L: Math.random() * Math.PI * 2,
                R: Math.random() * Math.PI * 2 + cfg.stereoSpread * Math.PI,
            });
        }
        
        this.chorusFeedbackL = 0;
        this.chorusFeedbackR = 0;
    }
    
    initDelay() {
        const cfg = this.delayConfig;
        const maxTapTime = Math.max(...cfg.taps.map(t => t.time));
        const maxDelayMs = maxTapTime + cfg.modDepth + 50;
        const maxSamples = Math.ceil(maxDelayMs * this.sampleRate / 1000);
        
        this.delayBufferL = new Float32Array(maxSamples);
        this.delayBufferR = new Float32Array(maxSamples);
        this.delayBufferSize = maxSamples;
        this.delayWriteIdx = 0;
        
        this.delayFilterL = 0;
        this.delayFilterR = 0;
        this.delayHighpassL = 0;
        this.delayHighpassR = 0;
        this.delayModPhase = Math.random() * Math.PI * 2;
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // CHORUS PROCESSING
    // ═══════════════════════════════════════════════════════════════════════
    
    processChorus(inputL, inputR, outputL, outputR, sendL, sendR, blockSize, activity) {
        const cfg = this.chorusConfig;
        
        if (!cfg.enabled || !this.initialized) {
            // Pass through
            for (let i = 0; i < blockSize; i++) {
                outputL[i] = inputL[i];
                outputR[i] = inputR[i];
            }
            return;
        }
        
        const sr = this.sampleRate;
        const twoPi = Math.PI * 2;
        const baseDelaySamples = cfg.baseDelay * sr / 1000;
        const modDepthSamples = cfg.modDepth * sr / 1000;
        
        // Wet mix scales with activity for organic fade
        const wetMix = cfg.wetMix * (0.5 + activity * 0.5);
        const dryMix = 1 - wetMix * 0.5;  // Keep dry strong
        
        for (let i = 0; i < blockSize; i++) {
            // Write to buffer with feedback
            this.chorusBufferL[this.chorusWriteIdx] = sendL[i] + this.chorusFeedbackL * cfg.feedback;
            this.chorusBufferR[this.chorusWriteIdx] = sendR[i] + this.chorusFeedbackR * cfg.feedback;
            
            let wetL = 0;
            let wetR = 0;
            
            // Sum all chorus voices
            for (let v = 0; v < cfg.voices; v++) {
                // Update phases
                this.chorusPhases[v].L += twoPi * cfg.rates[v] / sr;
                this.chorusPhases[v].R += twoPi * cfg.rates[v] / sr;
                
                if (this.chorusPhases[v].L > twoPi) this.chorusPhases[v].L -= twoPi;
                if (this.chorusPhases[v].R > twoPi) this.chorusPhases[v].R -= twoPi;
                
                const modL = Math.sin(this.chorusPhases[v].L);
                const modR = Math.sin(this.chorusPhases[v].R);
                
                const delaySamplesL = baseDelaySamples + modL * modDepthSamples;
                const delaySamplesR = baseDelaySamples + modR * modDepthSamples;
                
                wetL += this.readBuffer(this.chorusBufferL, this.chorusBufferSize, 
                                        this.chorusWriteIdx, delaySamplesL);
                wetR += this.readBuffer(this.chorusBufferR, this.chorusBufferSize,
                                        this.chorusWriteIdx, delaySamplesR);
            }
            
            // Average voices
            wetL /= cfg.voices;
            wetR /= cfg.voices;
            
            // Store for feedback
            this.chorusFeedbackL = wetL;
            this.chorusFeedbackR = wetR;
            
            // Mix
            outputL[i] = inputL[i] * dryMix + wetL * wetMix;
            outputR[i] = inputR[i] * dryMix + wetR * wetMix;
            
            // Advance write index
            this.chorusWriteIdx = (this.chorusWriteIdx + 1) % this.chorusBufferSize;
        }
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // DELAY PROCESSING
    // ═══════════════════════════════════════════════════════════════════════
    
    processDelay(inputL, inputR, outputL, outputR, sendL, sendR, blockSize, activity) {
        const cfg = this.delayConfig;
        
        if (!cfg.enabled || !this.initialized) {
            // Pass through
            for (let i = 0; i < blockSize; i++) {
                outputL[i] = inputL[i];
                outputR[i] = inputR[i];
            }
            return;
        }
        
        const sr = this.sampleRate;
        const twoPi = Math.PI * 2;
        
        // Wet mix scales with activity
        const wetMix = cfg.wetMix * (0.5 + activity * 0.5);
        
        for (let i = 0; i < blockSize; i++) {
            // Modulation for subtle movement
            this.delayModPhase += twoPi * cfg.modRate / sr;
            if (this.delayModPhase > twoPi) this.delayModPhase -= twoPi;
            const modOffset = Math.sin(this.delayModPhase) * cfg.modDepth * sr / 1000;
            
            // Read from all taps
            let wetL = 0;
            let wetR = 0;
            
            for (const tap of cfg.taps) {
                const delaySamples = tap.time * sr / 1000 + modOffset;
                
                const tapL = this.readBuffer(this.delayBufferL, this.delayBufferSize,
                                            this.delayWriteIdx, delaySamples);
                const tapR = this.readBuffer(this.delayBufferR, this.delayBufferSize,
                                            this.delayWriteIdx, delaySamples);
                
                // Pan the tap
                const panL = Math.max(0, 1 - tap.pan);
                const panR = Math.max(0, 1 + tap.pan);
                
                wetL += tapL * tap.level * panL;
                wetR += tapR * tap.level * panR;
            }
            
            // Apply filters (lowpass then highpass)
            this.delayFilterL += (wetL - this.delayFilterL) * cfg.highCut;
            this.delayFilterR += (wetR - this.delayFilterR) * cfg.highCut;
            wetL = this.delayFilterL;
            wetR = this.delayFilterR;
            
            // Highpass to remove rumble
            this.delayHighpassL += (wetL - this.delayHighpassL) * (1 - cfg.lowCut);
            this.delayHighpassR += (wetR - this.delayHighpassR) * (1 - cfg.lowCut);
            wetL = wetL - this.delayHighpassL * cfg.lowCut;
            wetR = wetR - this.delayHighpassR * cfg.lowCut;
            
            // Write to buffer with feedback and cross-feedback
            this.delayBufferL[this.delayWriteIdx] = sendL[i] + 
                wetL * cfg.feedback + wetR * cfg.crossFeedback;
            this.delayBufferR[this.delayWriteIdx] = sendR[i] + 
                wetR * cfg.feedback + wetL * cfg.crossFeedback;
            
            // Mix to output
            outputL[i] = inputL[i] + wetL * wetMix;
            outputR[i] = inputR[i] + wetR * wetMix;
            
            // Advance write index
            this.delayWriteIdx = (this.delayWriteIdx + 1) % this.delayBufferSize;
        }
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // BUFFER READING (with linear interpolation)
    // ═══════════════════════════════════════════════════════════════════════
    
    readBuffer(buffer, size, writeIdx, delaySamples) {
        const readPos = writeIdx - delaySamples;
        const readIdx = ((readPos % size) + size) % size;
        
        const idx0 = Math.floor(readIdx);
        const idx1 = (idx0 + 1) % size;
        const frac = readIdx - idx0;
        
        return buffer[idx0] * (1 - frac) + buffer[idx1] * frac;
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // CONFIGURATION API
    // ═══════════════════════════════════════════════════════════════════════
    
    setChorusConfig(options) {
        const needsReinit = options.voices !== undefined || 
                          options.baseDelay !== undefined ||
                          options.modDepth !== undefined;
        
        Object.assign(this.chorusConfig, options);
        
        if (needsReinit && this.initialized) {
            this.initChorus();
        }
    }
    
    setDelayConfig(options) {
        const needsReinit = options.taps !== undefined;
        
        Object.assign(this.delayConfig, options);
        
        if (needsReinit && this.initialized) {
            this.initDelay();
        }
    }
    
    setChorusEnabled(enabled) {
        this.chorusConfig.enabled = enabled;
    }
    
    setDelayEnabled(enabled) {
        this.delayConfig.enabled = enabled;
    }
    
    setChorusWetMix(value) {
        this.chorusConfig.wetMix = Math.max(0, Math.min(1, value));
    }
    
    setDelayWetMix(value) {
        this.delayConfig.wetMix = Math.max(0, Math.min(1, value));
    }
    
    getState() {
        return {
            chorus: {
                enabled: this.chorusConfig.enabled,
                wetMix: this.chorusConfig.wetMix,
            },
            delay: {
                enabled: this.delayConfig.enabled,
                wetMix: this.delayConfig.wetMix,
            },
        };
    }
}


// ╔════════════════════════════════════════════════════════════════════════════╗
// ║  MAIN PROCESSOR - THE ORCHESTRATOR                                         ║
// ║                                                                            ║
// ║  Coordinates all engines, handles messages, renders audio                  ║
// ╚════════════════════════════════════════════════════════════════════════════╝

class MicrobiomeSonificationProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        
        // ═══════════════════════════════════════════════════════════════════
        // ENGINES
        // ═══════════════════════════════════════════════════════════════════
        this.ctx = new SharedContext();
        this.mmc = new MMCEngine();
        this.reference = new ReferenceToneEngine();
        this.drone = new DroneEngine();
        this.category = new CategoryEngine();
        this.enzymatic = new EnzymaticEngine();
        this.postProcessor = new PostProcessor();
        
        // ═══════════════════════════════════════════════════════════════════
        // STATE
        // ═══════════════════════════════════════════════════════════════════
        this.initialized = false;
        this.lastReport = 0;
        this.reportInterval = 0.033;  // ~30fps
        
        // ═══════════════════════════════════════════════════════════════════
        // CASCADE FADE STATE
        // ═══════════════════════════════════════════════════════════════════
        this.cascade = {
            active: false,
            direction: 'in',  // 'in' or 'out'
            duration: 1.66,
            startTime: 0,
            pathwayOrder: [],  // sorted by consonance (n*d)
            pathwayFade: new Map(),  // pathwayId -> current fade (0-1)
        };
        
        // ═══════════════════════════════════════════════════════════════════
        // MESSAGE HANDLING
        // ═══════════════════════════════════════════════════════════════════
        this.port.onmessage = (e) => this.handleMessage(e.data);
    }
    
    startCascadeFade(direction, duration) {
        // Sort pathways by consonance (n*d) - lower is more consonant
        const sorted = [...this.ctx.pathways].sort((a, b) => {
            const consA = (a.n || 1) * (a.d || 1);
            const consB = (b.n || 1) * (b.d || 1);
            return consA - consB;
        });
        
        this.cascade.active = true;
        this.cascade.direction = direction;
        this.cascade.duration = duration;
        this.cascade.startTime = this.ctx.time;
        this.cascade.pathwayOrder = sorted.map(p => p.id);
        
        // Initialize fade states
        this.cascade.pathwayFade.clear();
        for (const p of this.ctx.pathways) {
            // Start at 0 for fade-in, 1 for fade-out
            this.cascade.pathwayFade.set(p.id, direction === 'in' ? 0 : 1);
        }
    }
    
    updateCascade() {
        if (!this.cascade.active) return;
        
        const elapsed = this.ctx.time - this.cascade.startTime;
        const progress = Math.min(1, elapsed / this.cascade.duration);
        
        const total = this.cascade.pathwayOrder.length;
        
        for (let i = 0; i < total; i++) {
            const id = this.cascade.pathwayOrder[i];
            // Each pathway starts fading at a staggered time
            const startProgress = i / total * 0.7;  // 70% of time for staggering
            const fadeProgress = Math.max(0, Math.min(1, (progress - startProgress) / 0.3));
            
            if (this.cascade.direction === 'in') {
                // Ease in - smooth curve
                this.cascade.pathwayFade.set(id, this.easeOutQuad(fadeProgress));
            } else {
                // Ease out - reverse order, smooth curve
                const reverseI = total - 1 - i;
                const reverseStartProgress = reverseI / total * 0.6;
                const reverseFadeProgress = Math.max(0, Math.min(1, (progress - reverseStartProgress) / 0.4));
                this.cascade.pathwayFade.set(id, 1 - this.easeInQuad(reverseFadeProgress));
            }
        }
        
        // Check if complete
        if (progress >= 1) {
            this.cascade.active = false;
            // Ensure final state
            for (const id of this.cascade.pathwayOrder) {
                this.cascade.pathwayFade.set(id, this.cascade.direction === 'in' ? 1 : 0);
            }
        }
    }
    
    easeOutQuad(t) { return t * (2 - t); }
    easeInQuad(t) { return t * t; }
    
    getCascadeFade(pathwayId) {
        if (!this.cascade.active && this.cascade.pathwayFade.size === 0) return 1;
        return this.cascade.pathwayFade.get(pathwayId) ?? 1;
    }
    
    
    // ═══════════════════════════════════════════════════════════════════════
    // MESSAGE HANDLING
    // ═══════════════════════════════════════════════════════════════════════
    
    handleMessage({ type, data }) {
        switch (type) {
            // ─────────────────────────────────────────────────────────────
            // INITIALIZATION
            // ─────────────────────────────────────────────────────────────
            case 'init':
                this.initPathways(data.pathways);
                break;
            
            // ─────────────────────────────────────────────────────────────
            // GLOBAL CONTROLS
            // ─────────────────────────────────────────────────────────────
            case 'setFundamental':
                this.ctx.fundamental = data;
                this.reference.updateFrequencies(this.ctx);
                this.drone.updateFrequencies(this.ctx);
                this.category.updateFrequencies(this.ctx);
                this.enzymatic.updateFrequencies(this.ctx);
                break;
                
            case 'setMasterVolume':
                this.ctx.masterVolume = Math.max(0, Math.min(1, data));
                break;
            
            case 'cascadeFadeIn':
                // Fade in pathways by consonance order over duration
                this.startCascadeFade('in', data.duration || 1.66);
                break;
                
            case 'cascadeFadeOut':
                // Fade out pathways by consonance order (reverse) over duration  
                this.startCascadeFade('out', data.duration || 0.8);
                break;
                
            case 'setFocus':
                this.ctx.setFocus(data.id);
                break;
            
            // ─────────────────────────────────────────────────────────────
            // MMC CONTROLS
            // ─────────────────────────────────────────────────────────────
            case 'setMMCIntensity':
                this.mmc.setIntensity(data);
                break;
                
            case 'setMMCDuration':
                this.mmc.setCycleDuration(data);
                break;
                
            case 'setMMCPhase':
                this.mmc.setPhase(data.phase);
                break;
                
            case 'setMMCBaseActivity':
                if (data.layer && data.value !== undefined) {
                    this.mmc.setBaseActivity(data.layer, data.value);
                }
                break;
            
            // ─────────────────────────────────────────────────────────────
            // REFERENCE TONES
            // ─────────────────────────────────────────────────────────────
            case 'setReferenceConfig':
                if (data.mixLevel !== undefined) this.reference.setMixLevel(data.mixLevel);
                if (data.breathing) this.reference.setBreathing(data.breathing);
                if (data.focus) this.reference.setFocusBehavior(data.focus);
                break;
            
            // ─────────────────────────────────────────────────────────────
            // DRONE
            // ─────────────────────────────────────────────────────────────
            case 'setDroneConfig':
                if (data.mixLevel !== undefined) this.drone.setMixLevel(data.mixLevel);
                if (data.voiceCount !== undefined) this.drone.setVoiceCount(data.voiceCount, this.ctx);
                if (data.consonanceDecay) this.drone.setConsonanceDecay(data.consonanceDecay);
                if (data.breathing) this.drone.setBreathing(data.breathing);
                if (data.globalMod) this.drone.setGlobalMod(data.globalMod);
                if (data.focus) this.drone.setFocusConfig(data.focus);
                if (data.peristalsis) this.drone.setPeristalsis(data.peristalsis);
                break;
                
            case 'triggerPeristalsis':
                this.drone.triggerPeristalticWave(data?.direction);
                break;
            
            // ─────────────────────────────────────────────────────────────
            // CATEGORY ENGINE
            // ─────────────────────────────────────────────────────────────
            case 'setCategoryConfig':
                if (data.category) {
                    this.category.setCategoryConfig(data.category, data);
                }
                break;
                
            case 'setCategoryEnabled':
                if (data.category !== undefined) {
                    this.category.setCategoryEnabled(data.category, data.enabled);
                }
                break;
                
            case 'setCategoryMixLevel':
                if (data.category !== undefined) {
                    this.category.setCategoryMixLevel(data.category, data.value);
                }
                break;
            
            // ─────────────────────────────────────────────────────────────
            // ENZYMATIC ENGINE
            // ─────────────────────────────────────────────────────────────
            case 'setEnzymaticConfig':
                if (data.shimmer) this.enzymatic.setShimmerConfig(data.shimmer);
                if (data.micro) this.enzymatic.setMicroConfig(data.micro);
                if (data.ripples) this.enzymatic.setRippleConfig(data.ripples);
                break;
                
            case 'setEnzymaticEnabled':
                if (data.type && data.enabled !== undefined) {
                    this.enzymatic.setEnabled(data.type, data.enabled);
                }
                break;
                
            case 'setEnzymaticMixLevel':
                if (data.type && data.value !== undefined) {
                    this.enzymatic.setMixLevel(data.type, data.value);
                }
                break;
            
            // ─────────────────────────────────────────────────────────────
            // POST-PROCESSOR (EFFECTS)
            // ─────────────────────────────────────────────────────────────
            case 'setChorusConfig':
                this.postProcessor.setChorusConfig(data);
                break;
                
            case 'setDelayConfig':
                this.postProcessor.setDelayConfig(data);
                break;
                
            case 'setChorusEnabled':
                this.postProcessor.setChorusEnabled(data);
                break;
                
            case 'setDelayEnabled':
                this.postProcessor.setDelayEnabled(data);
                break;
                
            case 'setChorusWetMix':
                this.postProcessor.setChorusWetMix(data);
                break;
                
            case 'setDelayWetMix':
                this.postProcessor.setDelayWetMix(data);
                break;
            
            // ─────────────────────────────────────────────────────────────
            // GAINS
            // ─────────────────────────────────────────────────────────────
            case 'setCategoryGain':
                if (data.category && data.gain !== undefined) {
                    this.ctx.categoryGains[data.category] = Math.max(0, Math.min(2, data.gain));
                }
                break;
                
            case 'setCategorySends':
                if (data.category && data.sends) {
                    this.ctx.categorySends[data.category] = {
                        ...this.ctx.categorySends[data.category],
                        ...data.sends,
                    };
                }
                break;
            
            // ─────────────────────────────────────────────────────────────
            // MS MODE
            // ─────────────────────────────────────────────────────────────
            case 'setMSMode':
                this.ctx.msMode.enabled = data.enabled;
                // Update MS data if provided
                if (data.msData) {
                    this.ctx.msMode.data = data.msData;
                    // Build affected pathway set
                    this.ctx.msMode.affectedSet.clear();
                    for (const id of Object.keys(data.msData)) {
                        this.ctx.msMode.affectedSet.add(id);
                    }
                }
                // Update audio parameters if provided
                if (data.focusBoost !== undefined) this.ctx.msMode.focusBoostDb = data.focusBoost;
                if (data.duckOthers !== undefined) this.ctx.msMode.duckOthersDb = data.duckOthers;
                if (data.settledDuck !== undefined) this.ctx.msMode.settledDuckDb = data.settledDuck;
                break;
                
            case 'setMSComparison':
                if (data.msData) {
                    this.ctx.msMode.data = data.msData;
                    // Build affected pathway set
                    this.ctx.msMode.affectedSet.clear();
                    for (const id of Object.keys(data.msData)) {
                        this.ctx.msMode.affectedSet.add(id);
                    }
                }
                break;
            
            // ─────────────────────────────────────────────────────────────
            // FAIRNESS
            // ─────────────────────────────────────────────────────────────
            case 'setFairnessConfig':
                if (data.weight !== undefined) this.ctx.fairness.weight = data.weight;
                if (data.decayTime !== undefined) this.ctx.fairness.decayTime = data.decayTime;
                break;
        }
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════════════════
    
    initPathways(pathwayData) {
        const sr = globalThis.sampleRate || 48000;
        this.ctx.sampleRate = sr;
        
        // Find max abundance for normalization
        const maxAbund = Math.max(...pathwayData.map(p => 
            p.amplitude || p.medianAbundance || 0.001
        ));
        
        // Build pathway objects
        this.ctx.pathways = pathwayData.map((p, i) => {
            const abundance = (p.amplitude || p.medianAbundance || 0.001) / maxAbund;
            const category = (p.category || 'other').toLowerCase();
            const subcategory = p.subcategory || 'Other';
            
            const n = p.n || this.extractN(p.ratio);
            const d = p.d || this.extractD(p.ratio);
            const ratio = n / d;
            
            return {
                id: p.id,
                name: p.name,
                index: i,
                n,
                d,
                ratio,
                frequency: this.ctx.fundamental * ratio,
                category,
                subcategory,
                abundance,
                baseVolume: Math.pow(abundance, 1.5),
                prevalence: p.prevalence,
                tier: p.tier,
            };
        });
        
        // Build lookup maps
        this.ctx.pathwayById = new Map(this.ctx.pathways.map(p => [p.id, p]));
        
        // Group by category
        for (const p of this.ctx.pathways) {
            if (!this.ctx.pathwaysByCategory.has(p.category)) {
                this.ctx.pathwaysByCategory.set(p.category, []);
            }
            this.ctx.pathwaysByCategory.get(p.category).push(p);
            
            if (!this.ctx.pathwaysBySubcategory.has(p.subcategory)) {
                this.ctx.pathwaysBySubcategory.set(p.subcategory, []);
            }
            this.ctx.pathwaysBySubcategory.get(p.subcategory).push(p);
        }
        
        // Sort by abundance within each group
        for (const [, arr] of this.ctx.pathwaysByCategory) {
            arr.sort((a, b) => b.abundance - a.abundance);
        }
        for (const [, arr] of this.ctx.pathwaysBySubcategory) {
            arr.sort((a, b) => b.abundance - a.abundance);
        }
        
        // Initialize fairness tracking
        for (const p of this.ctx.pathways) {
            this.ctx.fairness.lastSounded.set(p.id, 0);
        }
        
        // Build harmonic relationships
        this.ctx.buildHarmonicRelations();
        
        // Initialize all engines
        this.reference.init(this.ctx);
        this.drone.init(this.ctx);
        this.category.init(this.ctx);
        this.enzymatic.init(this.ctx);
        this.postProcessor.init(sr);
        
        this.initialized = true;
        
        // Report ready
        this.port.postMessage({
            type: 'ready',
            data: {
                pathwayCount: this.ctx.pathways.length,
                categories: [...this.ctx.pathwaysByCategory.keys()],
                subcategories: [...this.ctx.pathwaysBySubcategory.keys()],
                harmonicRelations: this.ctx.harmonicRelations.size,
                engines: {
                    reference: this.reference.getVoices().length,
                    drone: this.drone.voices.length,
                    category: this.category.getState(),
                    enzymatic: this.enzymatic.getState(),
                    postProcessor: this.postProcessor.getState(),
                },
            },
        });
        
        console.log(`MicrobiomeSonification v7.0 - THE LIVING OCEAN`);
        console.log(`  ${this.ctx.pathways.length} pathways initialized`);
        console.log(`  ${this.ctx.harmonicRelations.size} harmonic relationships mapped`);
    }
    
    extractN(ratio) {
        if (typeof ratio === 'string' && ratio.includes('/')) {
            return parseInt(ratio.split('/')[0], 10);
        }
        if (typeof ratio === 'number') {
            return Math.round(ratio * 12) || 1;
        }
        return 1;
    }
    
    extractD(ratio) {
        if (typeof ratio === 'string' && ratio.includes('/')) {
            return parseInt(ratio.split('/')[1], 10);
        }
        return 12;
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // MAIN PROCESS LOOP
    // ═══════════════════════════════════════════════════════════════════════
    
    process(inputs, outputs, parameters) {
        const output = outputs[0];
        const outL = output[0];
        const outR = output[1] || output[0];
        
        if (!outL || !this.initialized) return true;
        
        const blockSize = outL.length;
        const sr = globalThis.sampleRate || 48000;
        
        // ═══════════════════════════════════════════════════════════════════
        // UPDATE CONTEXT
        // ═══════════════════════════════════════════════════════════════════
        this.ctx.advance(blockSize, sr);
        
        // Update systems
        this.mmc.update(this.ctx);
        this.ctx.updateFocus();
        this.ctx.updateMSMode();
        
        // Update cascade fade animation
        this.updateCascade();
        
        // Store cascade accessor in context for engines to use
        this.ctx.getCascadeFade = (id) => this.getCascadeFade(id);
        
        // ═══════════════════════════════════════════════════════════════════
        // PREPARE BUFFERS
        // ═══════════════════════════════════════════════════════════════════
        
        // Dry mix (all engines write here)
        const dryL = new Float32Array(blockSize);
        const dryR = new Float32Array(blockSize);
        
        // Effect sends (engines write their contributions)
        const chorusSendL = new Float32Array(blockSize);
        const chorusSendR = new Float32Array(blockSize);
        const delaySendL = new Float32Array(blockSize);
        const delaySendR = new Float32Array(blockSize);
        
        // ═══════════════════════════════════════════════════════════════════
        // RENDER ENGINES
        // ═══════════════════════════════════════════════════════════════════
        
        // Reference tones (no effect sends - they're the anchor)
        this.reference.process(this.ctx, dryL, dryR);
        
        // Drone (the deep ocean)
        this.drone.process(this.ctx, dryL, dryR, 
                          chorusSendL, chorusSendR, delaySendL, delaySendR);
        
        // Category (sunlight on water)
        this.category.process(this.ctx, dryL, dryR,
                             chorusSendL, chorusSendR, delaySendL, delaySendR);
        
        // Enzymatic (the foam)
        this.enzymatic.process(this.ctx, dryL, dryR,
                              chorusSendL, chorusSendR, delaySendL, delaySendR);
        
        // ═══════════════════════════════════════════════════════════════════
        // POST-PROCESSING
        // ═══════════════════════════════════════════════════════════════════
        
        // Activity levels for organic effect fade
        const chorusActivity = this.ctx.mmcActivity.chorus ?? 0.5;
        const delayActivity = this.ctx.mmcActivity.delay ?? 0.5;
        
        // Chorus (processes dry + send, outputs to intermediate buffer)
        const postChorusL = new Float32Array(blockSize);
        const postChorusR = new Float32Array(blockSize);
        this.postProcessor.processChorus(
            dryL, dryR, 
            postChorusL, postChorusR,
            chorusSendL, chorusSendR,
            blockSize, chorusActivity
        );
        
        // Delay (processes chorus output + send, outputs to final)
        const postDelayL = new Float32Array(blockSize);
        const postDelayR = new Float32Array(blockSize);
        this.postProcessor.processDelay(
            postChorusL, postChorusR,
            postDelayL, postDelayR,
            delaySendL, delaySendR,
            blockSize, delayActivity
        );
        
        // ═══════════════════════════════════════════════════════════════════
        // SOFT LIMITING & OUTPUT
        // ═══════════════════════════════════════════════════════════════════
        
        for (let i = 0; i < blockSize; i++) {
            // Soft clip with tanh, then scale back
            outL[i] = Math.tanh(postDelayL[i] * 0.7) * 0.92;
            outR[i] = Math.tanh(postDelayR[i] * 0.7) * 0.92;
        }
        
        // ═══════════════════════════════════════════════════════════════════
        // REPORTING
        // ═══════════════════════════════════════════════════════════════════
        
        if (this.ctx.time - this.lastReport > this.reportInterval) {
            this.report();
            this.lastReport = this.ctx.time;
        }
        
        return true;
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // REPORTING
    // ═══════════════════════════════════════════════════════════════════════
    
    report() {
        // Build pathway modulation map - merge data from all engines
        const pathwayMod = new Map();
        
        // Drone voices (always-on foundation)
        const droneVoices = this.drone.getActiveVoices();
        for (const v of droneVoices) {
            pathwayMod.set(v.id, {
                id: v.id,
                envelope: 0.25,  // Steady presence
                layer: 'drone',
                category: v.category,
                lfoMod: 0.5,
            });
        }
        
        // Category voices (breathing layer)
        const categoryVoices = this.category.getVoices();
        for (const v of categoryVoices) {
            const existing = pathwayMod.get(v.id);
            if (existing) {
                existing.envelope = Math.max(existing.envelope, v.envelope || 0.3);
                existing.layer = 'category';
                existing.lfoMod = 0.5 + (v.envelope || 0) * 0.4;
            } else {
                pathwayMod.set(v.id, {
                    id: v.id,
                    envelope: v.envelope || 0.3,
                    layer: 'category',
                    category: v.category,
                    lfoMod: 0.5 + (v.envelope || 0) * 0.4,
                });
            }
        }
        
        // Enzymatic voices (shimmer/sparkle)
        const enzymaticVoices = this.enzymatic.getVoices();
        for (const v of enzymaticVoices) {
            const existing = pathwayMod.get(v.id);
            if (existing) {
                existing.shimmer = Math.max(existing.shimmer || 0, v.envelope || 0);
                existing.envelope = Math.max(existing.envelope, v.envelope || 0);
            } else {
                pathwayMod.set(v.id, {
                    id: v.id,
                    envelope: v.envelope || 0,
                    layer: v.type || 'shimmer',
                    shimmer: v.envelope || 0,
                    lfoMod: v.envelope || 0.5,
                });
            }
        }
        
        // Get peristalsis state
        const peristalsis = this.drone.getPeristalticState() || {};
        
        // Send as 'modulation' for HTML compatibility
        this.port.postMessage({
            type: 'modulation',
            data: {
                time: this.ctx.time,
                
                // Pathway data (what visualization primarily uses)
                pathways: Array.from(pathwayMod.values()),
                
                // Peristalsis for wave visualization
                peristalsisPhase: peristalsis.wavePosition || 0,
                
                // MMC state (90-second gut motility cycle)
                mmcPhase: this.ctx.mmcPhase,
                mmcActivity: { ...this.ctx.mmcActivity },
                mmcProgress: this.mmc.getPhaseProgress(),
                
                // Focus state
                focusId: this.ctx.focus.id,
                focusEnvelope: this.ctx.focus.envelope,
                
                // MS mode
                msMode: this.ctx.msMode.enabled,
                msTransition: this.ctx.msMode.transition,
                
                // Engine summaries
                engines: {
                    droneCount: this.drone.voices.length,
                    categoryState: this.category.getState(),
                    enzymaticState: this.enzymatic.getState(),
                },
            },
        });
    }
}

// ════════════════════════════════════════════════════════════════════════════
// REGISTER PROCESSOR
// ════════════════════════════════════════════════════════════════════════════

registerProcessor('microbiome-sonification', MicrobiomeSonificationProcessor);