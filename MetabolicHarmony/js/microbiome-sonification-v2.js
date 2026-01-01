/**
 * MicrobiomeSonification v2 - THE LIVING SEA
 * 
 * A complete sonification system for metabolic pathway data.
 * 
 * CORE PRINCIPLES:
 * 1. Focus supersedes all - hover/click brings a pathway to the surface
 * 2. Visible-aware - only cycles through currently visible pathways
 * 3. Hierarchical cycling - subcategory, category, and cross-category rotation
 * 4. No duplicate frequencies - one oscillator per unique ratio
 * 5. Fair representation - everything gets heard eventually
 * 6. Configurable speed - from meditative to bubbling
 * 7. Delay/reverb - sounds linger and breathe
 * 
 * LAYERS:
 * - Focus: The fish in your hands (supersedes all)
 * - Foundation: Always-on dominant pathways (gentle breathing)
 * - Slow Rotation: Category-level movement (4-8s cycles)
 * - Medium Rotation: Subcategory movement (1-3s cycles)  
 * - Fast Bubbles: Individual sparkles (0.1-0.5s)
 */

class MicrobiomeSonification extends AudioWorkletProcessor {
    constructor() {
        super();
        
        // ╔════════════════════════════════════════════════════════════╗
        // ║  LAYER CONFIGURATION                                       ║
        // ╚════════════════════════════════════════════════════════════╝
        
        this.LAYERS = {
            focus: {
                volume: 0.5,           // Prominent when focused
                duckOthers: 0.15,      // How much to duck everything else
                attackTime: 0.08,      // Quick fade in
                releaseTime: 0.3,      // Gentle fade out
            },
            
            foundation: {
                count: 8,              // Top N pathways (within visible)
                volume: 0.2,           // Reduced to leave headroom
                breathRate: 0.018,     // Very slow breathing
                breathDepth: 0.12,     // Gentle variation
            },
            
            slow: {
                name: 'slow',
                maxVoices: 6,
                cycleTime: [5.0, 10.0],   // Seconds between activations
                envelope: {
                    attack: [2.0, 4.0],
                    sustain: [6.0, 15.0],
                    release: [3.0, 5.0],
                },
                volume: 0.25,
                description: 'Category-level rotation',
            },
            
            medium: {
                name: 'medium',
                maxVoices: 12,
                cycleTime: [1.0, 3.0],
                envelope: {
                    attack: [0.5, 1.5],
                    sustain: [2.0, 5.0],
                    release: [1.0, 2.0],
                },
                volume: 0.18,
                description: 'Subcategory rotation',
            },
            
            fast: {
                name: 'fast',
                maxVoices: 20,
                cycleTime: [0.08, 0.4],
                envelope: {
                    attack: [0.02, 0.1],
                    sustain: [0.1, 0.4],
                    release: [0.05, 0.2],
                },
                volume: 0.12,
                description: 'Individual bubbles',
            },
        };
        
        // ╔════════════════════════════════════════════════════════════╗
        // ║  MODULATION CONFIGURATION                                  ║
        // ╚════════════════════════════════════════════════════════════╝
        
        this.MOD_CONFIG = {
            globalLFOs: [
                { rate: 0.017, depth: 0.025 },
                { rate: 0.053, depth: 0.035 },
                { rate: 0.11, depth: 0.018 }
            ],
            
            pathwayLFO: {
                minDepth: 0.04,
                maxDepth: 0.18,
                minRate: 0.04,
                maxRate: 0.18,
            },
            
            peristalsis: {
                rate: 0.04,
                driftRate: 0.01,
            },
        };
        
        // ╔════════════════════════════════════════════════════════════╗
        // ║  CHORUS CONFIGURATION                                      ║
        // ╚════════════════════════════════════════════════════════════╝
        
        this.CHORUS = {
            voices: 3,
            baseDelayMs: 12,
            modDepthMs: 4,
            rates: [0.13, 0.19, 0.26],
            maxSend: 0.28,
            feedback: 0.08,
        };
        
        // ╔════════════════════════════════════════════════════════════╗
        // ║  DELAY CONFIGURATION (for lingering)                       ║
        // ╚════════════════════════════════════════════════════════════╝
        
        this.DELAY = {
            timeMs: 180,              // Delay time
            feedback: 0.25,           // How much repeats
            wetMix: 0.2,              // Dry/wet balance
            highCut: 0.7,             // Darken repeats (0-1)
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
        // ║  STATE                                                     ║
        // ╚════════════════════════════════════════════════════════════╝
        
        // Pathway data
        this.pathways = [];
        this.pathwayById = new Map();
        
        // Ratio deduplication: ratio (as string) → oscillator state
        this.oscillators = new Map();
        // Ratio → [pathway IDs that use this ratio]
        this.ratioToPathways = new Map();
        
        // Visibility (from UI filters)
        this.visibleIds = new Set();  // Empty = all visible
        this.allVisible = true;
        
        // Focus state
        this.focusedId = null;
        this.focusEnvelope = 0;
        this.focusTargetEnvelope = 0;
        
        // Category state
        this.categoryState = {};
        this.categoryGains = {};
        
        // Layer cycling state
        this.layerState = {
            slow: { lastCycle: 0, nextCycleIn: 5, activeVoices: [] },
            medium: { lastCycle: 0, nextCycleIn: 1.5, activeVoices: [] },
            fast: { lastCycle: 0, nextCycleIn: 0.2, activeVoices: [] },
        };
        
        // Fairness tracking: pathway ID → time since last sounded
        this.lastSounded = new Map();
        
        // Foundation state
        this.foundationIds = new Set();
        
        // Global modulation
        this.globalLfoPhases = this.MOD_CONFIG.globalLFOs.map(() => Math.random() * Math.PI * 2);
        this.peristalsisPhase = Math.random() * Math.PI * 2;
        this.peristalsisDrift = Math.random() * Math.PI * 2;
        
        // Audio state
        this.fundamental = 600;
        this.masterVolume = 0.35;
        this.sampleRate = 48000;
        this.time = 0;
        
        // Effects (initialized in init)
        this.chorusReady = false;
        this.delayReady = false;
        
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
                // UI tells us which pathways are currently visible
                this.visibleIds = new Set(data.ids);
                this.allVisible = data.ids.length === 0 || data.ids.length === this.pathways.length;
                this.updateFoundation();
                break;
                
            case 'setFocus':
                // Hover dwell or click focus
                this.focusedId = data.id;
                this.focusTargetEnvelope = data.id ? 1.0 : 0.0;
                break;
                
            case 'setLayerConfig':
                // Runtime adjustment
                if (this.LAYERS[data.layer]) {
                    Object.assign(this.LAYERS[data.layer], data.config);
                }
                break;
                
            case 'setSpeed':
                // Preset speed modes
                this.applySpeedPreset(data.preset);
                break;
                
            case 'setDelayConfig':
                Object.assign(this.DELAY, data);
                break;
                
            case 'triggerPathway':
                // Manual trigger
                this.triggerPathway(data.id, data.layer || 'medium');
                break;
        }
    }
    
