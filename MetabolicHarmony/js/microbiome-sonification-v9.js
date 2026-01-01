/**
 * MicrobiomeSonification v8.0 - CLEAR SURFACE, TEEMING UNDERNEATH
 * 
 * Architecture:
 * - SharedContext     (state, timing, focus, MS mode)
 * - MMCEngine         (conductor - gut motility cycle)
 * - ReferenceToneEngine (harmonic anchor - octave pyramid)
 * - DroneEngine       (600 always-on voices - the deep foundation)
 * - GranularEngine    (NEW - rapid micro-grains that blend into texture)
 * - FocusEngine       (NEW - dedicated focus tone with constant volume)
 * - PostProcessor     (chorus + delay + limiter - the unified space)
 * 
 * Key Changes from v7:
 * - Granular approach: thousands of tiny grains → coherent texture
 * - Focus tone: constant volume across all ratios, cuts through cleanly
 * - MS transition: focus → pause → animate → settle (and reverse)
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
        
        this.pathways = [];
        this.pathwayById = new Map();
        this.pathwaysByCategory = new Map();
        this.pathwaysBySubcategory = new Map();
        this.harmonicRelations = new Map();
        
        // MMC state
        this.mmcPhase = 'quiescent';
        this.mmcActivity = {
            drone: 1.0,
            granular: 0.5,
            chorus: 0.5,
            delay: 0.5,
        };
        
        // Focus state - SIMPLIFIED
        this.focus = {
            id: null,
            pathway: null,
            envelope: 0,
            target: 0,
            attackTime: 0.15,
            releaseTime: 0.4,
            // Constant volume target - no boosting, just ducking others
            targetVolume: 0.35,
            duckOthers: 0.25,  // Others duck to 25%
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
        
        this.categorySends = {
            energy: { chorus: 0.3, delay: 0.25 },
            biosynthesis: { chorus: 0.35, delay: 0.3 },
            degradation: { chorus: 0.25, delay: 0.35 },
            salvage: { chorus: 0.4, delay: 0.2 },
            other: { chorus: 0.3, delay: 0.4 },
            superpathways: { chorus: 0.35, delay: 0.3 },
        };
        
        // MS Mode - Audio follows visual state
        // Visual handles precise timing, audio reacts to current state
        this.msMode = {
            enabled: false,
            transition: 0,           // 0 = healthy, 1 = MS (smoothed)
            transitionSpeed: 0.008,  // Smooth follow
            data: {},
            affectedSet: new Set(),
            
            focusBoostDb: 10,        // Boost for affected pathways
            duckOthersDb: -14,       // Duck for non-affected
            settledBoostDb: 3,       // After soften phase
            settledDuckDb: -3,       // After soften phase
            elevatedExtraDb: 4,      // Extra boost for elevated
        };
        
        // Fairness tracking
        this.fairness = {
            lastSounded: new Map(),
            decayTime: 15,
            weight: 0.3,
        };
        
        this.rippleQueue = [];
    }
    
    advance(blockSize, sampleRate) {
        this.blockSize = blockSize;
        this.sampleRate = sampleRate;
        this.dt = blockSize / sampleRate;
        this.time += this.dt;
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // FOCUS - Simplified, constant volume
    // ═══════════════════════════════════════════════════════════════════════
    
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
        // How much to duck non-focused pathways
        return 1.0 - (1.0 - this.focus.duckOthers) * this.focus.envelope;
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // MS MODE - Complete 4-phase transition
    // ═══════════════════════════════════════════════════════════════════════
    
    updateMSMode() {
        const ms = this.msMode;
        const target = ms.enabled ? 1 : 0;
        
        // Asymmetric speed: slower going in for drama, faster coming out for smoothness
        const speed = ms.enabled ? ms.transitionSpeed : ms.transitionSpeed * 2;
        ms.transition += (target - ms.transition) * speed;
        
        // Clamp very small values
        if (!ms.enabled && ms.transition < 0.005) {
            ms.transition = 0;
        }
    }
    
    getMSPhases() {
        const t = this.msMode.transition;
        return {
            // Simple transition tracking - audio follows visual
            t: this.msMode.transition
        };
    }
    
    getMSScale(pathwayId) {
        const ms = this.msMode;
        if (ms.transition < 0.001) return 1.0;
        
        const t = ms.transition;
        const msInfo = ms.data[pathwayId];
        const isAffected = ms.affectedSet.has(pathwayId);
        
        if (isAffected && msInfo) {
            // AFFECTED PATHWAY - boost
            const isDepleted = msInfo.enrichedIn === 'healthy';
            const isElevated = msInfo.enrichedIn === 'ms' || msInfo.enrichedIn === 'dysregulated';
            const ldaScore = msInfo.ldaScore || 0.5;
            
            // Base boost for being affected
            const focusBoost = Math.pow(10, ms.focusBoostDb * t / 20);
            
            // Direction change
            let directionScale = 1.0;
            if (isDepleted) {
                directionScale = 1 - (ldaScore * 0.4 * t);
            }
            if (isElevated) {
                directionScale = 1 + (ldaScore * 0.5 * t);
                // Extra boost for elevated
                directionScale *= Math.pow(10, ms.elevatedExtraDb * t / 20);
            }
            
            return focusBoost * directionScale;
            
        } else {
            // NON-AFFECTED PATHWAY - duck
            return Math.pow(10, ms.duckOthersDb * t / 20);
        }
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
    // HARMONIC RELATIONS
    // ═══════════════════════════════════════════════════════════════════════
    
    buildHarmonicRelations() {
        for (const pathway of this.pathways) {
            const relations = [];
            const siblings = this.pathwaysBySubcategory.get(pathway.subcategory) || [];
            
            for (const sibling of siblings) {
                if (sibling.id === pathway.id) continue;
                relations.push({
                    id: sibling.id,
                    relation: 'subcategory',
                    strength: 0.7,
                });
            }
            
            // Add consonant relations
            for (const other of this.pathways) {
                if (other.id === pathway.id) continue;
                const ratio = pathway.ratio / other.ratio;
                const consonance = this.getConsonance(ratio);
                if (consonance > 0.6) {
                    relations.push({
                        id: other.id,
                        relation: 'consonant',
                        strength: consonance,
                    });
                }
            }
            
            relations.sort((a, b) => b.strength - a.strength);
            this.harmonicRelations.set(pathway.id, relations.slice(0, 8));
        }
    }
    
    getConsonance(ratio) {
        if (ratio <= 0) return 0;
        const octaveNorm = Math.pow(2, Math.log2(ratio) % 1);
        const simpleRatios = [1, 1.5, 1.333, 1.25, 1.2, 1.667, 1.125, 1.0625];
        let maxConsonance = 0;
        for (const simple of simpleRatios) {
            const diff = Math.abs(octaveNorm - simple);
            const consonance = Math.exp(-diff * 10);
            maxConsonance = Math.max(maxConsonance, consonance);
        }
        return maxConsonance;
    }
}


// ╔════════════════════════════════════════════════════════════════════════════╗
// ║  MMC ENGINE - The Conductor                                                ║
// ╚════════════════════════════════════════════════════════════════════════════╝

class MMCEngine {
    constructor() {
        this.config = {
            cycleDuration: 90,
            phases: {
                quiescent: { duration: 0.45, activity: { drone: 1.0, granular: 0.3, chorus: 0.4, delay: 0.5 }},
                increasing: { duration: 0.20, activity: { drone: 1.0, granular: 0.6, chorus: 0.6, delay: 0.6 }},
                active:     { duration: 0.15, activity: { drone: 1.0, granular: 1.0, chorus: 0.8, delay: 0.7 }},
                decreasing: { duration: 0.20, activity: { drone: 1.0, granular: 0.5, chorus: 0.5, delay: 0.6 }},
            },
            intensity: 0.7,
        };
        
        this.cycleTime = 0;
        this.currentPhase = 'quiescent';
        this.phaseProgress = 0;
    }
    
    update(ctx) {
        this.cycleTime += ctx.dt;
        if (this.cycleTime >= this.config.cycleDuration) {
            this.cycleTime -= this.config.cycleDuration;
        }
        
        const cycleProgress = this.cycleTime / this.config.cycleDuration;
        let accumulated = 0;
        
        for (const [phaseName, phaseConfig] of Object.entries(this.config.phases)) {
            accumulated += phaseConfig.duration;
            if (cycleProgress < accumulated) {
                this.currentPhase = phaseName;
                const phaseStart = accumulated - phaseConfig.duration;
                this.phaseProgress = (cycleProgress - phaseStart) / phaseConfig.duration;
                break;
            }
        }
        
        ctx.mmcPhase = this.currentPhase;
        this.interpolateActivity(ctx);
    }
    
    interpolateActivity(ctx) {
        const current = this.config.phases[this.currentPhase].activity;
        const intensity = this.config.intensity;
        
        for (const [layer, targetValue] of Object.entries(current)) {
            const baseValue = 0.5;
            const modulatedValue = baseValue + (targetValue - baseValue) * intensity;
            
            if (ctx.mmcActivity[layer] !== undefined) {
                ctx.mmcActivity[layer] += (modulatedValue - ctx.mmcActivity[layer]) * 0.05;
            }
        }
    }
    
    setIntensity(value) {
        this.config.intensity = Math.max(0, Math.min(1, value));
    }
    
    setCycleDuration(seconds) {
        this.config.cycleDuration = Math.max(30, Math.min(180, seconds));
    }
}


// ╔════════════════════════════════════════════════════════════════════════════╗
// ║  REFERENCE TONE ENGINE - The Anchor                                        ║
// ╚════════════════════════════════════════════════════════════════════════════╝

class ReferenceToneEngine {
    constructor() {
        this.config = {
            mixLevel: 0.02,
            octaves: [-2, -1, 0, 1, 2],
            amplitudes: [0.9, 0.7, 0.5, 0.3, 0.15],
            breathing: { rate: 0.03, depth: 0.18 },
        };
        
        this.voices = [];
        this.breathPhase = 0.5;
    }
    
    init(ctx) {
        this.voices = [];
        for (let i = 0; i < this.config.octaves.length; i++) {
            const octave = this.config.octaves[i];
            this.voices.push({
                frequency: ctx.fundamental * Math.pow(2, octave),
                amplitude: this.config.amplitudes[i],
                phase: Math.random() * Math.PI * 2,
            });
        }
    }
    
    process(ctx, outputL, outputR) {
        const cfg = this.config;
        const sr = ctx.sampleRate;
        const twoPi = Math.PI * 2;
        
        this.breathPhase += twoPi * cfg.breathing.rate * ctx.dt;
        if (this.breathPhase > twoPi) this.breathPhase -= twoPi;
        const breathMod = 1 + Math.sin(this.breathPhase) * cfg.breathing.depth;
        
        for (const voice of this.voices) {
            voice.frequency = ctx.fundamental * Math.pow(2, this.config.octaves[this.voices.indexOf(voice)]);
            const amp = voice.amplitude * cfg.mixLevel * ctx.masterVolume * breathMod;
            const phaseInc = (twoPi * voice.frequency) / sr;
            
            for (let i = 0; i < ctx.blockSize; i++) {
                const sample = Math.sin(voice.phase) * amp;
                outputL[i] += sample;
                outputR[i] += sample;
                voice.phase += phaseInc;
                if (voice.phase > twoPi) voice.phase -= twoPi;
            }
        }
    }
}


// ╔════════════════════════════════════════════════════════════════════╗
// ║  DRONE ENGINE v0.1 — COLLAGE / LIFE‑CYCLE MODEL                     ║
// ║                                                                    ║
// ║  Each pathway lives through repeating growth arches:               ║
// ║  whisper → rise → presence → fall → whisper                         ║
// ║                                                                    ║
// ║  No LFOs. No noise modulation. No detuning.                         ║
// ║  Time, scarcity, and harmonic truth only.                           ║
// ╚════════════════════════════════════════════════════════════════════╝

class DroneEngine {
    constructor() {
        // ╔════════════════════════════════════════════════════════════
        // GLOBAL FIELD (Gut State)
        // ╚════════════════════════════════════════════════════════════
        this.global = {
            mixLevel: 0.18,
            whisperLevel: 0.001715,

            rippleStrength: 0.85,
            rippleSpeed: 0.0008,
        };

        // ╔════════════════════════════════════════════════════════════
        // PERCEPTUAL HABITUATION (NEW)
        // ╚════════════════════════════════════════════════════════════
        this.habituation = {
            enabled: true,
            onsetTime: 4.0,
            maxReduction: 0.45,
            rate: 0.08,
            consonanceBias: 0.6,
        };

        // ╔════════════════════════════════════════════════════════════
        // INTERACTION — EXCITATION FIELD (NEW)
        // ╚════════════════════════════════════════════════════════════
        this.interaction = {
            excitationStrength: 0.6,
            spread: 0.25,
            decayTime: 18.0,
            consonanceSensitivity: 0.4,
        };

        // ╔════════════════════════════════════════════════════════════
        // LAYERS AS PROBABILITY FILTERS
        // ╚════════════════════════════════════════════════════════════
        this.layers = {
            roots: { minDuration: 40, maxDuration: 240, recurrenceScale: 160, weight: 0.55 },
            branches: { minDuration: 6, maxDuration: 30, recurrenceScale: 42, weight: 0.3 },
            leaves: {
                minDuration: 1.6,
                maxDuration: 6,
                recurrenceScale: 16,
                weight: 0.15,
            },
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

                // NEW: habituation state
                activeTime: 0,
                habituation: 0,

                layers: this.initLayerStates(ctx.time),
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

    process(ctx, outputL, outputR) {
        if (!this.initialized) return;

        const sr = ctx.sampleRate;
        const twoPi = Math.PI * 2;

        // ── Global ripple field
        this.globalVelocity += (Math.random() * 2 - 1) * this.global.rippleSpeed;
        this.globalVelocity *= 0.995;
        this.globalField = Math.max(0.8, Math.min(1.2, this.globalField + this.globalVelocity));

        for (const v of this.voices) {
            // ── Interaction energy decay (NEW)
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

            // ── Perceptual habituation (NEW)
            if (this.habituation.enabled && isActive) {
                v.activeTime += ctx.dt;

                if (v.activeTime > this.habituation.onsetTime) {
                    const bias =
                        1 -
                        v.consonance * this.habituation.consonanceBias;

                    v.habituation +=
                        this.habituation.rate *
                        bias *
                        ctx.dt;

                    v.habituation = Math.min(1, v.habituation);
                }
            } else {
                v.activeTime = 0;
                v.habituation *= 0.95;
            }

            const habituationGain =
                1 -
                v.habituation * this.habituation.maxReduction;

            const finalAmp =
                amp *
                habituationGain *
                this.global.mixLevel *
                ctx.masterVolume *
                ctx.getMSScale(v.pathwayId);

            if (finalAmp < 0.000001) continue;

            const phaseInc = twoPi * v.frequency / sr;

            for (let i = 0; i < ctx.blockSize; i++) {
                const s = Math.sin(v.phase) * finalAmp;
                outputL[i] += s;
                outputR[i] += s;
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

    // ╔════════════════════════════════════════════════════════════
    // INTERACTION — HAND IN WATER
    // Call this repeatedly while hovering / dragging
    // ╚════════════════════════════════════════════════════════════
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
// ║  GRANULAR ENGINE - Clear Surface, Teeming Underneath                       ║
// ║  Thousands of micro-grains that blend into coherent texture                ║
// ╚════════════════════════════════════════════════════════════════════════════╝

class GranularEngine {
    constructor() {
        this.config = {
            mixLevel: 0.0,
            
            // Grain parameters
            grainDuration: {
                min: 0.03,   // 30ms minimum
                max: 0.08,   // 80ms maximum
            },
            
            // Spawn rate per category (grains per second)
            spawnRates: {
                energy: 25,
                biosynthesis: 30,
                degradation: 20,
                salvage: 8,
                other: 15,
                superpathways: 6,
            },
            
            // Maximum simultaneous grains per category
            maxGrains: {
                energy: 40,
                biosynthesis: 50,
                degradation: 35,
                salvage: 15,
                other: 25,
                superpathways: 10,
            },
            
            // Weighting for pathway selection
            weighting: {
                consonance: 0.35,
                abundance: 0.55,
                fairness: 0.2,
            },
            
            // Grain envelope shape
            envelope: {
                attack: 0.35,   // 15% attack
                release: 0.45,  // 25% release
            },
        };
        
        this.grains = [];
        this.categoryTimers = {};
        this.initialized = false;
    }
    
    init(ctx) {
        this.grains = [];
        
        // Initialize spawn timers for each category
        for (const category of Object.keys(this.config.spawnRates)) {
            this.categoryTimers[category] = {
                lastSpawn: ctx.time,
                nextInterval: this.getSpawnInterval(category),
            };
        }
        
        this.initialized = true;
    }
    
    getSpawnInterval(category) {
        const rate = this.config.spawnRates[category] || 10;
        // Add variation
        return (1 / rate) * (0.7 + Math.random() * 0.6);
    }
    
    process(ctx, outputL, outputR, chorusSendL, chorusSendR, delaySendL, delaySendR) {
        if (!this.initialized) return;
        
        const cfg = this.config;
        const sr = ctx.sampleRate;
        const twoPi = Math.PI * 2;
        
        // MMC activity scales spawn rate
        const activityMult = ctx.mmcActivity.granular || 0.5;
        
        // Spawn new grains
        for (const [category, timer] of Object.entries(this.categoryTimers)) {
            const categoryGain = ctx.categoryGains[category] ?? 1.0;
            if (categoryGain < 0.05) continue;
            
            const pathways = ctx.pathwaysByCategory.get(category);
            if (!pathways || pathways.length === 0) continue;
            
            // Count current grains in this category
            const currentGrains = this.grains.filter(g => g.category === category).length;
            const maxGrains = cfg.maxGrains[category] || 20;
            
            // Spawn if timer elapsed and under max
            if (ctx.time - timer.lastSpawn > timer.nextInterval / activityMult && currentGrains < maxGrains) {
                this.spawnGrain(category, pathways, ctx);
                timer.lastSpawn = ctx.time;
                timer.nextInterval = this.getSpawnInterval(category);
            }
        }
        
        // Process and render grains
        const finishedGrains = [];
        
        for (let gi = 0; gi < this.grains.length; gi++) {
            const grain = this.grains[gi];
            const age = ctx.time - grain.startTime;
            const progress = age / grain.duration;
            
            if (progress >= 1) {
                finishedGrains.push(gi);
                continue;
            }
            
            // Grain envelope (attack-sustain-release)
            let envelope;
            if (progress < cfg.envelope.attack) {
                envelope = progress / cfg.envelope.attack;
            } else if (progress > 1 - cfg.envelope.release) {
                envelope = (1 - progress) / cfg.envelope.release;
            } else {
                envelope = 1;
            }
            
            // Apply envelope curve (smooth)
            envelope = envelope * envelope * (3 - 2 * envelope);
            
            // Focus/MS modulation
            const focusDuck = ctx.focus.id && ctx.focus.id !== grain.pathwayId ? ctx.getFocusDuck() : 1;
            const msScale = ctx.getMSScale(grain.pathwayId);
            const categoryGain = ctx.categoryGains[grain.category] ?? 1.0;
            
            const amp = grain.amplitude * envelope * cfg.mixLevel * ctx.masterVolume * 
                       focusDuck * msScale * categoryGain * activityMult;
            
            if (amp < 0.00002) continue;
            
            const panAngle = (grain.pan + 1) * Math.PI / 4;
            const gainL = Math.cos(panAngle);
            const gainR = Math.sin(panAngle);
            
            const phaseInc = (twoPi * grain.frequency) / sr;
            
            // Effect sends
            const sends = ctx.categorySends[grain.category] || { chorus: 0.3, delay: 0.3 };
            
            for (let i = 0; i < ctx.blockSize; i++) {
                const sample = Math.sin(grain.phase) * amp;
                const sampleL = sample * gainL;
                const sampleR = sample * gainR;
                
                outputL[i] += sampleL;
                outputR[i] += sampleR;
                
                // Heavy effect sends for texture blending
                chorusSendL[i] += sampleL * sends.chorus * 0.5;
                chorusSendR[i] += sampleR * sends.chorus * 0.5;
                delaySendL[i] += sampleL * sends.delay * 0.4;
                delaySendR[i] += sampleR * sends.delay * 0.4;
                
                grain.phase += phaseInc;
                if (grain.phase > twoPi) grain.phase -= twoPi;
            }
        }
        
        // Remove finished grains (reverse order to preserve indices)
        for (let i = finishedGrains.length - 1; i >= 0; i--) {
            this.grains.splice(finishedGrains[i], 1);
        }
    }
    
    spawnGrain(category, pathways, ctx) {
        // Select pathway with weighting
        const pathway = this.selectPathway(pathways, ctx);
        if (!pathway) return;
        
        const cfg = this.config;
        const duration = cfg.grainDuration.min + Math.random() * (cfg.grainDuration.max - cfg.grainDuration.min);
        
        this.grains.push({
            pathwayId: pathway.id,
            category: category,
            frequency: ctx.fundamental * pathway.ratio,
            amplitude: pathway.baseVolume * 0.6,
            pan: (Math.random() - 0.5) * 1.4,
            phase: Math.random() * Math.PI * 2,
            startTime: ctx.time,
            duration: duration,
        });
        
        ctx.markSounded(pathway.id);
    }
    
    selectPathway(pathways, ctx) {
        const cfg = this.config.weighting;
        let totalWeight = 0;
        const weights = [];
        
        for (const p of pathways) {
            const nxd = (p.n || 1) * (p.d || 1);
            const consonance = 1 / Math.sqrt(nxd);
            const abundance = p.baseVolume || 0.5;
            const fairness = ctx.getFairnessBonus(p.id);
            
            const weight = consonance * cfg.consonance + 
                          abundance * cfg.abundance + 
                          fairness * cfg.fairness;
            
            weights.push(weight);
            totalWeight += weight;
        }
        
        let r = Math.random() * totalWeight;
        for (let i = 0; i < pathways.length; i++) {
            r -= weights[i];
            if (r <= 0) return pathways[i];
        }
        
        return pathways[pathways.length - 1];
    }
    
    updateFrequencies(ctx) {
        for (const grain of this.grains) {
            const pathway = ctx.pathwayById.get(grain.pathwayId);
            if (pathway) {
                grain.frequency = ctx.fundamental * pathway.ratio;
            }
        }
    }
}


// ╔════════════════════════════════════════════════════════════════════════════╗
// ║  FOCUS ENGINE - Dedicated Focus Tone with Constant Volume                  ║
// ║  Cuts through clearly, same volume for ALL ratios                          ║
// ╚════════════════════════════════════════════════════════════════════════════╝

class FocusEngine {
    constructor() {
        this.config = {
            // Constant target volume regardless of pathway
            targetVolume: 0.35,
            
            // Envelope
            attackTime: 0.12,
            releaseTime: 0.35,
            
            // Slight harmonics for richness
            harmonics: [
                { ratio: 1, amp: 0.05 },
                { ratio: 2, amp: 0.02 },
                { ratio: 3, amp: 0.01 },
            ],
        };
        
        this.phases = [0, 0, 0];
        this.currentPathway = null;
        this.envelope = 0;
    }
    
    process(ctx, outputL, outputR) {
        const cfg = this.config;
        const sr = ctx.sampleRate;
        const twoPi = Math.PI * 2;
        
        // Update envelope
        const target = ctx.focus.target;
        const speed = target > this.envelope ? 
            ctx.dt / cfg.attackTime * 4 : 
            ctx.dt / cfg.releaseTime * 3;
        
        this.envelope += (target - this.envelope) * speed;
        this.envelope = Math.max(0, Math.min(1, this.envelope));
        
        if (this.envelope < 0.001) {
            this.envelope = 0;
            return;
        }
        
        // Get focused pathway
        const pathway = ctx.focus.pathway;
        if (!pathway) return;
        
        const baseFreq = ctx.fundamental * pathway.ratio;
        
        // Constant volume - this is the key!
        // Slight reduction for very low or very high frequencies
        let freqCompensation = 1.0;
        if (baseFreq < 200) {
            freqCompensation = 0.8 + (baseFreq / 200) * 0.2;
        } else if (baseFreq > 2000) {
            freqCompensation = 0.9;
        }
        
        const amp = cfg.targetVolume * this.envelope * ctx.masterVolume * freqCompensation;
        
        // Render with harmonics
        for (let h = 0; h < cfg.harmonics.length; h++) {
            const harmonic = cfg.harmonics[h];
            const freq = baseFreq * harmonic.ratio;
            const harmonicAmp = amp * harmonic.amp;
            
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
// ║  POST PROCESSOR - Chorus, Delay, Soft Limiting                             ║
// ╚════════════════════════════════════════════════════════════════════════════╝

class PostProcessor {
    constructor() {
        this.chorusConfig = {
            enabled: true,
            wetMix: 0.25,
            voices: 3,
            depth: 0.003,
            rate: 0.4,
        };
        
        this.delayConfig = {
            enabled: true,
            wetMix: 0.2,
            time: 0.35,
            feedback: 0.4,
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
        this.delayLP = [0, 0];
        
        this.limiterGain = 1.0;
    }
    
    init(sampleRate) {
        // Chorus
        const chorusMaxDelay = Math.ceil(sampleRate * 0.05);
        this.chorusBuffer = [new Float32Array(chorusMaxDelay), new Float32Array(chorusMaxDelay)];
        this.chorusWriteIndex = 0;
        this.chorusLfoPhases = [];
        for (let v = 0; v < this.chorusConfig.voices; v++) {
            this.chorusLfoPhases.push(Math.random() * Math.PI * 2);
        }
        
        // Delay
        const delayMaxTime = Math.ceil(sampleRate * 1.0);
        this.delayBuffer = [new Float32Array(delayMaxTime), new Float32Array(delayMaxTime)];
        this.delayWriteIndex = 0;
        this.delayLP = [0, 0];
    }
    
    process(ctx, dryL, dryR, chorusSendL, chorusSendR, delaySendL, delaySendR, outputL, outputR) {
        const blockSize = ctx.blockSize;
        const sr = ctx.sampleRate;
        
        // Process chorus
        if (this.chorusConfig.enabled && this.chorusBuffer) {
            this.processChorus(chorusSendL, chorusSendR, blockSize, sr);
        }
        
        // Process delay
        if (this.delayConfig.enabled && this.delayBuffer) {
            this.processDelay(delaySendL, delaySendR, blockSize, sr);
        }
        
        // Mix to output with soft limiting
        for (let i = 0; i < blockSize; i++) {
            let sampleL = dryL[i] + chorusSendL[i] * this.chorusConfig.wetMix + delaySendL[i] * this.delayConfig.wetMix;
            let sampleR = dryR[i] + chorusSendR[i] * this.chorusConfig.wetMix + delaySendR[i] * this.delayConfig.wetMix;
            
            // Soft limiting
            const peak = Math.max(Math.abs(sampleL), Math.abs(sampleR));
            const thresh = this.limiterConfig.threshold;
            
            if (peak > thresh) {
                const targetGain = thresh / peak;
                this.limiterGain = Math.min(this.limiterGain, targetGain);
            } else {
                this.limiterGain += (1 - this.limiterGain) * this.limiterConfig.release;
            }
            
            outputL[i] = sampleL * this.limiterGain;
            outputR[i] = sampleR * this.limiterGain;
        }
    }
    
    processChorus(sendL, sendR, blockSize, sr) {
        const cfg = this.chorusConfig;
        const bufferSize = this.chorusBuffer[0].length;
        const baseDelay = Math.floor(sr * 0.015);
        const twoPi = Math.PI * 2;
        
        for (let i = 0; i < blockSize; i++) {
            this.chorusBuffer[0][this.chorusWriteIndex] = sendL[i];
            this.chorusBuffer[1][this.chorusWriteIndex] = sendR[i];
            
            let outL = 0, outR = 0;
            
            for (let v = 0; v < cfg.voices; v++) {
                this.chorusLfoPhases[v] += twoPi * (cfg.rate * (0.8 + v * 0.2)) / sr;
                if (this.chorusLfoPhases[v] > twoPi) this.chorusLfoPhases[v] -= twoPi;
                
                const modulation = Math.sin(this.chorusLfoPhases[v]) * cfg.depth * sr;
                const delay = baseDelay + modulation;
                const readIndex = (this.chorusWriteIndex - Math.floor(delay) + bufferSize) % bufferSize;
                
                outL += this.chorusBuffer[0][readIndex];
                outR += this.chorusBuffer[1][readIndex];
            }
            
            sendL[i] = outL / cfg.voices;
            sendR[i] = outR / cfg.voices;
            
            this.chorusWriteIndex = (this.chorusWriteIndex + 1) % bufferSize;
        }
    }
    
    processDelay(sendL, sendR, blockSize, sr) {
        const cfg = this.delayConfig;
        const bufferSize = this.delayBuffer[0].length;
        const delaySamples = Math.floor(cfg.time * sr);
        
        for (let i = 0; i < blockSize; i++) {
            const readIndex = (this.delayWriteIndex - delaySamples + bufferSize) % bufferSize;
            
            let delayedL = this.delayBuffer[0][readIndex];
            let delayedR = this.delayBuffer[1][readIndex];
            
            // Damping LP filter
            this.delayLP[0] += (delayedL - this.delayLP[0]) * (1 - cfg.damping);
            this.delayLP[1] += (delayedR - this.delayLP[1]) * (1 - cfg.damping);
            delayedL = this.delayLP[0];
            delayedR = this.delayLP[1];
            
            // Write input + feedback
            this.delayBuffer[0][this.delayWriteIndex] = sendL[i] + delayedL * cfg.feedback;
            this.delayBuffer[1][this.delayWriteIndex] = sendR[i] + delayedR * cfg.feedback;
            
            // Output
            sendL[i] = delayedL;
            sendR[i] = delayedR;
            
            this.delayWriteIndex = (this.delayWriteIndex + 1) % bufferSize;
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
        this.granular = new GranularEngine();
        this.focus = new FocusEngine();
        this.postProcessor = new PostProcessor();
        
        this.initialized = false;
        this.lastReport = 0;
        this.reportInterval = 0.033;
        
        // Cascade fade state
        this.cascade = {
            active: false,
            direction: 'in',
            duration: 4.8,
            startTime: 0,
            pathwayOrder: [],
            pathwayFade: new Map(),
        };
        
        this.port.onmessage = (e) => this.handleMessage(e.data);
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // CASCADE FADE
    // ═══════════════════════════════════════════════════════════════════════
    
    startCascadeFade(direction, duration) {
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
        
        this.cascade.pathwayFade.clear();
        this.cascade.pathwayPhase = new Map();
        
        for (const p of this.ctx.pathways) {
            this.cascade.pathwayFade.set(p.id, direction === 'in' ? 0 : 1);
            this.cascade.pathwayPhase.set(p.id, Math.random() * 0.12);
        }
    }
    
    updateCascade() {
        if (!this.cascade.active) return;
        
        const elapsed = this.ctx.time - this.cascade.startTime;
        const progress = Math.min(1, elapsed / this.cascade.duration);
        const total = this.cascade.pathwayOrder.length;
        
        for (let i = 0; i < total; i++) {
            const id = this.cascade.pathwayOrder[i];
            const phaseOffset = this.cascade.pathwayPhase?.get(id) || 0;
            
            if (this.cascade.direction === 'in') {
                const startProgress = (i / total * 0.6) + phaseOffset;
                const fadeProgress = Math.max(0, Math.min(1, (progress - startProgress) / 0.35));
                this.cascade.pathwayFade.set(id, this.easeOutQuad(fadeProgress));
            } else {
                const reverseI = total - 1 - i;
                const startProgress = (reverseI / total * 0.5) + phaseOffset;
                const fadeProgress = Math.max(0, Math.min(1, (progress - startProgress) / 0.45));
                this.cascade.pathwayFade.set(id, 1 - this.easeInQuad(fadeProgress));
            }
        }
        
        if (progress >= 1) {
            this.cascade.active = false;
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
    
    handleMessage(msg) {
        const { type, data } = msg;
        
        switch (type) {
            case 'init':
                this.initFromData(data);
                break;
                
            case 'setFundamental':
                this.ctx.fundamental = Math.max(20, Math.min(2000, data));
                this.drone.updateFrequencies(this.ctx);
                this.granular.updateFrequencies(this.ctx);
                break;
                
            case 'setMasterVolume':
                this.ctx.masterVolume = Math.max(0, Math.min(1, data));
                break;
                
            case 'cascadeFadeIn':
                this.startCascadeFade('in', data.duration || 4.8);
                break;
                
            case 'cascadeFadeOut':
                this.startCascadeFade('out', data.duration || 0.9);
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
                    for (const id of Object.keys(data.msData)) {
                        this.ctx.msMode.affectedSet.add(id);
                    }
                }
                break;
                
            case 'setMSComparison':
                if (data.msData) {
                    this.ctx.msMode.data = data.msData;
                    this.ctx.msMode.affectedSet.clear();
                    for (const id of Object.keys(data.msData)) {
                        this.ctx.msMode.affectedSet.add(id);
                    }
                }
                break;
                
            case 'setMMCIntensity':
                this.mmc.setIntensity(data);
                break;
                
            case 'setMMCDuration':
                this.mmc.setCycleDuration(data);
                break;
                
            case 'setDroneConfig':
                if (data.mixLevel !== undefined) this.drone.config.mixLevel = data.mixLevel;
                break;
                
            case 'setGranularConfig':
                if (data.mixLevel !== undefined) this.granular.config.mixLevel = data.mixLevel;
                break;
        }
    }
    
    initFromData(data) {
        const sr = globalThis.sampleRate || 48000;
        
        this.ctx.pathways = data.pathways.map(p => {
            const n = p.n || this.extractN(p.ratio);
            const d = p.d || this.extractD(p.ratio);
            const ratio = typeof p.ratio === 'number' ? p.ratio : n / d;
            
            return {
                id: p.id,
                n, d, ratio,
                category: p.category || 'other',
                subcategory: p.subcategory || p.category || 'other',
                abundance: p.amplitude || 0.5,
                baseVolume: Math.pow(p.amplitude || 0.5, 1.5),
            };
        });
        
        this.ctx.pathwayById = new Map(this.ctx.pathways.map(p => [p.id, p]));
        
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
        
        for (const [, arr] of this.ctx.pathwaysByCategory) {
            arr.sort((a, b) => b.abundance - a.abundance);
        }
        
        for (const p of this.ctx.pathways) {
            this.ctx.fairness.lastSounded.set(p.id, 0);
        }
        
        this.ctx.buildHarmonicRelations();
        
        this.reference.init(this.ctx);
        this.drone.init(this.ctx);
        this.granular.init(this.ctx);
        this.postProcessor.init(sr);
        
        this.initialized = true;
        
        this.port.postMessage({
            type: 'ready',
            data: {
                pathwayCount: this.ctx.pathways.length,
                categories: [...this.ctx.pathwaysByCategory.keys()],
            }
        });
        
        console.log(`[v8] Initialized: ${this.ctx.pathways.length} pathways`);
    }
    
    extractN(ratio) {
        if (typeof ratio === 'string' && ratio.includes('/')) {
            return parseInt(ratio.split('/')[0], 10);
        }
        return Math.round(ratio * 12) || 1;
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
        
        // Update context
        this.ctx.advance(blockSize, sr);
        this.mmc.update(this.ctx);
        this.ctx.updateFocus();
        this.ctx.updateMSMode();
        this.updateCascade();
        
        // Store accessors - bind to proper methods
        this.ctx.getCascadeFade = (id) => this.getCascadeFade(id);
        // getMSScale is already a method on SharedContext, just ensure it's callable
        const ctxRef = this.ctx;
        this.ctx.getMSScaleFunc = (id) => ctxRef.getMSScale(id);
        
        // Prepare buffers
        const dryL = new Float32Array(blockSize);
        const dryR = new Float32Array(blockSize);
        const chorusSendL = new Float32Array(blockSize);
        const chorusSendR = new Float32Array(blockSize);
        const delaySendL = new Float32Array(blockSize);
        const delaySendR = new Float32Array(blockSize);
        
        // Render engines
        this.reference.process(this.ctx, dryL, dryR);
        this.drone.process(this.ctx, dryL, dryR);
        this.granular.process(this.ctx, dryL, dryR, chorusSendL, chorusSendR, delaySendL, delaySendR);
        this.focus.process(this.ctx, dryL, dryR);
        
        // Post process (chorus, delay, limiting)
        this.postProcessor.process(this.ctx, dryL, dryR, chorusSendL, chorusSendR, delaySendL, delaySendR, outL, outR);
        
        // Periodic state report
        if (this.ctx.time - this.lastReport > this.reportInterval) {
            this.lastReport = this.ctx.time;
            this.sendStateReport();
        }
        
        return true;
    }
    
    sendStateReport() {
        const phases = this.ctx.getMSPhases();
        
        this.port.postMessage({
            type: 'state',
            data: {
                time: this.ctx.time,
                mmcPhase: this.ctx.mmcPhase,
                mmcActivity: { ...this.ctx.mmcActivity },
                focusEnvelope: this.ctx.focus.envelope,
                focusId: this.ctx.focus.id,
                msMode: this.ctx.msMode.enabled,
                msTransition: this.ctx.msMode.transition,
                msPhases: phases,
                grainCount: this.granular.grains.length,
            }
        });
    }
}

registerProcessor('microbiome-sonification-processor', MicrobiomeSonificationProcessor);
