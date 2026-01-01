/**
 * HarmonicSynthProcessor v5 - CALM SEA + CHORUS
 * 
 * Categories ebb and flow into chorus at modulated rates.
 */

class HarmonicSynthProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        
        // ╔════════════════════════════════════════════════════════════╗
        // ║  MODULATION CONFIG                                         ║
        // ╚════════════════════════════════════════════════════════════╝
        
        this.MOD_CONFIG = {
            globalLFOs: [
                { rate: 0.02, depth: 0.03 },
                { rate: 0.067, depth: 0.04 },
                { rate: 0.15, depth: 0.02 }
            ],
            
            pathway: {
                minDepth: 0.05,
                maxDepth: 0.33,
                minRate: 0.05,
                maxRate: 0.33,
                rateFromRatio: 0.3
            },
            
            pan: {
                peristalsisRate: 0.067,
                driftRate: 0.015,
                maxCategoryRange: 0.6,
                consonanceSwayFactor: 0.30
            },
            
            visual: {
                maxModulation: 0.08,
                reportInterval: 0.033
            }
        };
        
        // ╔════════════════════════════════════════════════════════════╗
        // ║  CHORUS CONFIG                                             ║
        // ╚════════════════════════════════════════════════════════════╝
        
        this.CHORUS_CONFIG = {
            voices: 3,
            baseDelayMs: 12,
            modDepthMs: 4,
            rates: [0.18, 0.23, 0.31],
            maxSend: 0.35,           // Max wet amount when fully "in" chorus
            feedback: 0.08,
            stereoSpread: 0.7        // How much L/R differ
        };
        
        // ╔════════════════════════════════════════════════════════════╗
        // ║  CATEGORY CONFIG - Each has chorus send modulation         ║
        // ╚════════════════════════════════════════════════════════════╝
        
        this.categoryConfig = {
            energy: {
                panHome: 0.0,
                panRange: 0.4,
                lfoPhaseOffset: 0,
                // Chorus send modulation
                chorusSendRate: 0.04,      // How fast it ebbs/flows into chorus
                chorusSendDepth: 0.8,      // 0-1, how much the send varies
                chorusSendBase: 0.3,       // Baseline send (0-1)
                chorusSendPhase: 0         // Starting phase offset
            },
            biosynthesis: {
                panHome: 0.55,
                panRange: 0.3,
                lfoPhaseOffset: Math.PI * 0.4,
                chorusSendRate: 0.055,
                chorusSendDepth: 0.7,
                chorusSendBase: 0.4,
                chorusSendPhase: Math.PI * 0.5
            },
            degradation: {
                panHome: -0.55,
                panRange: 0.3,
                lfoPhaseOffset: Math.PI * 0.8,
                chorusSendRate: 0.033,
                chorusSendDepth: 0.9,
                chorusSendBase: 0.25,
                chorusSendPhase: Math.PI
            },
            salvage: {
                panHome: 0.3,
                panRange: 0.25,
                lfoPhaseOffset: Math.PI * 1.2,
                chorusSendRate: 0.045,
                chorusSendDepth: 0.6,
                chorusSendBase: 0.35,
                chorusSendPhase: Math.PI * 1.5
            },
            other: {
                panHome: -0.3,
                panRange: 0.25,
                lfoPhaseOffset: Math.PI * 1.6,
                chorusSendRate: 0.05,
                chorusSendDepth: 0.75,
                chorusSendBase: 0.3,
                chorusSendPhase: Math.PI * 0.3
            }
        };
        
        // ╔════════════════════════════════════════════════════════════╗
        // ║  STATE                                                     ║
        // ╚════════════════════════════════════════════════════════════╝
        
        this.pathways = [];
        this.phases = [];
        
        this.fundamental = 660;
        this.masterVolume = 0.3;
        this.sampleRate = 48000;
        this.time = 0;
        
        this.globalLfoPhases = this.MOD_CONFIG.globalLFOs.map(() => Math.random() * Math.PI * 2);
        this.peristalsisPhase = Math.random() * Math.PI * 2;
        this.peristalsisDriftPhase = Math.random() * Math.PI * 2;
        
        // Per-category dynamic state
        this.categoryState = {};
        for (const cat in this.categoryConfig) {
            const cfg = this.categoryConfig[cat];
            this.categoryState[cat] = {
                pan: cfg.panHome,
                chorusSendPhase: cfg.chorusSendPhase,
                currentChorusSend: cfg.chorusSendBase  // Current modulated send
            };
        }
        
        this.categoryGains = {
            energy: 1.0, biosynthesis: 1.0, degradation: 1.0, salvage: 1.0, other: 1.0
        };
        
        this.subcategoryGains = {
            'Glycolysis/Gluconeogenesis': 1.0,
            'Glyoxylate Cycle': 1.0,
            'Fermentation': 1.0,
            'TCA Cycle': 1.0,
            'Pentose Phosphate': 1.0,
            'Respiration': 1.0
        };
        
        this.focusedId = null;
        this.focusBoost = 1.5;
        this.duckAmount = 1.0;
        this.targetFocusBoost = 1.0;
        this.targetDuckAmount = 1.0;
        
        this.smoothingFactor = 0.997;
        this.lastReportTime = 0;
        
        // Chorus (initialized properly in initPathways)
        this.chorusReady = false;
        
        this.port.onmessage = (event) => this.handleMessage(event.data);
    }
    
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
            case 'setSubcategoryGain':
                this.subcategoryGains[data.subcategory] = data.gain;
                break;
            case 'setCategoryChorusSend':
                // Adjust a category's chorus behavior at runtime
                const cfg = this.categoryConfig[data.category];
                if (cfg) {
                    if (data.rate !== undefined) cfg.chorusSendRate = data.rate;
                    if (data.depth !== undefined) cfg.chorusSendDepth = data.depth;
                    if (data.base !== undefined) cfg.chorusSendBase = data.base;
                }
                break;
            case 'setFocus':
                this.focusedId = data.id;
                if (data.id) {
                    this.targetFocusBoost = Math.pow(10, data.boostDb / 20);
                    this.targetDuckAmount = Math.pow(10, data.duckDb / 20);
                } else {
                    this.targetFocusBoost = 1.0;
                    this.targetDuckAmount = 1.0;
                }
                break;
            case 'setPathwayAmplitudes':
                data.forEach(({ id, amplitude }) => {
                    const pathway = this.pathways.find(p => p.id === id);
                    if (pathway) {
                        pathway.targetAmplitude = amplitude;
                        pathway.baseAmplitude = amplitude;
                    }
                });
                break;
            case 'addCategory':
                // Future-proof: add new categories at runtime
                this.categoryConfig[data.name] = {
                    panHome: data.panHome || 0,
                    panRange: data.panRange || 0.3,
                    lfoPhaseOffset: data.lfoPhaseOffset || Math.random() * Math.PI * 2,
                    chorusSendRate: data.chorusSendRate || 0.04,
                    chorusSendDepth: data.chorusSendDepth || 0.7,
                    chorusSendBase: data.chorusSendBase || 0.3,
                    chorusSendPhase: data.chorusSendPhase || Math.random() * Math.PI * 2
                };
                this.categoryState[data.name] = {
                    pan: data.panHome || 0,
                    chorusSendPhase: data.chorusSendPhase || Math.random() * Math.PI * 2,
                    currentChorusSend: data.chorusSendBase || 0.3
                };
                this.categoryGains[data.name] = 1.0;
                break;
        }
    }
    
    initPathways(pathwayData) {
        this.sampleRate = globalThis.sampleRate || 48000;
        const cfg = this.MOD_CONFIG.pathway;
        
        this.pathways = pathwayData.map((p) => {
            const abundance = p.amplitude || 0.5;
            const stability = Math.sqrt(abundance);
            const lfoDepth = cfg.minDepth + (1 - stability) * (cfg.maxDepth - cfg.minDepth);
            const ratioInfluence = Math.min(p.ratio / 15, 1) * cfg.rateFromRatio;
            const randomVariation = (Math.random() - 0.5) * 0.04;
            const lfoRate = cfg.minRate + ratioInfluence * (cfg.maxRate - cfg.minRate) + randomVariation;
            
            const normalizedRatio = Math.min(p.ratio / 20, 1);
            const panOffset = normalizedRatio * this.MOD_CONFIG.pan.consonanceSwayFactor;
            
            return {
                id: p.id,
                ratio: p.ratio,
                baseAmplitude: p.amplitude,
                amplitude: p.amplitude,
                targetAmplitude: p.amplitude,
                category: p.category || 'energy',
                subcategory: p.subcategory || 'Other',
                
                stability,
                lfoDepth,
                lfoRate,
                lfoPhases: [
                    Math.random() * Math.PI * 2,
                    Math.random() * Math.PI * 2,
                    Math.random() * Math.PI * 2
                ],
                panOffset,
                
                smoothedMod: 1.0,
                smoothedPan: 0,
                currentLfoMod: 1.0,
                currentPan: 0
            };
        });
        
        this.phases = this.pathways.map(() => Math.random() * Math.PI * 2);
        
        // Init chorus
        this.initChorus();
        
        this.port.postMessage({
            type: 'ready',
            count: this.pathways.length,
            categories: Object.keys(this.categoryConfig),
            subcategories: [...new Set(this.pathways.map(p => p.subcategory))]
        });
    }
    
    initChorus() {
        const cfg = this.CHORUS_CONFIG;
        const sr = this.sampleRate;
        
        const maxDelaySamples = Math.ceil((cfg.baseDelayMs + cfg.modDepthMs + 5) * sr / 1000);
        
        this.chorusBufferL = new Float32Array(maxDelaySamples);
        this.chorusBufferR = new Float32Array(maxDelaySamples);
        this.chorusBufferSize = maxDelaySamples;
        this.chorusWriteIdx = 0;
        
        this.chorusLfoPhases = [];
        for (let v = 0; v < cfg.voices; v++) {
            this.chorusLfoPhases.push({
                L: Math.random() * Math.PI * 2,
                R: Math.random() * Math.PI * 2 + Math.PI * cfg.stereoSpread
            });
        }
        
        this.chorusFeedbackL = 0;
        this.chorusFeedbackR = 0;
        
        this.chorusReady = true;
    }
    
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
        
        // === UPDATE GLOBAL STATE ===
        const globalMod = this.updateGlobalLFOs(dt);
        this.updatePeristalsis(dt);
        this.updateCategoryChorusSends(dt);
        
        this.focusBoost += (this.targetFocusBoost - this.focusBoost) * 0.03;
        this.duckAmount += (this.targetDuckAmount - this.duckAmount) * 0.03;
        
        // === CLEAR BUFFERS ===
        for (let i = 0; i < blockSize; i++) {
            channelL[i] = 0;
            if (channelR !== channelL) channelR[i] = 0;
        }
        
        // Temp buffers for dry signal (before chorus)
        const dryL = new Float32Array(blockSize);
        const dryR = new Float32Array(blockSize);
        
        // Per-sample chorus send (weighted by what's playing)
        const chorusSendL = new Float32Array(blockSize);
        const chorusSendR = new Float32Array(blockSize);
        
        // === PROCESS PATHWAYS ===
        for (let p = 0; p < this.pathways.length; p++) {
            const pathway = this.pathways[p];
            
            // Update pathway LFOs
            for (let l = 0; l < 3; l++) {
                const rate = pathway.lfoRate * (0.7 + l * 0.3);
                pathway.lfoPhases[l] += twoPi * rate * dt;
                if (pathway.lfoPhases[l] > twoPi) pathway.lfoPhases[l] -= twoPi;
            }
            
            // Amplitude modulation
            const lfo1 = Math.sin(pathway.lfoPhases[0]);
            const lfo2 = Math.sin(pathway.lfoPhases[1] * 1.3) * 0.6;
            const lfo3 = Math.sin(pathway.lfoPhases[2] * 0.7) * 0.4;
            const combinedLfo = (lfo1 + lfo2 + lfo3) / 2;
            let pathwayMod = 1.0 + combinedLfo * pathway.lfoDepth;
            
            let totalMod = pathwayMod * globalMod;
            
            const isFocused = pathway.id === this.focusedId;
            if (isFocused) {
                totalMod = totalMod * 0.15 + 0.85;
            }
            
            pathway.smoothedMod += (totalMod - pathway.smoothedMod) * 0.08;
            pathway.currentLfoMod = pathway.smoothedMod;
            
            pathway.amplitude += (pathway.targetAmplitude - pathway.amplitude) * (1 - this.smoothingFactor);
            
            const categoryGain = this.categoryGains[pathway.category] ?? 1.0;
            const subcategoryGain = this.subcategoryGains[pathway.subcategory] ?? 1.0;
            
            let focusGain = 1.0;
            if (this.focusedId) {
                focusGain = isFocused ? this.focusBoost : this.duckAmount;
            }
            
            let finalAmp = pathway.amplitude 
                * categoryGain 
                * subcategoryGain 
                * focusGain
                * pathway.smoothedMod
                * this.masterVolume;
            
            finalAmp = Math.max(finalAmp, 0.0005);
            
            if (finalAmp < 0.0001) continue;
            
            // Panning
            const catConfig = this.categoryConfig[pathway.category] || this.categoryConfig.energy;
            const catState = this.categoryState[pathway.category] || this.categoryState.energy;
            
            const peristalsisInfluence = Math.sin(this.peristalsisPhase + catConfig.lfoPhaseOffset);
            let pan = catState.pan + pathway.panOffset * peristalsisInfluence;
            
            if (isFocused) pan *= 0.25;
            pan = Math.max(-1, Math.min(1, pan));
            
            pathway.smoothedPan += (pan - pathway.smoothedPan) * 0.05;
            pathway.currentPan = pathway.smoothedPan;
            
            const panAngle = (pathway.smoothedPan + 1) * Math.PI / 4;
            const gainL = Math.cos(panAngle);
            const gainR = Math.sin(panAngle);
            
            // This pathway's chorus send (from its category)
            const pathwayChorusSend = catState.currentChorusSend * this.CHORUS_CONFIG.maxSend;
            
            const freq = this.fundamental * pathway.ratio;
            
            for (let i = 0; i < blockSize; i++) {
                const sample = Math.sin(this.phases[p]) * finalAmp;
                
                const sampleL = sample * gainL;
                const sampleR = sample * gainR;
                
                dryL[i] += sampleL;
                dryR[i] += sampleR;
                
                // Accumulate chorus send weighted by signal
                chorusSendL[i] += sampleL * pathwayChorusSend;
                chorusSendR[i] += sampleR * pathwayChorusSend;
                
                this.phases[p] += (twoPi * freq) / sr;
                if (this.phases[p] > twoPi) this.phases[p] -= twoPi;
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
            channelL[i] = Math.tanh(channelL[i] * 0.6) * 0.95;
            if (channelR !== channelL) {
                channelR[i] = Math.tanh(channelR[i] * 0.6) * 0.95;
            }
        }
        
        // === REPORT ===
        if (this.time - this.lastReportTime > this.MOD_CONFIG.visual.reportInterval) {
            this.reportModulation();
            this.lastReportTime = this.time;
        }
        
        return true;
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
        const driftWave = Math.sin(this.peristalsisDriftPhase) * 0.35;
        const combined = (mainWave + driftWave) / 1.35;
        
        for (const cat in this.categoryConfig) {
            const cfg = this.categoryConfig[cat];
            const state = this.categoryState[cat];
            const target = cfg.panHome + combined * cfg.panRange;
            state.pan += (target - state.pan) * 0.02;
        }
    }
    
    updateCategoryChorusSends(dt) {
        const twoPi = Math.PI * 2;
        
        for (const cat in this.categoryConfig) {
            const cfg = this.categoryConfig[cat];
            const state = this.categoryState[cat];
            
            // Update this category's chorus send LFO
            state.chorusSendPhase += twoPi * cfg.chorusSendRate * dt;
            if (state.chorusSendPhase > twoPi) state.chorusSendPhase -= twoPi;
            
            // Smooth sine modulation: base ± (depth * base)
            const mod = Math.sin(state.chorusSendPhase);
            const target = cfg.chorusSendBase + mod * cfg.chorusSendDepth * cfg.chorusSendBase;
            
            // Clamp 0-1 and smooth
            state.currentChorusSend += (Math.max(0, Math.min(1, target)) - state.currentChorusSend) * 0.05;
        }
    }
    
    processChorus(dryL, dryR, sendL, sendR, outL, outR, blockSize) {
        const cfg = this.CHORUS_CONFIG;
        const sr = this.sampleRate;
        const twoPi = Math.PI * 2;
        
        const baseDelaySamples = cfg.baseDelayMs * sr / 1000;
        const modDepthSamples = cfg.modDepthMs * sr / 1000;
        
        for (let i = 0; i < blockSize; i++) {
            // Write send signal to delay (what goes INTO chorus)
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
            
            // Output = dry + wet (send already has the mix baked in)
            outL[i] = dryL[i] + wetL;
            if (outR !== outL) {
                outR[i] = dryR[i] + wetR;
            }
            
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
    
    reportModulation() {
        const maxVisualMod = this.MOD_CONFIG.visual.maxModulation;
        
        // Include category chorus sends in report
        const categoryData = {};
        for (const cat in this.categoryState) {
            categoryData[cat] = {
                pan: this.categoryState[cat].pan,
                chorusSend: this.categoryState[cat].currentChorusSend
            };
        }
        
        const modData = this.pathways.map(p => ({
            id: p.id,
            lfoMod: 1.0 + Math.max(-maxVisualMod, Math.min(maxVisualMod, p.currentLfoMod - 1.0)),
            pan: p.currentPan
        }));
        
        this.port.postMessage({
            type: 'modulation',
            data: {
                time: this.time,
                peristalsisPhase: this.peristalsisPhase,
                categories: categoryData,
                pathways: modData
            }
        });
    }
}

registerProcessor('harmonic-synth', HarmonicSynthProcessor);