    applySpeedPreset(preset) {
        switch (preset) {
            case 'meditative':
                this.LAYERS.slow.cycleTime = [8.0, 15.0];
                this.LAYERS.medium.cycleTime = [3.0, 6.0];
                this.LAYERS.fast.cycleTime = [0.5, 1.5];
                this.LAYERS.fast.maxVoices = 8;
                break;
                
            case 'balanced':
                this.LAYERS.slow.cycleTime = [5.0, 10.0];
                this.LAYERS.medium.cycleTime = [1.0, 3.0];
                this.LAYERS.fast.cycleTime = [0.08, 0.4];
                this.LAYERS.fast.maxVoices = 20;
                break;
                
            case 'bubbling':
                this.LAYERS.slow.cycleTime = [3.0, 6.0];
                this.LAYERS.medium.cycleTime = [0.5, 1.5];
                this.LAYERS.fast.cycleTime = [0.03, 0.15];
                this.LAYERS.fast.maxVoices = 35;
                break;
        }
    }
    
    // ╔════════════════════════════════════════════════════════════════╗
    // ║  INITIALIZATION                                                ║
    // ╚════════════════════════════════════════════════════════════════╝
    
    initPathways(pathwayData) {
        this.sampleRate = globalThis.sampleRate || 48000;
        
        // Find max abundance
        const maxAbund = Math.max(...pathwayData.map(p => p.amplitude || 0.001));
        
        // Build pathway objects
        this.pathways = pathwayData.map((p, i) => {
            const abundance = (p.amplitude || 0.001) / maxAbund;
            const cat = p.category || 'other';
            const catCfg = this.CATEGORIES[cat] || this.CATEGORIES.other;
            
            // LFO parameters based on abundance
            const stability = Math.sqrt(abundance);
            const lfoDepth = this.MOD_CONFIG.pathwayLFO.minDepth + 
                (1 - stability) * (this.MOD_CONFIG.pathwayLFO.maxDepth - this.MOD_CONFIG.pathwayLFO.minDepth);
            const lfoRate = this.MOD_CONFIG.pathwayLFO.minRate +
                Math.random() * (this.MOD_CONFIG.pathwayLFO.maxRate - this.MOD_CONFIG.pathwayLFO.minRate);
            
            return {
                id: p.id,
                index: i,
                ratio: p.ratio,
                ratioKey: `${p.ratio}`,  // String key for deduplication
                category: cat,
                subcategory: p.subcategory || 'Other',
                
                abundance,
                baseVolume: Math.pow(abundance, 1.8),  // Moderate exponent
                
                // Per-pathway modulation
                lfoPhase: Math.random() * Math.PI * 2,
                lfoRate,
                lfoDepth,
                currentLfoMod: 1.0,
                
                // Panning
                basePan: catCfg.panHome + (Math.random() - 0.5) * catCfg.panRange,
                currentPan: catCfg.panHome,
                
                // Envelope state (for rotation layers)
                isActive: false,
                activeLayer: null,
                envelopePhase: 'off',
                envelopeTime: 0,
                envelopeValue: 0,
                attackTime: 0,
                sustainTime: 0,
                releaseTime: 0,
                
                // Foundation breathing
                breathPhase: Math.random() * Math.PI * 2,
                isFoundation: false,
            };
        });
        
        // Build lookup
        this.pathwayById = new Map(this.pathways.map(p => [p.id, p]));
        
        // Build ratio → pathways mapping and create oscillators
        this.buildOscillatorMap();
        
        // Initialize category state
        for (const cat in this.CATEGORIES) {
            this.categoryState[cat] = {
                pan: this.CATEGORIES[cat].panHome,
                chorusSend: this.CATEGORIES[cat].chorusSendBase,
                chorusSendPhase: Math.random() * Math.PI * 2,
            };
            this.categoryGains[cat] = 1.0;
        }
        
        // Initialize fairness tracking
        for (const p of this.pathways) {
            this.lastSounded.set(p.id, 0);
        }
        
        // Set initial foundation
        this.updateFoundation();
        
        // Initialize effects
        this.initChorus();
        this.initDelay();
        
        // Report
        this.port.postMessage({
            type: 'ready',
            count: this.pathways.length,
            uniqueRatios: this.oscillators.size,
            categories: Object.keys(this.CATEGORIES),
        });
        
        console.log(`MicrobiomeSonification v2 initialized`);
        console.log(`  ${this.pathways.length} pathways`);
        console.log(`  ${this.oscillators.size} unique ratios (oscillators)`);
    }
    
