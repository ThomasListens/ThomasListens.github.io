/**
 * MicrobiomeSonification v4.1 - THE CONSONANT OCEAN
 * 
 * Philosophy: A unified drone that rewards close listening.
 * "The water is deep" - many voices mixed low create depth, not chaos.
 * 
 * KEY PRINCIPLES:
 * 1. DRONE layer is ALWAYS ON - most consonant pathways (1/1, 2/1, 3/2...)
 * 2. Everything else supports the drone from underneath
 * 3. Dense activity mixed quiet = feel it, don't hear individuals
 * 4. Effects (delay + chorus) unify into one space
 * 5. Focus pulls a fish from the sea
 * 
 * LAYER ARCHITECTURE:
 * ┌─────────────────────────────────────────────────────────────┐
 * │  DRONE (loud)      12 voices  - ALWAYS ON, consonant core   │
 * ├─────────────────────────────────────────────────────────────┤
 * │  SUSTAIN (medium)  16 voices  - Category rotation           │
 * │  MOVEMENT (quiet)  24 voices  - Subcategory rotation        │
 * ├─────────────────────────────────────────────────────────────┤
 * │  TEXTURE (v.quiet) 40 voices  - Dense background            │
 * │  SHIMMER (brief)   24 voices  - Sparkles into reverb        │
 * │  RIPPLES (react)   10 voices  - Harmonic responses          │
 * └─────────────────────────────────────────────────────────────┘
 */

