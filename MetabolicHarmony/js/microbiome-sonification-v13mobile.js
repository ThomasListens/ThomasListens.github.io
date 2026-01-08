/**
 * MicrobiomeSonification v13 - HARMONIC CLOUD TEXTURE
 * 
 * Changes from v12:
 * - HARMONIC CLOUD ENGINE: True granular microsound - thousands of imperceptible
 *   particles forming one continuous fluid
 *   - Micro-grains: 1-4ms duration, 150-800 grains/second
 *   - Imperceptible per-grain volume (0.00012) - density creates texture
 *   - Cosine-windowed envelopes for click-free blending
 *   - GRAVITATIONAL PULL toward 1/1 (home) - all particles drift toward consonance
 *   - Consonance scaling: linear, exponential, or none
 *   - Cloud center drifts through harmonic space with momentum
 *   - Heavy reverb (85%) for complete smearing
 *   - Like running water - molecules invisible, collective flow perceptible
 * 
 * Architecture:
 * - SharedContext        (state, timing, focus, MS mode, key findings)
 * - MMCEngine            (conductor - gut motility cycle)
 * - ReferenceToneEngine  (harmonic anchor - octave pyramid)
 * - DroneEngine          (unified sound - MS mode modulates these voices)
 * - MSSpotlightLayer     (guarantees MS pathway audibility during transition)
 * - FocusEngine          (single pathway focus tone - with EQ shaping)
 * - KeyFindingsEngine    (rippling chord for pathway groups)
 * - HarmonicCloudEngine  (NEW: granular microsound - flowing harmonic fluid)
 * - ReverbProcessor      (diffuse wash - the pool)
 * - PostProcessor        (chorus + delay + limiter)
 */

// ╔════════════════════════════════════════════════════════════════════════════╗
// ║  SHARED CONTEXT                                                            ║
// ╚════════════════════════════════════════════════════════════════════════════╝

class SharedContext {
    constructor() {
        this.time = 0;
        this.sampleRate = 48000;
        this.blockSize = 128;
        this.dt = 0;
        
        this.fundamental = 660;
        this.masterVolume = 0.4;
        
        // MASTER FADE
        this.masterFade = 0;
        this.masterFadeTarget = 0;
        this.masterFadeSpeed = 0.5;
        
        // DRONE SOLO (for sequence isolation)
        this.droneSoloActive = false;
        this.droneSoloDuck = 0.0;           // Mute drone when solo active
        this.droneSoloDuckSmoothed = 1.0;   // Smoothed value
        
        // Mode (affects granular rain movement)
        this.composedMode = 'composed';     // 'composed' or 'consonance'
        
        this.pathways = [];
        this.pathwayById = new Map();
        this.pathwaysByCategory = new Map();
        this.pathwaysBySubcategory = new Map();
        
        // MMC state
        this.mmcPhase = 'quiescent';
        this.mmcActivity = {
            drone: 1.0,
            granular: 0.5,
            chorus: 0.5,
            delay: 0.5,
        };
        
        // Focus state - now with gentler ducking
        this.focus = {
            id: null,
            pathway: null,
            envelope: 0,
            target: 0,
            attackTime: 0.25,      // Slower attack (was 0.15)
            releaseTime: 0.5,      // Slower release (was 0.4)
            targetVolume: 0.35,
            duckOthers: 0.55,      // Gentler duck (was 0.45 = duck TO 45%, now 55%)
            duckAttack: 0.4,       // NEW: Separate slower duck attack
        };
        
        // Category gains
        this.categoryGains = {
            energy: 1.0,
            biosynthesis: 1.0,
            degradation: 1.0,
            salvage: 1.0,
            other: 1.0,
            superpathways: 1.0,
        };
        
        // MS MODE
        this.msMode = {
            enabled: false,
            data: {},
            affectedSet: new Set(),
            depletedSet: new Set(),
            elevatedSet: new Set(),
            
            phases: {
                affected: 0,
                depleted: 0,
                elevated: 0,
                settled: 0,
            },
            
            smoothedPhases: {
                affected: 0,
                depleted: 0,
                elevated: 0,
                settled: 0,
            },
            
            ldaScores: new Map(),
            
            config: {
                depletedDuckMax: 0.55,
                elevatedBoostMax: 1.20,
                contextDuckMax: 0.70,
                smoothingSpeed: 4.0,
            },
        };
        
        // KEY FINDINGS - NEW
        this.keyFindings = {
            active: false,
            pathwayIds: [],        // Array of pathway IDs in this finding
            pathwaySet: new Set(), // For quick lookup
            envelope: 0,
            target: 0,
            attackTime: 0.3,
            releaseTime: 0.5,
            emphasisAmount: 0.15,  // How much to boost finding pathways
            duckAmount: 0.25,      // How much to duck others
        };
        
        // Fairness tracking
        this.fairness = {
            lastSounded: new Map(),
            decayTime: 15,
            weight: 0.3,
        };
    }
    
    advance(blockSize, sampleRate) {
        this.blockSize = blockSize;
        this.sampleRate = sampleRate;
        this.dt = blockSize / sampleRate;
        this.time += this.dt;
        
        // Update master fade
        const fadeSpeed = this.masterFadeSpeed * this.dt;
        if (this.masterFade < this.masterFadeTarget) {
            this.masterFade = Math.min(this.masterFadeTarget, this.masterFade + fadeSpeed);
        } else if (this.masterFade > this.masterFadeTarget) {
            this.masterFade = Math.max(this.masterFadeTarget, this.masterFade - fadeSpeed);
        }
        
        // Smooth MS phases
        const msSmooth = this.msMode.config.smoothingSpeed * this.dt;
        const raw = this.msMode.phases;
        const smooth = this.msMode.smoothedPhases;
        
        smooth.affected += (raw.affected - smooth.affected) * msSmooth;
        smooth.depleted += (raw.depleted - smooth.depleted) * msSmooth;
        smooth.elevated += (raw.elevated - smooth.elevated) * msSmooth;
        smooth.settled += (raw.settled - smooth.settled) * msSmooth;
        
        smooth.affected = Math.max(0, Math.min(1, smooth.affected));
        smooth.depleted = Math.max(0, Math.min(1, smooth.depleted));
        smooth.elevated = Math.max(0, Math.min(1, smooth.elevated));
        smooth.settled = Math.max(0, Math.min(1, smooth.settled));
        
        // Update key findings envelope
        const kf = this.keyFindings;
        const kfSpeed = kf.target > kf.envelope ? 
            this.dt / kf.attackTime * 3 : 
            this.dt / kf.releaseTime * 2;
        kf.envelope += (kf.target - kf.envelope) * kfSpeed;
        kf.envelope = Math.max(0, Math.min(1, kf.envelope));
        
        // Smooth drone solo duck
        const soloDuckTarget = this.droneSoloActive ? this.droneSoloDuck : 1.0;
        this.droneSoloDuckSmoothed += (soloDuckTarget - this.droneSoloDuckSmoothed) * 4.0 * this.dt;
    }
    
    // Master fade controls
    fadeIn(duration) {
        this.masterFadeTarget = 1;
        this.masterFadeSpeed = 1 / duration;
    }
    
    fadeOut(duration) {
        this.masterFadeTarget = 0;
        this.masterFadeSpeed = 1 / duration;
    }
    
    getMasterFade() {
        const t = this.masterFade;
        return t * t * (3 - 2 * t);
    }
    
    // Focus methods - now with separate duck envelope
    updateFocus() {
        const f = this.focus;
        const speed = f.target > f.envelope ? 
            this.dt / f.attackTime * 3 : 
            this.dt / f.releaseTime * 2.5;
        
        f.envelope += (f.target - f.envelope) * speed;
        f.envelope = Math.max(0, Math.min(1, f.envelope));
        
        if (f.envelope < 0.001 && f.target === 0) {
            f.envelope = 0;
        }
    }
    
    setFocus(pathwayId) {
        this.focus.id = pathwayId;
        this.focus.pathway = pathwayId ? this.pathwayById.get(pathwayId) : null;
        this.focus.target = pathwayId ? 1.0 : 0.0;
    }
    
    getFocusDuck() {
        // Slower duck attack using smoothed envelope
        const duckEnv = this.focus.envelope;
        return 1.0 - (1.0 - this.focus.duckOthers) * duckEnv * duckEnv; // Squared for slower onset
    }
    
    // MS MODE methods
    getMSActivity() {
        const p = this.msMode.smoothedPhases;
        return Math.max(p.affected, p.depleted, p.elevated, p.settled);
    }
    
    isPathwayMSAffected(pathwayId) {
        return this.msMode.affectedSet.has(pathwayId);
    }
    
    isPathwayMSDepleted(pathwayId) {
        return this.msMode.depletedSet.has(pathwayId);
    }
    
    isPathwayMSElevated(pathwayId) {
        return this.msMode.elevatedSet.has(pathwayId);
    }
    
    getPathwayLDA(pathwayId) {
        return this.msMode.ldaScores.get(pathwayId) || 0.5;
    }
    
    getMSGainModifier(pathwayId) {
        const msActivity = this.getMSActivity();
        if (msActivity < 0.001) return 1.0;
        
        const p = this.msMode.smoothedPhases;
        const cfg = this.msMode.config;
        const lda = this.getPathwayLDA(pathwayId);
        const ldaNorm = Math.min(lda / 2.0, 1.0);
        
        if (this.isPathwayMSDepleted(pathwayId)) {
            let gain = 1.0 + p.affected * 0.1;
            const duckAmount = (1.0 - cfg.depletedDuckMax) * ldaNorm;
            gain *= 1.0 - (p.depleted * duckAmount);
            gain += p.settled * duckAmount * 0.3;
            return Math.max(0.3, gain);
            
        } else if (this.isPathwayMSElevated(pathwayId)) {
            let gain = 1.0 + p.affected * 0.1;
            const boostAmount = (cfg.elevatedBoostMax - 1.0) * ldaNorm;
            gain += p.elevated * boostAmount;
            gain -= p.settled * boostAmount * 0.4;
            return Math.min(1.5, gain);
            
        } else {
            const contextDuck = 1.0 - (1.0 - cfg.contextDuckMax) * msActivity;
            const settledRecovery = p.settled * (1.0 - cfg.contextDuckMax) * 0.5;
            return Math.max(0.4, contextDuck + settledRecovery);
        }
    }
    