    buildOscillatorMap() {
        this.oscillators.clear();
        this.ratioToPathways.clear();
        
        for (const p of this.pathways) {
            const key = p.ratioKey;
            
            // Track which pathways share this ratio
            if (!this.ratioToPathways.has(key)) {
                this.ratioToPathways.set(key, []);
            }
            this.ratioToPathways.get(key).push(p.id);
            
            // Create oscillator if new ratio
            if (!this.oscillators.has(key)) {
                this.oscillators.set(key, {
                    ratio: p.ratio,
                    phase: Math.random() * Math.PI * 2,
                    // Aggregated state from all pathways using this ratio
                    amplitude: 0,
                    targetAmplitude: 0,
                    pan: 0,
                    chorusSend: 0,
                });
            }
        }
    }
    
    updateFoundation() {
        // Get visible pathways sorted by abundance
        const visible = this.getVisiblePathways();
        visible.sort((a, b) => b.abundance - a.abundance);
        
        // Top N become foundation
        const count = Math.min(this.LAYERS.foundation.count, visible.length);
        
        // Clear old foundation
        for (const p of this.pathways) {
            p.isFoundation = false;
        }
        this.foundationIds.clear();
        
        // Set new foundation
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
        const maxDelay = Math.ceil(500 * this.sampleRate / 1000);  // 500ms max
        
        this.delayBufferL = new Float32Array(maxDelay);
        this.delayBufferR = new Float32Array(maxDelay);
        this.delayBufferSize = maxDelay;
        this.delayWriteIdx = 0;
        this.delayFilterL = 0;
        this.delayFilterR = 0;
        this.delayReady = true;
    }
    