class MicrobiomeSonification extends AudioWorkletProcessor {
    constructor() {
        super();
        
        // ╔════════════════════════════════════════════════════════════╗
        // ║  MMC CYCLE - THE CONDUCTOR                                 ║
        // ║  Controls which systems are active and at what intensity   ║
        // ╚════════════════════════════════════════════════════════════╝
        
        this.MMC = {
            cycleDuration: 60,  // Full cycle in seconds (compressed from 90 min)
            
            phases: {
                quiescent: {
                    duration: 0.40,      // 40% of cycle
                    layers: {
                        drone: 1.0,      // ALWAYS on
                        sustain: 0.4,
                        movement: 0.2,
                        texture: 0.3,
                        shimmer: 0.1,
                        ripples: 0.1,
                    },
                    peristalsisRate: 0.0,
                    description: 'Rest - gentle drone',
                },
                irregular: {
                    duration: 0.30,
                    layers: {
                        drone: 1.0,
                        sustain: 0.7,
                        movement: 0.6,
                        texture: 0.7,
                        shimmer: 0.4,
                        ripples: 0.4,
                    },
                    peristalsisRate: 0.3,
                    description: 'Awakening - building activity',
                },
                intense: {
                    duration: 0.18,
                    layers: {
                        drone: 1.0,
                        sustain: 1.0,
                        movement: 1.0,
                        texture: 1.0,
                        shimmer: 1.0,
                        ripples: 1.0,
                    },
                    peristalsisRate: 1.0,
                    description: 'Full activity - teeming with life',
                },
                transition: {
                    duration: 0.12,
                    layers: {
                        drone: 1.0,
                        sustain: 0.6,
                        movement: 0.4,
                        texture: 0.5,
                        shimmer: 0.2,
                        ripples: 0.2,
                    },
                    peristalsisRate: 0.4,
                    description: 'Settling - returning to rest',
                },
            },
            
            // Current state
            currentPhase: 'quiescent',
            phaseTime: 0,
            cycleTime: 0,
            
            // Smooth transitions
            layerActivity: {
                drone: 1.0,
                sustain: 0.4,
                movement: 0.2,
                texture: 0.3,
                shimmer: 0.1,
                ripples: 0.1,
            },
            peristalsisActivity: 0,
            transitionSpeed: 0.5,  // How fast to blend between phases
        };
        
        // ╔════════════════════════════════════════════════════════════╗
        // ║  LAYER CONFIGURATION                                       ║
        // ║  DRONE is the surface - everything else is underneath      ║
        // ╚════════════════════════════════════════════════════════════╝
        
        this.LAYERS = {
            focus: {
                volume: 0.4,
                duckOthers: 0.25,
                attackTime: 0.12,
                releaseTime: 0.5,
            },
            
            // THE DRONE - always on, most consonant pathways
            // This is the "surface of the water" - constant, grounding
            drone: {
                name: 'drone',
                voiceCount: 12,          // Top 12 by consonance+abundance
                mixLevel: 0.28,          // LOUD - this IS the sound
                alwaysOn: true,          // Never cycles off
                breathRate: [0.08, 0.15], // Gentle amplitude modulation
                breathDepth: [0.15, 0.25],
                description: 'Always-on consonant drone - the grounding sound',
            },
            
            // SUSTAIN - Long tones that reinforce the drone
            // Rotates through categories but blends into drone
            sustain: {
                name: 'sustain',
                voiceCount: 16,
                mixLevel: 0.12,          // Supportive, not dominant
                cycleTime: [4, 8],       // Moderate cycling
                envelope: {
                    attack: [1.5, 3.0],  // Gentle fades
                    sustain: [3.0, 6.0],
                    release: [2.0, 4.0],
                },
                categoryRotation: true,
                description: 'Reinforcing layer - blends with drone',
            },
            
            // MOVEMENT - Subcategory rotation, more activity
            movement: {
                name: 'movement',
                voiceCount: 24,
                mixLevel: 0.07,          // Background
                cycleTime: [1.5, 3.5],   // Faster turnover
                envelope: {
                    attack: [0.6, 1.2],
                    sustain: [1.0, 2.5],
                    release: [0.8, 1.5],
                },
                subcategoryRotation: true,
                description: 'Subcategory movement - activity under surface',
            },
            
            // TEXTURE - Dense background, many quiet voices
            texture: {
                name: 'texture',
                voiceCount: 40,
                mixLevel: 0.04,          // Very quiet but dense
                cycleTime: [0.5, 1.5],
                envelope: {
                    attack: [0.2, 0.5],
                    sustain: [0.3, 0.8],
                    release: [0.3, 0.6],
                },
                randomSelection: true,
                description: 'Dense texture - feel more than hear',
            },
            
            // SHIMMER - Brief sparkles
            shimmer: {
                name: 'shimmer',
                voiceCount: 24,
                mixLevel: 0.035,
                cycleTime: [0.08, 0.3],
                envelope: {
                    attack: [0.015, 0.05],
                    sustain: [0.04, 0.15],
                    release: [0.1, 0.3],
                },
                randomSelection: true,
                description: 'Brief sparkles that feed into reverb',
            },
            
            // RIPPLES - Harmonic responses (triggered, not cycled)
            ripples: {
                name: 'ripples',
                voiceCount: 10,
                mixLevel: 0.05,
                envelope: {
                    attack: [0.08, 0.2],
                    sustain: [0.15, 0.4],
                    release: [0.25, 0.5],
                },
                harmonicResponse: true,
                description: 'Harmonic responses',
            },
        };
        
        // ╔════════════════════════════════════════════════════════════╗
        // ║  PERISTALSIS - FREQUENCY SPACE WAVES                       ║
        // ║  Waves that sweep through the frequency spectrum           ║
        // ║  Active oscillators "catch" the wave as it passes          ║
        // ╚════════════════════════════════════════════════════════════╝
        
        this.PERISTALSIS = {
            enabled: true,
            
            // Wave spawning
            spawnRate: 0.15,          // Waves per second at full activity
            maxWaves: 2,
            
            // Wave properties
            wave: {
                speed: [80, 160],     // Hz per second
                width: [60, 120],     // Hz width of wave
                amplitude: 0.25,      // Volume boost when wave passes
                direction: 'both',    // 'up', 'down', or 'both'
            },
            
            // Frequency range (matches our ratio range at 600Hz fundamental)
            minFreq: 75,              // 600 * 0.125
            maxFreq: 9600,            // 600 * 16
            
            // Current waves
            waves: [],
        };
        
        // ╔════════════════════════════════════════════════════════════╗
        // ║  HARMONIC RIPPLES                                          ║
        // ║  When a pathway activates, related ratios may respond      ║
        // ╚════════════════════════════════════════════════════════════╝
        
        this.RIPPLES = {
            enabled: true,
            triggerChance: 0.35,      // Chance when pathway activates
            
            // Find harmonically related ratios
            relations: {
                octave: { multipliers: [0.5, 2], chance: 0.4, delay: [0.02, 0.06] },
                fifth: { multipliers: [2/3, 3/2], chance: 0.3, delay: [0.03, 0.08] },
                fourth: { multipliers: [3/4, 4/3], chance: 0.25, delay: [0.04, 0.10] },
                third: { multipliers: [4/5, 5/4], chance: 0.2, delay: [0.05, 0.12] },
            },
            
            volumeDecay: 0.5,         // Ripples are quieter
            maxRipples: 3,            // Max ripples per trigger
            
            // Pending ripples
            pending: [],
        };
        
        // ╔════════════════════════════════════════════════════════════╗
        // ║  GLOBAL MODULATION                                         ║
        // ║  Slow LFOs that affect the entire drone                    ║
        // ╚════════════════════════════════════════════════════════════╝
        
        this.MODULATION = {
            // Very slow breathing of the whole system
            breath: {
                rate: 0.012,
                depth: 0.08,
                phase: 0,
            },
            
            // Even slower drift
            drift: {
                rate: 0.004,
                depth: 0.05,
                phase: Math.random() * Math.PI * 2,
            },
            
            // Gentle shimmer
            shimmer: {
                rate: 0.07,
                depth: 0.025,
                phase: Math.random() * Math.PI * 2,
            },
        };
        
        // ╔════════════════════════════════════════════════════════════╗
        // ║  EFFECTS - THE GLUE                                        ║
        // ║  Delay and reverb unify everything into one space          ║
        // ╚════════════════════════════════════════════════════════════╝
        
        this.DELAY = {
            time1: 185,               // ms - main delay
            time2: 310,               // ms - secondary tap
            time3: 470,               // ms - third tap (pseudo-reverb)
            
            feedback: 0.32,
            crossFeedback: 0.15,      // L→R and R→L
            
            wetMix: 0.22,
            
            // Filter the delays (darker = more reverb-like)
            highCut: 0.45,            // Strong high cut
            lowCut: 0.05,             // Slight low cut
            
            // Modulation for chorus-like effect
            modRate: 0.3,
            modDepth: 3,              // ms
        };
        
        this.CHORUS = {
            enabled: true,
            voices: 3,
            baseDelay: 12,
            modDepth: 4,
            rates: [0.12, 0.18, 0.25],
            wetMix: 0.2,
            feedback: 0.08,
        };
        
        // ╔════════════════════════════════════════════════════════════╗
        // ║  CATEGORY CONFIGURATION                                    ║
        // ╚════════════════════════════════════════════════════════════╝
        
        this.CATEGORIES = {
            energy: { panHome: 0.0, panRange: 0.25, chorusSend: 0.35 },
            biosynthesis: { panHome: 0.4, panRange: 0.2, chorusSend: 0.4 },
            degradation: { panHome: -0.4, panRange: 0.2, chorusSend: 0.32 },
            salvage: { panHome: 0.2, panRange: 0.15, chorusSend: 0.38 },
            superpathways: { panHome: 0.0, panRange: 0.35, chorusSend: 0.45 },
            other: { panHome: -0.2, panRange: 0.2, chorusSend: 0.3 },
        };
        
        // ╔════════════════════════════════════════════════════════════╗
        // ║  STATE                                                     ║
        // ╚════════════════════════════════════════════════════════════╝
        
        // Pathways
        this.pathways = [];
        this.pathwayById = new Map();
        this.pathwaysByCategory = new Map();
        this.pathwaysBySubcategory = new Map();
        
        // Oscillators (one per unique ratio)
        this.oscillators = new Map();
        this.ratioToPathways = new Map();
        
        // Visibility
        this.visibleIds = new Set();
        this.allVisible = true;
        
        // Focus
        this.focusedId = null;
        this.focusEnvelope = 0;
        this.focusTarget = 0;
        
        // Layer cycling state
        this.layerState = {};
        for (const name in this.LAYERS) {
            if (name === 'focus') continue;
            this.layerState[name] = {
                activeVoices: [],      // [{id, envelope, phase, ...}, ...]
                lastCycle: 0,
                nextCycleIn: 1,
                categoryIndex: 0,      // For category rotation
                subcategoryIndex: 0,
            };
        }
        
        // Category state
        this.categoryGains = {};
        
        // Drone (always-on consonant pathways)
        this.droneIds = new Set();
        
        // Fairness tracking
        this.lastSounded = new Map();
        
        // MS comparison mode
        this.msMode = false;
        this.msComparisonData = {};
        
        // Audio
        this.fundamental = 600;
        this.masterVolume = 0.38;
        this.sampleRate = 48000;
        this.time = 0;
        
        // Effects state (initialized later)
        this.delayReady = false;
        this.chorusReady = false;
        
        // Reporting
        this.lastReport = 0;
        this.reportInterval = 0.033;
        
        this.port.onmessage = (e) => this.handleMessage(e.data);
    }
    
    // ╔════════════════════════════════════════════════════════════════╗
    // ║  MESSAGE HANDLING                                              ║
    // ╚════════════════════════════════════════════════════════════════╝
    
    handleMessage({ type, data }) {
        switch (type) {
            case 'init':
                this.initPathways(data.pathways);
                break;
            case 'setFundamental':
                this.fundamental = data;
                break;
            case 'setMasterVolume':
                this.masterVolume = data;
                break;
            case 'setCategoryGain':
                this.categoryGains[data.category] = data.gain;
                break;
            case 'setVisiblePathways':
                this.visibleIds = new Set(data.ids);
                this.allVisible = data.ids.length === 0 || data.ids.length === this.pathways.length;
                this.updateFoundation();
                break;
            case 'setFocus':
                this.focusedId = data.id;
                this.focusTarget = data.id ? 1.0 : 0.0;
                break;
            case 'setMMCPhase':
                // Manual phase control for testing
                this.MMC.currentPhase = data.phase;
                this.MMC.phaseTime = 0;
                break;
            case 'setLayerMix':
                if (this.LAYERS[data.layer]) {
                    this.LAYERS[data.layer].mixLevel = data.mix;
                }
                break;
            case 'setEffects':
                if (data.delay) Object.assign(this.DELAY, data.delay);
                if (data.chorus) Object.assign(this.CHORUS, data.chorus);
                break;
            case 'triggerPathway':
                this.manualTrigger(data.id, data.layer || 'movement');
                break;
            case 'setMSMode':
                this.setMSMode(data.enabled, data.msData);
                break;
            case 'setMSComparison':
                // Receive MS comparison data from main thread
                this.msComparisonData = data.msData || {};
                break;
        }
    }
    