    // KEY FINDINGS methods
    setKeyFinding(pathwayIds) {
        const kf = this.keyFindings;
        if (pathwayIds && pathwayIds.length > 0) {
            kf.active = true;
            kf.pathwayIds = pathwayIds;
            kf.pathwaySet = new Set(pathwayIds);
            kf.target = 1.0;
        } else {
            kf.active = false;
            kf.pathwayIds = [];
            kf.pathwaySet.clear();
            kf.target = 0.0;
        }
    }
    
    isPathwayInFinding(pathwayId) {
        return this.keyFindings.pathwaySet.has(pathwayId);
    }
    
    getKeyFindingsDuck() {
        const kf = this.keyFindings;
        return 1.0 - kf.duckAmount * kf.envelope;
    }
    
    getKeyFindingsBoost() {
        const kf = this.keyFindings;
        return 1.0 + kf.emphasisAmount * kf.envelope;
    }
    
    // Fairness
    markSounded(pathwayId) {
        this.fairness.lastSounded.set(pathwayId, this.time);
    }
    
    getFairnessBonus(pathwayId) {
        const lastTime = this.fairness.lastSounded.get(pathwayId) || 0;
        const timeSince = this.time - lastTime;
        return Math.min(timeSince / this.fairness.decayTime, 1) * this.fairness.weight;
    }
}


// ╔════════════════════════════════════════════════════════════════════════════╗
// ║  MMC ENGINE - Gut Motility Conductor                                       ║
// ╚════════════════════════════════════════════════════════════════════════════╝

class MMCEngine {
    constructor() {
        this.cycleDuration = 90;
        this.currentPhase = 0;
        this.intensity = 1.0;
        
        this.phaseDurations = {
            quiescent: 0.55,
            increasing: 0.2,
            peak: 0.15,
            decreasing: 0.1,
        };
    }
    
    update(ctx) {
        ctx.mmcPhase = this.getCurrentPhaseName(this.currentPhase);
        
        const activity = this.getPhaseActivity(this.currentPhase);
        const smoothing = 0.02;
        
        ctx.mmcActivity.drone += (activity.drone - ctx.mmcActivity.drone) * smoothing;
        ctx.mmcActivity.granular += (activity.granular - ctx.mmcActivity.granular) * smoothing;
        ctx.mmcActivity.chorus += (activity.chorus - ctx.mmcActivity.chorus) * smoothing;
        ctx.mmcActivity.delay += (activity.delay - ctx.mmcActivity.delay) * smoothing;
        
        this.currentPhase += ctx.dt / this.cycleDuration;
        if (this.currentPhase >= 1) this.currentPhase -= 1;
    }
    
    getCurrentPhaseName(phase) {
        const d = this.phaseDurations;
        if (phase < d.quiescent) return 'quiescent';
        if (phase < d.quiescent + d.increasing) return 'increasing';
        if (phase < d.quiescent + d.increasing + d.peak) return 'peak';
        return 'decreasing';
    }
    
    getPhaseActivity(phase) {
        const d = this.phaseDurations;
        const i = this.intensity;
        
        if (phase < d.quiescent) {
            return { drone: 0.7 * i, granular: 0.3 * i, chorus: 0.4, delay: 0.3 };
        }
        if (phase < d.quiescent + d.increasing) {
            const t = (phase - d.quiescent) / d.increasing;
            return { 
                drone: (0.7 + 0.3 * t) * i, 
                granular: (0.3 + 0.5 * t) * i, 
                chorus: 0.4 + 0.2 * t, 
                delay: 0.3 + 0.2 * t 
            };
        }
        if (phase < d.quiescent + d.increasing + d.peak) {
            return { drone: 1.0 * i, granular: 0.8 * i, chorus: 0.6, delay: 0.5 };
        }
        const t = (phase - d.quiescent - d.increasing - d.peak) / d.decreasing;
        return { 
            drone: (1.0 - 0.3 * t) * i, 
            granular: (0.8 - 0.5 * t) * i, 
            chorus: 0.6 - 0.2 * t, 
            delay: 0.5 - 0.2 * t 
        };
    }
    
    setIntensity(val) { this.intensity = Math.max(0, Math.min(1, val)); }
    setCycleDuration(val) { this.cycleDuration = Math.max(30, Math.min(300, val)); }
}


// ╔════════════════════════════════════════════════════════════════════════════╗
// ║  REFERENCE TONE ENGINE - Harmonic Anchor                                   ║
// ╚════════════════════════════════════════════════════════════════════════════╝

class ReferenceToneEngine {
    constructor() {
        this.config = {
            volume: 0.0139,
            harmonics: [
                { ratio: 1, amp: 1.0 },
                { ratio: 2, amp: 0.4 },
                { ratio: 4, amp: 0.15 },
            ],
        };
        this.phases = [0, 0, 0];
    }
    
    init(ctx) {}
    
    process(ctx, outputL, outputR) {
        const cfg = this.config;
        const sr = ctx.sampleRate;
        const twoPi = Math.PI * 2;
        const masterFade = ctx.getMasterFade();
        
        if (masterFade < 0.001) return;
        
        // Apply solo duck - mute reference tone when soloing sequences
        const soloDuck = ctx.droneSoloDuckSmoothed;
        if (soloDuck < 0.001) return;
        
        for (let h = 0; h < cfg.harmonics.length; h++) {
            const harmonic = cfg.harmonics[h];
            const freq = ctx.fundamental * harmonic.ratio;
            const amp = cfg.volume * harmonic.amp * ctx.masterVolume * masterFade * soloDuck;
            
            if (amp < 0.00001) continue;
            
            const phaseInc = (twoPi * freq) / sr;
            
            for (let i = 0; i < ctx.blockSize; i++) {
                const sample = Math.sin(this.phases[h]) * amp;
                outputL[i] += sample;
                outputR[i] += sample;
                this.phases[h] += phaseInc;
                if (this.phases[h] > twoPi) this.phases[h] -= twoPi;
            }
        }
    }
}


// ╔════════════════════════════════════════════════════════════════════════════╗
// ║  DRONE ENGINE v12 — WITH MS MODULATION + KEY FINDINGS SUPPORT              ║
// ╚════════════════════════════════════════════════════════════════════════════╝

class DroneEngine {
    constructor() {
        this.global = {
            mixLevel: 0.015,
            whisperLevel: 0.006715,
            rippleStrength: 0.95,
            rippleSpeed: 0.0008,
        };

        this.habituation = {
            enabled: true,
            onsetTime: 4.0,
            maxReduction: 0.45,
            rate: 0.08,
            consonanceBias: 0.6,
        };

        this.interaction = {
            excitationStrength: 0.6,
            spread: 0.25,
            decayTime: 18.0,
            consonanceSensitivity: 0.4,
        };

        this.layers = {
            roots:    { minDuration: 40,  maxDuration: 240, recurrenceScale: 160, weight: 0.55 },
            deep:     { minDuration: 20,  maxDuration: 80,  recurrenceScale: 90,  weight: 0.25 },
            branches: { minDuration: 6,   maxDuration: 30,  recurrenceScale: 42,  weight: 0.20 },
            twigs:    { minDuration: 2.5, maxDuration: 12,  recurrenceScale: 24,  weight: 0.30 },
            leaves:   { minDuration: 1.6, maxDuration: 6,   recurrenceScale: 16,  weight: 0.12 },
        };

        this.voices = [];
        this.categoryOffsets = new Map();

        this.globalField = 1.0;
        this.globalVelocity = 0;

        this.initialized = false;
    }

    init(ctx) {
        this.voices = [];
        this.categoryOffsets.clear();

        let categoryIndex = 0;

        for (const p of ctx.pathways.slice(0, 600)) {
            if (!this.categoryOffsets.has(p.category)) {
                this.categoryOffsets.set(p.category, (categoryIndex++ * 0.37) % 1);
            }

            const consonance = 1 / Math.sqrt((p.n || 1) * (p.d || 1));

            this.voices.push({
                pathwayId: p.id,
                category: p.category,

                ratio: p.ratio,
                frequency: ctx.fundamental * p.ratio,
                phase: Math.random() * Math.PI * 2,

                abundance: p.abundance ?? 0.5,
                consonance,

                interactionEnergy: 0,

                activeTime: 0,
                habituation: 0,

                layers: this.initLayerStates(ctx.time),
                
                msGainSmoothed: 1.0,
                kfGainSmoothed: 1.0,  // NEW: Key findings gain
            });
        }

        this.initialized = true;
    }

    initLayerStates(now) {
        const states = {};
        for (const name in this.layers) {
            states[name] = {
                state: 'rest',
                env: 0,
                elapsed: 0,
                duration: 0,
                nextEvent: now + Math.random() * 30,
            };
        }
        return states;
    }