    // ╔════════════════════════════════════════════════════════════════╗
    // ║  LAYER CYCLING                                                 ║
    // ╚════════════════════════════════════════════════════════════════╝
    
    updateLayerCycles(dt) {
        for (const layerName of ['slow', 'medium', 'fast']) {
            const layer = this.LAYERS[layerName];
            const state = this.layerState[layerName];
            
            state.lastCycle += dt;
            
            // Time for new activation?
            if (state.lastCycle >= state.nextCycleIn) {
                this.tryActivateInLayer(layerName);
                
                // Schedule next
                const [min, max] = layer.cycleTime;
                state.nextCycleIn = min + Math.random() * (max - min);
                state.lastCycle = 0;
            }
            
            // Clean up finished voices
            state.activeVoices = state.activeVoices.filter(id => {
                const p = this.pathwayById.get(id);
                return p && p.isActive && p.activeLayer === layerName;
            });
        }
    }
    
    tryActivateInLayer(layerName) {
        const layer = this.LAYERS[layerName];
        const state = this.layerState[layerName];
        
        // Check polyphony
        if (state.activeVoices.length >= layer.maxVoices) return;
        
        // Get candidates: visible, not active, not foundation, not focused
        const candidates = this.getVisiblePathways().filter(p =>
            !p.isActive &&
            !p.isFoundation &&
            p.id !== this.focusedId
        );
        
        if (candidates.length === 0) return;
        
        // Fairness: prioritize pathways that haven't played recently
        candidates.sort((a, b) => {
            const aLast = this.lastSounded.get(a.id) || 0;
            const bLast = this.lastSounded.get(b.id) || 0;
            // Older = higher priority, but add randomness
            return (aLast - bLast) + (Math.random() - 0.5) * this.time * 0.5;
        });
        
        // Pick from top candidates with some randomness
        const pickIndex = Math.floor(Math.random() * Math.min(5, candidates.length));
        const chosen = candidates[pickIndex];
        
        this.activatePathway(chosen, layerName);
    }
    