    // ╔════════════════════════════════════════════════════════════════╗
    // ║  MS COMPARISON MODE                                            ║
    // ╚════════════════════════════════════════════════════════════════╝
    
    setMSMode(enabled, msData) {
        this.msMode = enabled;
        
        if (msData) {
            this.msComparisonData = msData;
        }
        
        const scaleFactor = 0.5;  // How strongly MS affects amplitude
        
        for (const p of this.pathways) {
            if (!this.msComparisonData) {
                p.msAmplitudeScale = 1.0;
                continue;
            }
            
            const msInfo = this.msComparisonData[p.id];
            
            if (msInfo && enabled) {
                if (msInfo.enrichedIn === 'healthy') {
                    // Depleted in MS - reduce amplitude
                    p.msAmplitudeScale = 1 - (msInfo.ldaScore * scaleFactor);
                } else {
                    // Elevated in MS - increase amplitude  
                    p.msAmplitudeScale = 1 + (msInfo.ldaScore * scaleFactor);
                }
            } else {
                p.msAmplitudeScale = 1.0;
            }
        }
        
        // Re-select drone voices since amplitudes changed
        if (enabled) {
            this.updateFoundation();
        }
    }
    
    // ╔════════════════════════════════════════════════════════════════╗
    // ║  INITIALIZATION                                                ║
    // ╚════════════════════════════════════════════════════════════════╝
    
    initPathways(pathwayData) {
        this.sampleRate = globalThis.sampleRate || 48000;
        
        const maxAbund = Math.max(...pathwayData.map(p => p.amplitude || 0.001));
        
        this.pathways = pathwayData.map((p, i) => {
            const abundance = (p.amplitude || 0.001) / maxAbund;
            const cat = (p.category || 'other').toLowerCase();
            const subcat = p.subcategory || 'Other';
            const catCfg = this.CATEGORIES[cat] || this.CATEGORIES.other;
            
            // Handle various ratio formats
            const n = p.n || this.extractN(p.ratio);
            const d = p.d || this.extractD(p.ratio);
            const ratioValue = typeof p.ratio === 'number' ? p.ratio : n / d;
            
            return {
                id: p.id,
                index: i,
                n,
                d,
                ratioValue,
                ratioKey: `${n}/${d}`,
                frequency: this.fundamental * ratioValue,
                
                category: cat,
                subcategory: subcat,
                
                abundance,
                baseVolume: Math.pow(abundance, 1.6),
                
                // Panning
                basePan: catCfg.panHome + (Math.random() - 0.5) * catCfg.panRange,
                currentPan: catCfg.panHome,
                chorusSend: catCfg.chorusSend,
                
                // State
                isDrone: false,
                peristalsisBoost: 0,
                
                // MS comparison
                msAmplitudeScale: 1.0,
                
                // LFO
                lfoPhase: Math.random() * Math.PI * 2,
                lfoRate: 0.05 + Math.random() * 0.1,
                lfoDepth: 0.03 + (1 - abundance) * 0.08,
            };
        });
        
        // Build lookups
        this.pathwayById = new Map(this.pathways.map(p => [p.id, p]));
        
        // Group by category
        for (const p of this.pathways) {
            if (!this.pathwaysByCategory.has(p.category)) {
                this.pathwaysByCategory.set(p.category, []);
            }
            this.pathwaysByCategory.get(p.category).push(p);
            
            if (!this.pathwaysBySubcategory.has(p.subcategory)) {
                this.pathwaysBySubcategory.set(p.subcategory, []);
            }
            this.pathwaysBySubcategory.get(p.subcategory).push(p);
        }
        
        // Sort each group by abundance
        for (const [, arr] of this.pathwaysByCategory) {
            arr.sort((a, b) => b.abundance - a.abundance);
        }
        for (const [, arr] of this.pathwaysBySubcategory) {
            arr.sort((a, b) => b.abundance - a.abundance);
        }
        
        // Build oscillator map (deduplication)
        this.buildOscillators();
        
        // Initialize fairness
        for (const p of this.pathways) {
            this.lastSounded.set(p.id, 0);
        }
        
        // Set foundation
        this.updateFoundation();
        
        // Initialize effects
        this.initDelay();
        this.initChorus();
        
        // Initialize layer cycle timers
        for (const name in this.LAYERS) {
            if (name === 'focus' || !this.LAYERS[name].cycleTime) continue;
            const [min, max] = this.LAYERS[name].cycleTime;
            this.layerState[name].nextCycleIn = min + Math.random() * (max - min);
        }
        
        this.port.postMessage({
            type: 'ready',
            data: {
                pathwayCount: this.pathways.length,
                oscillatorCount: this.oscillators.size,
                categories: [...this.pathwaysByCategory.keys()],
                subcategories: [...this.pathwaysBySubcategory.keys()],
            }
        });
        
        console.log(`MicrobiomeSonification v4 initialized`);
        console.log(`  ${this.pathways.length} pathways → ${this.oscillators.size} oscillators`);
    }
    
    buildOscillators() {
        this.oscillators.clear();
        this.ratioToPathways.clear();
        
        for (const p of this.pathways) {
            const key = p.ratioKey;
            
            if (!this.ratioToPathways.has(key)) {
                this.ratioToPathways.set(key, []);
            }
            this.ratioToPathways.get(key).push(p.id);
            
            if (!this.oscillators.has(key)) {
                this.oscillators.set(key, {
                    n: p.n,
                    d: p.d,
                    ratioValue: p.ratioValue,
                    frequency: p.frequency,
                    phase: Math.random() * Math.PI * 2,
                    amplitude: 0,
                    targetAmplitude: 0,
                    pan: 0,
                    chorusSend: 0,
                    peristalsisBoost: 0,
                });
            }
        }
    }
    
    // ╔════════════════════════════════════════════════════════════════╗
    // ║  HELPER FUNCTIONS                                              ║
    // ╚════════════════════════════════════════════════════════════════╝
    
    extractN(ratio) {
        if (typeof ratio === 'string' && ratio.includes('/')) {
            return parseInt(ratio.split('/')[0], 10);
        }
        const [n] = this.decimalToFraction(ratio);
        return n;
    }
    
    extractD(ratio) {
        if (typeof ratio === 'string' && ratio.includes('/')) {
            return parseInt(ratio.split('/')[1], 10);
        }
        const [, d] = this.decimalToFraction(ratio);
        return d;
    }
    