    process(ctx, outputL, outputR, reverbSendL, reverbSendR) {
        if (!this.initialized) return;

        const sr = ctx.sampleRate;
        const twoPi = Math.PI * 2;
        const masterFade = ctx.getMasterFade();
        
        if (masterFade < 0.001) return;

        // Global ripple field
        this.globalVelocity += (Math.random() * 2 - 1) * this.global.rippleSpeed;
        this.globalVelocity *= 0.995;
        this.globalField = Math.max(0.8, Math.min(1.2, this.globalField + this.globalVelocity));

        const msActivity = ctx.getMSActivity();
        const kfEnvelope = ctx.keyFindings.envelope;

        for (const v of this.voices) {
            v.interactionEnergy *= Math.exp(-ctx.dt / this.interaction.decayTime);

            const catOffset = this.categoryOffsets.get(v.category) || 0;
            const ripple =
                1 +
                (this.globalField - 1) *
                this.global.rippleStrength *
                (0.7 + catOffset);

            const rippleResponse = 0.5 + v.consonance * 0.5;

            let amp = this.global.whisperLevel;
            let isActive = false;

            for (const layerName in this.layers) {
                const cfg = this.layers[layerName];
                const layer = v.layers[layerName];

                const probability =
                    ripple *
                    rippleResponse *
                    Math.pow(v.abundance, 1.1) *
                    (1 + v.interactionEnergy);

                if (layer.state === 'rest') {
                    if (Math.random() < ctx.dt / (cfg.recurrenceScale / probability)) {
                        layer.state = 'active';
                        layer.elapsed = 0;
                        layer.duration =
                            cfg.minDuration +
                            v.consonance *
                            (cfg.maxDuration - cfg.minDuration);
                    }
                } else {
                    isActive = true;
                    layer.elapsed += ctx.dt;
                    const t = layer.elapsed / layer.duration;

                    if (t >= 1) {
                        layer.state = 'rest';
                        layer.env = 0;
                    } else {
                        layer.env = t < 0.5
                            ? t * t * (3 - 2 * t)
                            : (1 - t) * (1 - t) * (3 - 2 * (1 - t));
                    }
                }

                amp += layer.env * cfg.weight;
            }

            // Perceptual habituation
            if (this.habituation.enabled && isActive) {
                v.activeTime += ctx.dt;

                if (v.activeTime > this.habituation.onsetTime) {
                    const bias = 1 - v.consonance * this.habituation.consonanceBias;
                    v.habituation += this.habituation.rate * bias * ctx.dt;
                    v.habituation = Math.min(1, v.habituation);
                }
            } else {
                v.activeTime = 0;
                v.habituation *= 0.95;
            }

            const habituationGain = 1 - v.habituation * this.habituation.maxReduction;

            // Focus ducking
            const focusDuck = ctx.focus.id && ctx.focus.id !== v.pathwayId ? ctx.getFocusDuck() : 1;

            // MS gain modulation
            const msGainTarget = ctx.getMSGainModifier(v.pathwayId);
            const msGainSpeed = 3.0 * ctx.dt;
            v.msGainSmoothed += (msGainTarget - v.msGainSmoothed) * msGainSpeed;
            
            // Key Findings gain modulation - NEW
            let kfGainTarget = 1.0;
            if (kfEnvelope > 0.01) {
                if (ctx.isPathwayInFinding(v.pathwayId)) {
                    kfGainTarget = ctx.getKeyFindingsBoost();
                } else {
                    kfGainTarget = ctx.getKeyFindingsDuck();
                }
            }
            const kfGainSpeed = 4.0 * ctx.dt;
            v.kfGainSmoothed += (kfGainTarget - v.kfGainSmoothed) * kfGainSpeed;
            
            // Category gain
            const categoryGain = ctx.categoryGains[v.category] ?? 1.0;

            const finalAmp =
                amp *
                habituationGain *
                focusDuck *
                v.msGainSmoothed *
                v.kfGainSmoothed *  // Key findings modulation
                categoryGain *
                ctx.droneSoloDuckSmoothed *  // Solo mode ducking
                this.global.mixLevel *
                ctx.masterVolume *
                masterFade;

            if (finalAmp < 0.000001) continue;

            const phaseInc = twoPi * v.frequency / sr;

            for (let i = 0; i < ctx.blockSize; i++) {
                const s = Math.sin(v.phase) * finalAmp;
                outputL[i] += s;
                outputR[i] += s;
                
                const msReverbBoost = msActivity > 0.1 ? 1.2 : 1.0;
                const reverbSend = (isActive ? 0.3 : 0.15) * msReverbBoost;
                reverbSendL[i] += s * reverbSend;
                reverbSendR[i] += s * reverbSend;
                
                v.phase += phaseInc;
                if (v.phase > twoPi) v.phase -= twoPi;
            }
        }
    }

    updateFrequencies(ctx) {
        for (const v of this.voices) {
            v.frequency = ctx.fundamental * v.ratio;
        }
    }

    excitePathway(pathwayId) {
        for (const v of this.voices) {
            if (v.pathwayId === pathwayId) {
                v.interactionEnergy +=
                    this.interaction.excitationStrength *
                    (0.5 + v.consonance * this.interaction.consonanceSensitivity);
            }
        }
    }
}


// ╔════════════════════════════════════════════════════════════════════════════╗
// ║  MS SPOTLIGHT LAYER - Guarantees MS pathways are heard during transition   ║
// ║                                                                            ║
// ║  This is a LIGHTWEIGHT layer that only activates during MS phases.         ║
// ║  It doesn't replace the drone modulation - it supplements it to ensure     ║
// ║  the MS pathways are definitely audible even if they're in "rest" state.   ║
// ╚════════════════════════════════════════════════════════════════════════════╝

class MSSpotlightLayer {
    constructor() {
        this.config = {
            maxVoices: 16,           // Limit for performance
            baseVolume: 0.002,      // Subtle - supplement not replace
            depletedTimbre: 0.7,     // Darker
            elevatedTimbre: 1.2,     // Brighter
        };
        
        this.voices = [];
        this.initialized = false;
    }
    
    init(ctx) {
        this.voices = [];
        this.initialized = true;
    }
    
    updateMSData(ctx, msData) {
        if (!msData) return;
        
        this.voices = [];
        
        // Build voices sorted by LDA score
        const entries = Object.entries(msData)
            .map(([id, info]) => ({
                id,
                info,
                pathway: ctx.pathwayById.get(id),
            }))
            .filter(e => e.pathway)
            .sort((a, b) => (b.info.ldaScore || 0.5) - (a.info.ldaScore || 0.5))
            .slice(0, this.config.maxVoices);
        
        for (const { id, info, pathway } of entries) {
            const isDepleted = info.enrichedIn === 'healthy';
            const isElevated = !isDepleted;
            
            this.voices.push({
                pathwayId: id,
                pathway,
                isDepleted,
                isElevated,
                ldaScore: Math.min(info.ldaScore || 0.5, 2.0),
                frequency: ctx.fundamental * pathway.ratio,
                phase: Math.random() * Math.PI * 2,
                envelope: 0,
            });
        }
        
        console.log(`[MSSpotlight] ${this.voices.length} voices ready`);
    }
    
    process(ctx, outputL, outputR, reverbSendL, reverbSendR) {
        if (!this.initialized || this.voices.length === 0) return;
        
        const p = ctx.msMode.smoothedPhases;
        const masterFade = ctx.getMasterFade();
        
        // Only active during MS transition phases
        // Spotlight fades in during "affected", adjusts during depleted/elevated, fades during settled
        const spotlightActivity = p.affected * (1.0 - p.settled * 0.7);
        
        if (spotlightActivity < 0.001 || masterFade < 0.001) return;
        
        const sr = ctx.sampleRate;
        const twoPi = Math.PI * 2;
        const cfg = this.config;
        
        for (const v of this.voices) {
            // Calculate target envelope based on phase and direction
            let targetEnv = spotlightActivity * cfg.baseVolume;
            
            // Direction-based adjustment
            if (v.isDepleted) {
                // Depleted: present during affected, then fade during depleted phase
                targetEnv *= (1.0 - p.depleted * 0.5);
            } else if (v.isElevated) {
                // Elevated: present during affected, boost during elevated phase
                targetEnv *= (1.0 + p.elevated * 0.3);
            }
            
            // LDA scaling - more significant pathways are more prominent
            targetEnv *= 0.5 + v.ldaScore * 0.5;
            
            // Smooth envelope
            const envSpeed = 5.0 * ctx.dt;
            v.envelope += (targetEnv - v.envelope) * envSpeed;
            
            if (v.envelope < 0.0001) continue;
            
            const amp = v.envelope * ctx.masterVolume * masterFade * ctx.droneSoloDuckSmoothed;
            
            // Timbre adjustment
            const timbre = v.isDepleted ? cfg.depletedTimbre : (v.isElevated ? cfg.elevatedTimbre : 1.0);
            
            const phaseInc = (twoPi * v.frequency) / sr;
            
            for (let i = 0; i < ctx.blockSize; i++) {
                // Simple sine with subtle 2nd harmonic for timbre
                const fundamental = Math.sin(v.phase);
                const harmonic = Math.sin(v.phase * 2) * 0.15 * timbre;
                const sample = (fundamental + harmonic) * amp;
                
                outputL[i] += sample;
                outputR[i] += sample;
                
                // Send to reverb for blend
                reverbSendL[i] += sample * 0.4;
                reverbSendR[i] += sample * 0.4;
                
                v.phase += phaseInc;
                if (v.phase > twoPi) v.phase -= twoPi;
            }
        }
    }
    
    updateFrequencies(ctx) {
        for (const v of this.voices) {
            v.frequency = ctx.fundamental * v.pathway.ratio;
        }
    }
}


// ╔════════════════════════════════════════════════════════════════════════════╗
// ║  FOCUS ENGINE v12 - With Fletcher-Munson Compensation                      ║
// ║                                                                            ║
// ║  Human hearing is less sensitive to low and high frequencies.              ║
// ║  This applies frequency-dependent gain to maintain perceived loudness.     ║
// ╚════════════════════════════════════════════════════════════════════════════╝

class FocusEngine {
    constructor() {
        this.config = {
            targetVolume: 0.040,     // Slightly reduced base
            attackTime: 0.15,
            releaseTime: 0.4,
            harmonics: [
                { ratio: 1, amp: 1.0 },
                { ratio: 2, amp: 0.04 },  // Reduced harmonics
                { ratio: 3, amp: 0.015 },
            ],
            
            // Fletcher-Munson compensation
            // Reference frequency for "neutral" loudness
            referenceFreq: 1000,
            // Low frequency boost (below reference)
            lowBoostMax: 2.5,        // Max boost at very low freqs
            lowBoostKnee: 200,       // Frequency where boost starts
            // High frequency cut (above reference)  
            highCutStart: 2500,      // Frequency where cut starts
            highCutMax: 0.5,         // Max attenuation at very high freqs
            highCutKnee: 6000,       // Frequency for max cut
        };
        this.phases = [0, 0, 0];
        this.envelope = 0;
    }
    
    /**
     * Calculate frequency-dependent gain based on equal-loudness contours
     */
    getFrequencyGain(freq) {
        const cfg = this.config;
        let gain = 1.0;
        
        if (freq < cfg.lowBoostKnee) {
            // Low frequency boost - logarithmic curve
            const t = Math.log2(freq / cfg.lowBoostKnee) / Math.log2(20 / cfg.lowBoostKnee);
            const boost = 1.0 + (cfg.lowBoostMax - 1.0) * Math.max(0, -t);
            gain *= boost;
        }
        
        if (freq > cfg.highCutStart) {
            // High frequency attenuation - smooth rolloff
            const t = (freq - cfg.highCutStart) / (cfg.highCutKnee - cfg.highCutStart);
            const cut = 1.0 - (1.0 - cfg.highCutMax) * Math.min(1, Math.max(0, t));
            gain *= cut;
        }
        
        return gain;
    }
    
