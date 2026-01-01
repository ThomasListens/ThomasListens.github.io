/**
 * MicrobiomeSonification v5.1 - MULTI-ENGINE ARCHITECTURE
 * 
 * Updates in v5.1:
 * - Low frequency compensation for focused tones
 * - Relaxed focus envelope (smoother transitions)
 * - Peristaltic waves through the drone
 * 
 * Engines:
 * - SharedContext (state shared across all engines)
 * - MMCEngine (conductor with intensity scaling)
 * - DroneEngine (always-on consonant foundation + peristalsis)
 * - ReferenceToneEngine (harmonic ground - octave pyramid)
 * - Main Processor skeleton
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
        
        // ═══════════════════════════════════════════════════════════════════
        // MMC STATE (updated by MMCEngine)
        // ═══════════════════════════════════════════════════════════════════
        this.mmcPhase = 'quiescent';
        this.mmcActivity = {
            drone: 1.0,
            sustain: 0.5,
            movement: 0.5,
            texture: 0.5,
            shimmer: 0.5,
            peristalsis: 0.5,
        };
        
        // ═══════════════════════════════════════════════════════════════════
        // FOCUS STATE
        // Affects ALL engines - pulls one voice from the sea
        // ═══════════════════════════════════════════════════════════════════
        this.focus = {
            id: null,
            pathway: null,
            envelope: 0,
            target: 0,
            
            // How each engine responds to focus
            droneBoost: 6.0,
            categoryBoost: 2.0,
            duckOthers: 0.15,
            shimmerBurst: true,
            peristalsisAttract: 0.5,
            
            // Remove modulation for focused tone (steady, clear)
            removeModulation: true,
            
            // Abundance compensation (quiet pathways boosted when focused)
            abundanceCompensation: {
                enabled: true,
                targetLevel: 0.8,
                strength: 0.85,
            },
            
            // Envelope timing - RELAXED for smoother transitions
            attackTime: 0.3,     // Was 0.15
            releaseTime: 0.6,    // Was 0.4
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
        
        this.subcategoryGains = {};
        
        // ═══════════════════════════════════════════════════════════════════
        // MS COMPARISON MODE
        // ═══════════════════════════════════════════════════════════════════
        this.msMode = {
            enabled: false,
            transition: 0,
            transitionSpeed: 0.02,
            data: {},
        };
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // TIMING UPDATE
    // ═══════════════════════════════════════════════════════════════════════
    
    advance(blockSize, sampleRate) {
        this.blockSize = blockSize;
        this.sampleRate = sampleRate;
        this.dt = blockSize / sampleRate;
        this.time += this.dt;
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // FOCUS METHODS - RELAXED ENVELOPE
    // ═══════════════════════════════════════════════════════════════════════
    
    updateFocus() {
        const f = this.focus;
        
        if (f.target > f.envelope) {
            // Attack - smooth curve
            const attackRate = this.dt / f.attackTime;
            f.envelope += (f.target - f.envelope) * attackRate * 3;
        } else {
            // Release - exponential decay for natural fade
            const releaseRate = this.dt / f.releaseTime;
            f.envelope += (f.target - f.envelope) * releaseRate * 2.5;
            
            // Clean cutoff at very low values
            if (f.envelope < 0.001 && f.target === 0) {
                f.envelope = 0;
            }
        }
        
        f.envelope = Math.max(0, Math.min(1, f.envelope));
    }
    
    setFocus(pathwayId) {
        const wasFocused = this.focus.id !== null;
        const newFocus = pathwayId !== null;
        const isSwitching = wasFocused && newFocus && pathwayId !== this.focus.id;
        
        if (isSwitching) {
            // Switching directly - keep envelope high for smooth handoff
            // Don't reset to 0, just change the target
        } else if (!wasFocused && newFocus) {
            // Fresh focus from nothing - start from 0
            this.focus.envelope = 0;
        }
        
        this.focus.id = pathwayId;
        this.focus.pathway = pathwayId ? this.pathwayById.get(pathwayId) : null;
        this.focus.target = pathwayId ? 1.0 : 0.0;
    }
    
    getFocusDuck() {
        return 1.0 - (1.0 - this.focus.duckOthers) * this.focus.envelope;
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // MS MODE
    // ═══════════════════════════════════════════════════════════════════════
    
    updateMSMode() {
        const ms = this.msMode;
        const target = ms.enabled ? 1 : 0;
        ms.transition += (target - ms.transition) * ms.transitionSpeed;
    }
    
    getMSScale(pathwayId) {
        if (!this.msMode.enabled && this.msMode.transition < 0.01) {
            return 1.0;
        }
        
        const msInfo = this.msMode.data[pathwayId];
        if (!msInfo) return 1.0;
        
        const scaleFactor = 0.5;
        let msScale;
        
        if (msInfo.enrichedIn === 'healthy') {
            msScale = 1 - (msInfo.ldaScore * scaleFactor);
        } else {
            msScale = 1 + (msInfo.ldaScore * scaleFactor);
        }
        
        return 1.0 + (msScale - 1.0) * this.msMode.transition;
    }
}


// ╔════════════════════════════════════════════════════════════════════════════╗
// ║  MMC ENGINE - THE CONDUCTOR                                                ║
// ║  Controls activity levels with intensity scaling                           ║
// ║                                                                            ║
// ║  Intensity = 0: All phases sound similar (flat, consistent)               ║
// ║  Intensity = 1: Full contrast between phases (dynamic, evolving)          ║
// ╚════════════════════════════════════════════════════════════════════════════╝

class MMCEngine {
    constructor() {
        this.config = {
            cycleDuration: 60,
            transitionSpeed: 0.5,
            
            // ═══════════════════════════════════════════════════════════════
            // INTENSITY SCALING (0 = flat, 1 = full contrast)
            // ═══════════════════════════════════════════════════════════════
            intensity: 1.0,
            
            // Base activity (what you get at intensity = 0)
            baseActivity: {
                drone: 1.0,
                sustain: 0.6,
                movement: 0.5,
                texture: 0.5,
                shimmer: 0.4,
                peristalsis: 0.3,
            },
            
            // Phase definitions
            phases: {
                quiescent: {
                    duration: 0.40,
                    activity: {
                        drone: 1.0,
                        sustain: 0.3,
                        movement: 0.15,
                        texture: 0.25,
                        shimmer: 0.1,
                        peristalsis: 0.05,
                    },
                    description: 'Rest - gentle drone',
                },
                irregular: {
                    duration: 0.30,
                    activity: {
                        drone: 1.0,
                        sustain: 0.6,
                        movement: 0.5,
                        texture: 0.6,
                        shimmer: 0.35,
                        peristalsis: 0.4,
                    },
                    description: 'Awakening - building activity',
                },
                intense: {
                    duration: 0.18,
                    activity: {
                        drone: 1.0,
                        sustain: 1.0,
                        movement: 1.0,
                        texture: 1.0,
                        shimmer: 1.0,
                        peristalsis: 1.0,
                    },
                    description: 'Full activity - teeming with life',
                },
                transition: {
                    duration: 0.12,
                    activity: {
                        drone: 1.0,
                        sustain: 0.5,
                        movement: 0.35,
                        texture: 0.4,
                        shimmer: 0.2,
                        peristalsis: 0.25,
                    },
                    description: 'Settling - returning to rest',
                },
            },
        };
        
        this.currentPhase = 'quiescent';
        this.phaseTime = 0;
        this.cycleTime = 0;
        this.activity = { ...this.config.baseActivity };
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // MAIN UPDATE
    // ═══════════════════════════════════════════════════════════════════════
    
    update(ctx) {
        const cfg = this.config;
        
        this.cycleTime += ctx.dt;
        this.phaseTime += ctx.dt;
        
        // Check phase transition
        const phaseCfg = cfg.phases[this.currentPhase];
        const phaseDuration = phaseCfg.duration * cfg.cycleDuration;
        
        if (this.phaseTime >= phaseDuration) {
            this.phaseTime = 0;
            this.advancePhase();
        }
        
        // Calculate activity with intensity scaling
        const phaseTarget = cfg.phases[this.currentPhase].activity;
        const intensity = cfg.intensity;
        
        for (const key in this.activity) {
            const base = cfg.baseActivity[key] ?? 0.5;
            const target = phaseTarget[key] ?? 0.5;
            
            // Interpolate: at intensity=0 use base, at intensity=1 use target
            const scaledTarget = base + (target - base) * intensity;
            
            // Smooth transition
            this.activity[key] += (scaledTarget - this.activity[key]) * cfg.transitionSpeed * ctx.dt;
        }
        
        // Update context
        ctx.mmcPhase = this.currentPhase;
        ctx.mmcActivity = this.activity;
    }
    
    advancePhase() {
        const phases = ['quiescent', 'irregular', 'intense', 'transition'];
        const idx = phases.indexOf(this.currentPhase);
        this.currentPhase = phases[(idx + 1) % phases.length];
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // CONFIGURATION
    // ═══════════════════════════════════════════════════════════════════════
    
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
    
    setPhaseActivity(phase, layer, value) {
        if (this.config.phases[phase]?.activity[layer] !== undefined) {
            this.config.phases[phase].activity[layer] = Math.max(0, Math.min(1, value));
        }
    }
}


// ╔════════════════════════════════════════════════════════════════════════════╗
// ║  REFERENCE TONE ENGINE - THE HARMONIC GROUND                               ║
// ║                                                                            ║
// ║  A pyramid of octave-related tones providing harmonic reference            ║
// ║  1/1 at center (loudest), octaves spread left/right and quieter            ║
// ║                                                                            ║
// ║  When focus activates, these hold steady - the ground doesn't duck         ║
// ║  EXCEPT when the focused pathway matches a reference tone ratio            ║
// ╚════════════════════════════════════════════════════════════════════════════╝

class ReferenceToneEngine {
    constructor() {
        this.config = {
            mixLevel: 0.05,
            
            // ═══════════════════════════════════════════════════════════════
            // REFERENCE TONES - pyramid structure
            // Amplitude and pan define the shape
            // ═══════════════════════════════════════════════════════════════
            tones: [
                { n: 1, d: 4, amp: 0.05, pan: -0.8 },  // 2 octaves down, far left
                { n: 1, d: 2, amp: 0.25, pan: -0.5 },  // 1 octave down, left
                { n: 1, d: 1, amp: 1.0,  pan: 0.0  },  // FUNDAMENTAL - center, loudest
                { n: 2, d: 1, amp: 0.25, pan: 0.5  },  // 1 octave up, right
                { n: 4, d: 1, amp: 0.05, pan: 0.8  },  // 2 octaves up, far right
            ],
            
            // ═══════════════════════════════════════════════════════════════
            // FOCUS BEHAVIOR
            // ═══════════════════════════════════════════════════════════════
            focus: {
                duckAmount: 1.0,           // 1.0 = no duck, 0.5 = duck to 50%
                boostAmount: 1.0,          // multiplier when focus active
                boostFundamental: 1.0,     // extra boost for 1/1 specifically
                
                // When focused pathway matches a reference tone
                duckWhenMatchesFocus: true,
                duckMatchAmount: 0.85,     // Duck to 15% when matching
                
                // Also duck octave-related tones (1/1, 2/1, 1/2 are all related)
                duckOctaveRelated: false,
                duckOctaveAmount: 0.5,     // Duck octaves to 50%
            },
        };
        
        this.voices = [];
        this.initialized = false;
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════════════════
    
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
        console.log(`ReferenceToneEngine: ${this.voices.length} reference tones`);
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // RATIO MATCHING HELPERS
    // ═══════════════════════════════════════════════════════════════════════
    
    ratiosMatch(ratio1, ratio2, tolerance = 0.001) {
        return Math.abs(ratio1 - ratio2) < tolerance;
    }
    
    areOctaveRelated(ratio1, ratio2) {
        // Check if ratios are octave multiples of each other
        // log2(ratio1/ratio2) should be close to an integer
        if (ratio1 <= 0 || ratio2 <= 0) return false;
        const logRatio = Math.log2(ratio1 / ratio2);
        return Math.abs(logRatio - Math.round(logRatio)) < 0.01;
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // MAIN PROCESS
    // ═══════════════════════════════════════════════════════════════════════
    
    process(ctx, outputL, outputR) {
        if (!this.initialized || this.voices.length === 0) return;
        
        const cfg = this.config;
        const focusCfg = cfg.focus;
        const sr = ctx.sampleRate;
        const twoPi = Math.PI * 2;
        
        // Focus state
        const focusActive = ctx.focus.envelope > 0.01;
        const focusEnv = ctx.focus.envelope;
        
        // Get focused pathway's ratio (if any)
        const focusedRatio = ctx.focus.pathway ? ctx.focus.pathway.ratio : null;
        
        for (const voice of this.voices) {
            // Calculate base amplitude
            let amp = voice.baseAmplitude * cfg.mixLevel * ctx.masterVolume;
            
            if (focusActive && focusedRatio !== null) {
                // Check if this reference tone matches the focused pathway
                const exactMatch = this.ratiosMatch(voice.ratio, focusedRatio);
                const octaveMatch = focusCfg.duckOctaveRelated && 
                                    this.areOctaveRelated(voice.ratio, focusedRatio);
                
                if (exactMatch && focusCfg.duckWhenMatchesFocus) {
                    // Exact match - duck this tone, drone is playing it
                    amp *= 1 - (focusEnv * focusCfg.duckMatchAmount);
                } else if (octaveMatch && !exactMatch) {
                    // Octave related but not exact - partial duck
                    amp *= 1 - (focusEnv * focusCfg.duckOctaveAmount);
                } else {
                    // No match - normal boost behavior
                    const boost = voice.isFundamental 
                        ? focusCfg.boostFundamental 
                        : focusCfg.boostAmount;
                    
                    amp *= 1 + (boost - 1) * focusEnv;
                }
            } else if (focusActive) {
                // Focus active but no pathway (shouldn't happen, but handle it)
                const boost = voice.isFundamental 
                    ? focusCfg.boostFundamental 
                    : focusCfg.boostAmount;
                
                amp *= 1 + (boost - 1) * focusEnv;
            }
            
            // Panning
            const panAngle = (voice.pan + 1) * Math.PI / 4;
            const gainL = Math.cos(panAngle);
            const gainR = Math.sin(panAngle);
            
            // Render
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
    
    // ═══════════════════════════════════════════════════════════════════════
    // CONFIGURATION
    // ═══════════════════════════════════════════════════════════════════════
    
    setMixLevel(value) {
        this.config.mixLevel = Math.max(0, Math.min(1, value));
    }
    
    setToneAmplitude(n, d, amp) {
        const voice = this.voices.find(v => v.n === n && v.d === d);
        if (voice) {
            voice.baseAmplitude = Math.max(0, Math.min(1, amp));
        }
    }
    
    setTonePan(n, d, pan) {
        const voice = this.voices.find(v => v.n === n && v.d === d);
        if (voice) {
            voice.pan = Math.max(-1, Math.min(1, pan));
        }
    }
    
    setFocusBehavior(options) {
        if (options.duckAmount !== undefined) {
            this.config.focus.duckAmount = options.duckAmount;
        }
        if (options.boostAmount !== undefined) {
            this.config.focus.boostAmount = options.boostAmount;
        }
        if (options.boostFundamental !== undefined) {
            this.config.focus.boostFundamental = options.boostFundamental;
        }
        if (options.duckWhenMatchesFocus !== undefined) {
            this.config.focus.duckWhenMatchesFocus = options.duckWhenMatchesFocus;
        }
        if (options.duckMatchAmount !== undefined) {
            this.config.focus.duckMatchAmount = options.duckMatchAmount;
        }
        if (options.duckOctaveRelated !== undefined) {
            this.config.focus.duckOctaveRelated = options.duckOctaveRelated;
        }
        if (options.duckOctaveAmount !== undefined) {
            this.config.focus.duckOctaveAmount = options.duckOctaveAmount;
        }
    }
    
    updateFrequencies(ctx) {
        for (const voice of this.voices) {
            voice.frequency = ctx.fundamental * voice.ratio;
        }
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // INFO
    // ═══════════════════════════════════════════════════════════════════════
    
    getVoices() {
        return this.voices.map(v => ({
            ratio: `${v.n}/${v.d}`,
            amp: v.baseAmplitude,
            pan: v.pan,
            isFundamental: v.isFundamental,
        }));
    }
}


// ╔════════════════════════════════════════════════════════════════════════════╗
// ║  DRONE ENGINE - ALWAYS-ON CONSONANT FOUNDATION                             ║
// ║                                                                            ║
// ║  The "surface of the water" - constant, grounding                          ║
// ║  Features:                                                                 ║
// ║  - Consonance decay (quiet dissonant ratios)                               ║
// ║  - Organic breathing with wandering rates                                  ║
// ║  - Focus: removes modulation, compensates for abundance & frequency        ║
// ║  - Peristaltic waves that sweep through frequency space                    ║
// ╚════════════════════════════════════════════════════════════════════════════╝

class DroneEngine {
    constructor() {
        this.config = {
            voiceCount: 600,
            mixLevel: 0.1,
            
            // ═══════════════════════════════════════════════════════════════
            // CONSONANCE DECAY
            // ═══════════════════════════════════════════════════════════════
            consonanceDecay: {
                enabled: true,
                curve: 'logarithmic',    // 'exponential', 'linear', 'logarithmic'
                strength: 1.30,
                cutoff: 1,
            },
            
            // ═══════════════════════════════════════════════════════════════
            // BREATHING (per-voice amplitude modulation)
            // ═══════════════════════════════════════════════════════════════
            breathing: {
                rateRange: [0.06, 0.98],
                depthRange: [0.12, 0.68],
                
                // Organic wandering of rates over time
                wander: {
                    enabled: true,
                    speed: 0.006,
                    amount: 0.1,
                },
            },
            
            // ═══════════════════════════════════════════════════════════════
            // GLOBAL MODULATION (whole drone breathes together)
            // ═══════════════════════════════════════════════════════════════
            globalMod: {
                rate: 0.033,
                depth: 0.06,
            },
            
            // ═══════════════════════════════════════════════════════════════
            // FOCUS RESPONSE
            // ═══════════════════════════════════════════════════════════════
            focus: {
                boost: 6.0,
                removeModulation: true,
                
                abundanceCompensation: {
                    enabled: true,
                    targetLevel: 0.7,
                    strength: 0.85,
                },
                
                // LOW FREQUENCY COMPENSATION
                // Boosts low tones when focused (our ears are less sensitive)
                frequencyCompensation: {
                    enabled: true,
                    strength: 0.35,    // How much to boost low frequencies
                    // At ratio 0.25 (2 oct down): ~1.5x boost
                    // At ratio 1 (fundamental): 1x (no change)
                    // At ratio 4 (2 oct up): ~0.9x (slight reduction)
                },
            },
            
            // ═══════════════════════════════════════════════════════════════
            // PERISTALSIS - WAVES THROUGH FREQUENCY SPACE
            // ═══════════════════════════════════════════════════════════════
            peristalsis: {
                enabled: true,
                
                // Wave timing
                interval: 8,           // Seconds between waves
                intervalVariation: 4,  // Random variation (+/-)
                duration: 3.5,         // How long wave takes to sweep
                
                // Wave shape
                width: 0.6,            // Octaves wide
                boostAmount: 1.4,      // Volume multiplier at wave center
                
                // Direction: 'up', 'down', 'random', 'center-out'
                direction: 'random',
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
            nextWaveIn: 3 + Math.random() * 5,
            centerFreq: null,
        };
    }
    

    
    // ═══════════════════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════════════════
    
    init(ctx) {
        this.selectVoices(ctx);
        this.initialized = true;
        console.log(`DroneEngine: ${this.voices.length} voices initialized`);
    }
    
    selectVoices(ctx) {
        const cfg = this.config;
        const [minRate, maxRate] = cfg.breathing.rateRange;
        const [minDepth, maxDepth] = cfg.breathing.depthRange;
        
        // Score pathways by consonance + abundance
        const scored = ctx.pathways.map(p => {
            const nxd = p.n * p.d;
            const consonanceScore = 1 / Math.log2(nxd + 1);
            const score = consonanceScore * 0.7 + p.abundance * 0.3;
            return { pathway: p, score, nxd };
        });
        
        scored.sort((a, b) => b.score - a.score);
        
        const count = Math.min(cfg.voiceCount, scored.length);
        this.voices = [];
        
        for (let i = 0; i < count; i++) {
            const { pathway, nxd } = scored[i];
            
            const breathRate = minRate + Math.random() * (maxRate - minRate);
            const breathDepth = minDepth + Math.random() * (maxDepth - minDepth);
            
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
                
                phase: Math.random() * Math.PI * 2,
                
                // Breathing
                breathPhase: Math.random() * Math.PI * 2,
                breathRate,
                breathRateBase: breathRate,
                breathRateWander: Math.random() * Math.PI * 2,
                breathDepth,
                breathDepthBase: breathDepth,
                breathDepthWander: Math.random() * Math.PI * 2,
                
                pan: (Math.random() - 0.5) * 0.4,
            });
        }
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // CONSONANCE DECAY
    // ═══════════════════════════════════════════════════════════════════════
    
    getConsonanceMultiplier(nxd) {
        const cfg = this.config.consonanceDecay;
        if (!cfg.enabled) return 1.0;
        
        switch (cfg.curve) {
            case 'exponential':
                return Math.exp(-cfg.strength * Math.log(nxd) * 0.5);
            case 'linear':
                return Math.max(0, 1 - (nxd / Math.max(1, cfg.cutoff)) * cfg.strength);
            case 'logarithmic':
                return 1 / Math.pow(Math.log2(nxd + 1), cfg.strength);
            default:
                return 1.0;
        }
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // FOCUS AMPLITUDE (with abundance AND frequency compensation)
    // ═══════════════════════════════════════════════════════════════════════
    
    getFocusedAmplitude(voice, ctx) {
        const focusCfg = this.config.focus;
        const isFocused = ctx.focus.id === voice.pathwayId;
        
        if (!isFocused) {
            return voice.baseAmplitude * ctx.getFocusDuck();
        }
        
        // This voice IS focused
        const comp = focusCfg.abundanceCompensation;
        const freqComp = focusCfg.frequencyCompensation;
        
        // Calculate frequency compensation
        // Low frequencies get boosted, high frequencies slightly reduced
        let freqMultiplier = 1.0;
        if (freqComp.enabled) {
            // Boost lows, leave highs alone
            // At ratio 0.25: boost ~1.5x (with strength 0.35)
            // At ratio 0.5: boost ~1.27x
            // At ratio 1+: no change (1.0)
            freqMultiplier = 1 + Math.max(0, (1 - voice.ratio)) * freqComp.strength * 2;
        }
        
        let focusedLevel;
        if (!comp.enabled) {
            focusedLevel = voice.baseAmplitude * focusCfg.boost * freqMultiplier;
        } else {
            // Abundance compensation: boost quiet pathways more
            const currentLevel = voice.baseAmplitude;
            const targetLevel = comp.targetLevel;
            const compensatedLevel = currentLevel + (targetLevel - currentLevel) * comp.strength;
            focusedLevel = compensatedLevel * focusCfg.boost * freqMultiplier;
        }
        
        return voice.baseAmplitude + (focusedLevel - voice.baseAmplitude) * ctx.focus.envelope;
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // BREATHING UPDATE (with organic wander)
    // ═══════════════════════════════════════════════════════════════════════
    
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
            const rateRange = maxRate - minRate;
            const depthRange = maxDepth - minDepth;
            
            const rateWanderAmount = Math.sin(voice.breathRateWander) * rateRange * wander.amount;
            const depthWanderAmount = Math.sin(voice.breathDepthWander) * depthRange * wander.amount;
            
            voice.breathRate = Math.max(minRate, Math.min(maxRate, voice.breathRateBase + rateWanderAmount));
            voice.breathDepth = Math.max(minDepth, Math.min(maxDepth, voice.breathDepthBase + depthWanderAmount));
        }
        
        voice.breathPhase += twoPi * voice.breathRate * ctx.dt;
        if (voice.breathPhase > twoPi) voice.breathPhase -= twoPi;
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // PERISTALSIS - WAVES THROUGH FREQUENCY SPACE
    // ═══════════════════════════════════════════════════════════════════════
    
    updatePeristalsis(ctx) {
        const cfg = this.config.peristalsis;
        if (!cfg.enabled) return;
        
        const p = this.peristalsis;
        
        // Scale by MMC activity
        const activity = ctx.mmcActivity.peristalsis || 0.3;
        
        if (!p.active) {
            // Countdown to next wave
            p.nextWaveIn -= ctx.dt;
            
            // Only spawn if MMC activity allows
            if (p.nextWaveIn <= 0 && activity > 0.1 && Math.random() < activity) {
                this.startPeristalticWave(ctx);
            } else if (p.nextWaveIn <= 0) {
                // Reset timer even if we didn't spawn
                p.nextWaveIn = cfg.interval * 0.5 + Math.random() * cfg.intervalVariation;
            }
        } else {
            // Wave is active - advance it
            p.progress += ctx.dt / cfg.duration;
            
            if (p.progress >= 1) {
                p.active = false;
                p.nextWaveIn = cfg.interval + (Math.random() - 0.5) * cfg.intervalVariation * 2;
            }
        }
    }
    
    startPeristalticWave(ctx) {
        const cfg = this.config.peristalsis;
        const p = this.peristalsis;
        
        p.active = true;
        p.progress = 0;
        
        // Determine direction
        if (cfg.direction === 'random') {
            const roll = Math.random();
            if (roll < 0.4) {
                p.direction = 1;  // Up
            } else if (roll < 0.8) {
                p.direction = -1; // Down
            } else {
                p.direction = 0;  // Center-out
            }
        } else if (cfg.direction === 'up') {
            p.direction = 1;
        } else if (cfg.direction === 'down') {
            p.direction = -1;
        } else if (cfg.direction === 'center-out') {
            p.direction = 0;
        }
        
        p.centerFreq = ctx.fundamental;
    }
    
    getPeristalticBoost(voice, ctx) {
        const cfg = this.config.peristalsis;
        const p = this.peristalsis;
        
        if (!cfg.enabled || !p.active) return 1.0;
        
        // Calculate voice position in octaves from fundamental
        const voiceOctave = Math.log2(voice.ratio);  // -3 to +4 roughly
        const minOctave = -3;
        const maxOctave = 4;
        const octaveRange = maxOctave - minOctave;
        
        // Smooth envelope for the wave itself (fade in/out at edges)
        let waveEnvelope = 1.0;
        if (p.progress < 0.1) {
            waveEnvelope = p.progress / 0.1;
        } else if (p.progress > 0.9) {
            waveEnvelope = (1 - p.progress) / 0.1;
        }
        
        let waveCenter;
        let boost = 1.0;
        
        if (p.direction === 0) {
            // Center-out: wave expands from fundamental
            const spread = p.progress * octaveRange / 2;
            const distFromCenter = Math.abs(voiceOctave);
            
            // Wave is a ring expanding outward
            if (distFromCenter <= spread && distFromCenter >= spread - cfg.width) {
                const localPos = (spread - distFromCenter) / cfg.width;
                const shape = Math.sin(localPos * Math.PI);
                boost = 1 + (cfg.boostAmount - 1) * shape * waveEnvelope;
            }
        } else {
            // Linear sweep up or down
            if (p.direction > 0) {
                waveCenter = minOctave + p.progress * octaveRange;
            } else {
                waveCenter = maxOctave - p.progress * octaveRange;
            }
            
            const distance = Math.abs(voiceOctave - waveCenter);
            
            if (distance < cfg.width) {
                // Smooth wave shape using sine
                const localPos = 1 - (distance / cfg.width);
                const shape = Math.sin(localPos * Math.PI * 0.5);
                boost = 1 + (cfg.boostAmount - 1) * shape * waveEnvelope;
            }
        }
        
        return boost;
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // MAIN PROCESS
    // ═══════════════════════════════════════════════════════════════════════
    
    process(ctx, outputL, outputR) {
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
        
        const activity = ctx.mmcActivity.drone || 1.0;
        
        for (const voice of this.voices) {
            // Update breathing
            this.updateBreathing(voice, ctx);
            
            const isFocused = ctx.focus.id === voice.pathwayId;
            
            // Calculate breath envelope
            let breathEnvelope;
            if (isFocused && focusCfg.removeModulation) {
                // Focused: interpolate from breathing to steady
                const breath = Math.sin(voice.breathPhase);
                const normalEnvelope = 1 - voice.breathDepth + voice.breathDepth * (breath * breath);
                breathEnvelope = normalEnvelope + (1.0 - normalEnvelope) * ctx.focus.envelope;
            } else {
                const breath = Math.sin(voice.breathPhase);
                breathEnvelope = 1 - voice.breathDepth + voice.breathDepth * (breath * breath);
            }
            
            // Consonance decay
            const consonanceMult = this.getConsonanceMultiplier(voice.nxd);
            
            // Focus amplitude (with abundance AND frequency compensation)
            const focusedAmp = this.getFocusedAmplitude(voice, ctx);
            
            // Peristaltic boost
            const peristalticBoost = this.getPeristalticBoost(voice, ctx);
            
            // MS scaling
            const msMult = ctx.getMSScale(voice.pathwayId);
            
            // Category gain
            const categoryGain = ctx.categoryGains[voice.category] ?? 1.0;
            
            // Global mod (reduced for focused)
            let globalModApplied = globalMod;
            if (isFocused && focusCfg.removeModulation) {
                globalModApplied = 1 + (globalMod - 1) * (1 - ctx.focus.envelope);
            }
            
            // Final amplitude
            const amp = focusedAmp *
                        consonanceMult *
                        breathEnvelope *
                        globalModApplied *
                        activity *
                        msMult *
                        categoryGain *
                        peristalticBoost *
                        cfg.mixLevel *
                        ctx.masterVolume;
            
            // Panning
            const panAngle = (voice.pan + 1) * Math.PI / 4;
            const gainL = Math.cos(panAngle);
            const gainR = Math.sin(panAngle);
            
            // Render
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
    
    // ═══════════════════════════════════════════════════════════════════════
    // CONFIGURATION
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
    
    // Manual trigger for testing
    triggerPeristalticWave(direction) {
        if (direction) {
            this.config.peristalsis.direction = direction;
        }
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
            breathRate: v.breathRate.toFixed(3),
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
// ║  MAIN PROCESSOR - ORCHESTRATES ALL ENGINES                                 ║
// ╚════════════════════════════════════════════════════════════════════════════╝

class MicrobiomeSonificationProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        
        // Shared context
        this.ctx = new SharedContext();
        
        // Engines
        this.mmc = new MMCEngine();
        this.drone = new DroneEngine();
        this.reference = new ReferenceToneEngine();
        
        this.initialized = false;
        this.lastReport = 0;
        this.reportInterval = 0.033;
        
        this.port.onmessage = (e) => this.handleMessage(e.data);
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
            // GLOBAL
            // ─────────────────────────────────────────────────────────────
            case 'setFundamental':
                this.ctx.fundamental = data;
                this.drone.updateFrequencies(this.ctx);
                this.reference.updateFrequencies(this.ctx);
                break;
                
            case 'setMasterVolume':
                this.ctx.masterVolume = data;
                break;
                
            case 'setFocus':
                this.ctx.setFocus(data.id);
                break;
            
            // ─────────────────────────────────────────────────────────────
            // MMC
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
            
            // ─────────────────────────────────────────────────────────────
            // PERISTALSIS
            // ─────────────────────────────────────────────────────────────
            case 'triggerPeristalsis':
                this.drone.triggerPeristalticWave(data.direction);
                break;
            
            // ─────────────────────────────────────────────────────────────
            // REFERENCE TONES
            // ─────────────────────────────────────────────────────────────
            case 'setReferenceConfig':
                if (data.mixLevel !== undefined) this.reference.setMixLevel(data.mixLevel);
                if (data.focus) this.reference.setFocusBehavior(data.focus);
                if (data.toneAmplitude) {
                    this.reference.setToneAmplitude(
                        data.toneAmplitude.n, 
                        data.toneAmplitude.d, 
                        data.toneAmplitude.amp
                    );
                }
                if (data.tonePan) {
                    this.reference.setTonePan(
                        data.tonePan.n, 
                        data.tonePan.d, 
                        data.tonePan.pan
                    );
                }
                break;
            
            // ─────────────────────────────────────────────────────────────
            // GAINS
            // ─────────────────────────────────────────────────────────────
            case 'setCategoryGain':
                this.ctx.categoryGains[data.category] = data.gain;
                break;
                
            case 'setSubcategoryGain':
                this.ctx.subcategoryGains[data.subcategory] = data.gain;
                break;
            
            // ─────────────────────────────────────────────────────────────
            // MS MODE
            // ─────────────────────────────────────────────────────────────
            case 'setMSMode':
                this.ctx.msMode.enabled = data.enabled;
                if (data.msData) {
                    this.ctx.msMode.data = data.msData;
                }
                break;
        }
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════════════════
    
    initPathways(pathwayData) {
        const sr = globalThis.sampleRate || 48000;
        this.ctx.sampleRate = sr;
        
        const maxAbund = Math.max(...pathwayData.map(p => 
            p.amplitude || p.medianAbundance || 0.001
        ));
        
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
        
        // Group by category and subcategory
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
        
        // Sort by abundance
        for (const [, arr] of this.ctx.pathwaysByCategory) {
            arr.sort((a, b) => b.abundance - a.abundance);
        }
        for (const [, arr] of this.ctx.pathwaysBySubcategory) {
            arr.sort((a, b) => b.abundance - a.abundance);
        }
        
        // Initialize subcategory gains
        for (const [subcat] of this.ctx.pathwaysBySubcategory) {
            this.ctx.subcategoryGains[subcat] = 1.0;
        }
        
        // Initialize engines
        this.drone.init(this.ctx);
        this.reference.init(this.ctx);
        
        this.initialized = true;
        
        this.port.postMessage({
            type: 'ready',
            data: {
                pathwayCount: this.ctx.pathways.length,
                categories: [...this.ctx.pathwaysByCategory.keys()],
                subcategories: [...this.ctx.pathwaysBySubcategory.keys()],
                droneVoices: this.drone.getActiveVoices().length,
                referenceTones: this.reference.getVoices(),
            }
        });
        
        console.log(`MicrobiomeSonification v5.1 initialized: ${this.ctx.pathways.length} pathways`);
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
    // MAIN PROCESS
    // ═══════════════════════════════════════════════════════════════════════
    
    process(inputs, outputs, parameters) {
        const output = outputs[0];
        const outL = output[0];
        const outR = output[1] || output[0];
        
        if (!outL || !this.initialized) return true;
        
        const blockSize = outL.length;
        const sr = globalThis.sampleRate || 48000;
        
        // Advance context
        this.ctx.advance(blockSize, sr);
        
        // Update systems
        this.mmc.update(this.ctx);
        this.ctx.updateFocus();
        this.ctx.updateMSMode();
        
        // ═══════════════════════════════════════════════════════════════════
        // RENDER ENGINES
        // ═══════════════════════════════════════════════════════════════════
        
        const mixL = new Float32Array(blockSize);
        const mixR = new Float32Array(blockSize);
        
        // Reference tones (harmonic ground - underneath everything)
        this.reference.process(this.ctx, mixL, mixR);
        
        // Drone (always on, with peristalsis)
        this.drone.process(this.ctx, mixL, mixR);
        
        // ═══════════════════════════════════════════════════════════════════
        // OUTPUT (soft limiting)
        // ═══════════════════════════════════════════════════════════════════
        
        for (let i = 0; i < blockSize; i++) {
            outL[i] = Math.tanh(mixL[i] * 0.8) * 0.9;
            outR[i] = Math.tanh(mixR[i] * 0.8) * 0.9;
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
        const activePathways = [];
        
        for (const v of this.drone.getActiveVoices()) {
            activePathways.push({
                id: v.id,
                layer: 'drone',
                ratio: v.ratio,
                envelope: 1.0,
            });
        }
        
        this.port.postMessage({
            type: 'visualState',
            data: {
                time: this.ctx.time,
                mmcPhase: this.ctx.mmcPhase,
                mmcActivity: { ...this.ctx.mmcActivity },
                mmcIntensity: this.mmc.config.intensity,
                focusedId: this.ctx.focus.id,
                focusEnvelope: this.ctx.focus.envelope,
                msMode: this.ctx.msMode.enabled,
                msTransition: this.ctx.msMode.transition,
                activePathways,
                droneVoices: this.drone.voices.length,
                referenceTones: this.reference.getVoices(),
                peristalsis: this.drone.getPeristalticState(),
            }
        });
    }
}

registerProcessor('microbiome-sonification', MicrobiomeSonificationProcessor);