    activatePathway(pathway, layerName) {
        const layer = this.LAYERS[layerName];
        const env = layer.envelope;
        const rand = () => 0.75 + Math.random() * 0.5;
        
        pathway.isActive = true;
        pathway.activeLayer = layerName;
        pathway.envelopePhase = 'attack';
        pathway.envelopeTime = 0;
        pathway.envelopeValue = 0;
        
        pathway.attackTime = (env.attack[0] + Math.random() * (env.attack[1] - env.attack[0])) * rand();
        pathway.sustainTime = (env.sustain[0] + Math.random() * (env.sustain[1] - env.sustain[0])) * rand();
        pathway.releaseTime = (env.release[0] + Math.random() * (env.release[1] - env.release[0])) * rand();
        
        this.layerState[layerName].activeVoices.push(pathway.id);
        this.lastSounded.set(pathway.id, this.time);
    }
    
    triggerPathway(id, layerName) {
        const p = this.pathwayById.get(id);
        if (p && !p.isActive) {
            this.activatePathway(p, layerName);
        }
    }
    
    // ╔════════════════════════════════════════════════════════════════╗
    // ║  ENVELOPE & MODULATION UPDATES                                 ║
    // ╚════════════════════════════════════════════════════════════════╝
    
    updateEnvelopes(dt) {
        const foundationCfg = this.LAYERS.foundation;
        
        for (const p of this.pathways) {
            // Foundation: continuous gentle breathing
            if (p.isFoundation) {
                p.breathPhase += Math.PI * 2 * foundationCfg.breathRate * dt;
                if (p.breathPhase > Math.PI * 2) p.breathPhase -= Math.PI * 2;
                
                const breath = Math.sin(p.breathPhase) * foundationCfg.breathDepth;
                p.envelopeValue = foundationCfg.volume * (1 + breath);
                p.isActive = true;
                p.activeLayer = 'foundation';
                continue;
            }
            
            // Non-active pathways
            if (!p.isActive) {
                p.envelopeValue = 0;
                continue;
            }
            
            // Active in a rotation layer
            p.envelopeTime += dt;
            
            switch (p.envelopePhase) {
                case 'attack':
                    p.envelopeValue = p.envelopeTime / p.attackTime;
                    if (p.envelopeTime >= p.attackTime) {
                        p.envelopePhase = 'sustain';
                        p.envelopeTime = 0;
                        p.envelopeValue = 1.0;
                    }
                    break;
                    
                case 'sustain':
                    // Gentle drift
                    p.breathPhase += Math.PI * 2 * 0.025 * dt;
                    p.envelopeValue = 1.0 + Math.sin(p.breathPhase) * 0.06;
                    
                    if (p.envelopeTime >= p.sustainTime) {
                        p.envelopePhase = 'release';
                        p.envelopeTime = 0;
                    }
                    break;
                    
                case 'release':
                    const progress = p.envelopeTime / p.releaseTime;
                    p.envelopeValue = (1 + Math.cos(progress * Math.PI)) / 2;
                    
                    if (p.envelopeTime >= p.releaseTime) {
                        p.envelopePhase = 'off';
                        p.envelopeValue = 0;
                        p.isActive = false;
                        p.activeLayer = null;
                    }
                    break;
            }
            
            p.envelopeValue = Math.max(0, Math.min(1.1, p.envelopeValue));
        }
        
        // Focus envelope (smooth)
        const focusCfg = this.LAYERS.focus;
        const focusRate = this.focusTargetEnvelope > this.focusEnvelope
            ? 1.0 / focusCfg.attackTime
            : 1.0 / focusCfg.releaseTime;
        
        this.focusEnvelope += (this.focusTargetEnvelope - this.focusEnvelope) * focusRate * dt * 10;
    }
    