    process(ctx, outputL, outputR) {
        const cfg = this.config;
        const sr = ctx.sampleRate;
        const twoPi = Math.PI * 2;
        const masterFade = ctx.getMasterFade();
        
        // Update envelope
        const target = ctx.focus.target;
        const speed = target > this.envelope ? 
            ctx.dt / cfg.attackTime * 4 : 
            ctx.dt / cfg.releaseTime * 3;
        
        this.envelope += (target - this.envelope) * speed;
        this.envelope = Math.max(0, Math.min(1, this.envelope));
        
        if (this.envelope < 0.001 || masterFade < 0.001) return;
        
        const pathway = ctx.focus.pathway;
        if (!pathway) return;
        
        const baseFreq = ctx.fundamental * pathway.ratio;
        
        // Apply Fletcher-Munson compensation
        const freqGain = this.getFrequencyGain(baseFreq);
        
        const amp = cfg.targetVolume * this.envelope * ctx.masterVolume * masterFade * freqGain * ctx.droneSoloDuckSmoothed;
        
        for (let h = 0; h < cfg.harmonics.length; h++) {
            const harmonic = cfg.harmonics[h];
            const freq = baseFreq * harmonic.ratio;
            
            // Also compensate harmonics (less aggressively)
            const harmonicFreqGain = h === 0 ? 1.0 : Math.sqrt(this.getFrequencyGain(freq));
            const harmonicAmp = amp * harmonic.amp * harmonicFreqGain;
            
            if (harmonicAmp < 0.0001) continue;
            
            const phaseInc = (twoPi * freq) / sr;
            
            for (let i = 0; i < ctx.blockSize; i++) {
                const sample = Math.sin(this.phases[h]) * harmonicAmp;
                outputL[i] += sample;
                outputR[i] += sample;
                this.phases[h] += phaseInc;
                if (this.phases[h] > twoPi) this.phases[h] -= twoPi;
            }
        }
    }
}


// ╔════════════════════════════════════════════════════════════════════════════╗
// ║  KEY FINDINGS ENGINE - Rippling Chord for Pathway Groups                   ║
// ║                                                                            ║
// ║  When a key finding is selected, this creates a chord from all pathways    ║
// ║  in that finding. Each pathway has phase-offset modulation so they         ║
// ║  "ripple" rather than pulsing in unison - organic wave effect.             ║
// ╚════════════════════════════════════════════════════════════════════════════╝

class KeyFindingsEngine {
    constructor() {
        this.config = {
            baseVolume: 0.012,       // Per-voice volume
            maxVoices: 10,           // Limit for very large findings
            
            // Fletcher-Munson (same as focus)
            referenceFreq: 1000,
            lowBoostMax: 2.0,
            lowBoostKnee: 200,
            highCutStart: 2500,
            highCutMax: 0.6,
            highCutKnee: 6000,
        };
        
        // ════════════════════════════════════════════════════════════════════
        // CHARACTER PROFILES - Each finding has its own sonic personality
        // volumeScale: 1.0 = normal, 0.5 = half volume, 2.0 = double
        // ════════════════════════════════════════════════════════════════════
        this.characters = {
            // KYNURENINE: Neurotoxic shift - harsh, unstable, distorted
            kynurenine: {
                name: 'neurotoxic',
                volumeScale: 0.6,         // Adjust this to control loudness
                rippleRate: 0.3,          // Faster, more agitated
                rippleDepth: 0.5,         // More variation
                phaseSpread: 0.9,         // Chaotic phase relationships
                distortion: 3.35,         // Waveshaping distortion
                distortionAsymmetry: 5.2, // Asymmetric clipping (harsher)
                harmonicBoost: 0.5,       // More upper harmonics
                tremoloRate: 5.0,         // Fast tremolo (neurological tremor)
                tremoloDepth: 0.15,       // Subtle but unsettling
                instability: 0.01,        // Pitch instability (neurotoxic wobble)
            },
            
            // ENERGY: Mitochondrial stress - heavy, exhausted, sighing
            energy: {
                name: 'exhaustion',
                volumeScale: 0.6,         // Adjust this to control loudness
                rippleRate: 0.06,         // Very slow - labored breathing
                rippleDepth: 0.6,         // Deep sighs
                phaseSpread: 0.3,         // More coherent (unified exhaustion)
                distortion: 0,            // Clean but weak
                harmonicBoost: 0.5,       // Fewer harmonics (depleted energy)
                tremoloRate: 0,           // No tremolo
                tremoloDepth: 0,
                sighEnvelope: true,       // Special envelope shape
                sighAttack: 0.4,          // Slow inhale
                sighHold: 0.2,            // Brief hold
                sighRelease: 0.8,         // Long exhale
                lowPassCutoff: 0.7,       // Muffled, tired
            },
            
            // SCFA/FERMENTATION: Immune disruption - wavering, weak signal
            fermentation: {
                name: 'wavering',
                volumeScale: 0.8,         // Adjust this to control loudness
                rippleRate: 0.2,          // Medium
                rippleDepth: 0.7,         // Strong wavering
                phaseSpread: 0.5,         // Moderate spread
                distortion: 0,            // Clean
                harmonicBoost: 0.8,       // Slightly reduced
                tremoloRate: 2.5,         // Slow tremolo (wavering)
                tremoloDepth: 0.4,        // Strong wavering effect
                amplitudeNoise: 0.15,     // Random amplitude drops (weak signal)
                dropoutRate: 0.3,         // Occasional signal dropouts
            },
            
            // DEFAULT: Neutral presentation
            default: {
                name: 'neutral',
                volumeScale: 1.0,
                rippleRate: 0.15,
                rippleDepth: 0.4,
                phaseSpread: 0.7,
                distortion: 0,
                harmonicBoost: 1.0,
                tremoloRate: 0,
                tremoloDepth: 0,
            },
        };
        
        this.voices = [];
        this.activeCharacter = this.characters.default;
        this.activeFindingId = null;
        this.time = 0;
        this.sighPhase = 0;  // For energy metabolism sigh envelope
        this.initialized = false;
    }
    
    init(ctx) {
        this.voices = [];
        this.initialized = true;
    }
    
    /**
     * Set the pathways for this finding
     * Called when a key finding is selected
     */
    setFinding(ctx, pathwayIds, findingId) {
        this.voices = [];
        this.sighPhase = 0;
        
        if (!pathwayIds || pathwayIds.length === 0) {
            this.activeFindingId = null;
            this.activeCharacter = this.characters.default;
            return;
        }
        
        // Select character based on finding ID
        this.activeFindingId = findingId;
        this.activeCharacter = this.characters[findingId] || this.characters.default;
        
        console.log(`[KeyFindings] Character: ${this.activeCharacter.name}`);
        
        // Get pathway data and sort by ratio for harmonic coherence
        const pathways = pathwayIds
            .map(id => ctx.pathwayById.get(id))
            .filter(p => p)
            .sort((a, b) => a.ratio - b.ratio)
            .slice(0, this.config.maxVoices);
        
        // Calculate phase offsets for ripple effect
        const count = pathways.length;
        const char = this.activeCharacter;
        
        for (let i = 0; i < count; i++) {
            const p = pathways[i];
            
            // Distribute ripple phases across voices
            const ripplePhaseOffset = (i / count) * Math.PI * 2 * char.phaseSpread;
            
            this.voices.push({
                pathwayId: p.id,
                pathway: p,
                frequency: ctx.fundamental * p.ratio,
                baseFrequency: ctx.fundamental * p.ratio,  // For instability
                phases: [Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2],
                ripplePhase: ripplePhaseOffset,
                tremoloPhase: ripplePhaseOffset * 0.5,  // Offset but deterministic (not random)
                envelope: 0,
                dropoutTimer: 0,  // For SCFA weak signal effect
                isDroppedOut: false,
            });
        }
        
        console.log(`[KeyFindings] ${this.voices.length} voices for ${char.name} chord`);
    }
    
    getFrequencyGain(freq) {
        const cfg = this.config;
        let gain = 1.0;
        
        if (freq < cfg.lowBoostKnee) {
            const t = Math.log2(freq / cfg.lowBoostKnee) / Math.log2(20 / cfg.lowBoostKnee);
            const boost = 1.0 + (cfg.lowBoostMax - 1.0) * Math.max(0, -t);
            gain *= boost;
        }
        
        if (freq > cfg.highCutStart) {
            const t = (freq - cfg.highCutStart) / (cfg.highCutKnee - cfg.highCutStart);
            const cut = 1.0 - (1.0 - cfg.highCutMax) * Math.min(1, Math.max(0, t));
            gain *= cut;
        }
        
        return gain;
    }
    
    /**
     * Soft clipping distortion with asymmetry
     */
    distort(sample, amount, asymmetry) {
        if (amount <= 0) return sample;
        
        // Add asymmetry (positive peaks clip harder)
        const asymSample = sample + sample * sample * asymmetry;
        
        // Soft clipping using tanh
        const driven = asymSample * (1 + amount * 3);
        return Math.tanh(driven) * (1 / (1 + amount * 0.5));  // Compensate gain
    }
    
    /**
     * Sigh envelope for energy/exhaustion character
     */
    getSighEnvelope(char) {
        const cycleLength = char.sighAttack + char.sighHold + char.sighRelease;
        const phase = this.sighPhase % cycleLength;
        
        if (phase < char.sighAttack) {
            // Inhale (attack) - slow rise
            const t = phase / char.sighAttack;
            return t * t;  // Exponential rise
        } else if (phase < char.sighAttack + char.sighHold) {
            // Hold at top
            return 1.0;
        } else {
            // Exhale (release) - long fall
            const t = (phase - char.sighAttack - char.sighHold) / char.sighRelease;
            return Math.pow(1 - t, 1.5);  // Slower exponential fall
        }
    }
    
