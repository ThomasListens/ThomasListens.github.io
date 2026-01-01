/**
 * LivingMicrobiomeSynth v1 - THREE-LAYER CHURNING ECOSYSTEM
 * 
 * Merges the rich modulation system (LFOs, chorus, peristalsis)
 * with the breathing/activation system (envelopes, probability, polyphony)
 * 
 * THREE LAYERS:
 *   Foundation - Always on, dominant species, slow breathing
 *   Midground  - Rotating cast, long envelopes, harmonic texture  
 *   Sparkle    - Brief appearances, rare species, fireflies
 * 
 * All layers share the same modulation system when active.
 */

class LivingMicrobiomeSynth extends AudioWorkletProcessor {
    constructor() {
        super();
        
        // ╔════════════════════════════════════════════════════════════╗
        // ║  LAYER CONFIGURATION                                       ║
        // ╚════════════════════════════════════════════════════════════╝
        
        this.LAYER_CONFIG = {
            foundation: {
                name: 'foundation',
                count: 10,                    // Top N pathways by abundance
                volumeScale: 0.25,            // Reduced to leave headroom
                breathRate: 0.02,             // Very slow breathing
                breathDepth: 0.15,            // Gentle amplitude variation
                alwaysActive: true,
            },
            
            midground: {
                name: 'midground',
                maxActive: 25,                // Max simultaneous voices
                abundanceRange: [0.05, 0.8],  // Which pathways belong here
                activationProb: 0.08,         // Base probability per check
                checkInterval: 0.15,          // Seconds between checks
                envelope: {
                    attack: [1.5, 3.0],       // [min, max] seconds
                    sustain: [4.0, 12.0],
                    release: [2.0, 4.0],
                },
            },
            
            sparkle: {
                name: 'sparkle',
                maxActive: 15,
                abundanceRange: [0.0, 0.15],  // Rarest pathways
                activationProb: 0.04,
                checkInterval: 0.2,
                envelope: {
                    attack: [0.05, 0.3],      // Quick fade in
                    sustain: [0.2, 1.5],      // Brief presence
                    release: [0.1, 0.5],      // Quick fade out
                },
            },
        };
        
        // ╔════════════════════════════════════════════════════════════╗
        // ║  MODULATION CONFIGURATION (from HarmonicSynth v5)          ║
        // ╚════════════════════════════════════════════════════════════╝
        
        this.MOD_CONFIG = {
            globalLFOs: [
                { rate: 0.02, depth: 0.03 },
                { rate: 0.067, depth: 0.04 },
                { rate: 0.15, depth: 0.02 }
            ],
            
            pathway: {
                minDepth: 0.05,
                maxDepth: 0.25,
                minRate: 0.05,
                maxRate: 0.25,
                rateFromRatio: 0.3
            },
            
            pan: {
                peristalsisRate: 0.05,
                driftRate: 0.012,
                maxCategoryRange: 0.5,
            },
        };
        
        // ╔════════════════════════════════════════════════════════════╗
        // ║  CHORUS CONFIGURATION                                      ║
        // ╚════════════════════════════════════════════════════════════╝
        
        this.CHORUS_CONFIG = {
            voices: 3,
            baseDelayMs: 15,
            modDepthMs: 5,
            rates: [0.15, 0.21, 0.28],
            maxSend: 0.3,
            feedback: 0.1,
            stereoSpread: 0.6,
        };
        
        // ╔════════════════════════════════════════════════════════════╗
        // ║  CATEGORY CONFIGURATION                                    ║
        // ╚════════════════════════════════════════════════════════════╝
        
        this.categoryConfig = {
            energy: {
                panHome: 0.0, panRange: 0.35, lfoPhaseOffset: 0,
                chorusSendRate: 0.035, chorusSendDepth: 0.7, chorusSendBase: 0.35,
            },
            biosynthesis: {
                panHome: 0.5, panRange: 0.3, lfoPhaseOffset: Math.PI * 0.4,
                chorusSendRate: 0.045, chorusSendDepth: 0.6, chorusSendBase: 0.4,
            },
            degradation: {
                panHome: -0.5, panRange: 0.3, lfoPhaseOffset: Math.PI * 0.8,
                chorusSendRate: 0.028, chorusSendDepth: 0.8, chorusSendBase: 0.3,
            },
            salvage: {
                panHome: 0.25, panRange: 0.25, lfoPhaseOffset: Math.PI * 1.2,
                chorusSendRate: 0.04, chorusSendDepth: 0.5, chorusSendBase: 0.35,
            },
            superpathways: {
                panHome: 0.0, panRange: 0.5, lfoPhaseOffset: Math.PI * 0.2,
                chorusSendRate: 0.05, chorusSendDepth: 0.6, chorusSendBase: 0.45,
            },
            other: {
                panHome: -0.25, panRange: 0.3, lfoPhaseOffset: Math.PI * 1.6,
                chorusSendRate: 0.038, chorusSendDepth: 0.65, chorusSendBase: 0.32,
            },
        };
        
        // ╔════════════════════════════════════════════════════════════╗
        // ║  VOLUME SCALING                                            ║
        // ╚════════════════════════════════════════════════════════════╝
        
        this.VOLUME_CONFIG = {
            exponent: 2.0,          // abundance^exponent for base volume
            floor: 0.005,           // Minimum volume
            ceiling: 1.0,           // Maximum volume
        };
        
        // ╔════════════════════════════════════════════════════════════╗
        // ║  STATE INITIALIZATION                                      ║
        // ╚════════════════════════════════════════════════════════════╝
        
        this.pathways = [];
        this.sortedByAbundance = [];
        
        this.fundamental = 600;
        this.masterVolume = 0.35;
        this.sampleRate = 48000;
        this.time = 0;
        
        // Global LFO state
        this.globalLfoPhases = this.MOD_CONFIG.globalLFOs.map(() => Math.random() * Math.PI * 2);
        
        // Peristalsis state
        this.peristalsisPhase = Math.random() * Math.PI * 2;
        this.peristalsisDriftPhase = Math.random() * Math.PI * 2;
        
        // Category state
        this.categoryState = {};
        for (const cat in this.categoryConfig) {
            this.categoryState[cat] = {
                pan: this.categoryConfig[cat].panHome,
                chorusSendPhase: Math.random() * Math.PI * 2,
                currentChorusSend: this.categoryConfig[cat].chorusSendBase,
            };
        }
        
        // Category gains (user-controllable)
        this.categoryGains = {};
        for (const cat in this.categoryConfig) {
            this.categoryGains[cat] = 1.0;
        }
        
        // Layer activation timing
        this.lastMidgroundCheck = 0;
        this.lastSparkleCheck = 0;
        
        // Focus state
        this.focusedId = null;
        this.focusBoost = 1.0;
        this.focusDuck = 1.0;
        this.targetFocusBoost = 1.0;
        this.targetFocusDuck = 1.0;
        
        // Chorus (initialized in initPathways)
        this.chorusReady = false;
        
        // Visual reporting
        this.lastReportTime = 0;
        this.reportInterval = 0.033;  // ~30fps
        
        this.port.onmessage = (event) => this.handleMessage(event.data);
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
                if (this.categoryGains.hasOwnProperty(data.category)) {
                    this.categoryGains[data.category] = data.gain;
                }
                break;
                
            case 'setFocus':
                this.focusedId = data.id;
                if (data.id) {
                    this.targetFocusBoost = Math.pow(10, (data.boostDb || 8) / 20);
                    this.targetFocusDuck = Math.pow(10, (data.duckDb || -6) / 20);
                } else {
                    this.targetFocusBoost = 1.0;
                    this.targetFocusDuck = 1.0;
                }
                break;
                
            case 'setLayerConfig':
                // Runtime adjustment of layer parameters
                if (data.layer && this.LAYER_CONFIG[data.layer]) {
                    Object.assign(this.LAYER_CONFIG[data.layer], data.config);
                }
                break;
                
            case 'setVolumeConfig':
                Object.assign(this.VOLUME_CONFIG, data);
                this.recalculateVolumes();
                break;
                
            case 'triggerPathway':
                // Manually trigger a specific pathway
                const p = this.pathways.find(pw => pw.id === data.id);
                if (p && !p.isActive) {
                    this.activatePathway(p, data.layer || p.assignedLayer);
                }
                break;
                
            case 'setChorusConfig':
                Object.assign(this.CHORUS_CONFIG, data);
                break;
        }
    }
    
    // ╔════════════════════════════════════════════════════════════════╗
    // ║  PATHWAY INITIALIZATION                                        ║
    // ╚════════════════════════════════════════════════════════════════╝
    
    initPathways(pathwayData) {
        this.sampleRate = globalThis.sampleRate || 48000;
        
        // Find max abundance for normalization
        const maxAbund = Math.max(...pathwayData.map(p => p.amplitude || 0.001));
        
        // Create pathway objects with full modulation state
        this.pathways = pathwayData.map((p, index) => {
            const rawAbundance = p.amplitude || 0.001;
            const normalizedAbundance = rawAbundance / maxAbund;
            
            // Volume scaling
            const vol = this.VOLUME_CONFIG;
            const baseVolume = Math.max(
                vol.floor,
                Math.min(vol.ceiling, Math.pow(normalizedAbundance, vol.exponent))
            );
            
            // Per-pathway LFO parameters (from HarmonicSynth)
            const modCfg = this.MOD_CONFIG.pathway;
            const stability = Math.sqrt(normalizedAbundance);
            const lfoDepth = modCfg.minDepth + (1 - stability) * (modCfg.maxDepth - modCfg.minDepth);
            const ratioInfluence = Math.min(p.ratio / 15, 1) * modCfg.rateFromRatio;
            const lfoRate = modCfg.minRate + ratioInfluence * (modCfg.maxRate - modCfg.minRate);
            
            // Category config
            const cat = p.category || 'other';
            const catCfg = this.categoryConfig[cat] || this.categoryConfig.other;
            
            // Random pan offset within category range
            const panOffset = (Math.random() - 0.5) * catCfg.panRange * 0.5;
            
            return {
                // Identity
                id: p.id,
                index: index,
                ratio: p.ratio,
                category: cat,
                subcategory: p.subcategory || 'Other',
                
                // Abundance & volume
                normalizedAbundance,
                baseVolume,
                currentVolume: 0,
                
                // Layer assignment (set after sorting)
                assignedLayer: null,
                
                // Activation state
                isActive: false,
                envelopePhase: 'off',  // 'off', 'attack', 'sustain', 'release'
                envelopeTime: 0,
                envelopeValue: 0,
                attackTime: 0,
                sustainTime: 0,
                releaseTime: 0,
                
                // Foundation breathing (for foundation layer)
                breathPhase: Math.random() * Math.PI * 2,
                
                // Per-pathway LFO state
                lfoDepth,
                lfoRate,
                lfoPhases: [
                    Math.random() * Math.PI * 2,
                    Math.random() * Math.PI * 2,
                    Math.random() * Math.PI * 2,
                ],
                currentLfoMod: 1.0,
                smoothedLfoMod: 1.0,
                
                // Panning
                panOffset,
                currentPan: catCfg.panHome + panOffset,
                smoothedPan: catCfg.panHome + panOffset,
                
                // Oscillator
                phase: Math.random() * Math.PI * 2,
                
                // For visual reporting
                chorusSendAmount: 0,
            };
        });
        
        // Sort by abundance (descending)
        this.sortedByAbundance = [...this.pathways].sort(
            (a, b) => b.normalizedAbundance - a.normalizedAbundance
        );
        
        // Assign layers based on abundance rank
        this.assignLayers();
        
        // Activate foundation layer
        this.activateFoundation();
        
        // Initialize chorus
        this.initChorus();
        
        // Report ready
        const layerCounts = {
            foundation: this.pathways.filter(p => p.assignedLayer === 'foundation').length,
            midground: this.pathways.filter(p => p.assignedLayer === 'midground').length,
            sparkle: this.pathways.filter(p => p.assignedLayer === 'sparkle').length,
        };
        
        this.port.postMessage({
            type: 'ready',
            count: this.pathways.length,
            layers: layerCounts,
        });
        
        console.log(`LivingMicrobiomeSynth initialized: ${this.pathways.length} pathways`);
        console.log(`  Foundation: ${layerCounts.foundation}`);
        console.log(`  Midground: ${layerCounts.midground}`);
        console.log(`  Sparkle: ${layerCounts.sparkle}`);
    }
    
    assignLayers() {
        const foundationCount = this.LAYER_CONFIG.foundation.count;
        const midRange = this.LAYER_CONFIG.midground.abundanceRange;
        const sparkleRange = this.LAYER_CONFIG.sparkle.abundanceRange;
        
        // Top N are foundation
        for (let i = 0; i < Math.min(foundationCount, this.sortedByAbundance.length); i++) {
            this.sortedByAbundance[i].assignedLayer = 'foundation';
        }
        
        // Rest are midground or sparkle based on abundance
        for (let i = foundationCount; i < this.sortedByAbundance.length; i++) {
            const p = this.sortedByAbundance[i];
            const abund = p.normalizedAbundance;
            
            if (abund >= midRange[0] && abund <= midRange[1]) {
                p.assignedLayer = 'midground';
            } else if (abund >= sparkleRange[0] && abund <= sparkleRange[1]) {
                p.assignedLayer = 'sparkle';
            } else {
                // Fallback: lower abundance = sparkle, higher = midground
                p.assignedLayer = abund < 0.1 ? 'sparkle' : 'midground';
            }
        }
    }
    
    activateFoundation() {
        const cfg = this.LAYER_CONFIG.foundation;
        
        for (const p of this.pathways) {
            if (p.assignedLayer === 'foundation') {
                p.isActive = true;
                p.envelopePhase = 'sustain';
                p.envelopeValue = 1.0;
                p.breathPhase = Math.random() * Math.PI * 2;
            }
        }
    }
    
    recalculateVolumes() {
        const vol = this.VOLUME_CONFIG;
        for (const p of this.pathways) {
            p.baseVolume = Math.max(
                vol.floor,
                Math.min(vol.ceiling, Math.pow(p.normalizedAbundance, vol.exponent))
            );
        }
    }
    
    // ╔════════════════════════════════════════════════════════════════╗
    // ║  CHORUS INITIALIZATION                                         ║
    // ╚════════════════════════════════════════════════════════════════╝
    
    initChorus() {
        const cfg = this.CHORUS_CONFIG;
        const sr = this.sampleRate;
        
        const maxDelaySamples = Math.ceil((cfg.baseDelayMs + cfg.modDepthMs + 10) * sr / 1000);
        
        this.chorusBufferL = new Float32Array(maxDelaySamples);
        this.chorusBufferR = new Float32Array(maxDelaySamples);
        this.chorusBufferSize = maxDelaySamples;
        this.chorusWriteIdx = 0;
        
        this.chorusLfoPhases = [];
        for (let v = 0; v < cfg.voices; v++) {
            this.chorusLfoPhases.push({
                L: Math.random() * Math.PI * 2,
                R: Math.random() * Math.PI * 2 + Math.PI * cfg.stereoSpread,
            });
        }
        
        this.chorusFeedbackL = 0;
        this.chorusFeedbackR = 0;
        
        this.chorusReady = true;
    }
    
    // ╔════════════════════════════════════════════════════════════════╗
    // ║  ACTIVATION SYSTEM                                             ║
    // ╚════════════════════════════════════════════════════════════════╝
    
    activatePathway(pathway, layer) {
        if (pathway.isActive) return false;
        
        const layerCfg = this.LAYER_CONFIG[layer];
        if (!layerCfg) return false;
        
        // Check polyphony limit for this layer
        if (!layerCfg.alwaysActive) {
            const activeInLayer = this.pathways.filter(
                p => p.isActive && p.assignedLayer === layer
            ).length;
            
            if (activeInLayer >= layerCfg.maxActive) return false;
        }
        
        // Set envelope times with randomization
        const env = layerCfg.envelope;
        const rand = () => 0.7 + Math.random() * 0.6;  // ±30%
        
        pathway.attackTime = (env.attack[0] + Math.random() * (env.attack[1] - env.attack[0])) * rand();
        pathway.sustainTime = (env.sustain[0] + Math.random() * (env.sustain[1] - env.sustain[0])) * rand();
        pathway.releaseTime = (env.release[0] + Math.random() * (env.release[1] - env.release[0])) * rand();
        
        pathway.isActive = true;
        pathway.envelopePhase = 'attack';
        pathway.envelopeTime = 0;
        pathway.envelopeValue = 0;
        
        return true;
    }
    
    checkLayerActivations(layer, dt) {
        const cfg = this.LAYER_CONFIG[layer];
        if (!cfg || cfg.alwaysActive) return;
        
        // Get candidates for this layer
        const candidates = this.pathways.filter(
            p => p.assignedLayer === layer && !p.isActive
        );
        
        if (candidates.length === 0) return;
        
        // Shuffle for fairness
        candidates.sort(() => Math.random() - 0.5);
        
        // Check activation probability
        for (const p of candidates) {
            // Scale probability by abundance (more abundant = more likely)
            const prob = cfg.activationProb * (0.3 + p.normalizedAbundance * 0.7);
            
            if (Math.random() < prob * cfg.checkInterval) {
                if (this.activatePathway(p, layer)) {
                    break;  // Only activate one per check
                }
            }
        }
    }
    
    // ╔════════════════════════════════════════════════════════════════╗
    // ║  ENVELOPE & MODULATION UPDATES                                 ║
    // ╚════════════════════════════════════════════════════════════════╝
    
    updateEnvelopes(dt) {
        const foundationCfg = this.LAYER_CONFIG.foundation;
        
        for (const p of this.pathways) {
            if (!p.isActive) continue;
            
            // Foundation layer: continuous with gentle breathing
            if (p.assignedLayer === 'foundation') {
                p.breathPhase += Math.PI * 2 * foundationCfg.breathRate * dt;
                if (p.breathPhase > Math.PI * 2) p.breathPhase -= Math.PI * 2;
                
                const breath = Math.sin(p.breathPhase) * foundationCfg.breathDepth;
                p.envelopeValue = foundationCfg.volumeScale * (1 + breath);
                continue;
            }
            
            // Other layers: standard ADSR
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
                    // Gentle variation during sustain
                    p.breathPhase += Math.PI * 2 * 0.03 * dt;
                    p.envelopeValue = 1.0 + Math.sin(p.breathPhase) * 0.08;
                    
                    if (p.envelopeTime >= p.sustainTime) {
                        p.envelopePhase = 'release';
                        p.envelopeTime = 0;
                    }
                    break;
                    
                case 'release':
                    // Smooth cosine release curve
                    const releaseProgress = p.envelopeTime / p.releaseTime;
                    p.envelopeValue = (1 + Math.cos(releaseProgress * Math.PI)) / 2;
                    
                    if (p.envelopeTime >= p.releaseTime) {
                        p.envelopePhase = 'off';
                        p.envelopeValue = 0;
                        p.isActive = false;
                    }
                    break;
            }
            
            p.envelopeValue = Math.max(0, Math.min(1.2, p.envelopeValue));
        }
    }
    
    updateGlobalLFOs(dt) {
        const twoPi = Math.PI * 2;
        let combined = 1.0;
        
        for (let i = 0; i < this.MOD_CONFIG.globalLFOs.length; i++) {
            const lfo = this.MOD_CONFIG.globalLFOs[i];
            this.globalLfoPhases[i] += twoPi * lfo.rate * dt;
            if (this.globalLfoPhases[i] > twoPi) this.globalLfoPhases[i] -= twoPi;
            combined *= 1.0 + Math.sin(this.globalLfoPhases[i]) * lfo.depth;
        }
        
        return combined;
    }
    
    updatePeristalsis(dt) {
        const twoPi = Math.PI * 2;
        const panCfg = this.MOD_CONFIG.pan;
        
        this.peristalsisPhase += twoPi * panCfg.peristalsisRate * dt;
        this.peristalsisDriftPhase += twoPi * panCfg.driftRate * dt;
        
        if (this.peristalsisPhase > twoPi) this.peristalsisPhase -= twoPi;
        if (this.peristalsisDriftPhase > twoPi) this.peristalsisDriftPhase -= twoPi;
        
        const mainWave = Math.sin(this.peristalsisPhase);
        const driftWave = Math.sin(this.peristalsisDriftPhase) * 0.3;
        const combined = (mainWave + driftWave) / 1.3;
        
        // Update category panning
        for (const cat in this.categoryConfig) {
            const cfg = this.categoryConfig[cat];
            const state = this.categoryState[cat];
            const target = cfg.panHome + combined * cfg.panRange * 0.5;
            state.pan += (target - state.pan) * 0.015;
        }
    }
    
    updateCategoryChorusSends(dt) {
        const twoPi = Math.PI * 2;
        
        for (const cat in this.categoryConfig) {
            const cfg = this.categoryConfig[cat];
            const state = this.categoryState[cat];
            
            state.chorusSendPhase += twoPi * cfg.chorusSendRate * dt;
            if (state.chorusSendPhase > twoPi) state.chorusSendPhase -= twoPi;
            
            const mod = Math.sin(state.chorusSendPhase);
            const target = cfg.chorusSendBase + mod * cfg.chorusSendDepth * cfg.chorusSendBase;
            state.currentChorusSend += (Math.max(0, Math.min(1, target)) - state.currentChorusSend) * 0.04;
        }
    }
    
    updatePathwayLFOs(pathway, dt) {
        const twoPi = Math.PI * 2;
        
        // Update pathway's three LFOs
        for (let l = 0; l < 3; l++) {
            const rate = pathway.lfoRate * (0.7 + l * 0.3);
            pathway.lfoPhases[l] += twoPi * rate * dt;
            if (pathway.lfoPhases[l] > twoPi) pathway.lfoPhases[l] -= twoPi;
        }
        
        // Combine LFOs
        const lfo1 = Math.sin(pathway.lfoPhases[0]);
        const lfo2 = Math.sin(pathway.lfoPhases[1] * 1.3) * 0.5;
        const lfo3 = Math.sin(pathway.lfoPhases[2] * 0.7) * 0.3;
        const combined = (lfo1 + lfo2 + lfo3) / 1.8;
        
        pathway.currentLfoMod = 1.0 + combined * pathway.lfoDepth;
        pathway.smoothedLfoMod += (pathway.currentLfoMod - pathway.smoothedLfoMod) * 0.06;
    }
    
    // ╔════════════════════════════════════════════════════════════════╗
    // ║  CHORUS PROCESSING                                             ║
    // ╚════════════════════════════════════════════════════════════════╝
    
    processChorus(dryL, dryR, sendL, sendR, outL, outR, blockSize) {
        const cfg = this.CHORUS_CONFIG;
        const sr = this.sampleRate;
        const twoPi = Math.PI * 2;
        
        const baseDelaySamples = cfg.baseDelayMs * sr / 1000;
        const modDepthSamples = cfg.modDepthMs * sr / 1000;
        
        for (let i = 0; i < blockSize; i++) {
            // Write to delay buffer
            this.chorusBufferL[this.chorusWriteIdx] = sendL[i] + this.chorusFeedbackL * cfg.feedback;
            this.chorusBufferR[this.chorusWriteIdx] = sendR[i] + this.chorusFeedbackR * cfg.feedback;
            
            let wetL = 0;
            let wetR = 0;
            
            for (let v = 0; v < cfg.voices; v++) {
                const rate = cfg.rates[v % cfg.rates.length];
                
                this.chorusLfoPhases[v].L += twoPi * rate / sr;
                this.chorusLfoPhases[v].R += twoPi * rate / sr;
                if (this.chorusLfoPhases[v].L > twoPi) this.chorusLfoPhases[v].L -= twoPi;
                if (this.chorusLfoPhases[v].R > twoPi) this.chorusLfoPhases[v].R -= twoPi;
                
                const modL = Math.sin(this.chorusLfoPhases[v].L);
                const modR = Math.sin(this.chorusLfoPhases[v].R);
                
                const delaySamplesL = baseDelaySamples + modL * modDepthSamples;
                const delaySamplesR = baseDelaySamples + modR * modDepthSamples;
                
                wetL += this.readDelayInterp(this.chorusBufferL, delaySamplesL);
                wetR += this.readDelayInterp(this.chorusBufferR, delaySamplesR);
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
    
    readDelayInterp(buffer, delaySamples) {
        const readPos = this.chorusWriteIdx - delaySamples;
        const readIdx = ((readPos % this.chorusBufferSize) + this.chorusBufferSize) % this.chorusBufferSize;
        
        const idx0 = Math.floor(readIdx);
        const idx1 = (idx0 + 1) % this.chorusBufferSize;
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
        
        // === LAYER ACTIVATION CHECKS ===
        if (this.time - this.lastMidgroundCheck > this.LAYER_CONFIG.midground.checkInterval) {
            this.checkLayerActivations('midground', dt);
            this.lastMidgroundCheck = this.time;
        }
        
        if (this.time - this.lastSparkleCheck > this.LAYER_CONFIG.sparkle.checkInterval) {
            this.checkLayerActivations('sparkle', dt);
            this.lastSparkleCheck = this.time;
        }
        
        // === UPDATE GLOBAL STATE ===
        const globalMod = this.updateGlobalLFOs(dt);
        this.updatePeristalsis(dt);
        this.updateCategoryChorusSends(dt);
        this.updateEnvelopes(dt);
        
        // Smooth focus transitions
        this.focusBoost += (this.targetFocusBoost - this.focusBoost) * 0.02;
        this.focusDuck += (this.targetFocusDuck - this.focusDuck) * 0.02;
        
        // === CLEAR BUFFERS ===
        const dryL = new Float32Array(blockSize);
        const dryR = new Float32Array(blockSize);
        const chorusSendL = new Float32Array(blockSize);
        const chorusSendR = new Float32Array(blockSize);
        
        // === PROCESS ACTIVE PATHWAYS ===
        let activeCount = 0;
        
        for (const p of this.pathways) {
            if (!p.isActive || p.envelopeValue < 0.001) continue;
            
            activeCount++;
            
            // Update per-pathway LFOs
            this.updatePathwayLFOs(p, dt);
            
            // Category state
            const catState = this.categoryState[p.category] || this.categoryState.other;
            const catCfg = this.categoryConfig[p.category] || this.categoryConfig.other;
            
            // Panning
            const peristalsisInfluence = Math.sin(this.peristalsisPhase + catCfg.lfoPhaseOffset);
            let targetPan = catState.pan + p.panOffset + peristalsisInfluence * 0.1;
            targetPan = Math.max(-1, Math.min(1, targetPan));
            p.smoothedPan += (targetPan - p.smoothedPan) * 0.04;
            p.currentPan = p.smoothedPan;
            
            const panAngle = (p.smoothedPan + 1) * Math.PI / 4;
            const gainL = Math.cos(panAngle);
            const gainR = Math.sin(panAngle);
            
            // Volume calculation
            const categoryGain = this.categoryGains[p.category] ?? 1.0;
            
            let focusGain = 1.0;
            if (this.focusedId) {
                focusGain = (p.id === this.focusedId) ? this.focusBoost : this.focusDuck;
            }
            
            const finalVolume = p.baseVolume
                * p.envelopeValue
                * p.smoothedLfoMod
                * globalMod
                * categoryGain
                * focusGain
                * this.masterVolume;
            
            if (finalVolume < 0.0001) continue;
            
            // Chorus send for this pathway
            const chorusSend = catState.currentChorusSend * this.CHORUS_CONFIG.maxSend;
            p.chorusSendAmount = chorusSend;
            
            // Frequency
            const freq = this.fundamental * p.ratio;
            const phaseInc = (twoPi * freq) / sr;
            
            // Render samples
            for (let i = 0; i < blockSize; i++) {
                const sample = Math.sin(p.phase) * finalVolume;
                
                const sampleL = sample * gainL;
                const sampleR = sample * gainR;
                
                dryL[i] += sampleL;
                dryR[i] += sampleR;
                
                chorusSendL[i] += sampleL * chorusSend;
                chorusSendR[i] += sampleR * chorusSend;
                
                p.phase += phaseInc;
                if (p.phase > twoPi) p.phase -= twoPi;
            }
        }
        
        // === APPLY CHORUS ===
        if (this.chorusReady) {
            this.processChorus(dryL, dryR, chorusSendL, chorusSendR, channelL, channelR, blockSize);
        } else {
            for (let i = 0; i < blockSize; i++) {
                channelL[i] = dryL[i];
                if (channelR !== channelL) channelR[i] = dryR[i];
            }
        }
        
        // === SOFT LIMITING ===
        for (let i = 0; i < blockSize; i++) {
            channelL[i] = Math.tanh(channelL[i] * 0.65) * 0.92;
            if (channelR !== channelL) {
                channelR[i] = Math.tanh(channelR[i] * 0.65) * 0.92;
            }
        }
        
        // === VISUAL REPORTING ===
        if (this.time - this.lastReportTime > this.reportInterval) {
            this.reportState(activeCount);
            this.lastReportTime = this.time;
        }
        
        return true;
    }
    
    // ╔════════════════════════════════════════════════════════════════╗
    // ║  VISUAL REPORTING                                              ║
    // ╚════════════════════════════════════════════════════════════════╝
    
    reportState(activeCount) {
        // Comprehensive state for visualization
        const pathwayData = this.pathways
            .filter(p => p.isActive)
            .map(p => ({
                id: p.id,
                layer: p.assignedLayer,
                envelope: p.envelopeValue,
                envelopePhase: p.envelopePhase,
                lfoMod: p.smoothedLfoMod,
                pan: p.currentPan,
                chorusSend: p.chorusSendAmount,
            }));
        
        const categoryData = {};
        for (const cat in this.categoryState) {
            categoryData[cat] = {
                pan: this.categoryState[cat].pan,
                chorusSend: this.categoryState[cat].currentChorusSend,
            };
        }
        
        const layerCounts = {
            foundation: this.pathways.filter(p => p.isActive && p.assignedLayer === 'foundation').length,
            midground: this.pathways.filter(p => p.isActive && p.assignedLayer === 'midground').length,
            sparkle: this.pathways.filter(p => p.isActive && p.assignedLayer === 'sparkle').length,
        };
        
        this.port.postMessage({
            type: 'visualState',
            data: {
                time: this.time,
                activeCount,
                layers: layerCounts,
                peristalsisPhase: this.peristalsisPhase,
                categories: categoryData,
                pathways: pathwayData,
            }
        });
    }
}

registerProcessor('living-microbiome', LivingMicrobiomeSynth);