    updateGlobalMod(dt) {
        const twoPi = Math.PI * 2;
        let combined = 1.0;
        
        for (let i = 0; i < this.MOD_CONFIG.globalLFOs.length; i++) {
            const lfo = this.MOD_CONFIG.globalLFOs[i];
            this.globalLfoPhases[i] += twoPi * lfo.rate * dt;
            if (this.globalLfoPhases[i] > twoPi) this.globalLfoPhases[i] -= twoPi;
            combined *= 1.0 + Math.sin(this.globalLfoPhases[i]) * lfo.depth;
        }
        
        // Peristalsis
        this.peristalsisPhase += twoPi * this.MOD_CONFIG.peristalsis.rate * dt;
        this.peristalsisDrift += twoPi * this.MOD_CONFIG.peristalsis.driftRate * dt;
        if (this.peristalsisPhase > twoPi) this.peristalsisPhase -= twoPi;
        if (this.peristalsisDrift > twoPi) this.peristalsisDrift -= twoPi;
        
        // Update category panning
        const wave = Math.sin(this.peristalsisPhase) + Math.sin(this.peristalsisDrift) * 0.3;
        for (const cat in this.CATEGORIES) {
            const cfg = this.CATEGORIES[cat];
            const state = this.categoryState[cat];
            state.pan += (cfg.panHome + wave * cfg.panRange * 0.4 - state.pan) * 0.012;
            
            // Chorus send modulation
            state.chorusSendPhase += twoPi * cfg.chorusSendRate * dt;
            const sendMod = Math.sin(state.chorusSendPhase) * 0.3;
            state.chorusSend = cfg.chorusSendBase * (1 + sendMod);
        }
        
        return combined;
    }
    
    updatePathwayMod(p, dt) {
        const twoPi = Math.PI * 2;
        p.lfoPhase += twoPi * p.lfoRate * dt;
        if (p.lfoPhase > twoPi) p.lfoPhase -= twoPi;
        
        p.currentLfoMod = 1.0 + Math.sin(p.lfoPhase) * p.lfoDepth;
        
        // Update pan
        const catState = this.categoryState[p.category] || this.categoryState.other;
        const targetPan = catState.pan + (p.basePan - catState.pan) * 0.3;
        p.currentPan += (targetPan - p.currentPan) * 0.03;
    }
    
    // ╔════════════════════════════════════════════════════════════════╗
    // ║  OSCILLATOR AGGREGATION                                        ║
    // ╚════════════════════════════════════════════════════════════════╝
    