    process(ctx, outputL, outputR, reverbSendL, reverbSendR) {
        if (!this.initialized || this.voices.length === 0) return;
        
        const kfEnvelope = ctx.keyFindings.envelope;
        const masterFade = ctx.getMasterFade();
        
        if (kfEnvelope < 0.001 || masterFade < 0.001) return;
        
        const sr = ctx.sampleRate;
        const twoPi = Math.PI * 2;
        const cfg = this.config;
        const char = this.activeCharacter;
        
        this.time += ctx.dt;
        
        // Update sigh phase for energy character
        if (char.sighEnvelope) {
            this.sighPhase += ctx.dt;
        }
        
        // Get sigh envelope if applicable - NOW CALCULATED PER-VOICE
        const baseSighMod = char.sighEnvelope ? this.getSighEnvelope(char) : 1.0;
        
        // Global ripple phase advance
        const rippleInc = char.rippleRate * ctx.dt * twoPi;
        
        for (const v of this.voices) {
            // Advance ripple phase
            v.ripplePhase += rippleInc;
            if (v.ripplePhase > twoPi) v.ripplePhase -= twoPi;
            
            // Advance tremolo phase
            if (char.tremoloRate > 0) {
                v.tremoloPhase += char.tremoloRate * ctx.dt * twoPi;
                if (v.tremoloPhase > twoPi) v.tremoloPhase -= twoPi;
            }
            
            // SCFA dropout effect
            if (char.dropoutRate > 0) {
                v.dropoutTimer -= ctx.dt;
                if (v.dropoutTimer <= 0) {
                    v.isDroppedOut = Math.random() < char.dropoutRate;
                    v.dropoutTimer = 0.1 + Math.random() * 0.3;  // Check every 100-400ms
                }
            }
            
            // Frequency with instability (kynurenine)
            let freq = v.baseFrequency;
            if (char.instability > 0) {
                freq *= 1 + (Math.random() * 2 - 1) * char.instability;
            }
            v.frequency = freq;
            
            // Frequency-dependent gain
            const freqGain = this.getFrequencyGain(v.frequency);
            
            // Base envelope (smoothed on/off)
            const targetEnv = cfg.baseVolume * kfEnvelope * freqGain;
            const envSpeed = 4.0 * ctx.dt;
            v.envelope += (targetEnv - v.envelope) * envSpeed;
            
            if (v.envelope < 0.0001) continue;
            
            // Ripple modulation - OFFSET biosynthesis by 180° (counter-phase)
            const isBiosynthesis = v.pathway.category === 'biosynthesis';
            const phaseOffset = isBiosynthesis ? Math.PI : 0;
            const rippleMod = 1.0 - char.rippleDepth * 0.5 + 
                Math.sin(v.ripplePhase + phaseOffset) * char.rippleDepth * 0.5;
            
            // Tremolo modulation
            const tremoloMod = char.tremoloDepth > 0 ?
                1.0 - char.tremoloDepth * 0.5 + Math.sin(v.tremoloPhase) * char.tremoloDepth * 0.5 :
                1.0;
            
            // Amplitude noise (SCFA weak signal)
            const noiseMod = char.amplitudeNoise > 0 ?
                1.0 - Math.random() * char.amplitudeNoise :
                1.0;
            
            // Dropout (SCFA)
            const dropoutMod = v.isDroppedOut ? 0.1 : 1.0;
            
            // Low pass effect (energy exhaustion)
            const lowPassMod = char.lowPassCutoff || 1.0;
            
            // Sigh modulation - INVERT for biosynthesis (they breathe IN while others breathe OUT)
            const sighMod = isBiosynthesis ? (2.0 - baseSighMod) : baseSighMod;
            
            // Combine all modulations
            const totalMod = rippleMod * tremoloMod * noiseMod * dropoutMod * sighMod;
            
            // Final amplitude (with per-character volume control)
            const volumeScale = char.volumeScale || 1.0;
            const amp = v.envelope * totalMod * volumeScale * ctx.masterVolume * masterFade;
            
            // Render with harmonics
            const harmonicBoost = char.harmonicBoost || 1.0;
            const numHarmonics = char.distortion > 0 ? 3 : 2;  // More harmonics for distortion
            
            for (let h = 0; h < numHarmonics; h++) {
                const harmonicRatio = h + 1;
                const harmonicFreq = v.frequency * harmonicRatio;
                
                // Harmonic amplitude (boosted or reduced based on character)
                let hAmp;
                if (h === 0) {
                    hAmp = amp;  // Fundamental
                } else {
                    hAmp = amp * 0.12 * Math.pow(harmonicBoost, h) * lowPassMod;
                }
                
                if (hAmp < 0.00001) continue;
                
                const phaseInc = (twoPi * harmonicFreq) / sr;
                
                // Ensure we have enough phase accumulators
                while (v.phases.length <= h) {
                    v.phases.push(Math.random() * twoPi);
                }
                
                for (let i = 0; i < ctx.blockSize; i++) {
                    let sample = Math.sin(v.phases[h]) * hAmp;
                    
                    // Apply distortion (kynurenine)
                    if (char.distortion > 0 && h === 0) {
                        sample = this.distort(sample, char.distortion, char.distortionAsymmetry || 0);
                    }
                    
                    outputL[i] += sample;
                    outputR[i] += sample;
                    
                    // Reverb send
                    reverbSendL[i] += sample * 0.35;
                    reverbSendR[i] += sample * 0.35;
                    
                    v.phases[h] += phaseInc;
                    if (v.phases[h] > twoPi) v.phases[h] -= twoPi;
                }
            }
        }
    }
    
    updateFrequencies(ctx) {
        for (const v of this.voices) {
            v.baseFrequency = ctx.fundamental * v.pathway.ratio;
            v.frequency = v.baseFrequency;
        }
    }
}


// ╔════════════════════════════════════════════════════════════════════════════╗
// ║  HARMONIC CLOUD ENGINE - Granular Microsound Texture                       ║
// ╠════════════════════════════════════════════════════════════════════════════╣
// ║  Thousands of imperceptible micro-grains forming a continuous fluid.       ║
// ║  Like running water - individual molecules invisible, collective flow      ║
// ║  perceptible. All particles gently pulled toward 1/1 (home).              ║
// ║  Consonance scaling: linear or exponential volume by harmonic distance.    ║
// ╚════════════════════════════════════════════════════════════════════════════╝

class HarmonicCloudEngine {
    constructor() {
        this.config = {
            // Master levels - VERY low, density creates volume
            masterGain: 0.00069,         // Imperceptible per-grain
            reverbSend: 0.95,            // Heavy reverb for smearing
            
            // Grain timing - TRUE MICROSOUND
            grainDurationMin: 0.001,     // 1ms minimum
            grainDurationMax: 0.2,     // 4ms maximum
            
            // Density - grains per second (the texture)
            baseDensity: 80,            // Base grains/second
            minDensity: 50,             // Sparse trickle
            maxDensity: 120,             // Rushing stream
            
            // Envelope shape - no clicks
            grainAttack: 0.045,         // 0.5ms attack
            grainRelease: 0.09,         // 2ms release (longer tail)
            
            // CONSONANCE SCALING - pull toward 1/1
            consonanceMode: 'exponential', // 'linear', 'exponential', 'none'
            consonanceExponent: 2.0,       // For exponential: higher = stronger pull to consonance
            consonanceFloor: 0.05,         // Minimum gain for most dissonant
            
            // GRAVITATIONAL DRIFT toward 1/1
            homeGravity: 0.15,           // Probability bias toward consonant ratios
            driftSpeed: 0.02,            // How fast the cloud's center moves
            
            // Harmonic current - flow direction
            currentStrength: 0.3,        // Strength of directional flow
            currentChangeRate: 0.005,    // How often flow direction shifts
            
            // Stereo spread
            stereoWidth: 0.6,            // How wide the cloud spreads
        };
        
        // Grain pool - pre-allocated for performance
        this.maxGrains = 200;            // Max simultaneous grains
        this.grains = [];
        
        // Pathway pool
        this.pathwayPool = [];
        this.totalWeight = 0;
        
        // Cloud state - WHERE the cloud currently "is" in harmonic space
        this.cloudCenter = 1.0;          // Current center ratio (1.0 = fundamental)
        this.cloudMomentum = 0;          // Drift momentum
        this.currentAngle = 0;           // Flow direction in ratio-space
        
        // Time tracking
        this.grainAccumulator = 0;       // For sub-sample grain timing
        
        // Activity tracking for visualization
        this.activeRegions = new Map();  // ratio-region -> activity level
        
        this.initialized = false;
    }
    
    init(ctx) {
        this.grains = [];
        this.pathwayPool = [];
        this.activeRegions.clear();
        
        this.rebuildPool(ctx);
        this.initialized = true;
    }
    
    rebuildPool(ctx) {
        this.pathwayPool = [];
        
        for (const p of ctx.pathways) {
            const n = p.n || 1;
            const d = p.d || 1;
            const ratio = n / d;
            
            // Distance from 1/1 in log space (octave-normalized)
            const logRatio = Math.abs(Math.log2(ratio));
            
            // Consonance measure: 1/(n*d) - lower product = more consonant
            const nxd = n * d;
            const consonance = 1 / Math.sqrt(nxd);
            
            // Base weight from abundance/prevalence
            const abundance = p.abundance ?? 0.5;
            const prevalence = p.prevalence ?? 0.5;
            const baseWeight = Math.sqrt(abundance * prevalence);
            
            this.pathwayPool.push({
                pathway: p,
                ratio: ratio,
                logRatio: logRatio,
                n: n,
                d: d,
                nxd: nxd,
                consonance: consonance,
                baseWeight: baseWeight,
                frequency: ctx.fundamental * ratio,
                
                // For weighted selection
                weight: 0,
                cumulativeWeight: 0,
            });
        }
        
        // Sort by ratio for spatial coherence
        this.pathwayPool.sort((a, b) => a.ratio - b.ratio);
        
        this.recalculateWeights();
    }
    
    recalculateWeights() {
        // Apply consonance scaling to weights
        const cfg = this.config;
        
        for (const entry of this.pathwayPool) {
            let consonanceScale = 1.0;
            
            if (cfg.consonanceMode === 'linear') {
                // Linear: weight proportional to consonance
                consonanceScale = cfg.consonanceFloor + (1 - cfg.consonanceFloor) * entry.consonance;
                
            } else if (cfg.consonanceMode === 'exponential') {
                // Exponential: strong preference for consonant ratios
                const exp = cfg.consonanceExponent;
                consonanceScale = cfg.consonanceFloor + 
                    (1 - cfg.consonanceFloor) * Math.pow(entry.consonance, exp);
                    
            } else {
                // None: equal weighting
                consonanceScale = 1.0;
            }
            
            entry.weight = entry.baseWeight * consonanceScale;
        }
        
        // Build cumulative weights
        let cumulative = 0;
        for (const entry of this.pathwayPool) {
            cumulative += entry.weight;
            entry.cumulativeWeight = cumulative;
        }
        this.totalWeight = cumulative;
    }
    