    decimalToFraction(decimal, maxDenom = 128) {
        let bestN = 1, bestD = 1, bestErr = Math.abs(decimal - 1);
        for (let d = 1; d <= maxDenom; d++) {
            const n = Math.round(decimal * d);
            const err = Math.abs(decimal - n / d);
            if (err < bestErr) {
                bestErr = err;
                bestN = n;
                bestD = d;
            }
            if (err < 0.0001) break;
        }
        const g = this.gcd(bestN, bestD);
        return [bestN / g, bestD / g];
    }
    
    gcd(a, b) {
        return b === 0 ? a : this.gcd(b, a % b);
    }
    
    randomInRange([min, max]) {
        return min + Math.random() * (max - min);
    }
    
    updateFoundation() {
        // Select drone pathways based on consonance (low n*d) and abundance
        const visible = this.getVisiblePathways();
        
        // Score by consonance and abundance
        // Lower n*d = more consonant = higher score
        const scored = visible.map(p => {
            const nxd = p.n * p.d;
            const consonanceScore = 1 / Math.log2(nxd + 1); // 1/1 scores highest
            const abundanceScore = p.abundance;
            // Weight consonance heavily - we want 1/1, 2/1, 3/2 etc
            const score = consonanceScore * 0.7 + abundanceScore * 0.3;
            return { pathway: p, score, nxd };
        });
        
        scored.sort((a, b) => b.score - a.score);
        
        const count = Math.min(this.LAYERS.drone.voiceCount, visible.length);
        
        // Clear old
        for (const p of this.pathways) {
            p.isDrone = false;
        }
        this.droneIds = new Set();
        
        // Set new drone pathways
        for (let i = 0; i < count; i++) {
            scored[i].pathway.isDrone = true;
            this.droneIds.add(scored[i].pathway.id);
        }
        
        // Initialize drone voices (they're always on, just breathing)
        this.initDroneVoices();
    }
    
    initDroneVoices() {
        const cfg = this.LAYERS.drone;
        const state = this.layerState.drone;
        
        // Clear existing
        state.activeVoices = [];
        
        // Create a voice for each drone pathway
        for (const id of this.droneIds) {
            const pathway = this.pathwayById.get(id);
            if (!pathway) continue;
            
            const breathRate = cfg.breathRate[0] + Math.random() * (cfg.breathRate[1] - cfg.breathRate[0]);
            const breathDepth = cfg.breathDepth[0] + Math.random() * (cfg.breathDepth[1] - cfg.breathDepth[0]);
            
            state.activeVoices.push({
                id: pathway.id,
                pathwayIndex: pathway.index,
                
                // Drone voices don't have attack/sustain/release - they breathe
                phase: 'drone',
                envelope: 1.0,
                
                // Breathing parameters
                breathPhase: Math.random() * Math.PI * 2,
                breathRate,
                breathDepth,
                
                layer: 'drone',
            });
        }
    }
    
    getVisiblePathways() {
        if (this.allVisible) return [...this.pathways];
        return this.pathways.filter(p => this.visibleIds.has(p.id));
    }
    
    // ╔════════════════════════════════════════════════════════════════╗
    // ║  EFFECTS INITIALIZATION                                        ║
    // ╚════════════════════════════════════════════════════════════════╝
    
    initDelay() {
        const maxMs = Math.max(this.DELAY.time1, this.DELAY.time2, this.DELAY.time3) + 50;
        const maxSamples = Math.ceil(maxMs * this.sampleRate / 1000);
        
        this.delayBuffers = {
            L1: new Float32Array(maxSamples),
            R1: new Float32Array(maxSamples),
            L2: new Float32Array(maxSamples),
            R2: new Float32Array(maxSamples),
            L3: new Float32Array(maxSamples),
            R3: new Float32Array(maxSamples),
        };
        this.delayBufferSize = maxSamples;
        this.delayWriteIdx = 0;
        
        // Filters
        this.delayFilterL = 0;
        this.delayFilterR = 0;
        this.delayHighpassL = 0;
        this.delayHighpassR = 0;
        
        // Modulation
        this.delayModPhase = 0;
        
        this.delayReady = true;
    }
    
    initChorus() {
        const cfg = this.CHORUS;
        const maxDelay = Math.ceil((cfg.baseDelay + cfg.modDepth + 5) * this.sampleRate / 1000);
        
        this.chorusBufferL = new Float32Array(maxDelay);
        this.chorusBufferR = new Float32Array(maxDelay);
        this.chorusBufferSize = maxDelay;
        this.chorusWriteIdx = 0;
        
        this.chorusPhases = cfg.rates.map(() => ({
            L: Math.random() * Math.PI * 2,
            R: Math.random() * Math.PI * 2 + Math.PI * 0.5,
        }));
        
        this.chorusFeedbackL = 0;
        this.chorusFeedbackR = 0;
        
        this.chorusReady = true;
    }
    
    // ╔════════════════════════════════════════════════════════════════╗
    // ║  MMC CYCLE UPDATE                                              ║
    // ╚════════════════════════════════════════════════════════════════╝
    
    updateMMC(dt) {
        const mmc = this.MMC;
        
        mmc.cycleTime += dt;
        mmc.phaseTime += dt;
        
        // Check phase transition
        const currentCfg = mmc.phases[mmc.currentPhase];
        const phaseDuration = currentCfg.duration * mmc.cycleDuration;
        
        if (mmc.phaseTime >= phaseDuration) {
            mmc.phaseTime = 0;
            
            const phases = ['quiescent', 'irregular', 'intense', 'transition'];
            const idx = phases.indexOf(mmc.currentPhase);
            mmc.currentPhase = phases[(idx + 1) % phases.length];
        }
        
        // Smoothly blend toward current phase's layer activity
        const targetLayers = mmc.phases[mmc.currentPhase].layers;
        const targetPeristalsis = mmc.phases[mmc.currentPhase].peristalsisRate;
        
        for (const layer in targetLayers) {
            const target = targetLayers[layer];
            const current = mmc.layerActivity[layer];
            mmc.layerActivity[layer] += (target - current) * mmc.transitionSpeed * dt;
        }
        
        mmc.peristalsisActivity += (targetPeristalsis - mmc.peristalsisActivity) * mmc.transitionSpeed * dt;
    }
    
    // ╔════════════════════════════════════════════════════════════════╗
    // ║  LAYER CYCLING                                                 ║
    // ╚════════════════════════════════════════════════════════════════╝
    
    updateLayers(dt) {
        // Update drone layer (always on, just breathing)
        this.updateDroneLayer(dt);
        
        // Update cycling layers
        for (const layerName in this.LAYERS) {
            if (layerName === 'focus' || layerName === 'ripples' || layerName === 'drone') continue;
            
            const cfg = this.LAYERS[layerName];
            const state = this.layerState[layerName];
            
            if (!cfg.cycleTime) continue;
            
            // Update existing voices
            this.updateLayerVoices(layerName, dt);
            
            // Check if layer is active (MMC controlled)
            const activity = this.MMC.layerActivity[layerName] || 0;
            if (activity < 0.05) continue;
            
            // Time for new voice?
            state.lastCycle += dt;
            if (state.lastCycle >= state.nextCycleIn) {
                // Scale spawn rate by activity
                if (Math.random() < activity) {
                    this.spawnLayerVoice(layerName);
                }
                
                const [min, max] = cfg.cycleTime;
                state.nextCycleIn = min + Math.random() * (max - min);
                state.lastCycle = 0;
            }
        }
        
        // Update ripples separately (they're triggered, not cycled)
        this.updateRipples(dt);
    }
    
