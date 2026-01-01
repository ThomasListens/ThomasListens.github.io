/**
 * MicrobiomeSonification v3
 * With Peristaltic Rhythms, Subcategory Polyrhythms, and Living Organisms
 * 
 * Scientific basis:
 * - Peristalsis modeled on actual gut motility patterns (MMC phases)
 * - Subcategory rhythms create organic polyrhythms from pathway groupings
 * - Organisms represent bacterial activity and metabolic flux
 */

class MicrobiomeSonification extends AudioWorkletProcessor {
    constructor() {
        super();
        
        // ╔════════════════════════════════════════════════════════════╗
        // ║  LAYER CONFIGURATION                                       ║
        // ╚════════════════════════════════════════════════════════════╝
        
        this.LAYERS = {
            focus: {
                volume: 0.5,
                duckOthers: 0.15,
                attackTime: 0.08,
                releaseTime: 0.3,
            },
            
            foundation: {
                count: 12,
                volume: 0.18,
                breathRates: [0.012, 0.019, 0.031],
                breathDepths: [0.15, 0.10, 0.06],
            },
            
            slow: {
                name: 'slow',
                maxVoices: 24,
                cycleTime: [5.0, 10.0],
                envelope: {
                    attack: [2.0, 4.0],
                    sustain: [6.0, 15.0],
                    release: [3.0, 5.0],
                },
                volume: 0.20,
            },
            
            medium: {
                name: 'medium',
                maxVoices: 48,
                cycleTime: [1.0, 3.0],
                envelope: {
                    attack: [0.5, 1.5],
                    sustain: [2.0, 5.0],
                    release: [1.0, 2.0],
                },
                volume: 0.15,
            },
            
            fast: {
                name: 'fast',
                maxVoices: 64,
                cycleTime: [0.08, 0.35],
                envelope: {
                    attack: [0.008, 0.025],
                    sustain: [0.03, 0.10],
                    release: [0.15, 0.45],
                },
                volume: 0.10,
                envelopeShape: 'bubble',
            },
        };
        
        // ╔════════════════════════════════════════════════════════════╗
        // ║  PERISTALSIS CONFIGURATION                                 ║
        // ║  Based on actual gut motility patterns                     ║
        // ╚════════════════════════════════════════════════════════════╝
        
        this.PERISTALSIS = {
            enabled: true,
            
            // Migrating Motor Complex - the "housekeeper" of the gut
            // Real MMC cycles ~90-120 minutes, we compress for musicality
            mmc: {
                cycleDuration: 45,        // Compressed from ~100 minutes
                phases: {
                    // Phase I: Quiescence (40-60% of cycle)
                    quiescent: { 
                        duration: 0.45,   // Fraction of cycle
                        activity: 0.1,
                        contractionRate: 0.02,
                    },
                    // Phase II: Irregular contractions (20-30%)
                    irregular: { 
                        duration: 0.30,
                        activity: 0.5,
                        contractionRate: 0.08,
                        irregularity: 0.4, // Random variation
                    },
                    // Phase III: Regular intense contractions (5-10%)
                    intense: { 
                        duration: 0.15,
                        activity: 1.0,
                        contractionRate: 0.15,
                    },
                    // Phase IV: Transition (brief)
                    transition: { 
                        duration: 0.10,
                        activity: 0.3,
                        contractionRate: 0.05,
                    },
                },
                currentPhase: 'quiescent',
                phaseTime: 0,
            },
            
            // Peristaltic waves sweep through ratio space
            // Like actual waves moving through the intestine
            contractions: {
                baseRate: 0.08,           // Base contraction frequency
                travelSpeed: 0.12,        // How fast wave moves through ratio space
                wavelength: 0.4,          // Width in log-ratio space
                amplitude: 0.6,           // Volume influence
                
                // Multiple simultaneous waves (like real gut segments)
                maxWaves: 3,
                spawnChance: 0.3,         // Per cycle
            },
            
            // Segmentation - mixing contractions (don't travel)
            segmentation: {
                enabled: true,
                rate: 0.12,               // Faster than peristalsis
                regions: 5,               // Number of mixing regions
                depth: 0.3,               // Volume modulation depth
            },
            
            // Regional variation (scientifically accurate)
            regions: {
                // Lower ratios = "proximal" gut (more active)
                proximal: { ratioRange: [0.125, 0.5], activityMult: 1.3 },
                // Middle ratios = "mid" gut  
                mid: { ratioRange: [0.5, 2], activityMult: 1.0 },
                // Higher ratios = "distal" gut (slower, more rhythmic)
                distal: { ratioRange: [2, 16], activityMult: 0.7 },
            },
        };
        
        // ╔════════════════════════════════════════════════════════════╗
        // ║  SUBCATEGORY RHYTHM CONFIGURATION                          ║
        // ║  Natural polyrhythms from pathway groupings                ║
        // ╚════════════════════════════════════════════════════════════╝
        
        this.SUBCATEGORY_RHYTHM = {
            enabled: true,
            
            // Each subcategory pulses at its own rate
            // Rate derived from subcategory size → natural polyrhythms
            baseRate: 0.03,              // Slowest pulse rate
            maxRate: 0.15,               // Fastest pulse rate
            
            // How subcategory size affects rhythm
            sizeInfluence: 0.6,          // Larger = slower, creates contrast
            
            // Pulse shape
            pulseAttack: 0.3,            // Fraction of cycle
            pulseSustain: 0.2,
            pulseRelease: 0.5,
            pulseDepth: 0.4,             // Volume modulation amount
            
            // Phase relationships
            phaseSpread: true,           // Spread initial phases
            phaseDrift: 0.002,           // Slow drift for evolution
            
            // Cross-influence between related subcategories
            crossInfluence: {
                enabled: true,
                strength: 0.2,
                // Subcategories in same category influence each other
            },
            
            // Computed at init
            subcategories: new Map(),    // subcategory -> rhythm state
        };
        
        // ╔════════════════════════════════════════════════════════════╗
        // ║  LIVING ORGANISMS CONFIGURATION                            ║
        // ║  Represent bacterial activity and metabolic flux           ║
        // ╚════════════════════════════════════════════════════════════╝
        
        this.ORGANISMS = {
            enabled: true,
            maxCount: 8,
            spawnInterval: [10, 25],     // Seconds between spawns
            
            types: {
                // Represents a bacterial genus "exploring" metabolic space
                bacterium: {
                    weight: 0.4,
                    lifespan: [15, 40],
                    speed: [0.02, 0.06],          // Movement in ratio space
                    influenceRadius: 0.3,         // How far it affects pathways
                    influenceStrength: 0.5,
                    movement: 'brownian',         // Random walk
                    preferredCategories: null,    // null = any
                    activationChance: 0.4,        // Chance to trigger pathway
                    color: 'bacterial',
                },
                
                // Represents metabolic flux through connected pathways
                metabolicFlux: {
                    weight: 0.3,
                    lifespan: [8, 20],
                    speed: [0.04, 0.10],
                    influenceRadius: 0.15,
                    influenceStrength: 0.7,
                    movement: 'directed',         // Follows pathway connections
                    preferredCategories: ['energy', 'biosynthesis'],
                    activationChance: 0.6,
                    chainActivation: true,        // Can trigger pathway chains
                    color: 'flux',
                },
                
                // Represents cross-feeding between species
                crossFeeder: {
                    weight: 0.2,
                    lifespan: [20, 50],
                    speed: [0.01, 0.03],
                    influenceRadius: 0.5,
                    influenceStrength: 0.3,
                    movement: 'oscillating',      // Back and forth
                    bridgeCategories: true,       // Moves between categories
                    activationChance: 0.25,
                    color: 'crossfeed',
                },
                
                // Represents a "bloom" event - rapid bacterial growth
                bloom: {
                    weight: 0.1,
                    lifespan: [5, 12],
                    speed: [0, 0.01],             // Mostly stationary
                    influenceRadius: 0.6,
                    influenceStrength: 0.8,
                    movement: 'expanding',        // Grows outward
                    expansionRate: 0.02,
                    activationChance: 0.7,
                    maxExpansion: 1.2,
                    color: 'bloom',
                },
            },
            
            // Behavioral parameters
            behavior: {
                avoidFocused: true,              // Stay away from focused pathway
                attractToActivity: 0.3,          // Slight attraction to active areas
                categoryAffinity: 0.5,           // Tendency to stay in preferred category
                boundaryBehavior: 'reflect',     // What to do at ratio bounds
            },
        };
        
        // ╔════════════════════════════════════════════════════════════╗
        // ║  RIPPLE CONFIGURATION                                      ║
        // ╚════════════════════════════════════════════════════════════╝
        
        this.RIPPLE = {
            enabled: true,
            triggerChance: 0.5,
            
            spatial: {
                enabled: true,
                count: [1, 3],
                maxDistance: 0.12,
                delayRange: [0.015, 0.06],
                volumeDecay: 0.7,
            },
            
            consonance: {
                enabled: true,
                chance: 0.45,
                count: [1, 2],
                delayRange: [0.03, 0.12],
                volumeDecay: 0.65,
                mode: 'adaptive',
                maxNxdDiff: 20,
                simplifyRange: [0.25, 0.65],
                adaptiveThreshold: 50,
            },
            
            chain: {
                enabled: true,
                maxDepth: 2,
                decayPerGen: 0.5,
            },
        };
        
        // ╔════════════════════════════════════════════════════════════╗
        // ║  MODULATION CONFIGURATION                                  ║
        // ╚════════════════════════════════════════════════════════════╝
        
        this.MOD_CONFIG = {
            globalLFOs: [
                { rate: 0.013, depth: 0.03 },
                { rate: 0.037, depth: 0.025 },
                { rate: 0.089, depth: 0.015 },
            ],
            
            pathwayLFO: {
                minDepth: 0.04,
                maxDepth: 0.18,
                minRate: 0.04,
                maxRate: 0.18,
            },
            
            tide: {
                rate: 0.006,
                depth: 0.12,
            },
        };
        
        // ╔════════════════════════════════════════════════════════════╗
        // ║  EFFECTS CONFIGURATION                                     ║
        // ╚════════════════════════════════════════════════════════════╝
        
        this.CHORUS = {
            voices: 3,
            baseDelayMs: 15,
            modDepthMs: 5,
            rates: [0.11, 0.17, 0.23],
            maxSend: 0.32,
            feedback: 0.1,
        };
        
        this.DELAY = {
            timeMs: 180,
            feedback: 0.28,
            wetMix: 0.20,
            highCut: 0.55,
        };
        
        // ╔════════════════════════════════════════════════════════════╗
        // ║  CATEGORY CONFIGURATION                                    ║
        // ╚════════════════════════════════════════════════════════════╝
        
        this.CATEGORIES = {
            energy: {
                panHome: 0.0, panRange: 0.3,
                chorusSendBase: 0.35, chorusSendRate: 0.03,
            },
            biosynthesis: {
                panHome: 0.45, panRange: 0.25,
                chorusSendBase: 0.4, chorusSendRate: 0.04,
            },
            degradation: {
                panHome: -0.45, panRange: 0.25,
                chorusSendBase: 0.32, chorusSendRate: 0.025,
            },
            salvage: {
                panHome: 0.25, panRange: 0.2,
                chorusSendBase: 0.38, chorusSendRate: 0.035,
            },
            superpathways: {
                panHome: 0.0, panRange: 0.4,
                chorusSendBase: 0.45, chorusSendRate: 0.045,
            },
            other: {
                panHome: -0.25, panRange: 0.25,
                chorusSendBase: 0.3, chorusSendRate: 0.03,
            },
        };
        
        // ╔════════════════════════════════════════════════════════════╗
        // ║  STATE INITIALIZATION                                      ║
        // ╚════════════════════════════════════════════════════════════╝
        
        // Pathway state
        this.pathways = [];
        this.pathwayById = new Map();
        this.pathwaysByRatioSorted = [];
        this.pathwaysBySubcategory = new Map();
        
        // Oscillator state
        this.oscillators = new Map();
        this.ratioToPathways = new Map();
        
        // Visibility state
        this.visibleIds = new Set();
        this.allVisible = true;
        
        // Focus state
        this.focusedId = null;
        this.focusEnvelope = 0;
        this.focusTargetEnvelope = 0;
        
        // Category state
        this.categoryState = {};
        this.categoryGains = {};
        this.subcategoryGains = {};
        
        // Layer state
        this.layerState = {
            slow: { lastCycle: 0, nextCycleIn: 5, activeVoices: [] },
            medium: { lastCycle: 0, nextCycleIn: 1.5, activeVoices: [] },
            fast: { lastCycle: 0, nextCycleIn: 0.2, activeVoices: [] },
        };
        
        // Peristalsis state
        this.peristalticWaves = [];
        this.segmentationPhases = [];
        this.mmcTime = 0;
        
        // Organism state
        this.organisms = [];
        this.lastOrganismSpawn = 0;
        this.nextOrganismSpawnIn = 15;
        this.organismIdCounter = 0;
        
        // Ripple state
        this.pendingRipples = [];
        
        // Foundation state
        this.foundationIds = new Set();
        this.foundationBreathPhases = [0, 0, 0];
        
        // Fairness state
        this.lastSounded = new Map();
        
        // Global modulation state
        this.globalLfoPhases = [];
        this.tidePhase = 0;
        
        // Timing
        this.fundamental = 600;
        this.masterVolume = 0.35;
        this.sampleRate = 48000;
        this.time = 0;
        
        // Ratio bounds
        this.minRatio = 0.125;
        this.maxRatio = 16;
        this.minRatioLog = Math.log2(0.125);
        this.maxRatioLog = Math.log2(16);
        
        // Effects state
        this.chorusReady = false;
        this.delayReady = false;
        
        // Reporting
        this.lastReport = 0;
        this.reportInterval = 0.04;
        
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
                this.updateVisibilityFromGains();
                break;
            case 'setSubcategoryGain':
                this.subcategoryGains[data.subcategory] = data.gain;
                this.updateVisibilityFromGains();
                break;
            case 'setVisiblePathways':
                this.visibleIds = new Set(data.ids);
                this.allVisible = data.ids.length === 0 || data.ids.length === this.pathways.length;
                this.updateFoundation();
                break;
            case 'setFocus':
                this.focusedId = data.id;
                this.focusTargetEnvelope = data.id ? 1.0 : 0.0;
                break;
            case 'setLayerConfig':
                if (this.LAYERS[data.layer]) {
                    this.mergeConfig(this.LAYERS[data.layer], data.config);
                }
                break;
            case 'setPeristalsisConfig':
                this.mergeConfig(this.PERISTALSIS, data);
                break;
            case 'setOrganismConfig':
                this.mergeConfig(this.ORGANISMS, data);
                break;
            case 'setRippleConfig':
                this.mergeConfig(this.RIPPLE, data);
                break;
            case 'setSpeed':
                this.applySpeedPreset(data.preset);
                break;
            case 'triggerPathway':
                this.triggerPathway(data.id, data.layer || 'medium');
                break;
            case 'spawnOrganism':
                this.spawnOrganism(data.type);
                break;
        }
    }
    
    mergeConfig(target, source) {
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key]) && !(source[key] instanceof Map)) {
                if (!target[key]) target[key] = {};
                this.mergeConfig(target[key], source[key]);
            } else {
                target[key] = source[key];
            }
        }
    }
    
    applySpeedPreset(preset) {
        switch (preset) {
            case 'meditative':
                this.PERISTALSIS.contractions.baseRate = 0.05;
                this.PERISTALSIS.contractions.travelSpeed = 0.08;
                this.LAYERS.fast.cycleTime = [0.2, 0.6];
                this.LAYERS.fast.maxVoices = 30;
                this.ORGANISMS.spawnInterval = [20, 40];
                this.RIPPLE.triggerChance = 0.3;
                break;
            case 'balanced':
                this.PERISTALSIS.contractions.baseRate = 0.08;
                this.PERISTALSIS.contractions.travelSpeed = 0.12;
                this.LAYERS.fast.cycleTime = [0.06, 0.3];
                this.LAYERS.fast.maxVoices = 50;
                this.ORGANISMS.spawnInterval = [10, 25];
                this.RIPPLE.triggerChance = 0.5;
                break;
            case 'active':
                this.PERISTALSIS.contractions.baseRate = 0.12;
                this.PERISTALSIS.contractions.travelSpeed = 0.18;
                this.LAYERS.fast.cycleTime = [0.03, 0.15];
                this.LAYERS.fast.maxVoices = 70;
                this.ORGANISMS.spawnInterval = [5, 15];
                this.RIPPLE.triggerChance = 0.65;
                break;
        }
    }
    
    updateVisibilityFromGains() {
        const newVisible = [];
        
        for (const p of this.pathways) {
            const catGain = this.categoryGains[p.category] ?? 1.0;
            const subGain = this.subcategoryGains[p.subcategory] ?? 1.0;
            
            if (catGain > 0.01 && subGain > 0.01) {
                newVisible.push(p.id);
            }
        }
        
        this.visibleIds = new Set(newVisible);
        this.allVisible = newVisible.length === this.pathways.length;
        this.updateFoundation();
        this.updateSubcategoryRhythms();
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
            
            const n = p.n || this.extractN(p.ratio);
            const d = p.d || this.extractD(p.ratio);
            const nxd = p.nxd || p.consonance || (n * d);
            const ratioValue = typeof p.ratio === 'number' ? p.ratio : n / d;
            const ratioLog = Math.log2(ratioValue);
            
            const primeFactors = this.getPrimeFactors(n * d);
            
            const stability = Math.sqrt(abundance);
            const lfoDepth = this.MOD_CONFIG.pathwayLFO.minDepth +
                (1 - stability) * (this.MOD_CONFIG.pathwayLFO.maxDepth - this.MOD_CONFIG.pathwayLFO.minDepth);
            const lfoRate = this.MOD_CONFIG.pathwayLFO.minRate +
                Math.random() * (this.MOD_CONFIG.pathwayLFO.maxRate - this.MOD_CONFIG.pathwayLFO.minRate);
            
            return {
                id: p.id,
                index: i,
                ratio: ratioValue,
                ratioLog,
                n,
                d,
                nxd,
                primeFactors,
                ratioKey: `${n}/${d}`,
                category: cat,
                subcategory: subcat,
                abundance,
                baseVolume: Math.pow(abundance, 1.5),
                lfoPhase: Math.random() * Math.PI * 2,
                lfoRate,
                lfoDepth,
                currentLfoMod: 1.0,
                basePan: catCfg.panHome + (Math.random() - 0.5) * catCfg.panRange,
                currentPan: catCfg.panHome,
                isActive: false,
                activeLayer: null,
                envelopePhase: 'off',
                envelopeTime: 0,
                envelopeValue: 0,
                attackTime: 0,
                sustainTime: 0,
                releaseTime: 0,
                
                // Peristalsis influence
                peristalsisInfluence: 0,
                peristalsisInfluenceTarget: 0,
                
                // Subcategory rhythm influence
                subcategoryPulse: 0,
                
                // Organism influence
                organismInfluence: 0,
                organismInfluenceTarget: 0,
                
                // Ripple
                rippleVolumeScale: 1.0,
                rippleGeneration: 0,
                rippleType: null,
                
                // Foundation
                breathPhases: [
                    Math.random() * Math.PI * 2,
                    Math.random() * Math.PI * 2,
                    Math.random() * Math.PI * 2,
                ],
                isFoundation: false,
            };
        });
        
        // Build indexes
        this.pathwaysByRatioSorted = [...this.pathways].sort((a, b) => a.ratio - b.ratio);
        this.pathwayById = new Map(this.pathways.map(p => [p.id, p]));
        this.buildOscillatorMap();
        this.buildSubcategoryIndex();
        this.buildHarmonicIndex();
        
        // Initialize category state
        for (const cat in this.CATEGORIES) {
            this.categoryState[cat] = {
                pan: this.CATEGORIES[cat].panHome,
                chorusSend: this.CATEGORIES[cat].chorusSendBase,
                chorusSendPhase: Math.random() * Math.PI * 2,
            };
            this.categoryGains[cat] = 1.0;
        }
        
        // Initialize subcategory gains
        for (const [subcat] of this.pathwaysBySubcategory) {
            this.subcategoryGains[subcat] = 1.0;
        }
        
        // Initialize subcategory rhythms
        this.initSubcategoryRhythms();
        
        // Initialize segmentation phases
        this.initSegmentation();
        
        // Initialize modulation phases
        this.globalLfoPhases = this.MOD_CONFIG.globalLFOs.map(() => Math.random() * Math.PI * 2);
        this.tidePhase = Math.random() * Math.PI * 2;
        
        // Initialize fairness
        for (const p of this.pathways) {
            this.lastSounded.set(p.id, 0);
        }
        
        // Initialize peristalsis
        this.PERISTALSIS.mmc.phaseTime = 0;
        this.PERISTALSIS.mmc.currentPhase = 'quiescent';
        
        this.updateFoundation();
        this.initChorus();
        this.initDelay();
        
        // Report ready
        const nxdStats = this.pathways.map(p => p.nxd);
        const ratios = this.pathwaysByRatioSorted;
        
        this.port.postMessage({
            type: 'ready',
            count: this.pathways.length,
            uniqueRatios: this.oscillators.size,
            categories: Object.keys(this.CATEGORIES),
            subcategories: [...this.pathwaysBySubcategory.keys()],
            nxdRange: [Math.min(...nxdStats), Math.max(...nxdStats)],
            ratioRange: [ratios[0]?.ratio || 0, ratios[ratios.length - 1]?.ratio || 1],
        });
        
        console.log(`MicrobiomeSonification v2.3 initialized`);
        console.log(`  ${this.pathways.length} pathways`);
        console.log(`  ${this.oscillators.size} unique ratios`);
        console.log(`  ${this.pathwaysBySubcategory.size} subcategories`);
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
    
    getPrimeFactors(n) {
        const factors = [];
        let d = 2;
        while (n > 1) {
            while (n % d === 0) {
                factors.push(d);
                n /= d;
            }
            d++;
            if (d * d > n && n > 1) {
                factors.push(n);
                break;
            }
        }
        return factors;
    }
    
    randomInRange([min, max]) {
        return min + Math.random() * (max - min);
    }
    
    // ╔════════════════════════════════════════════════════════════════╗
    // ║  INDEX BUILDING                                                ║
    // ╚════════════════════════════════════════════════════════════════╝
    
    buildOscillatorMap() {
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
                    ratio: p.ratio,
                    phase: Math.random() * Math.PI * 2,
                    amplitude: 0,
                    targetAmplitude: 0,
                    pan: 0,
                    chorusSend: 0,
                });
            }
        }
    }
    
    buildSubcategoryIndex() {
        this.pathwaysBySubcategory.clear();
        
        for (const p of this.pathways) {
            if (!this.pathwaysBySubcategory.has(p.subcategory)) {
                this.pathwaysBySubcategory.set(p.subcategory, []);
            }
            this.pathwaysBySubcategory.get(p.subcategory).push(p);
        }
    }
    
    buildHarmonicIndex() {
        this.harmonicFamilies = new Map();
        for (const p of this.pathways) {
            const dominantPrime = Math.max(...p.primeFactors, 1);
            if (!this.harmonicFamilies.has(dominantPrime)) {
                this.harmonicFamilies.set(dominantPrime, []);
            }
            this.harmonicFamilies.get(dominantPrime).push(p.id);
        }
        
        this.octaveEquivalents = new Map();
        for (const p of this.pathways) {
            let normalized = p.ratio;
            while (normalized >= 2) normalized /= 2;
            while (normalized < 1) normalized *= 2;
            const key = normalized.toFixed(4);
            if (!this.octaveEquivalents.has(key)) {
                this.octaveEquivalents.set(key, []);
            }
            this.octaveEquivalents.get(key).push(p.id);
        }
    }
    
    // ╔════════════════════════════════════════════════════════════════╗
    // ║  SUBCATEGORY RHYTHM SYSTEM                                     ║
    // ╚════════════════════════════════════════════════════════════════╝
    
    initSubcategoryRhythms() {
        const cfg = this.SUBCATEGORY_RHYTHM;
        cfg.subcategories.clear();
        
        // Find min and max subcategory sizes
        let minSize = Infinity, maxSize = 0;
        for (const [, pathways] of this.pathwaysBySubcategory) {
            minSize = Math.min(minSize, pathways.length);
            maxSize = Math.max(maxSize, pathways.length);
        }
        const sizeRange = maxSize - minSize || 1;
        
        // Assign rhythm parameters to each subcategory
        let phaseOffset = 0;
        const totalSubcats = this.pathwaysBySubcategory.size;
        
        for (const [subcat, pathways] of this.pathwaysBySubcategory) {
            // Normalize size (0 = smallest, 1 = largest)
            const sizeNorm = (pathways.length - minSize) / sizeRange;
            
            // Larger subcategories pulse slower → natural polyrhythms
            const cycleTime = 1 / (cfg.baseRate + (cfg.maxRate - cfg.baseRate) * Math.pow(1 - sizeNorm, cfg.sizeInfluence));
            
            // Spread initial phases
            const phase = cfg.phaseSpread 
                ? (phaseOffset / totalSubcats) * Math.PI * 2 
                : Math.random() * Math.PI * 2;
            
            cfg.subcategories.set(subcat, {
                pathways: pathways.map(p => p.id),
                count: pathways.length,
                cycleTime,
                phase,
                pulseValue: 0,
                category: pathways[0]?.category || 'other',
            });
            
            phaseOffset++;
        }
        
        console.log(`Initialized ${cfg.subcategories.size} subcategory rhythms`);
    }
    
    updateSubcategoryRhythms() {
        // Recalculate visible counts
        const cfg = this.SUBCATEGORY_RHYTHM;
        
        for (const [subcat, state] of cfg.subcategories) {
            const visiblePathways = state.pathways.filter(id => 
                this.allVisible || this.visibleIds.has(id)
            );
            state.visibleCount = visiblePathways.length;
        }
    }
    
    updateSubcategoryPulses(dt) {
        if (!this.SUBCATEGORY_RHYTHM.enabled) return;
        
        const cfg = this.SUBCATEGORY_RHYTHM;
        const twoPi = Math.PI * 2;
        
        for (const [subcat, state] of cfg.subcategories) {
            // Advance phase
            state.phase += (twoPi / state.cycleTime) * dt;
            if (state.phase > twoPi) state.phase -= twoPi;
            
            // Add drift for evolution
            state.phase += cfg.phaseDrift * dt * (Math.random() - 0.5);
            
            // Calculate pulse value based on phase
            const cyclePos = state.phase / twoPi;
            let pulse = 0;
            
            if (cyclePos < cfg.pulseAttack) {
                // Attack
                pulse = cyclePos / cfg.pulseAttack;
            } else if (cyclePos < cfg.pulseAttack + cfg.pulseSustain) {
                // Sustain
                pulse = 1.0;
            } else if (cyclePos < cfg.pulseAttack + cfg.pulseSustain + cfg.pulseRelease) {
                // Release
                const releasePos = (cyclePos - cfg.pulseAttack - cfg.pulseSustain) / cfg.pulseRelease;
                pulse = 1.0 - releasePos;
            }
            
            state.pulseValue = pulse * cfg.pulseDepth;
            
            // Apply to pathways in this subcategory
            for (const id of state.pathways) {
                const p = this.pathwayById.get(id);
                if (p) {
                    p.subcategoryPulse = state.pulseValue;
                }
            }
        }
        
        // Cross-influence between subcategories in same category
        if (cfg.crossInfluence.enabled) {
            this.applySubcategoryCrossInfluence();
        }
    }
    
    applySubcategoryCrossInfluence() {
        const cfg = this.SUBCATEGORY_RHYTHM;
        const byCategory = new Map();
        
        // Group subcategories by category
        for (const [subcat, state] of cfg.subcategories) {
            if (!byCategory.has(state.category)) {
                byCategory.set(state.category, []);
            }
            byCategory.get(state.category).push({ subcat, state });
        }
        
        // Apply cross-influence within each category
        for (const [, subcats] of byCategory) {
            if (subcats.length < 2) continue;
            
            // Calculate average pulse for category
            const avgPulse = subcats.reduce((sum, s) => sum + s.state.pulseValue, 0) / subcats.length;
            
            // Blend each subcategory toward average
            for (const { state } of subcats) {
                state.pulseValue = state.pulseValue * (1 - cfg.crossInfluence.strength) + 
                                   avgPulse * cfg.crossInfluence.strength;
            }
        }
    }
    
    initSegmentation() {
        const cfg = this.PERISTALSIS.segmentation;
        this.segmentationPhases = [];
        
        for (let i = 0; i < cfg.regions; i++) {
            this.segmentationPhases.push({
                phase: (i / cfg.regions) * Math.PI * 2,
                ratioStart: this.minRatioLog + (i / cfg.regions) * (this.maxRatioLog - this.minRatioLog),
                ratioEnd: this.minRatioLog + ((i + 1) / cfg.regions) * (this.maxRatioLog - this.minRatioLog),
            });
        }
    }
    
    updateFoundation() {
        const visible = this.getVisiblePathways();
        visible.sort((a, b) => b.abundance - a.abundance);
        const count = Math.min(this.LAYERS.foundation.count, visible.length);
        
        for (const p of this.pathways) {
            p.isFoundation = false;
        }
        this.foundationIds.clear();
        
        for (let i = 0; i < count; i++) {
            visible[i].isFoundation = true;
            this.foundationIds.add(visible[i].id);
        }
    }
    
    getVisiblePathways() {
        if (this.allVisible) return [...this.pathways];
        return this.pathways.filter(p => this.visibleIds.has(p.id));
    }
    
    // ╔════════════════════════════════════════════════════════════════╗
    // ║  EFFECTS INITIALIZATION                                        ║
    // ╚════════════════════════════════════════════════════════════════╝
    
    initChorus() {
        const cfg = this.CHORUS;
        const maxDelay = Math.ceil((cfg.baseDelayMs + cfg.modDepthMs + 5) * this.sampleRate / 1000);
        
        this.chorusBufferL = new Float32Array(maxDelay);
        this.chorusBufferR = new Float32Array(maxDelay);
        this.chorusBufferSize = maxDelay;
        this.chorusWriteIdx = 0;
        
        this.chorusLfoPhases = [];
        for (let v = 0; v < cfg.voices; v++) {
            this.chorusLfoPhases.push({
                L: Math.random() * Math.PI * 2,
                R: Math.random() * Math.PI * 2 + Math.PI * 0.5,
            });
        }
        
        this.chorusFeedbackL = 0;
        this.chorusFeedbackR = 0;
        this.chorusReady = true;
    }
    
    initDelay() {
        const maxDelay = Math.ceil(500 * this.sampleRate / 1000);
        
        this.delayBufferL = new Float32Array(maxDelay);
        this.delayBufferR = new Float32Array(maxDelay);
        this.delayBufferSize = maxDelay;
        this.delayWriteIdx = 0;
        this.delayFilterL = 0;
        this.delayFilterR = 0;
        this.delayReady = true;
    }
    
    // ╔════════════════════════════════════════════════════════════════╗
    // ║  PERISTALSIS SYSTEM                                            ║
    // ╚════════════════════════════════════════════════════════════════╝
    
    updatePeristalsis(dt) {
        if (!this.PERISTALSIS.enabled) return;
        
        // Update MMC phase
        this.updateMMC(dt);
        
        // Update peristaltic waves
        this.updatePeristalticWaves(dt);
        
        // Update segmentation
        this.updateSegmentation(dt);
        
        // Apply influences to pathways
        this.applyPeristalsisToPathways(dt);
    }
    
    updateMMC(dt) {
        const mmc = this.PERISTALSIS.mmc;
        mmc.phaseTime += dt;
        
        const currentPhaseCfg = mmc.phases[mmc.currentPhase];
        const phaseDuration = currentPhaseCfg.duration * mmc.cycleDuration;
        
        // Check for phase transition
        if (mmc.phaseTime >= phaseDuration) {
            mmc.phaseTime = 0;
            
            // Transition to next phase
            const phases = ['quiescent', 'irregular', 'intense', 'transition'];
            const currentIdx = phases.indexOf(mmc.currentPhase);
            mmc.currentPhase = phases[(currentIdx + 1) % phases.length];
            
            // Log phase changes for debugging
            // console.log(`MMC phase: ${mmc.currentPhase}`);
        }
    }
    
    updatePeristalticWaves(dt) {
        const cfg = this.PERISTALSIS.contractions;
        const mmc = this.PERISTALSIS.mmc;
        const mmcPhase = mmc.phases[mmc.currentPhase];
        
        // Maybe spawn new wave based on MMC activity
        const spawnChance = cfg.spawnChance * mmcPhase.activity * dt;
        if (Math.random() < spawnChance && this.peristalticWaves.length < cfg.maxWaves) {
            this.spawnPeristalticWave();
        }
        
        // Update existing waves
        for (let i = this.peristalticWaves.length - 1; i >= 0; i--) {
            const wave = this.peristalticWaves[i];
            
            // Move wave through ratio space
            wave.position += wave.speed * dt;
            wave.age += dt;
            
            // Update envelope
            if (wave.age < wave.attackTime) {
                wave.envelope = wave.age / wave.attackTime;
            } else if (wave.position > this.maxRatioLog + cfg.wavelength) {
                wave.envelope *= 0.9; // Fade out
            }
            
            // Remove finished waves
            if (wave.envelope < 0.01 || wave.position > this.maxRatioLog + cfg.wavelength * 2) {
                this.peristalticWaves.splice(i, 1);
            }
        }
    }
    
    spawnPeristalticWave() {
        const cfg = this.PERISTALSIS.contractions;
        const mmc = this.PERISTALSIS.mmc;
        const mmcPhase = mmc.phases[mmc.currentPhase];
        
        // Speed varies with MMC phase
        let speed = cfg.travelSpeed * mmcPhase.contractionRate * 10;
        
        // Add irregularity during irregular phase
        if (mmc.currentPhase === 'irregular' && mmcPhase.irregularity) {
            speed *= 1 + (Math.random() - 0.5) * mmcPhase.irregularity * 2;
        }
        
        this.peristalticWaves.push({
            position: this.minRatioLog - cfg.wavelength,
            speed,
            wavelength: cfg.wavelength * (0.8 + Math.random() * 0.4),
            amplitude: cfg.amplitude * mmcPhase.activity,
            age: 0,
            attackTime: 0.5,
            envelope: 0,
        });
    }
    
    updateSegmentation(dt) {
        if (!this.PERISTALSIS.segmentation.enabled) return;
        
        const cfg = this.PERISTALSIS.segmentation;
        const twoPi = Math.PI * 2;
        
        for (const seg of this.segmentationPhases) {
            seg.phase += twoPi * cfg.rate * dt;
            if (seg.phase > twoPi) seg.phase -= twoPi;
        }
    }
    
    applyPeristalsisToPathways(dt) {
        const cfg = this.PERISTALSIS.contractions;
        const segCfg = this.PERISTALSIS.segmentation;
        
        for (const p of this.pathways) {
            let influence = 0;
            
            // Peristaltic wave influence
            for (const wave of this.peristalticWaves) {
                const dist = Math.abs(p.ratioLog - wave.position);
                if (dist < wave.wavelength) {
                    const waveShape = Math.cos((dist / wave.wavelength) * Math.PI) * 0.5 + 0.5;
                    influence += waveShape * wave.amplitude * wave.envelope;
                }
            }
            
            // Segmentation influence
            if (segCfg.enabled) {
                for (const seg of this.segmentationPhases) {
                    if (p.ratioLog >= seg.ratioStart && p.ratioLog < seg.ratioEnd) {
                        const segValue = (Math.sin(seg.phase) * 0.5 + 0.5) * segCfg.depth;
                        influence += segValue;
                        break;
                    }
                }
            }
            
            // Regional variation
            const region = this.getRegionForRatio(p.ratio);
            if (region) {
                influence *= region.activityMult;
            }
            
            // Smooth the influence
            p.peristalsisInfluenceTarget = Math.min(1, influence);
            p.peristalsisInfluence += (p.peristalsisInfluenceTarget - p.peristalsisInfluence) * 0.1;
        }
    }
    
    getRegionForRatio(ratio) {
        const regions = this.PERISTALSIS.regions;
        for (const key in regions) {
            const region = regions[key];
            if (ratio >= region.ratioRange[0] && ratio < region.ratioRange[1]) {
                return region;
            }
        }
        return null;
    }
    
    // ╔════════════════════════════════════════════════════════════════╗
    // ║  ORGANISM SYSTEM                                               ║
    // ╚════════════════════════════════════════════════════════════════╝
    
    updateOrganisms(dt) {
        if (!this.ORGANISMS.enabled) return;
        
        // Maybe spawn new organism
        this.lastOrganismSpawn += dt;
        if (this.lastOrganismSpawn >= this.nextOrganismSpawnIn && 
            this.organisms.length < this.ORGANISMS.maxCount) {
            this.spawnRandomOrganism();
            this.lastOrganismSpawn = 0;
            this.nextOrganismSpawnIn = this.randomInRange(this.ORGANISMS.spawnInterval);
        }
        
        // Update existing organisms
        for (let i = this.organisms.length - 1; i >= 0; i--) {
            const org = this.organisms[i];
            this.updateOrganism(org, dt);
            
            if (org.age >= org.lifespan) {
                this.organisms.splice(i, 1);
            }
        }
        
        // Apply organism influences to pathways
        this.applyOrganismsToPathways(dt);
    }
    
    spawnRandomOrganism() {
        // Weighted random selection of organism type
        const types = this.ORGANISMS.types;
        const totalWeight = Object.values(types).reduce((sum, t) => sum + t.weight, 0);
        let r = Math.random() * totalWeight;
        
        for (const [typeName, typeConfig] of Object.entries(types)) {
            r -= typeConfig.weight;
            if (r <= 0) {
                this.spawnOrganism(typeName);
                return;
            }
        }
    }
    
    spawnOrganism(typeName) {
        const typeConfig = this.ORGANISMS.types[typeName];
        if (!typeConfig) return;
        
        // Choose spawn position
        let position = this.minRatioLog + Math.random() * (this.maxRatioLog - this.minRatioLog);
        
        // For category-preferring organisms, bias toward those categories
        if (typeConfig.preferredCategories) {
            const catPathways = this.pathways.filter(p => 
                typeConfig.preferredCategories.includes(p.category)
            );
            if (catPathways.length > 0) {
                const target = catPathways[Math.floor(Math.random() * catPathways.length)];
                position = target.ratioLog;
            }
        }
        
        const organism = {
            id: this.organismIdCounter++,
            type: typeName,
            config: typeConfig,
            position,
            positionTarget: position,
            speed: this.randomInRange(typeConfig.speed),
            direction: Math.random() < 0.5 ? 1 : -1,
            influenceRadius: typeConfig.influenceRadius,
            influenceStrength: typeConfig.influenceStrength,
            age: 0,
            lifespan: this.randomInRange(typeConfig.lifespan),
            envelope: 0,
            lastActivation: 0,
            activationCooldown: 0.5,
            
            // Movement-specific state
            oscillationPhase: Math.random() * Math.PI * 2,
            brownianTarget: position,
            brownianCooldown: 0,
            expansionRadius: typeConfig.influenceRadius,
        };
        
        this.organisms.push(organism);
        return organism;
    }
    
    updateOrganism(org, dt) {
        org.age += dt;
        
        // Envelope (fade in/out)
        const fadeTime = 2;
        if (org.age < fadeTime) {
            org.envelope = org.age / fadeTime;
        } else if (org.age > org.lifespan - fadeTime) {
            org.envelope = (org.lifespan - org.age) / fadeTime;
        } else {
            org.envelope = 1;
        }
        org.envelope = Math.max(0, Math.min(1, org.envelope));
        
        // Movement based on type
        switch (org.config.movement) {
            case 'brownian':
                this.updateBrownianMovement(org, dt);
                break;
            case 'directed':
                this.updateDirectedMovement(org, dt);
                break;
            case 'oscillating':
                this.updateOscillatingMovement(org, dt);
                break;
            case 'expanding':
                this.updateExpandingMovement(org, dt);
                break;
        }
        
        // Clamp to bounds
        const behavior = this.ORGANISMS.behavior;
        if (org.position < this.minRatioLog || org.position > this.maxRatioLog) {
            if (behavior.boundaryBehavior === 'reflect') {
                org.direction *= -1;
                org.position = Math.max(this.minRatioLog, Math.min(this.maxRatioLog, org.position));
            } else if (behavior.boundaryBehavior === 'wrap') {
                if (org.position < this.minRatioLog) org.position = this.maxRatioLog;
                else org.position = this.minRatioLog;
            }
        }
        
        // Maybe trigger pathway activation
        org.lastActivation += dt;
        if (org.lastActivation >= org.activationCooldown && Math.random() < org.config.activationChance * dt) {
            this.organismActivatePathway(org);
            org.lastActivation = 0;
        }
    }
    
    updateBrownianMovement(org, dt) {
        org.brownianCooldown -= dt;
        
        if (org.brownianCooldown <= 0) {
            // Pick new random target
            const wanderDistance = org.config.influenceRadius * 2;
            org.brownianTarget = org.position + (Math.random() - 0.5) * wanderDistance * 2;
            org.brownianCooldown = 1 + Math.random() * 3;
        }
        
        // Move toward target
        const diff = org.brownianTarget - org.position;
        org.position += Math.sign(diff) * Math.min(Math.abs(diff), org.speed * dt);
    }
    
    updateDirectedMovement(org, dt) {
        // Move in current direction, occasionally changing
        org.position += org.direction * org.speed * dt;
        
        // Random direction changes
        if (Math.random() < 0.01) {
            org.direction *= -1;
        }
        
        // Attraction to active pathways
        const behavior = this.ORGANISMS.behavior;
        if (behavior.attractToActivity > 0) {
            const activePathways = this.pathways.filter(p => p.isActive);
            if (activePathways.length > 0) {
                // Find nearest active pathway
                let nearest = null;
                let nearestDist = Infinity;
                for (const p of activePathways) {
                    const dist = Math.abs(p.ratioLog - org.position);
                    if (dist < nearestDist) {
                        nearestDist = dist;
                        nearest = p;
                    }
                }
                if (nearest && nearestDist < org.influenceRadius * 3) {
                    const pull = (nearest.ratioLog - org.position) * behavior.attractToActivity * dt;
                    org.position += pull;
                }
            }
        }
    }
    
    updateOscillatingMovement(org, dt) {
        org.oscillationPhase += dt * 0.5;
        const oscillation = Math.sin(org.oscillationPhase) * org.influenceRadius;
        org.positionTarget = org.position + oscillation * 0.1;
        org.position += (org.positionTarget - org.position) * 0.05;
        
        // Slow drift
        org.position += org.direction * org.speed * dt * 0.3;
    }
    
    updateExpandingMovement(org, dt) {
        // Bloom expands its radius over time
        if (org.config.expansionRate && org.config.maxExpansion) {
            org.expansionRadius += org.config.expansionRate * dt;
            org.expansionRadius = Math.min(org.expansionRadius, org.config.maxExpansion);
            org.influenceRadius = org.expansionRadius;
        }
    }
    
    organismActivatePathway(org) {
        // Find pathways within influence radius
        const candidates = this.getVisiblePathways().filter(p => {
            if (p.isActive || p.id === this.focusedId) return false;
            const dist = Math.abs(p.ratioLog - org.position);
            return dist < org.influenceRadius;
        });
        
        if (candidates.length === 0) return;
        
        // Weight by distance and pathway characteristics
        const weighted = candidates.map(p => {
            const dist = Math.abs(p.ratioLog - org.position);
            const distWeight = 1 - (dist / org.influenceRadius);
            return { pathway: p, weight: distWeight * p.abundance };
        });
        
        // Pick one
        const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
        let r = Math.random() * totalWeight;
        
        for (const item of weighted) {
            r -= item.weight;
            if (r <= 0) {
                this.activatePathway(item.pathway, 'fast');
                return;
            }
        }
    }
    
    applyOrganismsToPathways(dt) {
        // Reset targets
        for (const p of this.pathways) {
            p.organismInfluenceTarget = 0;
        }
        
        // Apply each organism's influence
        for (const org of this.organisms) {
            for (const p of this.pathways) {
                const dist = Math.abs(p.ratioLog - org.position);
                if (dist < org.influenceRadius) {
                    const influence = (1 - dist / org.influenceRadius) * org.influenceStrength * org.envelope;
                    p.organismInfluenceTarget = Math.max(p.organismInfluenceTarget, influence);
                }
            }
        }
        
        // Smooth transitions
        for (const p of this.pathways) {
            p.organismInfluence += (p.organismInfluenceTarget - p.organismInfluence) * 0.08;
        }
    }
    
    // ╔════════════════════════════════════════════════════════════════╗
    // ║  LAYER CYCLING                                                 ║
    // ╚════════════════════════════════════════════════════════════════╝
    
    updateLayerCycles(dt) {
        for (const layerName of ['slow', 'medium', 'fast']) {
            const layer = this.LAYERS[layerName];
            const state = this.layerState[layerName];
            
            state.lastCycle += dt;
            
            if (state.lastCycle >= state.nextCycleIn) {
                this.tryActivateInLayer(layerName);
                const [min, max] = layer.cycleTime;
                state.nextCycleIn = min + Math.random() * (max - min);
                state.lastCycle = 0;
            }
            
            state.activeVoices = state.activeVoices.filter(id => {
                const p = this.pathwayById.get(id);
                return p && p.isActive && p.activeLayer === layerName;
            });
        }
    }
    
    tryActivateInLayer(layerName) {
        const layer = this.LAYERS[layerName];
        const state = this.layerState[layerName];
        
        if (state.activeVoices.length >= layer.maxVoices) return;
        
        const candidates = this.getVisiblePathways().filter(p =>
            !p.isActive && !p.isFoundation && p.id !== this.focusedId
        );
        
        if (candidates.length === 0) return;
        
        // Score candidates based on multiple factors
        candidates.sort((a, b) => {
            const aLast = this.lastSounded.get(a.id) || 0;
            const bLast = this.lastSounded.get(b.id) || 0;
            
            // Fairness: prefer pathways that haven't sounded recently
            const fairnessA = this.time - aLast;
            const fairnessB = this.time - bLast;
            
            // Peristalsis boost: prefer pathways being "pushed" by peristaltic waves
            const peristalsisBoostA = a.peristalsisInfluence * this.time * 0.3;
            const peristalsisBoostB = b.peristalsisInfluence * this.time * 0.3;
            
            // Subcategory pulse boost: prefer pathways whose subcategory is pulsing
            const subcatBoostA = a.subcategoryPulse * this.time * 0.2;
            const subcatBoostB = b.subcategoryPulse * this.time * 0.2;
            
            // Organism boost: prefer pathways near organisms
            const organismBoostA = a.organismInfluence * this.time * 0.4;
            const organismBoostB = b.organismInfluence * this.time * 0.4;
            
            // Randomness for organic feel
            const randomA = (Math.random() - 0.5) * this.time * 0.2;
            const randomB = (Math.random() - 0.5) * this.time * 0.2;
            
            const scoreA = fairnessA + peristalsisBoostA + subcatBoostA + organismBoostA + randomA;
            const scoreB = fairnessB + peristalsisBoostB + subcatBoostB + organismBoostB + randomB;
            
            return scoreB - scoreA;
        });
        
        // Pick from top candidates with some randomness
        const pickIndex = Math.floor(Math.random() * Math.min(5, candidates.length));
        const chosen = candidates[pickIndex];
        
        this.activatePathway(chosen, layerName);
    }
    
    activatePathway(pathway, layerName) {
        const layer = this.LAYERS[layerName];
        const env = layer.envelope;
        
        pathway.isActive = true;
        pathway.activeLayer = layerName;
        pathway.envelopePhase = 'attack';
        pathway.envelopeTime = 0;
        pathway.envelopeValue = 0;
        
        pathway.attackTime = this.randomInRange(env.attack);
        pathway.sustainTime = this.randomInRange(env.sustain);
        pathway.releaseTime = this.randomInRange(env.release);
        
        pathway.rippleVolumeScale = 1.0;
        pathway.rippleGeneration = 0;
        pathway.rippleType = null;
        
        this.layerState[layerName].activeVoices.push(pathway.id);
        this.lastSounded.set(pathway.id, this.time);
        
        // Spawn ripples for fast layer
        if (layerName === 'fast' && this.RIPPLE.enabled) {
            this.spawnRipples(pathway, 0);
        }
    }
    
    triggerPathway(id, layerName) {
        const p = this.pathwayById.get(id);
        if (p && !p.isActive) {
            this.activatePathway(p, layerName);
        }
    }
    
    // ╔════════════════════════════════════════════════════════════════╗
    // ║  RIPPLE SYSTEM                                                 ║
    // ╚════════════════════════════════════════════════════════════════╝
    
    spawnRipples(sourcePathway, generation = 0) {
        const cfg = this.RIPPLE;
        
        let triggerChance = cfg.triggerChance;
        if (generation > 0) {
            if (!cfg.chain.enabled || generation > cfg.chain.maxDepth) return;
            triggerChance *= Math.pow(cfg.chain.decayPerGen, generation);
        }
        if (Math.random() > triggerChance) return;
        
        const candidates = this.getVisiblePathways().filter(p =>
            !p.isActive && p.id !== sourcePathway.id && p.id !== this.focusedId
        );
        if (candidates.length === 0) return;
        
        const sourceNxd = sourcePathway.nxd;
        const isConsonant = sourceNxd < cfg.consonance.adaptiveThreshold;
        
        // Spatial ripples
        if (cfg.spatial.enabled) {
            const spatialChance = isConsonant ? 0.4 : 0.8;
            if (Math.random() < spatialChance) {
                const neighbors = this.findSpatialNeighbors(sourcePathway.ratio, candidates, cfg.spatial.maxDistance);
                const count = Math.floor(this.randomInRange(cfg.spatial.count));
                const chosen = this.weightedRandomPick(neighbors, count);
                
                for (const item of chosen) {
                    const baseDelay = this.randomInRange(cfg.spatial.delayRange);
                    const delay = baseDelay * (0.3 + (item.distance / cfg.spatial.maxDistance) * 0.7);
                    this.queueRipple(item.pathway, delay, generation + 1, 'spatial', cfg.spatial.volumeDecay);
                }
            }
        }
        
        // Consonance ripples
        if (cfg.consonance.enabled) {
            const consonanceChance = isConsonant ? Math.min(1, cfg.consonance.chance * 1.5) : cfg.consonance.chance;
            if (Math.random() < consonanceChance) {
                const relatives = this.findConsonanceRelatives(sourcePathway, candidates);
                const count = Math.floor(this.randomInRange(cfg.consonance.count));
                const chosen = this.weightedRandomPick(relatives, count);
                
                for (const item of chosen) {
                    const delay = this.randomInRange(cfg.consonance.delayRange);
                    this.queueRipple(item.pathway, delay, generation + 1, 'consonance', cfg.consonance.volumeDecay);
                }
            }
        }
    }
    
    findSpatialNeighbors(sourceRatio, candidates, maxDistance) {
        const sourceLog = Math.log2(sourceRatio);
        return candidates
            .map(p => ({ pathway: p, distance: Math.abs(Math.log2(p.ratio) - sourceLog) }))
            .filter(x => x.distance > 0.01 && x.distance <= maxDistance)
            .sort((a, b) => a.distance - b.distance)
            .map(x => ({ ...x, weight: 1 - (x.distance / maxDistance) }));
    }
    
    findConsonanceRelatives(sourcePathway, candidates) {
        const cfg = this.RIPPLE.consonance;
        const sourceNxd = sourcePathway.nxd;
        
        let mode = cfg.mode;
        if (mode === 'adaptive') {
            mode = sourceNxd < cfg.adaptiveThreshold
                ? 'harmonic'
                : (Math.random() < 0.6 ? 'similar' : 'simpler');
        }
        
        switch (mode) {
            case 'similar':
                return this.findConsonanceSimilar(sourceNxd, candidates, cfg.maxNxdDiff);
            case 'simpler':
                return this.findConsonanceSimpler(sourceNxd, candidates, cfg.simplifyRange);
            case 'harmonic':
                return this.findHarmonicRelatives(sourcePathway, candidates);
            default:
                return this.findConsonanceSimilar(sourceNxd, candidates, cfg.maxNxdDiff);
        }
    }
    
    findConsonanceSimilar(sourceNxd, candidates, maxDiff) {
        return candidates
            .map(p => ({
                pathway: p,
                weight: Math.abs(p.nxd - sourceNxd) <= maxDiff
                    ? 1 - (Math.abs(p.nxd - sourceNxd) / maxDiff)
                    : 0
            }))
            .filter(x => x.weight > 0)
            .sort((a, b) => b.weight - a.weight);
    }
    
    findConsonanceSimpler(sourceNxd, candidates, simplifyRange) {
        const [minFrac, maxFrac] = simplifyRange;
        const targetMin = sourceNxd * minFrac;
        const targetMax = sourceNxd * maxFrac;
        
        return candidates
            .filter(p => p.nxd < sourceNxd)
            .map(p => ({
                pathway: p,
                weight: (p.nxd >= targetMin && p.nxd <= targetMax)
                    ? (sourceNxd - p.nxd) / sourceNxd
                    : (sourceNxd - p.nxd) / sourceNxd * 0.3,
            }))
            .filter(x => x.weight > 0.1)
            .sort((a, b) => b.weight - a.weight);
    }
    
    findHarmonicRelatives(sourcePathway, candidates) {
        const sourceFactors = sourcePathway.primeFactors;
        return candidates
            .map(p => {
                const shared = this.countSharedFactors(sourceFactors, p.primeFactors);
                const maxFactors = Math.max(sourceFactors.length, p.primeFactors.length);
                return { pathway: p, weight: maxFactors > 0 ? shared / maxFactors : 0 };
            })
            .filter(x => x.weight > 0.2)
            .sort((a, b) => b.weight - a.weight);
    }
    
    countSharedFactors(a, b) {
        const bCopy = [...b];
        let shared = 0;
        for (const f of a) {
            const idx = bCopy.indexOf(f);
            if (idx !== -1) {
                shared++;
                bCopy.splice(idx, 1);
            }
        }
        return shared;
    }
    
    weightedRandomPick(items, count) {
        if (items.length === 0) return [];
        if (items.length <= count) return items;
        
        const result = [];
        const available = [...items];
        
        for (let i = 0; i < count && available.length > 0; i++) {
            const totalWeight = available.reduce((sum, x) => sum + (x.weight || 1), 0);
            let r = Math.random() * totalWeight;
            
            for (let j = 0; j < available.length; j++) {
                r -= available[j].weight || 1;
                if (r <= 0) {
                    result.push(available[j]);
                    available.splice(j, 1);
                    break;
                }
            }
        }
        return result;
    }
    
    queueRipple(pathway, delay, generation, type, volumeScale) {
        this.pendingRipples.push({
            pathwayId: pathway.id,
            triggerTime: this.time + delay,
            generation,
            type,
            volumeScale,
        });
    }
    
    processPendingRipples() {
        for (let i = this.pendingRipples.length - 1; i >= 0; i--) {
            const ripple = this.pendingRipples[i];
            
            if (this.time >= ripple.triggerTime) {
                const pathway = this.pathwayById.get(ripple.pathwayId);
                
                if (pathway && !pathway.isActive) {
                    this.activateRipplePathway(pathway, ripple);
                    if (this.RIPPLE.chain.enabled) {
                        this.spawnRipples(pathway, ripple.generation);
                    }
                }
                
                this.pendingRipples.splice(i, 1);
            }
        }
    }
    
    activateRipplePathway(pathway, ripple) {
        const layer = this.LAYERS.fast;
        const env = layer.envelope;
        
        pathway.isActive = true;
        pathway.activeLayer = 'fast';
        pathway.envelopePhase = 'attack';
        pathway.envelopeTime = 0;
        pathway.envelopeValue = 0;
        
        const rippleShorten = 0.5 + Math.random() * 0.35;
        pathway.attackTime = this.randomInRange(env.attack) * rippleShorten;
        pathway.sustainTime = this.randomInRange(env.sustain) * rippleShorten;
        pathway.releaseTime = this.randomInRange(env.release);
        
        const generationDecay = Math.pow(0.7, ripple.generation);
        pathway.rippleVolumeScale = ripple.volumeScale * generationDecay;
        pathway.rippleType = ripple.type;
        pathway.rippleGeneration = ripple.generation;
        
        this.layerState.fast.activeVoices.push(pathway.id);
        this.lastSounded.set(pathway.id, this.time);
    }
    
    // ╔════════════════════════════════════════════════════════════════╗
    // ║  ENVELOPE UPDATES                                              ║
    // ╚════════════════════════════════════════════════════════════════╝
    
    updateEnvelopes(dt) {
        const foundationCfg = this.LAYERS.foundation;
        const twoPi = Math.PI * 2;
        
        // Update foundation breath phases
        for (let i = 0; i < foundationCfg.breathRates.length; i++) {
            this.foundationBreathPhases[i] += twoPi * foundationCfg.breathRates[i] * dt;
            if (this.foundationBreathPhases[i] > twoPi) {
                this.foundationBreathPhases[i] -= twoPi;
            }
        }
        
        for (const p of this.pathways) {
            // Foundation pathways have special breathing envelope
            if (p.isFoundation) {
                let breathSum = 0;
                for (let i = 0; i < foundationCfg.breathRates.length; i++) {
                    const phase = this.foundationBreathPhases[i] + p.breathPhases[i];
                    breathSum += Math.sin(phase) * foundationCfg.breathDepths[i];
                }
                
                // Add influence from peristalsis and organisms
                const peristalsisBoost = p.peristalsisInfluence * 0.3;
                const organismBoost = p.organismInfluence * 0.25;
                const subcatBoost = p.subcategoryPulse * 0.2;
                
                p.envelopeValue = foundationCfg.volume * (1 + breathSum + peristalsisBoost + organismBoost + subcatBoost);
                p.envelopeValue = Math.max(0, p.envelopeValue);
                p.isActive = true;
                p.activeLayer = 'foundation';
                continue;
            }
            
            // Non-active pathways
            if (!p.isActive) {
                p.envelopeValue = 0;
                continue;
            }
            
            p.envelopeTime += dt;
            const isBubble = p.activeLayer === 'fast' && this.LAYERS.fast.envelopeShape === 'bubble';
            
            switch (p.envelopePhase) {
                case 'attack':
                    p.envelopeValue = isBubble
                        ? Math.pow(p.envelopeTime / p.attackTime, 0.2)
                        : p.envelopeTime / p.attackTime;
                    
                    if (p.envelopeTime >= p.attackTime) {
                        p.envelopePhase = 'sustain';
                        p.envelopeTime = 0;
                        p.envelopeValue = 1.0;
                    }
                    break;
                    
                case 'sustain':
                    if (isBubble) {
                        const decayProgress = p.envelopeTime / p.sustainTime;
                        p.envelopeValue = Math.exp(-decayProgress * 4);
                    } else {
                        // Gentle breathing during sustain
                        p.breathPhases[0] += twoPi * 0.03 * dt;
                        p.envelopeValue = 1.0 + Math.sin(p.breathPhases[0]) * 0.08;
                    }
                    
                    if (p.envelopeTime >= p.sustainTime) {
                        p.envelopePhase = 'release';
                        p.envelopeTime = 0;
                    }
                    break;
                    
                case 'release':
                    const progress = p.envelopeTime / p.releaseTime;
                    p.envelopeValue = isBubble
                        ? Math.exp(-progress * 3) * (1 - progress * 0.3)
                        : (1 + Math.cos(progress * Math.PI)) / 2;
                    
                    if (p.envelopeTime >= p.releaseTime) {
                        p.envelopePhase = 'off';
                        p.envelopeValue = 0;
                        p.isActive = false;
                        p.activeLayer = null;
                    }
                    break;
            }
            
            p.envelopeValue = Math.max(0, Math.min(1.2, p.envelopeValue));
        }
        
        // Update focus envelope
        const focusCfg = this.LAYERS.focus;
        const focusRate = this.focusTargetEnvelope > this.focusEnvelope
            ? 1.0 / focusCfg.attackTime
            : 1.0 / focusCfg.releaseTime;
        
        this.focusEnvelope += (this.focusTargetEnvelope - this.focusEnvelope) * focusRate * dt * 10;
        this.focusEnvelope = Math.max(0, Math.min(1, this.focusEnvelope));
    }
    
    // ╔════════════════════════════════════════════════════════════════╗
    // ║  GLOBAL MODULATION                                             ║
    // ╚════════════════════════════════════════════════════════════════╝
    
    updateGlobalMod(dt) {
        const twoPi = Math.PI * 2;
        let combined = 1.0;
        
        // Global LFOs
        for (let i = 0; i < this.MOD_CONFIG.globalLFOs.length; i++) {
            const lfo = this.MOD_CONFIG.globalLFOs[i];
            this.globalLfoPhases[i] += twoPi * lfo.rate * dt;
            if (this.globalLfoPhases[i] > twoPi) this.globalLfoPhases[i] -= twoPi;
            combined *= 1.0 + Math.sin(this.globalLfoPhases[i]) * lfo.depth;
        }
        
        // Tide
        this.tidePhase += twoPi * this.MOD_CONFIG.tide.rate * dt;
        if (this.tidePhase > twoPi) this.tidePhase -= twoPi;
        
        // Category modulation
        for (const cat in this.CATEGORIES) {
            const cfg = this.CATEGORIES[cat];
            const state = this.categoryState[cat];
            
            // Pan modulation influenced by peristalsis
            const peristalsisPanMod = Math.sin(this.mmcTime * 0.1) * 0.2;
            const targetPan = cfg.panHome + peristalsisPanMod * cfg.panRange;
            state.pan += (targetPan - state.pan) * 0.015;
            
            // Chorus send modulation
            state.chorusSendPhase += twoPi * cfg.chorusSendRate * dt;
            if (state.chorusSendPhase > twoPi) state.chorusSendPhase -= twoPi;
            
            const sendMod = Math.sin(state.chorusSendPhase) * 0.3;
            state.chorusSend = cfg.chorusSendBase * (1 + sendMod);
        }
        
        return combined;
    }
    
    updatePathwayMod(p, dt) {
        const twoPi = Math.PI * 2;
        
        // Per-pathway LFO
        p.lfoPhase += twoPi * p.lfoRate * dt;
        if (p.lfoPhase > twoPi) p.lfoPhase -= twoPi;
        
        p.currentLfoMod = 1.0 + Math.sin(p.lfoPhase) * p.lfoDepth;
        
        // Pan follows category with individual variation
        const catState = this.categoryState[p.category] || this.categoryState.other;
        const targetPan = catState.pan + (p.basePan - catState.pan) * 0.3;
        p.currentPan += (targetPan - p.currentPan) * 0.04;
    }
    
    // ╔════════════════════════════════════════════════════════════════╗
    // ║  OSCILLATOR AGGREGATION                                        ║
    // ╚════════════════════════════════════════════════════════════════╝
    
    aggregateOscillators() {
        // Reset oscillator targets
        for (const osc of this.oscillators.values()) {
            osc.targetAmplitude = 0;
            osc.pan = 0;
            osc.chorusSend = 0;
        }
        
        const focusCfg = this.LAYERS.focus;
        const focusActive = this.focusEnvelope > 0.01;
        const duckAmount = focusActive
            ? focusCfg.duckOthers + (1 - focusCfg.duckOthers) * (1 - this.focusEnvelope)
            : 1.0;
        
        for (const p of this.pathways) {
            if (!p.isActive && p.id !== this.focusedId) continue;
            
            const osc = this.oscillators.get(p.ratioKey);
            if (!osc) continue;
            
            let volume = 0;
            
            if (p.id === this.focusedId && this.focusEnvelope > 0.01) {
                // Focused pathway
                volume = focusCfg.volume * this.focusEnvelope * p.currentLfoMod * 0.5;
            } else if (p.isActive) {
                const layerVol = this.LAYERS[p.activeLayer]?.volume || 0.2;
                const rippleScale = p.rippleVolumeScale ?? 1.0;
                
                // Combine all influence sources
                const peristalsisBoost = 1 + p.peristalsisInfluence * 0.4;
                const subcatBoost = 1 + p.subcategoryPulse * 0.3;
                const organismBoost = 1 + p.organismInfluence * 0.35;
                
                volume = p.baseVolume * p.envelopeValue * layerVol * p.currentLfoMod * rippleScale;
                volume *= peristalsisBoost * subcatBoost * organismBoost;
                volume *= duckAmount;
            }
            
            // Apply category and subcategory gains
            volume *= this.categoryGains[p.category] ?? 1.0;
            volume *= this.subcategoryGains[p.subcategory] ?? 1.0;
            
            osc.targetAmplitude += volume;
            
            if (volume > 0) {
                const catState = this.categoryState[p.category] || this.categoryState.other;
                osc.pan += p.currentPan * volume;
                osc.chorusSend += (catState.chorusSend || 0.3) * volume;
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
            
            // Smooth amplitude changes
            const smoothing = osc.targetAmplitude > osc.amplitude ? 0.12 : 0.08;
            osc.amplitude += (osc.targetAmplitude - osc.amplitude) * smoothing;
        }
    }
    
    // ╔════════════════════════════════════════════════════════════════╗
    // ║  EFFECTS PROCESSING                                            ║
    // ╚════════════════════════════════════════════════════════════════╝
    
    processChorus(dryL, dryR, sendL, sendR, outL, outR, blockSize) {
        const cfg = this.CHORUS;
        const sr = this.sampleRate;
        const twoPi = Math.PI * 2;
        const baseDelay = cfg.baseDelayMs * sr / 1000;
        const modDepth = cfg.modDepthMs * sr / 1000;
        
        for (let i = 0; i < blockSize; i++) {
            this.chorusBufferL[this.chorusWriteIdx] = sendL[i] + this.chorusFeedbackL * cfg.feedback;
            this.chorusBufferR[this.chorusWriteIdx] = sendR[i] + this.chorusFeedbackR * cfg.feedback;
            
            let wetL = 0, wetR = 0;
            
            for (let v = 0; v < cfg.voices; v++) {
                const rate = cfg.rates[v];
                this.chorusLfoPhases[v].L += twoPi * rate / sr;
                this.chorusLfoPhases[v].R += twoPi * rate / sr;
                if (this.chorusLfoPhases[v].L > twoPi) this.chorusLfoPhases[v].L -= twoPi;
                if (this.chorusLfoPhases[v].R > twoPi) this.chorusLfoPhases[v].R -= twoPi;
                
                const modL = Math.sin(this.chorusLfoPhases[v].L);
                const modR = Math.sin(this.chorusLfoPhases[v].R);
                
                wetL += this.readBuffer(this.chorusBufferL, this.chorusBufferSize, this.chorusWriteIdx, baseDelay + modL * modDepth);
                wetR += this.readBuffer(this.chorusBufferR, this.chorusBufferSize, this.chorusWriteIdx, baseDelay + modR * modDepth);
            }
            
            wetL /= cfg.voices;
            wetR /= cfg.voices;
            
            this.chorusFeedbackL = wetL;
            this.chorusFeedbackR = wetR;
            
            outL[i] = dryL[i] + wetL;
            outR[i] = dryR[i] + wetR;
            
            this.chorusWriteIdx = (this.chorusWriteIdx + 1) % this.chorusBufferSize;
        }
    }
    
    processDelay(inL, inR, outL, outR, blockSize) {
        const cfg = this.DELAY;
        const delaySamples = cfg.timeMs * this.sampleRate / 1000;
        const filterCoef = cfg.highCut;
        
        for (let i = 0; i < blockSize; i++) {
            const delayedL = this.readBuffer(this.delayBufferL, this.delayBufferSize, this.delayWriteIdx, delaySamples);
            const delayedR = this.readBuffer(this.delayBufferR, this.delayBufferSize, this.delayWriteIdx, delaySamples);
            
            this.delayFilterL += (delayedL - this.delayFilterL) * filterCoef;
            this.delayFilterR += (delayedR - this.delayFilterR) * filterCoef;
            
            this.delayBufferL[this.delayWriteIdx] = inL[i] + this.delayFilterL * cfg.feedback;
            this.delayBufferR[this.delayWriteIdx] = inR[i] + this.delayFilterR * cfg.feedback;
            
            outL[i] = inL[i] + delayedL * cfg.wetMix;
            outR[i] = inR[i] + delayedR * cfg.wetMix;
            
            this.delayWriteIdx = (this.delayWriteIdx + 1) % this.delayBufferSize;
        }
    }
    
    readBuffer(buffer, size, writeIdx, delaySamples) {
        const readPos = writeIdx - delaySamples;
        const readIdx = ((readPos % size) + size) % size;
        const idx0 = Math.floor(readIdx);
        const idx1 = (idx0 + 1) % size;
        const frac = readIdx - idx0;
        return buffer[idx0] * (1 - frac) + buffer[idx1] * frac;
    }
    
    // ╔════════════════════════════════════════════════════════════════╗
    // ║  MAIN PROCESS LOOP                                             ║
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
        this.mmcTime += dt;
        
        // ═══════════════════════════════════════════════════════════
        // UPDATE ALL SYSTEMS
        // ═══════════════════════════════════════════════════════════
        
        // Peristalsis (generates rhythmic "churning")
        this.updatePeristalsis(dt);
        
        // Subcategory polyrhythms
        this.updateSubcategoryPulses(dt);
        
        // Living organisms
        this.updateOrganisms(dt);
        
        // Layer cycling
        this.updateLayerCycles(dt);
        
        // Ripple processing
        this.processPendingRipples();
        
        // Envelope updates
        this.updateEnvelopes(dt);
        
        // Global modulation
        const globalMod = this.updateGlobalMod(dt);
        
        // Per-pathway modulation
        for (const p of this.pathways) {
            if (p.isActive || p.id === this.focusedId) {
                this.updatePathwayMod(p, dt);
            }
        }
        
        // Aggregate to oscillators
        this.aggregateOscillators();
        
        // ═══════════════════════════════════════════════════════════
        // RENDER OSCILLATORS
        // ═══════════════════════════════════════════════════════════
        
        const dryL = new Float32Array(blockSize);
        const dryR = new Float32Array(blockSize);
        const chorusSendL = new Float32Array(blockSize);
        const chorusSendR = new Float32Array(blockSize);
        
        for (const osc of this.oscillators.values()) {
            if (osc.amplitude < 0.0001) continue;
            
            const freq = this.fundamental * osc.ratio;
            const phaseInc = (twoPi * freq) / sr;
            
            const panAngle = (osc.pan + 1) * Math.PI / 4;
            const gainL = Math.cos(panAngle);
            const gainR = Math.sin(panAngle);
            
            const chorusSend = osc.chorusSend * this.CHORUS.maxSend;
            
            for (let i = 0; i < blockSize; i++) {
                const sample = Math.sin(osc.phase) * osc.amplitude * globalMod * this.masterVolume;
                
                const sampleL = sample * gainL;
                const sampleR = sample * gainR;
                
                dryL[i] += sampleL;
                dryR[i] += sampleR;
                
                chorusSendL[i] += sampleL * chorusSend;
                chorusSendR[i] += sampleR * chorusSend;
                
                osc.phase += phaseInc;
                if (osc.phase > twoPi) osc.phase -= twoPi;
            }
        }
        
        // ═══════════════════════════════════════════════════════════
        // EFFECTS CHAIN
        // ═══════════════════════════════════════════════════════════
        
        const postChorusL = new Float32Array(blockSize);
        const postChorusR = new Float32Array(blockSize);
        
        if (this.chorusReady) {
            this.processChorus(dryL, dryR, chorusSendL, chorusSendR, postChorusL, postChorusR, blockSize);
        } else {
            postChorusL.set(dryL);
            postChorusR.set(dryR);
        }
        
        if (this.delayReady) {
            this.processDelay(postChorusL, postChorusR, channelL, channelR, blockSize);
        } else {
            channelL.set(postChorusL);
            if (channelR !== channelL) channelR.set(postChorusR);
        }
        
        // ═══════════════════════════════════════════════════════════
        // SOFT LIMITING
        // ═══════════════════════════════════════════════════════════
        
        for (let i = 0; i < blockSize; i++) {
            channelL[i] = Math.tanh(channelL[i] * 0.7) * 0.85;
            if (channelR !== channelL) {
                channelR[i] = Math.tanh(channelR[i] * 0.7) * 0.85;
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
        const activePathways = this.pathways
            .filter(p => p.isActive || p.id === this.focusedId)
            .map(p => ({
                id: p.id,
                ratio: p.ratio,
                layer: p.id === this.focusedId ? 'focus' : p.activeLayer,
                envelope: p.id === this.focusedId ? this.focusEnvelope : p.envelopeValue,
                envelopePhase: p.envelopePhase,
                peristalsisInfluence: p.peristalsisInfluence,
                subcategoryPulse: p.subcategoryPulse,
                organismInfluence: p.organismInfluence,
                rippleType: p.rippleType,
                rippleGen: p.rippleGeneration,
                pan: p.currentPan,
            }));
        
        const layerCounts = {
            focus: this.focusedId ? 1 : 0,
            foundation: this.pathways.filter(p => p.isFoundation).length,
            slow: this.layerState.slow.activeVoices.length,
            medium: this.layerState.medium.activeVoices.length,
            fast: this.layerState.fast.activeVoices.length,
        };
        
        const rippleCounts = { spatial: 0, consonance: 0 };
        for (const p of activePathways) {
            if (p.rippleType === 'spatial') rippleCounts.spatial++;
            if (p.rippleType === 'consonance') rippleCounts.consonance++;
        }
        
        // Organism info for visualization
        const organismInfo = this.organisms.map(o => ({
            id: o.id,
            type: o.type,
            position: o.position,
            positionRatio: Math.pow(2, o.position),
            influenceRadius: o.influenceRadius,
            envelope: o.envelope,
            age: o.age,
            lifespan: o.lifespan,
        }));
        
        // Peristaltic wave info
        const peristalsisInfo = {
            mmcPhase: this.PERISTALSIS.mmc.currentPhase,
            mmcPhaseTime: this.PERISTALSIS.mmc.phaseTime,
            waveCount: this.peristalticWaves.length,
            waves: this.peristalticWaves.map(w => ({
                position: w.position,
                positionRatio: Math.pow(2, w.position),
                wavelength: w.wavelength,
                amplitude: w.amplitude,
                envelope: w.envelope,
            })),
        };
        
        // Subcategory rhythm info
        const subcategoryInfo = {};
        for (const [subcat, state] of this.SUBCATEGORY_RHYTHM.subcategories) {
            subcategoryInfo[subcat] = {
                pulseValue: state.pulseValue,
                phase: state.phase,
                count: state.count,
            };
        }
        
        this.port.postMessage({
            type: 'visualState',
            data: {
                time: this.time,
                focusedId: this.focusedId,
                focusEnvelope: this.focusEnvelope,
                layers: layerCounts,
                activeCount: activePathways.length,
                
                // New systems
                peristalsis: peristalsisInfo,
                organisms: organismInfo,
                subcategoryRhythms: subcategoryInfo,
                
                ripples: rippleCounts,
                pendingRipples: this.pendingRipples.length,
                tidePhase: this.tidePhase,
                uniqueOscillators: [...this.oscillators.values()].filter(o => o.amplitude > 0.001).length,
                categories: Object.fromEntries(
                    Object.entries(this.categoryState).map(([k, v]) => [k, {
                        pan: v.pan,
                        chorusSend: v.chorusSend,
                    }])
                ),
                pathways: activePathways.slice(0, 100),
            },
        });
    }
}

// ╔════════════════════════════════════════════════════════════════════╗
// ║  REGISTER PROCESSOR                                                ║
// ╚════════════════════════════════════════════════════════════════════╝

registerProcessor('microbiome-sonification', MicrobiomeSonification);