    updateFrequencies(ctx) {
        for (const entry of this.pathwayPool) {
            entry.frequency = ctx.fundamental * entry.ratio;
        }
    }
    
    // Select pathway with gravity toward current cloud center
    selectPathway(ctx) {
        if (this.pathwayPool.length === 0) return null;
        
        const cfg = this.config;
        
        // Gravitational bias: prefer pathways near cloud center
        if (Math.random() < cfg.homeGravity) {
            // Find pathways near current cloud center
            const nearbyThreshold = 0.3; // In log-ratio space
            const nearby = this.pathwayPool.filter(e => 
                Math.abs(Math.log2(e.ratio) - Math.log2(this.cloudCenter)) < nearbyThreshold
            );
            
            if (nearby.length > 0) {
                // Weighted random from nearby
                let totalNearby = nearby.reduce((sum, e) => sum + e.weight, 0);
                let r = Math.random() * totalNearby;
                for (const entry of nearby) {
                    r -= entry.weight;
                    if (r <= 0) return entry;
                }
                return nearby[nearby.length - 1];
            }
        }
        
        // Standard weighted random selection
        const r = Math.random() * this.totalWeight;
        for (const entry of this.pathwayPool) {
            if (entry.cumulativeWeight >= r) {
                return entry;
            }
        }
        return this.pathwayPool[this.pathwayPool.length - 1];
    }
    
    // Update cloud drift - gentle movement through harmonic space
    updateCloudDrift(ctx) {
        const cfg = this.config;
        const dt = ctx.dt;
        
        // Current direction shifts slowly
        this.currentAngle += (Math.random() - 0.5) * cfg.currentChangeRate;
        
        // Apply current to momentum
        this.cloudMomentum += Math.sin(this.currentAngle) * cfg.currentStrength * dt;
        
        // Gravity toward 1/1 (home)
        const homeDirection = -Math.log2(this.cloudCenter); // Negative if above 1, positive if below
        this.cloudMomentum += homeDirection * cfg.homeGravity * dt * 0.5;
        
        // Damping
        this.cloudMomentum *= 0.98;
        
        // Apply drift
        this.cloudCenter *= Math.pow(2, this.cloudMomentum * cfg.driftSpeed);
        
        // Soft bounds (stay within reasonable harmonic range)
        if (this.cloudCenter < 0.25) this.cloudCenter = 0.25;
        if (this.cloudCenter > 4.0) this.cloudCenter = 4.0;
    }
    
    spawnGrain(ctx, entry) {
        if (!entry || this.grains.length >= this.maxGrains) return;
        
        const cfg = this.config;
        const p = entry.pathway;
        
        // Category gain check
        const catGain = ctx.categoryGains[p.category] ?? 1.0;
        if (catGain < 0.01) return;
        
        // MS modifier
        const msGain = ctx.getMSGainModifier(p.id);
        
        // Key findings modifier
        let kfGain = 1.0;
        if (ctx.keyFindings.active) {
            kfGain = ctx.isPathwayInFinding(p.id) ? 
                ctx.getKeyFindingsBoost() : 
                ctx.getKeyFindingsDuck();
        }
        
        // Consonance-scaled amplitude
        let consonanceAmp = 1.0;
        if (cfg.consonanceMode === 'linear') {
            consonanceAmp = cfg.consonanceFloor + (1 - cfg.consonanceFloor) * entry.consonance;
        } else if (cfg.consonanceMode === 'exponential') {
            consonanceAmp = cfg.consonanceFloor + 
                (1 - cfg.consonanceFloor) * Math.pow(entry.consonance, cfg.consonanceExponent);
        }
        
        // Final amplitude
        const amplitude = entry.baseWeight * consonanceAmp * catGain * msGain * kfGain;
        
        // Random grain duration
        const duration = cfg.grainDurationMin + 
            Math.random() * (cfg.grainDurationMax - cfg.grainDurationMin);
        
        // Stereo position - spread based on ratio distance from center
        const ratioOffset = Math.log2(entry.ratio / this.cloudCenter);
        const pan = Math.tanh(ratioOffset * 2) * cfg.stereoWidth; // -1 to 1, centered on cloud
        
        // Tiny pitch variation (shimmer)
        const pitchVar = 1 + (Math.random() - 0.5) * 0.002;
        
        this.grains.push({
            frequency: entry.frequency * pitchVar,
            phase: Math.random() * Math.PI * 2,
            amplitude: amplitude,
            pan: pan,
            
            // Envelope
            duration: duration,
            elapsed: 0,
            attackTime: cfg.grainAttack,
            releaseTime: cfg.grainRelease,
            env: 0,
            
            // For visualization
            pathwayId: p.id,
            ratio: entry.ratio,
        });
    }
    
    process(ctx, outputL, outputR, reverbSendL, reverbSendR) {
        if (!this.initialized || this.pathwayPool.length === 0) return;
        
        const sr = ctx.sampleRate;
        const blockSize = ctx.blockSize;
        const cfg = this.config;
        const masterFade = ctx.getMasterFade();
        const dt = ctx.dt;
        
        if (masterFade < 0.001) return;
        
        // Update cloud drift
        this.updateCloudDrift(ctx);
        
        // Calculate density based on MMC
        const mmcActivity = ctx.mmcActivity.granular;
        const density = cfg.minDensity + (cfg.maxDensity - cfg.minDensity) * mmcActivity;
        
        // Grains to spawn this block
        const grainsPerSecond = density;
        const grainsThisBlock = grainsPerSecond * dt;
        this.grainAccumulator += grainsThisBlock;
        
        // Spawn grains
        const mode = ctx.composedMode ?? 'composed';
        while (this.grainAccumulator >= 1) {
            const entry = this.selectPathway(ctx);
            this.spawnGrain(ctx, entry);
            this.grainAccumulator -= 1;
        }
        
        // Global modifiers
        const focusDuck = ctx.getFocusDuck();
        const droneSoloDuck = ctx.droneSoloDuckSmoothed;
        const globalAmp = cfg.masterGain * masterFade * focusDuck * droneSoloDuck;
        
        const twoPi = Math.PI * 2;
        const invSr = 1 / sr;
        
        // Clear activity tracking
        this.activeRegions.clear();
        
        // Process grains
        for (let i = this.grains.length - 1; i >= 0; i--) {
            const grain = this.grains[i];
            
            // Update envelope
            grain.elapsed += dt;
            
            // Simple triangular-ish envelope with attack/release
            const attackEnd = grain.attackTime;
            const releaseStart = grain.duration - grain.releaseTime;
            
            if (grain.elapsed < attackEnd) {
                grain.env = grain.elapsed / attackEnd;
            } else if (grain.elapsed > releaseStart) {
                grain.env = Math.max(0, 1 - (grain.elapsed - releaseStart) / grain.releaseTime);
            } else {
                grain.env = 1;
            }
            
            // Check if grain is done
            if (grain.elapsed >= grain.duration) {
                this.grains.splice(i, 1);
                continue;
            }
            
            // Smooth envelope (cosine window for no clicks)
            const envShaped = 0.5 - 0.5 * Math.cos(grain.env * Math.PI);
            
            // Calculate amplitude
            const amp = grain.amplitude * envShaped * globalAmp;
            
            // Stereo
            const panAngle = (grain.pan + 1) * Math.PI * 0.25;
            const panL = Math.cos(panAngle);
            const panR = Math.sin(panAngle);
            
            // Phase increment
            const phaseInc = twoPi * grain.frequency * invSr;
            
            // Render grain - pure sine for cleanest blend
            for (let j = 0; j < blockSize; j++) {
                const sample = Math.sin(grain.phase) * amp;
                
                outputL[j] += sample * panL;
                outputR[j] += sample * panR;
                
                // Heavy reverb for smearing
                reverbSendL[j] += sample * panL * cfg.reverbSend;
                reverbSendR[j] += sample * panR * cfg.reverbSend;
                
                grain.phase += phaseInc;
            }
            
            // Keep phase bounded
            if (grain.phase > twoPi) grain.phase -= twoPi;
            
            // Track activity for visualization
            const regionKey = Math.round(Math.log2(grain.ratio) * 4); // Quarter-octave regions
            const current = this.activeRegions.get(regionKey) || 0;
            this.activeRegions.set(regionKey, current + envShaped * grain.amplitude);
        }
    }
    
    // Get cloud state for visualization
    getCloudState() {
        return {
            center: this.cloudCenter,
            momentum: this.cloudMomentum,
            grainCount: this.grains.length,
            density: this.grains.length / this.maxGrains,
        };
    }
    
    // Get active pathways for visualization (aggregated by region)
    getActiveRegions() {
        const result = [];
        for (const [region, activity] of this.activeRegions) {
            result.push({ region, activity });
        }
        return result;
    }
    
    // Configuration setters for runtime adjustment
    setConsonanceMode(mode) {
        if (['linear', 'exponential', 'none'].includes(mode)) {
            this.config.consonanceMode = mode;
            this.recalculateWeights();
        }
    }
    
    setConsonanceExponent(exp) {
        this.config.consonanceExponent = Math.max(0.5, Math.min(5, exp));
        if (this.config.consonanceMode === 'exponential') {
            this.recalculateWeights();
        }
    }
    
    setHomeGravity(gravity) {
        this.config.homeGravity = Math.max(0, Math.min(1, gravity));
    }
    
    setDensity(min, max) {
        this.config.minDensity = Math.max(50, min);
        this.config.maxDensity = Math.min(1500, max);
    }
}


// ╔════════════════════════════════════════════════════════════════════════════╗
// ║  REVERB PROCESSOR - Diffuse Wash (The Pool)                                ║
// ╚════════════════════════════════════════════════════════════════════════════╝

class ReverbProcessor {
    constructor() {
        this.config = {
            wetMix: 0.550,
            decayTime: 6.5,
            damping: 0.4,
            diffusion: 0.7,
            predelay: 0.02,
        };
        
        this.combDelays = [1557, 1617, 1491, 1422];
        this.allpassDelays = [225, 556];
        
        this.combBuffers = [];
        this.allpassBuffers = [];
        this.combIndices = [];
        this.allpassIndices = [];
        this.combFilters = [];
        
        this.predelayBuffer = null;
        this.predelayIndex = 0;
        
        this.initialized = false;
    }
    