    updateDroneLayer(dt) {
        const state = this.layerState.drone;
        if (!state) return;
        
        const twoPi = Math.PI * 2;
        
        for (const voice of state.activeVoices) {
            // Update breath phase
            voice.breathPhase += twoPi * voice.breathRate * dt;
            if (voice.breathPhase > twoPi) voice.breathPhase -= twoPi;
            
            // Calculate breathing envelope (always positive, centered around 1)
            // Use sin^2 for smoother breathing
            const breath = Math.sin(voice.breathPhase);
            voice.envelope = 1 - voice.breathDepth + voice.breathDepth * (breath * breath);
        }
    }
    
    updateLayerVoices(layerName, dt) {
        const state = this.layerState[layerName];
        const cfg = this.LAYERS[layerName];
        
        for (let i = state.activeVoices.length - 1; i >= 0; i--) {
            const voice = state.activeVoices[i];
            voice.time += dt;
            
            // Update envelope
            if (voice.phase === 'attack') {
                voice.envelope = voice.time / voice.attackTime;
                if (voice.time >= voice.attackTime) {
                    voice.phase = 'sustain';
                    voice.time = 0;
                    voice.envelope = 1;
                }
            } else if (voice.phase === 'sustain') {
                // Gentle breathing during sustain
                voice.envelope = 1 + Math.sin(voice.time * 0.5) * 0.05;
                if (voice.time >= voice.sustainTime) {
                    voice.phase = 'release';
                    voice.time = 0;
                }
            } else if (voice.phase === 'release') {
                voice.envelope = 1 - (voice.time / voice.releaseTime);
                if (voice.time >= voice.releaseTime) {
                    state.activeVoices.splice(i, 1);
                    continue;
                }
            }
            
            voice.envelope = Math.max(0, Math.min(1.1, voice.envelope));
        }
    }
    
    spawnLayerVoice(layerName) {
        const cfg = this.LAYERS[layerName];
        const state = this.layerState[layerName];
        
        // Check voice limit
        if (state.activeVoices.length >= cfg.voiceCount) return;
        
        // Select pathway based on layer type
        let pathway = null;
        
        if (cfg.categoryRotation) {
            // Sustain: rotate through categories
            const categories = [...this.pathwaysByCategory.keys()];
            const cat = categories[state.categoryIndex % categories.length];
            state.categoryIndex++;
            
            const catPathways = this.pathwaysByCategory.get(cat) || [];
            const visible = catPathways.filter(p => this.allVisible || this.visibleIds.has(p.id));
            if (visible.length > 0) {
                // Bias toward more abundant, with fairness
                pathway = this.selectWithFairness(visible);
            }
        } else if (cfg.subcategoryRotation) {
            // Movement: rotate through subcategories
            const subcats = [...this.pathwaysBySubcategory.keys()];
            const subcat = subcats[state.subcategoryIndex % subcats.length];
            state.subcategoryIndex++;
            
            const subPathways = this.pathwaysBySubcategory.get(subcat) || [];
            const visible = subPathways.filter(p => this.allVisible || this.visibleIds.has(p.id));
            if (visible.length > 0) {
                pathway = this.selectWithFairness(visible);
            }
        } else if (cfg.randomSelection) {
            // Texture/Shimmer: random from visible
            const visible = this.getVisiblePathways();
            if (visible.length > 0) {
                pathway = this.selectWithFairness(visible);
            }
        }
        
        if (!pathway) return;
        
        // Create voice
        const env = cfg.envelope;
        const voice = {
            id: pathway.id,
            pathwayIndex: pathway.index,
            
            phase: 'attack',
            time: 0,
            envelope: 0,
            
            attackTime: env.attack[0] + Math.random() * (env.attack[1] - env.attack[0]),
            sustainTime: env.sustain[0] + Math.random() * (env.sustain[1] - env.sustain[0]),
            releaseTime: env.release[0] + Math.random() * (env.release[1] - env.release[0]),
            
            layer: layerName,
        };
        
        state.activeVoices.push(voice);
        this.lastSounded.set(pathway.id, this.time);
        
        // Maybe trigger ripples (not from drone or texture)
        if (layerName !== 'drone' && layerName !== 'texture' && 
            this.RIPPLES.enabled && Math.random() < this.RIPPLES.triggerChance) {
            this.triggerRipples(pathway);
        }
    }
    
    selectWithFairness(pathways) {
        // Combine abundance bias with fairness (how long since last played)
        const scored = pathways.map(p => {
            const timeSince = this.time - (this.lastSounded.get(p.id) || 0);
            const fairnessBonus = Math.min(timeSince / 30, 1) * 0.5;
            const score = p.abundance * 0.5 + fairnessBonus + Math.random() * 0.3;
            return { pathway: p, score };
        });
        
        scored.sort((a, b) => b.score - a.score);
        
        // Pick from top candidates
        const topN = Math.min(5, scored.length);
        return scored[Math.floor(Math.random() * topN)].pathway;
    }
    
    // ╔════════════════════════════════════════════════════════════════╗
    // ║  RIPPLES                                                       ║
    // ╚════════════════════════════════════════════════════════════════╝
    
    triggerRipples(sourcePathway) {
        const cfg = this.RIPPLES;
        const activity = this.MMC.layerActivity.ripples || 0;
        if (activity < 0.1) return;
        
        let count = 0;
        
        for (const [relName, rel] of Object.entries(cfg.relations)) {
            if (count >= cfg.maxRipples) break;
            if (Math.random() > rel.chance * activity) continue;
            
            for (const mult of rel.multipliers) {
                if (count >= cfg.maxRipples) break;
                
                const targetRatio = sourcePathway.ratioValue * mult;
                
                // Find closest pathway
                const visible = this.getVisiblePathways();
                let closest = null;
                let closestDist = Infinity;
                
                for (const p of visible) {
                    if (p.id === sourcePathway.id) continue;
                    const dist = Math.abs(Math.log2(p.ratioValue / targetRatio));
                    if (dist < closestDist && dist < 0.1) { // Within ~10% 
                        closestDist = dist;
                        closest = p;
                    }
                }
                
                if (closest) {
                    const delay = rel.delay[0] + Math.random() * (rel.delay[1] - rel.delay[0]);
                    cfg.pending.push({
                        id: closest.id,
                        triggerTime: this.time + delay,
                        volume: cfg.volumeDecay,
                        relation: relName,
                    });
                    count++;
                }
            }
        }
    }
    