    aggregateOscillators() {
        // Reset all oscillators
        for (const osc of this.oscillators.values()) {
            osc.targetAmplitude = 0;
            osc.pan = 0;
            osc.chorusSend = 0;
        }
        
        const focusCfg = this.LAYERS.focus;
        const focusActive = this.focusEnvelope > 0.01;
        const duckAmount = focusActive ? focusCfg.duckOthers + (1 - focusCfg.duckOthers) * (1 - this.focusEnvelope) : 1.0;
        
        // Aggregate from active pathways
        for (const p of this.pathways) {
            if (!p.isActive && p.id !== this.focusedId) continue;
            
            const osc = this.oscillators.get(p.ratioKey);
            if (!osc) continue;
            
            let volume = 0;
            
            // Is this the focused pathway?
            if (p.id === this.focusedId && this.focusEnvelope > 0.01) {
                volume = focusCfg.volume * this.focusEnvelope * p.currentLfoMod * 0.5;  // Less LFO on focus
            } else if (p.isActive) {
                // Get layer volume
                const layerVol = p.activeLayer ? (this.LAYERS[p.activeLayer]?.volume || 0.2) : 0.2;
                volume = p.baseVolume * p.envelopeValue * layerVol * p.currentLfoMod;
                
                // Duck if something is focused
                volume *= duckAmount;
            }
            
            // Category gain
            volume *= this.categoryGains[p.category] ?? 1.0;
            
            // Accumulate (multiple pathways can contribute to same ratio)
            osc.targetAmplitude += volume;
            
            // Weighted pan/chorus
            if (volume > 0) {
                const catState = this.categoryState[p.category];
                osc.pan += p.currentPan * volume;
                osc.chorusSend += (catState?.chorusSend || 0.3) * volume;
            }
        }
        
        // Normalize pan and chorus by amplitude
        for (const osc of this.oscillators.values()) {
            if (osc.targetAmplitude > 0) {
                osc.pan /= osc.targetAmplitude;
                osc.chorusSend /= osc.targetAmplitude;
            }
            osc.pan = Math.max(-1, Math.min(1, osc.pan));
            osc.chorusSend = Math.min(1, osc.chorusSend);
            
            // Smooth amplitude
            osc.amplitude += (osc.targetAmplitude - osc.amplitude) * 0.08;
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
            // Read delayed signal
            const delayedL = this.readBuffer(this.delayBufferL, this.delayBufferSize, this.delayWriteIdx, delaySamples);
            const delayedR = this.readBuffer(this.delayBufferR, this.delayBufferSize, this.delayWriteIdx, delaySamples);
            
            // Low-pass filter on feedback (darken repeats)
            this.delayFilterL += (delayedL - this.delayFilterL) * filterCoef;
            this.delayFilterR += (delayedR - this.delayFilterR) * filterCoef;
            
            // Write to buffer (input + filtered feedback)
            this.delayBufferL[this.delayWriteIdx] = inL[i] + this.delayFilterL * cfg.feedback;
            this.delayBufferR[this.delayWriteIdx] = inR[i] + this.delayFilterR * cfg.feedback;
            
            // Output
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
        
        // === UPDATE STATE ===
        this.updateLayerCycles(dt);
        this.updateEnvelopes(dt);
        const globalMod = this.updateGlobalMod(dt);
        
        // Update per-pathway modulation (only active ones)
        for (const p of this.pathways) {
            if (p.isActive || p.id === this.focusedId) {
                this.updatePathwayMod(p, dt);
            }
        }
        
        // Aggregate to oscillators
        this.aggregateOscillators();
        
        // === RENDER OSCILLATORS ===
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
        
        // === EFFECTS CHAIN ===
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
        
        // === SOFT LIMITING ===
        for (let i = 0; i < blockSize; i++) {
            channelL[i] = Math.tanh(channelL[i] * 0.6) * 0.9;
            if (channelR !== channelL) {
                channelR[i] = Math.tanh(channelR[i] * 0.6) * 0.9;
            }
        }
        
        // === REPORTING ===
        if (this.time - this.lastReport > this.reportInterval) {
            this.report();
            this.lastReport = this.time;
        }
        
        return true;
    }
    
    // ╔════════════════════════════════════════════════════════════════╗
    // ║  VISUAL REPORTING                                              ║
    // ╚════════════════════════════════════════════════════════════════╝
    
    report() {
        const activePathways = this.pathways
            .filter(p => p.isActive || p.id === this.focusedId)
            .map(p => ({
                id: p.id,
                layer: p.id === this.focusedId ? 'focus' : p.activeLayer,
                envelope: p.id === this.focusedId ? this.focusEnvelope : p.envelopeValue,
                envelopePhase: p.envelopePhase,
                lfoMod: p.currentLfoMod,
                pan: p.currentPan,
            }));
        
        const layerCounts = {
            focus: this.focusedId ? 1 : 0,
            foundation: this.pathways.filter(p => p.isFoundation).length,
            slow: this.layerState.slow.activeVoices.length,
            medium: this.layerState.medium.activeVoices.length,
            fast: this.layerState.fast.activeVoices.length,
        };
        
        this.port.postMessage({
            type: 'visualState',
            data: {
                time: this.time,
                focusedId: this.focusedId,
                focusEnvelope: this.focusEnvelope,
                layers: layerCounts,
                activeCount: activePathways.length,
                uniqueOscillators: [...this.oscillators.values()].filter(o => o.amplitude > 0.001).length,
                peristalsisPhase: this.peristalsisPhase,
                categories: Object.fromEntries(
                    Object.entries(this.categoryState).map(([k, v]) => [k, { pan: v.pan, chorusSend: v.chorusSend }])
                ),
                pathways: activePathways,
            }
        });
    }
}

registerProcessor('microbiome-sonification', MicrobiomeSonification);