    init(sampleRate) {
        const scale = sampleRate / 48000;
        
        const scaledComb = this.combDelays.map(d => Math.round(d * scale));
        const scaledAllpass = this.allpassDelays.map(d => Math.round(d * scale));
        
        this.combBuffers = scaledComb.map(size => ({
            L: new Float32Array(size),
            R: new Float32Array(size),
        }));
        this.combIndices = scaledComb.map(() => 0);
        this.combFilters = scaledComb.map(() => ({ L: 0, R: 0 }));
        
        this.allpassBuffers = scaledAllpass.map(size => ({
            L: new Float32Array(size),
            R: new Float32Array(size),
        }));
        this.allpassIndices = scaledAllpass.map(() => 0);
        
        const predelaySamples = Math.round(this.config.predelay * sampleRate);
        this.predelayBuffer = {
            L: new Float32Array(predelaySamples || 1),
            R: new Float32Array(predelaySamples || 1),
        };
        this.predelayIndex = 0;
        
        this.initialized = true;
    }
    
    process(ctx, inputL, inputR, outputL, outputR) {
        if (!this.initialized) {
            for (let i = 0; i < ctx.blockSize; i++) {
                outputL[i] += inputL[i];
                outputR[i] += inputR[i];
            }
            return;
        }
        
        const masterFade = ctx.getMasterFade();
        
        const wet = this.config.wetMix * masterFade;
        const dry = (1 - this.config.wetMix * 0.5) * masterFade;
        
        if (masterFade < 0.001) {
            for (const buf of this.combBuffers) {
                buf.L.fill(0);
                buf.R.fill(0);
            }
            for (const buf of this.allpassBuffers) {
                buf.L.fill(0);
                buf.R.fill(0);
            }
            for (let i = 0; i < ctx.blockSize; i++) {
                outputL[i] = 0;
                outputR[i] = 0;
            }
            return;
        }
        
        const feedback = Math.exp(-3 / (this.config.decayTime * ctx.sampleRate / 1000));
        const damp = this.config.damping;
        const diffusion = this.config.diffusion;
        
        for (let i = 0; i < ctx.blockSize; i++) {
            const pdSize = this.predelayBuffer.L.length;
            const predelayedL = this.predelayBuffer.L[this.predelayIndex];
            const predelayedR = this.predelayBuffer.R[this.predelayIndex];
            this.predelayBuffer.L[this.predelayIndex] = inputL[i];
            this.predelayBuffer.R[this.predelayIndex] = inputR[i];
            this.predelayIndex = (this.predelayIndex + 1) % pdSize;
            
            let combOutL = 0, combOutR = 0;
            
            for (let c = 0; c < this.combBuffers.length; c++) {
                const buf = this.combBuffers[c];
                const size = buf.L.length;
                const idx = this.combIndices[c];
                const filt = this.combFilters[c];
                
                const readL = buf.L[idx];
                const readR = buf.R[idx];
                
                filt.L = readL * (1 - damp) + filt.L * damp;
                filt.R = readR * (1 - damp) + filt.R * damp;
                
                buf.L[idx] = predelayedL + filt.L * feedback;
                buf.R[idx] = predelayedR + filt.R * feedback;
                
                combOutL += readL;
                combOutR += readR;
                
                this.combIndices[c] = (idx + 1) % size;
            }
            
            combOutL *= 0.25;
            combOutR *= 0.25;
            
            let apL = combOutL, apR = combOutR;
            
            for (let a = 0; a < this.allpassBuffers.length; a++) {
                const buf = this.allpassBuffers[a];
                const size = buf.L.length;
                const idx = this.allpassIndices[a];
                
                const bufL = buf.L[idx];
                const bufR = buf.R[idx];
                
                const outL = -apL * diffusion + bufL;
                const outR = -apR * diffusion + bufR;
                
                buf.L[idx] = apL + bufL * diffusion;
                buf.R[idx] = apR + bufR * diffusion;
                
                apL = outL;
                apR = outR;
                
                this.allpassIndices[a] = (idx + 1) % size;
            }
            
            outputL[i] += inputL[i] * dry + apL * wet;
            outputR[i] += inputR[i] * dry + apR * wet;
        }
    }
}


// ╔════════════════════════════════════════════════════════════════════════════╗
// ║  POST PROCESSOR - Chorus + Delay + Limiter                                 ║
// ╚════════════════════════════════════════════════════════════════════════════╝

class PostProcessor {
    constructor() {
        this.chorusConfig = {
            enabled: true,
            wetMix: 0.2,
            voices: 3,
            depth: 0.003,
            rate: 0.4,
        };
        
        this.delayConfig = {
            enabled: true,
            wetMix: 0.15,
            time: 0.35,
            feedback: 0.35,
            damping: 0.3,
        };
        
        this.limiterConfig = {
            threshold: 0.85,
            knee: 0.1,
            release: 0.05,
        };
        
        this.chorusBuffer = null;
        this.chorusWriteIndex = 0;
        this.chorusLfoPhases = [];
        
        this.delayBuffer = null;
        this.delayWriteIndex = 0;
        this.delayFilter = { L: 0, R: 0 };
        
        this.limiterGain = 1;
    }
    
    init(sampleRate) {
        const chorusSize = Math.ceil(sampleRate * 0.05);
        this.chorusBuffer = {
            L: new Float32Array(chorusSize),
            R: new Float32Array(chorusSize),
        };
        this.chorusWriteIndex = 0;
        this.chorusLfoPhases = [0, Math.PI * 0.66, Math.PI * 1.33];
        
        const delaySize = Math.ceil(sampleRate * 0.8);
        this.delayBuffer = {
            L: new Float32Array(delaySize),
            R: new Float32Array(delaySize),
        };
        this.delayWriteIndex = 0;
    }
    
    process(ctx, dryL, dryR, chorusSendL, chorusSendR, delaySendL, delaySendR, outL, outR) {
        const sr = ctx.sampleRate;
        const blockSize = ctx.blockSize;
        const masterFade = ctx.getMasterFade();
        
        if (masterFade < 0.001) {
            this.chorusBuffer.L.fill(0);
            this.chorusBuffer.R.fill(0);
            this.delayBuffer.L.fill(0);
            this.delayBuffer.R.fill(0);
            this.delayFilter.L = 0;
            this.delayFilter.R = 0;
            for (let i = 0; i < blockSize; i++) {
                outL[i] = 0;
                outR[i] = 0;
            }
            return;
        }
        
        const chorusCfg = this.chorusConfig;
        const chorusSize = this.chorusBuffer.L.length;
        const baseDelay = Math.floor(sr * 0.015);
        const modDepth = Math.floor(sr * chorusCfg.depth);
        
        const delayCfg = this.delayConfig;
        const delaySize = this.delayBuffer.L.length;
        const delaySamples = Math.floor(sr * delayCfg.time);
        
        for (let i = 0; i < blockSize; i++) {
            let sampleL = dryL[i];
            let sampleR = dryR[i];
            
            if (chorusCfg.enabled) {
                this.chorusBuffer.L[this.chorusWriteIndex] = chorusSendL[i];
                this.chorusBuffer.R[this.chorusWriteIndex] = chorusSendR[i];
                
                let chorusL = 0, chorusR = 0;
                for (let v = 0; v < chorusCfg.voices; v++) {
                    this.chorusLfoPhases[v] += (chorusCfg.rate * (1 + v * 0.3)) / sr * Math.PI * 2;
                    if (this.chorusLfoPhases[v] > Math.PI * 2) this.chorusLfoPhases[v] -= Math.PI * 2;
                    
                    const mod = Math.sin(this.chorusLfoPhases[v]);
                    const delay = baseDelay + Math.floor(mod * modDepth);
                    const readIdx = (this.chorusWriteIndex - delay + chorusSize) % chorusSize;
                    
                    chorusL += this.chorusBuffer.L[readIdx];
                    chorusR += this.chorusBuffer.R[readIdx];
                }
                
                sampleL += (chorusL / chorusCfg.voices) * chorusCfg.wetMix * ctx.mmcActivity.chorus;
                sampleR += (chorusR / chorusCfg.voices) * chorusCfg.wetMix * ctx.mmcActivity.chorus;
                
                this.chorusWriteIndex = (this.chorusWriteIndex + 1) % chorusSize;
            }
            
            if (delayCfg.enabled) {
                const readIdx = (this.delayWriteIndex - delaySamples + delaySize) % delaySize;
                let delayL = this.delayBuffer.L[readIdx];
                let delayR = this.delayBuffer.R[readIdx];
                
                this.delayFilter.L = delayL * (1 - delayCfg.damping) + this.delayFilter.L * delayCfg.damping;
                this.delayFilter.R = delayR * (1 - delayCfg.damping) + this.delayFilter.R * delayCfg.damping;
                
                this.delayBuffer.L[this.delayWriteIndex] = delaySendL[i] + this.delayFilter.L * delayCfg.feedback;
                this.delayBuffer.R[this.delayWriteIndex] = delaySendR[i] + this.delayFilter.R * delayCfg.feedback;
                
                sampleL += delayL * delayCfg.wetMix * ctx.mmcActivity.delay;
                sampleR += delayR * delayCfg.wetMix * ctx.mmcActivity.delay;
                
                this.delayWriteIndex = (this.delayWriteIndex + 1) % delaySize;
            }
            
            const lim = this.limiterConfig;
            const peak = Math.max(Math.abs(sampleL), Math.abs(sampleR));
            
            if (peak > lim.threshold) {
                const targetGain = lim.threshold / peak;
                if (targetGain < this.limiterGain) {
                    this.limiterGain = targetGain;
                }
            }
            
            this.limiterGain += (1 - this.limiterGain) * lim.release;
            
            outL[i] = sampleL * this.limiterGain;
            outR[i] = sampleR * this.limiterGain;
        }
    }
}


// ╔════════════════════════════════════════════════════════════════════════════╗
// ║  MAIN PROCESSOR                                                            ║
// ╚════════════════════════════════════════════════════════════════════════════╝

class MicrobiomeSonificationProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        
        this.ctx = new SharedContext();
        this.mmc = new MMCEngine();
        this.reference = new ReferenceToneEngine();
        this.drone = new DroneEngine();
        this.msSpotlight = new MSSpotlightLayer();
        this.focus = new FocusEngine();
        this.keyFindings = new KeyFindingsEngine();
        this.harmonicCloud = new HarmonicCloudEngine();  // NEW: Rain stick texture
        this.reverb = new ReverbProcessor();
        this.postProcessor = new PostProcessor();
        
        this.initialized = false;
        this.lastReport = 0;
        this.reportInterval = 0.05;
        
        this.port.onmessage = (e) => this.handleMessage(e.data);
    }
    
    handleMessage(msg) {
        const { type, data } = msg;
        
        switch (type) {
            case 'init':
                this.initFromData(data);
                break;
                
            case 'setFundamental':
                this.ctx.fundamental = Math.max(20, Math.min(2000, data));
                this.drone.updateFrequencies(this.ctx);
                this.msSpotlight.updateFrequencies(this.ctx);
                this.keyFindings.updateFrequencies(this.ctx);
                this.harmonicCloud.updateFrequencies(this.ctx);
                break;
                
            case 'setMasterVolume':
                this.ctx.masterVolume = Math.max(0, Math.min(1, data));
                break;
                
            case 'fadeIn':
                this.ctx.fadeIn(data.duration || 2.2);
                break;
                
            case 'fadeOut':
                this.ctx.fadeOut(data.duration || 0.8);
                break;
                
            case 'setFocus':
                this.ctx.setFocus(data.id);
                break;
                
            case 'setCategoryGain':
                if (data.category && data.gain !== undefined) {
                    this.ctx.categoryGains[data.category] = Math.max(0, Math.min(2, data.gain));
                }
                break;
                
            case 'setMSMode':
                this.ctx.msMode.enabled = data.enabled;
                if (data.msData) {
                    this.ctx.msMode.data = data.msData;
                    this.ctx.msMode.affectedSet.clear();
                    this.ctx.msMode.depletedSet.clear();
                    this.ctx.msMode.elevatedSet.clear();
                    this.ctx.msMode.ldaScores.clear();
                    
                    for (const [id, info] of Object.entries(data.msData)) {
                        this.ctx.msMode.affectedSet.add(id);
                        this.ctx.msMode.ldaScores.set(id, info.ldaScore || 0.5);
                        
                        if (info.enrichedIn === 'healthy') {
                            this.ctx.msMode.depletedSet.add(id);
                        } else {
                            this.ctx.msMode.elevatedSet.add(id);
                        }
                    }
                    
                    // Update MS Spotlight layer
                    this.msSpotlight.updateMSData(this.ctx, data.msData);
                    
                    console.log(`[v12] MS Mode: ${this.ctx.msMode.affectedSet.size} affected`);
                }
                break;
                
            case 'setMSPhases':
                if (data.phases) {
                    this.ctx.msMode.phases.affected = data.phases.affected || 0;
                    this.ctx.msMode.phases.depleted = data.phases.depleted || 0;
                    this.ctx.msMode.phases.elevated = data.phases.elevated || 0;
                    this.ctx.msMode.phases.settled = data.phases.settled || 0;
                }
                break;
                
            // NEW: Key Findings support with character profiles
            case 'setKeyFinding':
                if (data.pathwayIds && data.pathwayIds.length > 0) {
                    this.ctx.setKeyFinding(data.pathwayIds);
                    this.keyFindings.setFinding(this.ctx, data.pathwayIds, data.findingId);
                    console.log(`[v12] Key Finding: ${data.findingId} (${data.pathwayIds.length} pathways)`);
                } else {
                    this.ctx.setKeyFinding(null);
                    this.keyFindings.setFinding(this.ctx, [], null);
                }
                break;
                
            case 'setMMCIntensity':
                this.mmc.setIntensity(data);
                break;
                
            case 'setMMCDuration':
                this.mmc.setCycleDuration(data);
                break;
                
            case 'setComposedMode':
                // Set mode for harmonic cloud movement behavior
                this.ctx.composedMode = data.enabled ? 'composed' : 'consonance';
                break;
                
            // Harmonic Cloud configuration
            case 'setCloudConsonanceMode':
                if (data.mode) {
                    this.harmonicCloud.setConsonanceMode(data.mode);
                }
                break;
                
            case 'setCloudConsonanceExponent':
                if (data.exponent !== undefined) {
                    this.harmonicCloud.setConsonanceExponent(data.exponent);
                }
                break;
                
            case 'setCloudGravity':
                if (data.gravity !== undefined) {
                    this.harmonicCloud.setHomeGravity(data.gravity);
                }
                break;
                
            case 'setCloudDensity':
                if (data.min !== undefined && data.max !== undefined) {
                    this.harmonicCloud.setDensity(data.min, data.max);
                }
                break;
                
            case 'cascadeFadeIn':
                this.ctx.fadeIn(data.duration || 2.2);
                break;
                
            case 'cascadeFadeOut':
                this.ctx.fadeOut(data.duration || 0.8);
                break;
                
            case 'excitePathway':
                if (data.id) {
                    this.drone.excitePathway(data.id);
                }
                break;
                
            case 'setDroneSolo':
                this.ctx.droneSoloActive = data.solo || false;
                if (data.duckAmount !== undefined) {
                    this.ctx.droneSoloDuck = data.duckAmount;
                }
                console.log(`[v12] Drone solo: ${data.solo ? 'ON' : 'OFF'}`);
                break;
        }
    }
    
    initFromData(data) {
        const sr = globalThis.sampleRate || 48000;
        
        this.ctx.pathways = data.pathways.map(p => {
            const n = p.n || 1;
            const d = p.d || 1;
            const ratio = n / d;
            
            return {
                id: p.id,
                n, d, ratio,
                category: p.category || 'other',
                subcategory: p.subcategory || p.category || 'other',
                abundance: p.amplitude || 0.5,
                prevalence: p.prevalence || 0.5,
                baseVolume: Math.pow(p.amplitude || 0.5, 1.5),
            };
        });
        
        this.ctx.pathwayById = new Map(this.ctx.pathways.map(p => [p.id, p]));
        
        for (const p of this.ctx.pathways) {
            if (!this.ctx.pathwaysByCategory.has(p.category)) {
                this.ctx.pathwaysByCategory.set(p.category, []);
            }
            this.ctx.pathwaysByCategory.get(p.category).push(p);
        }
        
        for (const [, arr] of this.ctx.pathwaysByCategory) {
            arr.sort((a, b) => b.abundance - a.abundance);
        }
        
        for (const p of this.ctx.pathways) {
            this.ctx.fairness.lastSounded.set(p.id, 0);
        }
        
        this.reference.init(this.ctx);
        this.drone.init(this.ctx);
        this.msSpotlight.init(this.ctx);
        this.keyFindings.init(this.ctx);
        this.harmonicCloud.init(this.ctx);
        this.reverb.init(sr);
        this.postProcessor.init(sr);
        
        this.initialized = true;
        
        this.port.postMessage({
            type: 'ready',
            data: {
                pathwayCount: this.ctx.pathways.length,
                categories: [...this.ctx.pathwaysByCategory.keys()],
            }
        });
        
        console.log(`[v12] Initialized: ${this.ctx.pathways.length} pathways`);
    }
    
    process(inputs, outputs, parameters) {
        const output = outputs[0];
        const outL = output[0];
        const outR = output[1] || output[0];
        
        if (!outL || !this.initialized) return true;
        
        const blockSize = outL.length;
        const sr = globalThis.sampleRate || 48000;
        
        this.ctx.advance(blockSize, sr);
        this.mmc.update(this.ctx);
        this.ctx.updateFocus();
        
        const dryL = new Float32Array(blockSize);
        const dryR = new Float32Array(blockSize);
        const reverbSendL = new Float32Array(blockSize);
        const reverbSendR = new Float32Array(blockSize);
        const chorusSendL = new Float32Array(blockSize);
        const chorusSendR = new Float32Array(blockSize);
        const delaySendL = new Float32Array(blockSize);
        const delaySendR = new Float32Array(blockSize);
        
        // Render all engines
        this.reference.process(this.ctx, dryL, dryR);
        this.drone.process(this.ctx, dryL, dryR, reverbSendL, reverbSendR);
        this.msSpotlight.process(this.ctx, dryL, dryR, reverbSendL, reverbSendR);  // NEW
        this.focus.process(this.ctx, dryL, dryR);
        this.keyFindings.process(this.ctx, dryL, dryR, reverbSendL, reverbSendR);
        this.harmonicCloud.process(this.ctx, dryL, dryR, reverbSendL, reverbSendR);  // Rain stick texture
        
        // Apply reverb
        const reverbedL = new Float32Array(blockSize);
        const reverbedR = new Float32Array(blockSize);
        this.reverb.process(this.ctx, reverbSendL, reverbSendR, reverbedL, reverbedR);
        
        // Mix reverbed signal back
        for (let i = 0; i < blockSize; i++) {
            dryL[i] += reverbedL[i];
            dryR[i] += reverbedR[i];
            
            chorusSendL[i] = dryL[i] * 0.3;
            chorusSendR[i] = dryR[i] * 0.3;
            delaySendL[i] = dryL[i] * 0.2;
            delaySendR[i] = dryR[i] * 0.2;
        }
        
        // Post process
        this.postProcessor.process(this.ctx, dryL, dryR, chorusSendL, chorusSendR, delaySendL, delaySendR, outL, outR);
        
        // Periodic state report
        if (this.ctx.time - this.lastReport > this.reportInterval) {
            this.lastReport = this.ctx.time;
            this.sendStateReport();
        }
        
        return true;
    }
    
    sendStateReport() {
        this.port.postMessage({
            type: 'state',
            data: {
                time: this.ctx.time,
                masterFade: this.ctx.masterFade,
                mmcPhase: this.ctx.mmcPhase,
                mmcActivity: { ...this.ctx.mmcActivity },
                focusEnvelope: this.ctx.focus.envelope,
                focusId: this.ctx.focus.id,
                msPhases: { ...this.ctx.msMode.smoothedPhases },
                msActivity: this.ctx.getMSActivity(),
                keyFindingActive: this.ctx.keyFindings.active,
                keyFindingEnvelope: this.ctx.keyFindings.envelope,
                // Harmonic cloud visualization data
                harmonicCloud: this.harmonicCloud.getCloudState(),
                harmonicCloudRegions: this.harmonicCloud.getActiveRegions(),
            }
        });
    }
}

registerProcessor('microbiome-sonification-processor', MicrobiomeSonificationProcessor);