    updateRipples(dt) {
        const cfg = this.RIPPLES;
        const state = this.layerState.ripples;
        const layerCfg = this.LAYERS.ripples;
        
        // Update existing ripple voices
        for (let i = state.activeVoices.length - 1; i >= 0; i--) {
            const voice = state.activeVoices[i];
            voice.time += dt;
            
            if (voice.phase === 'attack') {
                voice.envelope = voice.time / voice.attackTime;
                if (voice.time >= voice.attackTime) {
                    voice.phase = 'sustain';
                    voice.time = 0;
                    voice.envelope = 1;
                }
            } else if (voice.phase === 'sustain') {
                if (voice.time >= voice.sustainTime) {
                    voice.phase = 'release';
                    voice.time = 0;
                }
            } else if (voice.phase === 'release') {
                voice.envelope = 1 - (voice.time / voice.releaseTime);
                if (voice.time >= voice.releaseTime) {
                    state.activeVoices.splice(i, 1);
                }
            }
            
            voice.envelope = Math.max(0, Math.min(1, voice.envelope));
        }
        
        // Process pending ripples
        for (let i = cfg.pending.length - 1; i >= 0; i--) {
            const pending = cfg.pending[i];
            if (this.time >= pending.triggerTime) {
                cfg.pending.splice(i, 1);
                
                if (state.activeVoices.length >= layerCfg.voiceCount) continue;
                
                const pathway = this.pathwayById.get(pending.id);
                if (!pathway) continue;
                
                const env = layerCfg.envelope;
                state.activeVoices.push({
                    id: pending.id,
                    pathwayIndex: pathway.index,
                    
                    phase: 'attack',
                    time: 0,
                    envelope: 0,
                    volumeMult: pending.volume,
                    
                    attackTime: env.attack[0] + Math.random() * (env.attack[1] - env.attack[0]),
                    sustainTime: env.sustain[0] + Math.random() * (env.sustain[1] - env.sustain[0]),
                    releaseTime: env.release[0] + Math.random() * (env.release[1] - env.release[0]),
                    
                    layer: 'ripples',
                    relation: pending.relation,
                });
            }
        }
    }
    
    // ╔════════════════════════════════════════════════════════════════╗
    // ║  PERISTALSIS - FREQUENCY SPACE WAVES                           ║
    // ╚════════════════════════════════════════════════════════════════╝
    
    updatePeristalsis(dt) {
        if (!this.PERISTALSIS.enabled) return;
        
        const cfg = this.PERISTALSIS;
        const activity = this.MMC.peristalsisActivity;
        
        // Maybe spawn wave
        if (activity > 0.1 && Math.random() < cfg.spawnRate * activity * dt) {
            if (cfg.waves.length < cfg.maxWaves) {
                this.spawnPeristalticWave();
            }
        }
        
        // Update waves
        for (let i = cfg.waves.length - 1; i >= 0; i--) {
            const wave = cfg.waves[i];
            
            wave.position += wave.speed * wave.direction * dt;
            wave.age += dt;
            
            // Envelope
            if (wave.age < 0.5) {
                wave.envelope = wave.age / 0.5;
            } else if (wave.position < cfg.minFreq - wave.width || wave.position > cfg.maxFreq + wave.width) {
                wave.envelope *= 0.9;
            }
            
            // Remove finished
            if (wave.envelope < 0.01) {
                cfg.waves.splice(i, 1);
            }
        }
        
        // Apply to oscillators
        for (const osc of this.oscillators.values()) {
            let boost = 0;
            
            for (const wave of cfg.waves) {
                const dist = Math.abs(osc.frequency - wave.position);
                if (dist < wave.width) {
                    const shape = Math.cos((dist / wave.width) * Math.PI * 0.5);
                    boost += shape * wave.amplitude * wave.envelope;
                }
            }
            
            osc.peristalsisBoost = boost;
        }
    }
    
    spawnPeristalticWave() {
        const cfg = this.PERISTALSIS;
        const waveCfg = cfg.wave;
        
        const direction = waveCfg.direction === 'both' 
            ? (Math.random() < 0.5 ? 1 : -1)
            : (waveCfg.direction === 'up' ? 1 : -1);
        
        const startPos = direction > 0 ? cfg.minFreq : cfg.maxFreq;
        
        cfg.waves.push({
            position: startPos,
            speed: waveCfg.speed[0] + Math.random() * (waveCfg.speed[1] - waveCfg.speed[0]),
            width: waveCfg.width[0] + Math.random() * (waveCfg.width[1] - waveCfg.width[0]),
            amplitude: waveCfg.amplitude,
            direction,
            age: 0,
            envelope: 0,
        });
    }
    
    // ╔════════════════════════════════════════════════════════════════╗
    // ║  MODULATION                                                    ║
    // ╚════════════════════════════════════════════════════════════════╝
    
    updateModulation(dt) {
        const twoPi = Math.PI * 2;
        
        for (const mod of Object.values(this.MODULATION)) {
            mod.phase += twoPi * mod.rate * dt;
            if (mod.phase > twoPi) mod.phase -= twoPi;
        }
        
        // Calculate combined modulation
        let combined = 1.0;
        for (const mod of Object.values(this.MODULATION)) {
            combined *= 1 + Math.sin(mod.phase) * mod.depth;
        }
        
        return combined;
    }
    
    // ╔════════════════════════════════════════════════════════════════╗
    // ║  OSCILLATOR AGGREGATION                                        ║
    // ╚════════════════════════════════════════════════════════════════╝
    
    aggregateOscillators() {
        // Reset
        for (const osc of this.oscillators.values()) {
            osc.targetAmplitude = 0;
            osc.pan = 0;
            osc.chorusSend = 0;
        }
        
        const focusActive = this.focusEnvelope > 0.01;
        const duckAmount = focusActive 
            ? this.LAYERS.focus.duckOthers + (1 - this.LAYERS.focus.duckOthers) * (1 - this.focusEnvelope)
            : 1.0;
        
        // Process each layer
        for (const layerName in this.layerState) {
            const state = this.layerState[layerName];
            const cfg = this.LAYERS[layerName];
            
            if (!cfg) continue;
            
            const layerActivity = this.MMC.layerActivity[layerName] || 1.0;
            const layerMix = cfg.mixLevel * layerActivity;
            
            for (const voice of state.activeVoices) {
                const pathway = this.pathways[voice.pathwayIndex];
                if (!pathway) continue;
                
                const osc = this.oscillators.get(pathway.ratioKey);
                if (!osc) continue;
                
                let volume = pathway.baseVolume * voice.envelope * layerMix;
                volume *= (voice.volumeMult || 1);
                volume *= duckAmount;
                volume *= this.categoryGains[pathway.category] ?? 1.0;
                
                // Apply MS amplitude scaling
                volume *= (pathway.msAmplitudeScale ?? 1.0);
                
                osc.targetAmplitude += volume;
                osc.pan += pathway.basePan * volume;
                osc.chorusSend += pathway.chorusSend * volume;
            }
        }
        
        // Focus pathway
        if (this.focusedId && this.focusEnvelope > 0.01) {
            const pathway = this.pathwayById.get(this.focusedId);
            if (pathway) {
                const osc = this.oscillators.get(pathway.ratioKey);
                if (osc) {
                    let focusVol = this.LAYERS.focus.volume * this.focusEnvelope;
                    // Apply MS scaling to focus too
                    focusVol *= (pathway.msAmplitudeScale ?? 1.0);
                    osc.targetAmplitude += focusVol;
                    osc.pan += pathway.basePan * focusVol;
                    osc.chorusSend += pathway.chorusSend * focusVol;
                }
            }
        }
        
        // Normalize and smooth
        for (const osc of this.oscillators.values()) {
            if (osc.targetAmplitude > 0) {
                osc.pan /= osc.targetAmplitude;
                osc.chorusSend /= osc.targetAmplitude;
            }
            osc.pan = Math.max(-1, Math.min(1, osc.pan));
            osc.chorusSend = Math.min(1, osc.chorusSend);
            
            // Add peristalsis boost
            osc.targetAmplitude *= (1 + (osc.peristalsisBoost || 0));
            
            // Smooth amplitude changes
            osc.amplitude += (osc.targetAmplitude - osc.amplitude) * 0.08;
        }
    }
    
