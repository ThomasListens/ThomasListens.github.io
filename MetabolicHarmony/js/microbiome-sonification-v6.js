/**
 * MicrobiomeSonification v6.0 - MULTI-ENGINE ARCHITECTURE
 * 
 * Engines:
 * - SharedContext (state shared across all engines)
 * - MMCEngine (conductor with intensity scaling)
 * - ReferenceToneEngine (harmonic ground - octave pyramid)
 * - DroneEngine (always-on consonant foundation + peristalsis)
 * - CategoryEngine (all 6 categories as unified texture engine)
 * 
 * Features:
 * - Focus with abundance + frequency compensation
 * - Relaxed focus envelope for smooth transitions
 * - Peristaltic waves through the drone
 * - Reference tones duck when matching focused ratio
 * - Category engine with consonance-weighted cycling + MS mode support
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
                targetLevel: 0.7,
                strength: 0.85,
            },
            
            // Envelope timing - RELAXED for smooth transitions
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
            // Healthy-enriched pathways get QUIETER in MS view
            msScale = 1 - (msInfo.ldaScore * scaleFactor);
        } else {
            // MS-enriched pathways get LOUDER in MS view
            msScale = 1 + (msInfo.ldaScore * scaleFactor);
        }
        
        return 1.0 + (msScale - 1.0) * this.msMode.transition;
    }
}


// ╔════════════════════════════════════════════════════════════════════════════╗
// ║  MMC ENGINE - THE CONDUCTOR                                                ║
// ║  Controls activity levels with intensity scaling                           ║
// ╚════════════════════════════════════════════════════════════════════════════╝

class MMCEngine {
    constructor() {
        this.config = {
            cycleDuration: 60,
            transitionSpeed: 0.5,
            intensity: 1.0,
            
            baseActivity: {
                drone: 1.0,
                sustain: 0.6,
                movement: 0.5,
                texture: 0.5,
                shimmer: 0.4,
                peristalsis: 0.3,
            },
            
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
        
        const phaseCfg = cfg.phases[this.currentPhase];
        const phaseDuration = phaseCfg.duration * cfg.cycleDuration;
        
        if (this.phaseTime >= phaseDuration) {
            this.phaseTime = 0;
            this.advancePhase();
        }
        
        const phaseTarget = cfg.phases[this.currentPhase].activity;
        const intensity = cfg.intensity;
        
        for (const key in this.activity) {
            const base = cfg.baseActivity[key] ?? 0.5;
            const target = phaseTarget[key] ?? 0.5;
            const scaledTarget = base + (target - base) * intensity;
            this.activity[key] += (scaledTarget - this.activity[key]) * cfg.transitionSpeed * ctx.dt;
        }
        
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
}


// ╔════════════════════════════════════════════════════════════════════════════╗
// ║  REFERENCE TONE ENGINE - THE HARMONIC GROUND                               ║
// ║  Octave pyramid that ducks when matching focused ratio                     ║
// ╚════════════════════════════════════════════════════════════════════════════╝

class ReferenceToneEngine {
    constructor() {
        this.config = {
            mixLevel: 0.1,
            
            tones: [
                { n: 1, d: 4, amp: 0.05, pan: -0.8 },
                { n: 1, d: 2, amp: 0.25, pan: -0.5 },
                { n: 1, d: 1, amp: 1.0,  pan: 0.0  },
                { n: 2, d: 1, amp: 0.25, pan: 0.5  },
                { n: 4, d: 1, amp: 0.05, pan: 0.8  },
            ],
            
            focus: {
                duckAmount: 1.0,
                boostAmount: 1.5,
                boostFundamental: 2.9,
                duckWhenMatchesFocus: true,
                duckMatchAmount: 0.85,
                duckOctaveRelated: false,
                duckOctaveAmount: 0.5,
            },
        };
        
        this.voices = [];
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
        console.log(`ReferenceToneEngine: ${this.voices.length} reference tones`);
    }
    
    ratiosMatch(ratio1, ratio2, tolerance = 0.001) {
        return Math.abs(ratio1 - ratio2) < tolerance;
    }
    
    areOctaveRelated(ratio1, ratio2) {
        if (ratio1 <= 0 || ratio2 <= 0) return false;
        const logRatio = Math.log2(ratio1 / ratio2);
        return Math.abs(logRatio - Math.round(logRatio)) < 0.01;
    }
    
    process(ctx, outputL, outputR) {
        if (!this.initialized || this.voices.length === 0) return;
        
        const cfg = this.config;
        const focusCfg = cfg.focus;
        const sr = ctx.sampleRate;
        const twoPi = Math.PI * 2;
        
        const focusActive = ctx.focus.envelope > 0.01;
        const focusEnv = ctx.focus.envelope;
        const focusedRatio = ctx.focus.pathway ? ctx.focus.pathway.ratio : null;
        
        for (const voice of this.voices) {
            let amp = voice.baseAmplitude * cfg.mixLevel * ctx.masterVolume;
            
            if (focusActive && focusedRatio !== null) {
                const exactMatch = this.ratiosMatch(voice.ratio, focusedRatio);
                const octaveMatch = focusCfg.duckOctaveRelated && 
                                    this.areOctaveRelated(voice.ratio, focusedRatio);
                
                if (exactMatch && focusCfg.duckWhenMatchesFocus) {
                    amp *= 1 - (focusEnv * focusCfg.duckMatchAmount);
                } else if (octaveMatch && !exactMatch) {
                    amp *= 1 - (focusEnv * focusCfg.duckOctaveAmount);
                } else {
                    const boost = voice.isFundamental 
                        ? focusCfg.boostFundamental 
                        : focusCfg.boostAmount;
                    amp *= 1 + (boost - 1) * focusEnv;
                }
            } else if (focusActive) {
                const boost = voice.isFundamental 
                    ? focusCfg.boostFundamental 
                    : focusCfg.boostAmount;
                amp *= 1 + (boost - 1) * focusEnv;
            }
            
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
    
    setMixLevel(value) {
        this.config.mixLevel = Math.max(0, Math.min(1, value));
    }
    
    setFocusBehavior(options) {
        Object.assign(this.config.focus, options);
    }
    
    updateFrequencies(ctx) {
        for (const voice of this.voices) {
            voice.frequency = ctx.fundamental * voice.ratio;
        }
    }
    
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
// ║  With peristalsis and frequency compensation for focus                     ║
// ╚════════════════════════════════════════════════════════════════════════════╝

class DroneEngine {
    constructor() {
        this.config = {
            voiceCount: 600,
            mixLevel: 0.05,
            
            consonanceDecay: {
                enabled: true,
                curve: 'logarithmic',
                strength: 2.50,
                cutoff: 32,
            },
            
            breathing: {
                rateRange: [0.06, 0.58],
                depthRange: [0.12, 0.88],
                wander: {
                    enabled: true,
                    speed: 0.015,
                    amount: 0.1,
                },
            },
            
            globalMod: {
                rate: 0.033,
                depth: 0.06,
            },
            
            focus: {
                boost: 6.0,
                removeModulation: true,
                abundanceCompensation: {
                    enabled: true,
                    targetLevel: 0.7,
                    strength: 0.85,
                },
                frequencyCompensation: {
                    enabled: true,
                    strength: 0.35,
                },
            },
            
            peristalsis: {
                enabled: true,
                interval: 8,
                intervalVariation: 4,
                duration: 3.5,
                width: 0.6,
                boostAmount: 1.5,
                direction: 'random',
            },
        };
        
        this.voices = [];
        this.globalModPhase = Math.random() * Math.PI * 2;
        this.initialized = false;
        
        this.peristalsis = {
            active: false,
            progress: 0,
            direction: 1,
            nextWaveIn: 3 + Math.random() * 5,
        };
    }
    
    init(ctx) {
        this.selectVoices(ctx);
        this.initialized = true;
        console.log(`DroneEngine: ${this.voices.length} voices initialized`);
    }
    
    selectVoices(ctx) {
        const cfg = this.config;
        const [minRate, maxRate] = cfg.breathing.rateRange;
        const [minDepth, maxDepth] = cfg.breathing.depthRange;
        
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
    
    getFocusedAmplitude(voice, ctx) {
        const focusCfg = this.config.focus;
        const isFocused = ctx.focus.id === voice.pathwayId;
        
        if (!isFocused) {
            return voice.baseAmplitude * ctx.getFocusDuck();
        }
        
        const comp = focusCfg.abundanceCompensation;
        const freqComp = focusCfg.frequencyCompensation;
        
        // Frequency compensation - boost lows only
        let freqMultiplier = 1.0;
        if (freqComp.enabled && voice.ratio < 1) {
            freqMultiplier = 1 + (1 - voice.ratio) * freqComp.strength * 2;
        }
        
        let focusedLevel;
        if (!comp.enabled) {
            focusedLevel = voice.baseAmplitude * focusCfg.boost * freqMultiplier;
        } else {
            const currentLevel = voice.baseAmplitude;
            const targetLevel = comp.targetLevel;
            const compensatedLevel = currentLevel + (targetLevel - currentLevel) * comp.strength;
            focusedLevel = compensatedLevel * focusCfg.boost * freqMultiplier;
        }
        
        return voice.baseAmplitude + (focusedLevel - voice.baseAmplitude) * ctx.focus.envelope;
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
    
    updatePeristalsis(ctx) {
        const cfg = this.config.peristalsis;
        if (!cfg.enabled) return;
        
        const p = this.peristalsis;
        const activity = ctx.mmcActivity.peristalsis || 0.3;
        
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
            if (roll < 0.4) p.direction = 1;
            else if (roll < 0.8) p.direction = -1;
            else p.direction = 0;
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
        
        const voiceOctave = Math.log2(voice.ratio);
        const minOctave = -3;
        const maxOctave = 4;
        const octaveRange = maxOctave - minOctave;
        
        let waveEnvelope = 1.0;
        if (p.progress < 0.1) {
            waveEnvelope = p.progress / 0.1;
        } else if (p.progress > 0.9) {
            waveEnvelope = (1 - p.progress) / 0.1;
        }
        
        let waveCenter;
        let boost = 1.0;
        
        if (p.direction === 0) {
            const spread = p.progress * octaveRange / 2;
            const distFromCenter = Math.abs(voiceOctave);
            
            if (distFromCenter <= spread && distFromCenter >= spread - cfg.width) {
                const localPos = (spread - distFromCenter) / cfg.width;
                const shape = Math.sin(localPos * Math.PI);
                boost = 1 + (cfg.boostAmount - 1) * shape * waveEnvelope;
            }
        } else {
            if (p.direction > 0) {
                waveCenter = minOctave + p.progress * octaveRange;
            } else {
                waveCenter = maxOctave - p.progress * octaveRange;
            }
            
            const distance = Math.abs(voiceOctave - waveCenter);
            
            if (distance < cfg.width) {
                const localPos = 1 - (distance / cfg.width);
                const shape = Math.sin(localPos * Math.PI * 0.5);
                boost = 1 + (cfg.boostAmount - 1) * shape * waveEnvelope;
            }
        }
        
        return boost;
    }
    
    process(ctx, outputL, outputR) {
        if (!this.initialized || this.voices.length === 0) return;
        
        const cfg = this.config;
        const focusCfg = cfg.focus;
        const sr = ctx.sampleRate;
        const twoPi = Math.PI * 2;
        
        this.updatePeristalsis(ctx);
        
        this.globalModPhase += twoPi * cfg.globalMod.rate * ctx.dt;
        if (this.globalModPhase > twoPi) this.globalModPhase -= twoPi;
        const globalMod = 1 + Math.sin(this.globalModPhase) * cfg.globalMod.depth;
        
        const activity = ctx.mmcActivity.drone || 1.0;
        
        for (const voice of this.voices) {
            this.updateBreathing(voice, ctx);
            
            const isFocused = ctx.focus.id === voice.pathwayId;
            
            let breathEnvelope;
            if (isFocused && focusCfg.removeModulation) {
                const breath = Math.sin(voice.breathPhase);
                const normalEnvelope = 1 - voice.breathDepth + voice.breathDepth * (breath * breath);
                breathEnvelope = normalEnvelope + (1.0 - normalEnvelope) * ctx.focus.envelope;
            } else {
                const breath = Math.sin(voice.breathPhase);
                breathEnvelope = 1 - voice.breathDepth + voice.breathDepth * (breath * breath);
            }
            
            const consonanceMult = this.getConsonanceMultiplier(voice.nxd);
            const focusedAmp = this.getFocusedAmplitude(voice, ctx);
            const peristalticBoost = this.getPeristalticBoost(voice);
            const msMult = ctx.getMSScale(voice.pathwayId);
            const categoryGain = ctx.categoryGains[voice.category] ?? 1.0;
            
            let globalModApplied = globalMod;
            if (isFocused && focusCfg.removeModulation) {
                globalModApplied = 1 + (globalMod - 1) * (1 - ctx.focus.envelope);
            }
            
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


// ════════════════════════════════════════════════════════════════════════════
// END OF PART 1 — CategoryEngine and MainProcessor follow in Part 2
// ════════════════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════════
// PART 2 — CategoryEngine + MainProcessor
// ════════════════════════════════════════════════════════════════════════════


// ╔════════════════════════════════════════════════════════════════════════════╗
// ║  CATEGORY ENGINE - ALL PATHWAY CATEGORIES                                  ║
// ║                                                                            ║
// ║  Unified engine for all 6 metabolic categories                            ║
// ║  Each category has distinct sonic character via configuration             ║
// ║                                                                            ║
// ║  Categories:                                                               ║
// ║    Energy (51)        - Fast, shimmering, metabolic core                  ║
// ║    Biosynthesis (288) - Warm, layered, constructive                       ║
// ║    Degradation (160)  - Darker, varied, breaking down                     ║
// ║    Salvage (17)       - Pure, consonant, 3-limit recycling               ║
// ║    Other (74)         - Ambient, background texture                       ║
// ║    Superpathways (10) - Smooth, integrative, superparticular             ║
// ║                                                                            ║
// ║  MS Comparison mode affects abundance → heard via selection + amplitude   ║
// ╚════════════════════════════════════════════════════════════════════════════╝

class CategoryEngine {
    constructor() {
        // ═══════════════════════════════════════════════════════════════════
        // CATEGORY CONFIGURATIONS
        // Each category has distinct sonic characteristics
        // ═══════════════════════════════════════════════════════════════════
        this.categoryConfigs = {
            // ───────────────────────────────────────────────────────────────
            // ENERGY - Fast, shimmering, metabolic core
            // Glycolysis, TCA, Fermentation, Pentose Phosphate, etc.
            // ───────────────────────────────────────────────────────────────
            energy: {
                enabled: true,
                mixLevel: 0.015,
                
                spawn: {
                    intervalRange: [0.08, 0.18],
                    variation: 0.3,
                },
                envelope: {
                    attack: [0.4, 1.0],
                    sustain: [2.0, 5.0],
                    release: [0.8, 1.5],
                },
                weighting: {
                    consonance: 0.5,
                    abundance: 0.5,
                    sustainBonus: 1.2,
                },
                
                maxVoices: 70,
                initialVoices: 50,
                panSpread: 0.8,
                activityKey: 'sustain',
            },
            
            // ───────────────────────────────────────────────────────────────
            // BIOSYNTHESIS - Warm, layered, constructive
            // Amino Acids, Nucleotides, Cofactors, Lipids, Cell Wall, etc.
            // ───────────────────────────────────────────────────────────────
            biosynthesis: {
                enabled: true,
                mixLevel: 0.012,
                
                spawn: {
                    intervalRange: [0.10, 0.22],
                    variation: 0.35,
                },
                envelope: {
                    attack: [0.6, 1.4],
                    sustain: [3.0, 7.0],
                    release: [1.2, 2.0],
                },
                weighting: {
                    consonance: 0.4,
                    abundance: 0.6,
                    sustainBonus: 1.3,
                },
                
                maxVoices: 80,
                initialVoices: 55,
                panSpread: 0.6,
                activityKey: 'texture',
            },
            
            // ───────────────────────────────────────────────────────────────
            // DEGRADATION - Darker, more varied, breaking down
            // Amino Acids, Nucleotides, Aromatics, Carbohydrates breakdown
            // ───────────────────────────────────────────────────────────────
            degradation: {
                enabled: true,
                mixLevel: 0.010,
                
                spawn: {
                    intervalRange: [0.12, 0.28],
                    variation: 0.4,
                },
                envelope: {
                    attack: [0.3, 0.8],
                    sustain: [1.8, 4.5],
                    release: [0.6, 1.2],
                },
                weighting: {
                    consonance: 0.35,
                    abundance: 0.65,
                    sustainBonus: 1.15,
                },
                
                maxVoices: 50,
                initialVoices: 35,
                panSpread: 0.7,
                activityKey: 'movement',
            },
            
            // ───────────────────────────────────────────────────────────────
            // SALVAGE - Pure, consonant, recycling
            // 3-limit subharmonics - most harmonically pure
            // ───────────────────────────────────────────────────────────────
            salvage: {
                enabled: true,
                mixLevel: 0.020,
                
                spawn: {
                    intervalRange: [0.15, 0.30],
                    variation: 0.25,
                },
                envelope: {
                    attack: [0.5, 1.2],
                    sustain: [3.5, 7.0],
                    release: [1.5, 2.5],
                },
                weighting: {
                    consonance: 0.7,
                    abundance: 0.3,
                    sustainBonus: 1.5,
                },
                
                maxVoices: 20,
                initialVoices: 14,
                panSpread: 0.5,
                activityKey: 'sustain',
            },
            
            // ───────────────────────────────────────────────────────────────
            // OTHER - Ambient background texture
            // Unclassified pathways - wide, spacious, atmospheric
            // ───────────────────────────────────────────────────────────────
            other: {
                enabled: true,
                mixLevel: 0.008,
                
                spawn: {
                    intervalRange: [0.18, 0.40],
                    variation: 0.5,
                },
                envelope: {
                    attack: [0.8, 1.8],
                    sustain: [4.0, 9.0],
                    release: [1.5, 3.0],
                },
                weighting: {
                    consonance: 0.4,
                    abundance: 0.6,
                    sustainBonus: 1.2,
                },
                
                maxVoices: 30,
                initialVoices: 20,
                panSpread: 0.9,
                activityKey: 'texture',
            },
            
            // ───────────────────────────────────────────────────────────────
            // SUPERPATHWAYS - Smooth, integrative
            // Superparticular ratios - smooth melodic steps
            // ───────────────────────────────────────────────────────────────
            superpathways: {
                enabled: true,
                mixLevel: 0.018,
                
                spawn: {
                    intervalRange: [0.12, 0.25],
                    variation: 0.3,
                },
                envelope: {
                    attack: [0.5, 1.0],
                    sustain: [2.5, 5.5],
                    release: [1.0, 1.8],
                },
                weighting: {
                    consonance: 0.55,
                    abundance: 0.45,
                    sustainBonus: 1.35,
                },
                
                maxVoices: 15,
                initialVoices: 10,
                panSpread: 0.5,
                activityKey: 'sustain',
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
            
            // Build pathway pool with consonance scores
            const pool = pathways.map(p => {
                const nxd = p.n * p.d;
                const consonanceScore = 1 / Math.log2(nxd + 1);
                return { ...p, consonanceScore, nxd };
            });
            
            // Sort by weighted score
            const w = config.weighting;
            pool.sort((a, b) => {
                const scoreA = a.consonanceScore * w.consonance + a.abundance * w.abundance;
                const scoreB = b.consonanceScore * w.consonance + b.abundance * w.abundance;
                return scoreB - scoreA;
            });
            
            this.categoryState[category] = {
                pool,
                timeSinceSpawn: Math.random() * 0.5,
                nextSpawnInterval: this.getNextInterval(config),
            };
            
            // Pre-populate voices
            if (pool.length > 0) {
                this.prepopulateCategory(category, config, ctx);
            }
            
            console.log(`CategoryEngine [${category}]: ${pool.length} pathways, ` +
                        `${this.getVoiceCountForCategory(category)} initial voices`);
        }
        
        this.initialized = true;
        console.log(`CategoryEngine: ${this.voices.length} total initial voices`);
    }
    
    prepopulateCategory(category, config, ctx) {
        const state = this.categoryState[category];
        const count = Math.min(config.initialVoices, config.maxVoices, state.pool.length);
        
        for (let i = 0; i < count; i++) {
            const pathway = this.selectPathway(category, ctx);
            if (pathway) {
                const voice = this.spawnVoice(category, pathway, ctx);
                
                // Stagger lifecycle so voices don't all release together
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
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // SPAWNING
    // ═══════════════════════════════════════════════════════════════════════
    
    getNextInterval(config) {
        const [min, max] = config.spawn.intervalRange;
        const base = min + Math.random() * (max - min);
        const variation = 1 + (Math.random() - 0.5) * 2 * config.spawn.variation;
        return base * variation;
    }
    
    selectPathway(category, ctx) {
        const state = this.categoryState[category];
        const config = this.categoryConfigs[category];
        const pool = state.pool;
        
        if (pool.length === 0) return null;
        
        const w = config.weighting;
        
        // Calculate weights - MS mode affects abundance here
        const weights = pool.map(p => {
            // Apply MS scaling to abundance for selection weighting
            const msScale = ctx.getMSScale(p.id);
            const effectiveAbundance = p.abundance * msScale;
            
            const consWeight = p.consonanceScore * w.consonance;
            const abundWeight = effectiveAbundance * w.abundance;
            return Math.max(0.01, consWeight + abundWeight);
        });
        
        const totalWeight = weights.reduce((sum, x) => sum + x, 0);
        let r = Math.random() * totalWeight;
        
        for (let i = 0; i < pool.length; i++) {
            r -= weights[i];
            if (r <= 0) return pool[i];
        }
        
        return pool[0];
    }
    
    spawnVoice(category, pathway, ctx) {
        const config = this.categoryConfigs[category];
        const env = config.envelope;
        const w = config.weighting;
        
        const sustainMult = 1 + (w.sustainBonus - 1) * pathway.consonanceScore;
        
        const attack = env.attack[0] + Math.random() * (env.attack[1] - env.attack[0]);
        const baseSustain = env.sustain[0] + Math.random() * (env.sustain[1] - env.sustain[0]);
        const sustain = baseSustain * sustainMult;
        const release = env.release[0] + Math.random() * (env.release[1] - env.release[0]);
        
        return {
            category,
            
            pathwayId: pathway.id,
            pathway,
            subcategory: pathway.subcategory,
            
            frequency: ctx.fundamental * pathway.ratio,
            ratio: pathway.ratio,
            n: pathway.n,
            d: pathway.d,
            
            phase: 'attack',
            time: 0,
            envelope: 0,
            attackTime: attack,
            sustainTime: sustain,
            releaseTime: release,
            
            oscPhase: Math.random() * Math.PI * 2,
            pan: (Math.random() - 0.5) * config.panSpread,
        };
    }
    
    getVoiceCountForCategory(category) {
        return this.voices.filter(v => v.category === category).length;
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // UPDATE
    // ═══════════════════════════════════════════════════════════════════════
    
    updateVoices(ctx) {
        for (let i = this.voices.length - 1; i >= 0; i--) {
            const voice = this.voices[i];
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
                        this.voices.splice(i, 1);
                        continue;
                    }
                    break;
            }
            
            voice.envelope = Math.max(0, Math.min(1, voice.envelope));
        }
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // PROCESS
    // ═══════════════════════════════════════════════════════════════════════
    
    process(ctx, outputL, outputR) {
        if (!this.initialized) return;
        
        // Spawn for each category
        for (const [category, config] of Object.entries(this.categoryConfigs)) {
            if (!config.enabled) continue;
            
            const state = this.categoryState[category];
            if (!state || !state.pool || state.pool.length === 0) continue;
            
            // Get activity level from MMC
            const activity = ctx.mmcActivity[config.activityKey] || 0.5;
            if (activity < 0.05) continue;
            
            state.timeSinceSpawn += ctx.dt;
            
            if (state.timeSinceSpawn >= state.nextSpawnInterval) {
                state.timeSinceSpawn = 0;
                state.nextSpawnInterval = this.getNextInterval(config);
                
                const currentCount = this.getVoiceCountForCategory(category);
                
                // Scale max voices by activity
                const activeMaxVoices = Math.floor(config.maxVoices * (0.3 + activity * 0.7));
                
                if (currentCount < activeMaxVoices && Math.random() < activity) {
                    const pathway = this.selectPathway(category, ctx);
                    if (pathway) {
                        const voice = this.spawnVoice(category, pathway, ctx);
                        this.voices.push(voice);
                    }
                }
            }
        }
        
        // Update all voices
        this.updateVoices(ctx);
        
        // Render all voices
        this.renderVoices(ctx, outputL, outputR);
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════════════════
    
    renderVoices(ctx, outputL, outputR) {
        const sr = ctx.sampleRate;
        const twoPi = Math.PI * 2;
        
        for (const voice of this.voices) {
            const config = this.categoryConfigs[voice.category];
            if (!config || !config.enabled) continue;
            
            // Get activity for this category
            const activity = ctx.mmcActivity[config.activityKey] || 0.5;
            
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
            
            // Category gain from UI
            const categoryGain = ctx.categoryGains[voice.category] ?? 1.0;
            
            // MS MODE - Apply MS scaling to amplitude
            const msScale = ctx.getMSScale(voice.pathwayId);
            
            const amp = voice.pathway.baseVolume *
                        voice.envelope *
                        activity *
                        categoryGain *
                        focusMult *
                        msScale *
                        config.mixLevel *
                        ctx.masterVolume;
            
            if (amp < 0.0001) continue;
            
            const panAngle = (voice.pan + 1) * Math.PI / 4;
            const gainL = Math.cos(panAngle);
            const gainR = Math.sin(panAngle);
            
            const phaseInc = (twoPi * voice.frequency) / sr;
            
            for (let i = 0; i < ctx.blockSize; i++) {
                const sample = Math.sin(voice.oscPhase) * amp;
                
                outputL[i] += sample * gainL;
                outputR[i] += sample * gainR;
                
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
        if (options.initialVoices !== undefined) config.initialVoices = options.initialVoices;
        if (options.panSpread !== undefined) config.panSpread = options.panSpread;
        if (options.activityKey !== undefined) config.activityKey = options.activityKey;
        
        if (options.spawn) Object.assign(config.spawn, options.spawn);
        if (options.envelope) Object.assign(config.envelope, options.envelope);
        if (options.weighting) Object.assign(config.weighting, options.weighting);
    }
    
    setAllMixLevels(value) {
        for (const config of Object.values(this.categoryConfigs)) {
            config.mixLevel = Math.max(0, Math.min(1, value));
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
        this.reference = new ReferenceToneEngine();
        this.drone = new DroneEngine();
        this.category = new CategoryEngine();
        
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
                this.category.updateFrequencies(this.ctx);
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
            // REFERENCE TONES
            // ─────────────────────────────────────────────────────────────
            case 'setReferenceConfig':
                if (data.mixLevel !== undefined) this.reference.setMixLevel(data.mixLevel);
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
                this.drone.triggerPeristalticWave(data.direction);
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
            // GAINS
            // ─────────────────────────────────────────────────────────────
            case 'setCategoryGain':
                if (data.category && data.gain !== undefined) {
                    this.ctx.categoryGains[data.category] = data.gain;
                }
                break;
                
            case 'setSubcategoryGain':
                if (data.subcategory && data.gain !== undefined) {
                    this.ctx.subcategoryGains[data.subcategory] = data.gain;
                }
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
                
            // Alternative message type from HTML
            case 'setMSComparison':
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
        this.reference.init(this.ctx);
        this.drone.init(this.ctx);
        this.category.init(this.ctx);
        
        this.initialized = true;
        
        this.port.postMessage({
            type: 'ready',
            data: {
                pathwayCount: this.ctx.pathways.length,
                categories: [...this.ctx.pathwaysByCategory.keys()],
                subcategories: [...this.ctx.pathwaysBySubcategory.keys()],
                droneVoices: this.drone.getActiveVoices().length,
                referenceTones: this.reference.getVoices(),
                categoryEngine: this.category.getState(),
            }
        });
        
        console.log(`MicrobiomeSonification v6.0 initialized: ${this.ctx.pathways.length} pathways`);
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
        
        // Reference tones (harmonic ground)
        this.reference.process(this.ctx, mixL, mixR);
        
        // Drone (always on)
        this.drone.process(this.ctx, mixL, mixR);
        
        // Category textures (all 6 categories)
        this.category.process(this.ctx, mixL, mixR);
        
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
        
        // Drone voices (sample first 100 for performance)
        const droneVoices = this.drone.getActiveVoices().slice(0, 100);
        for (const v of droneVoices) {
            activePathways.push({
                id: v.id,
                layer: 'drone',
                category: v.category,
                ratio: v.ratio,
                envelope: 1.0,
            });
        }
        
        // Category voices (sample first 50 for performance)
        const categoryVoices = this.category.getVoices().slice(0, 50);
        for (const v of categoryVoices) {
            activePathways.push({
                id: v.id,
                layer: 'category',
                category: v.category,
                subcategory: v.subcategory,
                ratio: v.ratio,
                envelope: v.envelope,
                phase: v.phase,
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
                category: this.category.getState(),
            }
        });
    }
}

registerProcessor('microbiome-sonification', MicrobiomeSonificationProcessor);