    // ╔════════════════════════════════════════════════════════════════╗
    // ║  FOCUS ENVELOPE                                                ║
    // ╚════════════════════════════════════════════════════════════════╝
    
    updateFocus(dt) {
        const cfg = this.LAYERS.focus;
        const rate = this.focusTarget > this.focusEnvelope
            ? 1.0 / cfg.attackTime
            : 1.0 / cfg.releaseTime;
        
        this.focusEnvelope += (this.focusTarget - this.focusEnvelope) * rate * dt * 8;
    }
    
    // ╔════════════════════════════════════════════════════════════════╗
    // ║  EFFECTS PROCESSING                                            ║
    // ╚════════════════════════════════════════════════════════════════╝
    
    processChorus(dryL, dryR, outL, outR, blockSize) {
        const cfg = this.CHORUS;
        if (!cfg.enabled || !this.chorusReady) {
            outL.set(dryL);
            outR.set(dryR);
            return;
        }
        
        const sr = this.sampleRate;
        const twoPi = Math.PI * 2;
        const baseDelay = cfg.baseDelay * sr / 1000;
        const modDepth = cfg.modDepth * sr / 1000;
        
        for (let i = 0; i < blockSize; i++) {
            this.chorusBufferL[this.chorusWriteIdx] = dryL[i] + this.chorusFeedbackL * cfg.feedback;
            this.chorusBufferR[this.chorusWriteIdx] = dryR[i] + this.chorusFeedbackR * cfg.feedback;
            
            let wetL = 0, wetR = 0;
            
            for (let v = 0; v < cfg.voices; v++) {
                this.chorusPhases[v].L += twoPi * cfg.rates[v] / sr;
                this.chorusPhases[v].R += twoPi * cfg.rates[v] / sr;
                
                const modL = Math.sin(this.chorusPhases[v].L);
                const modR = Math.sin(this.chorusPhases[v].R);
                
                wetL += this.readDelayBuffer(this.chorusBufferL, this.chorusBufferSize, 
                    this.chorusWriteIdx, baseDelay + modL * modDepth);
                wetR += this.readDelayBuffer(this.chorusBufferR, this.chorusBufferSize,
                    this.chorusWriteIdx, baseDelay + modR * modDepth);
            }
            
            wetL /= cfg.voices;
            wetR /= cfg.voices;
            
            this.chorusFeedbackL = wetL;
            this.chorusFeedbackR = wetR;
            
            outL[i] = dryL[i] * (1 - cfg.wetMix) + wetL * cfg.wetMix;
            outR[i] = dryR[i] * (1 - cfg.wetMix) + wetR * cfg.wetMix;
            
            this.chorusWriteIdx = (this.chorusWriteIdx + 1) % this.chorusBufferSize;
        }
    }
    
    processDelay(inL, inR, outL, outR, blockSize) {
        if (!this.delayReady) {
            outL.set(inL);
            outR.set(inR);
            return;
        }
        
        const cfg = this.DELAY;
        const sr = this.sampleRate;
        const twoPi = Math.PI * 2;
        
        const delay1 = cfg.time1 * sr / 1000;
        const delay2 = cfg.time2 * sr / 1000;
        const delay3 = cfg.time3 * sr / 1000;
        
        const highCut = cfg.highCut;
        const lowCut = cfg.lowCut;
        
        for (let i = 0; i < blockSize; i++) {
            // Modulate delay time slightly
            this.delayModPhase += twoPi * cfg.modRate / sr;
            const modOffset = Math.sin(this.delayModPhase) * cfg.modDepth * sr / 1000;
            
            // Read from delay lines
            const tap1L = this.readDelayBuffer(this.delayBuffers.L1, this.delayBufferSize, 
                this.delayWriteIdx, delay1 + modOffset);
            const tap1R = this.readDelayBuffer(this.delayBuffers.R1, this.delayBufferSize,
                this.delayWriteIdx, delay1 - modOffset);
            
            const tap2L = this.readDelayBuffer(this.delayBuffers.L2, this.delayBufferSize,
                this.delayWriteIdx, delay2 + modOffset * 0.7);
            const tap2R = this.readDelayBuffer(this.delayBuffers.R2, this.delayBufferSize,
                this.delayWriteIdx, delay2 - modOffset * 0.7);
            
            const tap3L = this.readDelayBuffer(this.delayBuffers.L3, this.delayBufferSize,
                this.delayWriteIdx, delay3);
            const tap3R = this.readDelayBuffer(this.delayBuffers.R3, this.delayBufferSize,
                this.delayWriteIdx, delay3);
            
            // Combine taps with decreasing volume
            let wetL = tap1L * 0.5 + tap2L * 0.3 + tap3L * 0.2;
            let wetR = tap1R * 0.5 + tap2R * 0.3 + tap3R * 0.2;
            
            // Apply filters (lowpass and highpass)
            this.delayFilterL += (wetL - this.delayFilterL) * highCut;
            this.delayFilterR += (wetR - this.delayFilterR) * highCut;
            wetL = this.delayFilterL;
            wetR = this.delayFilterR;
            
            this.delayHighpassL += (wetL - this.delayHighpassL) * (1 - lowCut);
            this.delayHighpassR += (wetR - this.delayHighpassR) * (1 - lowCut);
            wetL = wetL - this.delayHighpassL * lowCut;
            wetR = wetR - this.delayHighpassR * lowCut;
            
            // Write to delay lines with feedback and cross-feedback
            this.delayBuffers.L1[this.delayWriteIdx] = inL[i] + wetL * cfg.feedback + wetR * cfg.crossFeedback;
            this.delayBuffers.R1[this.delayWriteIdx] = inR[i] + wetR * cfg.feedback + wetL * cfg.crossFeedback;
            this.delayBuffers.L2[this.delayWriteIdx] = tap1L * cfg.feedback * 0.7;
            this.delayBuffers.R2[this.delayWriteIdx] = tap1R * cfg.feedback * 0.7;
            this.delayBuffers.L3[this.delayWriteIdx] = tap2L * cfg.feedback * 0.5;
            this.delayBuffers.R3[this.delayWriteIdx] = tap2R * cfg.feedback * 0.5;
            
            // Output
            outL[i] = inL[i] + wetL * cfg.wetMix;
            outR[i] = inR[i] + wetR * cfg.wetMix;
            
            this.delayWriteIdx = (this.delayWriteIdx + 1) % this.delayBufferSize;
        }
    }
    
    readDelayBuffer(buffer, size, writeIdx, delaySamples) {
        const readPos = writeIdx - delaySamples;
        const readIdx = ((readPos % size) + size) % size;
        const idx0 = Math.floor(readIdx);
        const idx1 = (idx0 + 1) % size;
        const frac = readIdx - idx0;
        return buffer[idx0] * (1 - frac) + buffer[idx1] * frac;
    }
    
    // ╔════════════════════════════════════════════════════════════════╗
    // ║  MAIN PROCESS                                                  ║
    // ╚════════════════════════════════════════════════════════════════╝
    
    process(inputs, outputs, parameters) {
        const output = outputs[0];
        const channelL = output[0];
        const channelR = output[1] || output[0];
        
        if (!channelL || this.pathways.length === 0) return true;
        
        const blockSize = channelL.length;
        const sr = globalThis.sampleRate || 48000;
        this.sampleRate = sr;
        const twoPi = Math.PI * 2;
        const dt = blockSize / sr;
        
        this.time += dt;
        
        // ═══════════════════════════════════════════════════════════
        // UPDATE SYSTEMS
        // ═══════════════════════════════════════════════════════════
        
        this.updateMMC(dt);
        this.updateFocus(dt);
        this.updateLayers(dt);
        this.updatePeristalsis(dt);
        const globalMod = this.updateModulation(dt);
        
        this.aggregateOscillators();
        
        // ═══════════════════════════════════════════════════════════
        // RENDER OSCILLATORS
        // ═══════════════════════════════════════════════════════════
        
        const dryL = new Float32Array(blockSize);
        const dryR = new Float32Array(blockSize);
        
        for (const osc of this.oscillators.values()) {
            if (osc.amplitude < 0.0001) continue;
            
            const freq = this.fundamental * osc.ratioValue;
            const phaseInc = (twoPi * freq) / sr;
            
            const panAngle = (osc.pan + 1) * Math.PI / 4;
            const gainL = Math.cos(panAngle);
            const gainR = Math.sin(panAngle);
            
            for (let i = 0; i < blockSize; i++) {
                const sample = Math.sin(osc.phase) * osc.amplitude * globalMod * this.masterVolume;
                
                dryL[i] += sample * gainL;
                dryR[i] += sample * gainR;
                
                osc.phase += phaseInc;
                if (osc.phase > twoPi) osc.phase -= twoPi;
            }
        }
        
        // ═══════════════════════════════════════════════════════════
        // EFFECTS CHAIN
        // ═══════════════════════════════════════════════════════════
        
        const postChorusL = new Float32Array(blockSize);
        const postChorusR = new Float32Array(blockSize);
        
        this.processChorus(dryL, dryR, postChorusL, postChorusR, blockSize);
        this.processDelay(postChorusL, postChorusR, channelL, channelR, blockSize);
        
        // ═══════════════════════════════════════════════════════════
        // SOFT LIMITING
        // ═══════════════════════════════════════════════════════════
        
        for (let i = 0; i < blockSize; i++) {
            channelL[i] = Math.tanh(channelL[i] * 0.65) * 0.88;
            if (channelR !== channelL) {
                channelR[i] = Math.tanh(channelR[i] * 0.65) * 0.88;
            }
        }
        
        // ═══════════════════════════════════════════════════════════
        // REPORTING
        // ═══════════════════════════════════════════════════════════
        
        if (this.time - this.lastReport > this.reportInterval) {
            this.report();
            this.lastReport = this.time;
        }
        
        return true;
    }
    
    // ╔════════════════════════════════════════════════════════════════╗
    // ║  REPORTING                                                     ║
    // ╚════════════════════════════════════════════════════════════════╝
    
    report() {
        // Build pathway modulation map for visualization
        const pathwayModulation = {};
        for (const layerName in this.layerState) {
            for (const voice of this.layerState[layerName].activeVoices) {
                const p = this.pathways[voice.pathwayIndex];
                if (p) {
                    // Combine if pathway is in multiple layers
                    if (!pathwayModulation[p.id]) {
                        pathwayModulation[p.id] = {
                            id: p.id,
                            lfoMod: voice.envelope,
                            pan: p.basePan,
                            layer: voice.layer,
                            envelope: voice.envelope,
                        };
                    } else {
                        // Take max envelope if in multiple layers
                        pathwayModulation[p.id].lfoMod = Math.max(
                            pathwayModulation[p.id].lfoMod, 
                            voice.envelope
                        );
                    }
                }
            }
        }
        
        // Convert to array
        const activePathways = Object.values(pathwayModulation);
        
        // Layer voice counts
        const layerCounts = {};
        for (const name in this.layerState) {
            layerCounts[name] = this.layerState[name].activeVoices.length;
        }
        
        // Active oscillators
        const activeOscillators = [...this.oscillators.values()].filter(o => o.amplitude > 0.001).length;
        
        // Peristaltic waves - convert to phase for backward compat
        const peristalsisPhase = this.PERISTALSIS.waves.length > 0 
            ? (this.PERISTALSIS.waves[0].position / 9600) * Math.PI * 2 
            : this.time * 0.5;
        
        // Send BOTH formats for compatibility
        this.port.postMessage({
            type: 'modulation',  // Old format name for HTML compatibility
            data: {
                time: this.time,
                peristalsisPhase,
                
                // Per-pathway modulation (what HTML expects)
                pathways: activePathways,
                
                // Category info
                categories: Object.fromEntries(
                    Object.keys(this.CATEGORIES).map(cat => [cat, {
                        pan: this.CATEGORIES[cat].panHome,
                    }])
                ),
                
                // New v4 data
                mmcPhase: this.MMC.currentPhase,
                mmcLayerActivity: { ...this.MMC.layerActivity },
                layers: layerCounts,
                activeOscillators,
                msMode: this.msMode || false,
                
                // Focus
                focusedId: this.focusedId,
                focusEnvelope: this.focusEnvelope,
            },
        });
    }
    
    manualTrigger(id, layerName) {
        const pathway = this.pathwayById.get(id);
        if (!pathway) return;
        
        const cfg = this.LAYERS[layerName];
        const state = this.layerState[layerName];
        if (!cfg || !state) return;
        
        const env = cfg.envelope;
        state.activeVoices.push({
            id: pathway.id,
            pathwayIndex: pathway.index,
            phase: 'attack',
            time: 0,
            envelope: 0,
            attackTime: env.attack[0],
            sustainTime: env.sustain[0],
            releaseTime: env.release[0],
            layer: layerName,
        });
        
        this.lastSounded.set(id, this.time);
    }
}

registerProcessor('microbiome-sonification', MicrobiomeSonification);