/**
 * BreathingSynthProcessor v1 - SKY FULL OF STARS
 * 
 * Instead of 600 continuous drones, pathways "breathe":
 * - Stochastic activation based on abundance
 * - Envelope-based fading (attack, sustain, release)
 * - Extreme dynamic range
 * - Polyphony limiting
 * 
 * The result: a living, twinkling, breathing soundscape
 */

class BreathingSynthProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        
        // ╔════════════════════════════════════════════════════════════╗
        // ║  BREATHING CONFIG                                          ║
        // ╚════════════════════════════════════════════════════════════╝
        
        this.BREATH_CONFIG = {
            // How many voices can sound simultaneously
            maxPolyphony: 64,
            
            // Volume scaling exponent (higher = more extreme difference)
            // 1.0 = linear, 2.0 = squared, 3.0 = cubed
            volumeExponent: 2.9,
            
            // Minimum volume floor (prevents total silence)
            volumeFloor: 0.001,
            
            // Base probability that a pathway will activate
            // Scaled by abundance: prob = baseProbability * abundance^probExponent
            baseProbability: 0.15,
            probExponent: 0.5,  // sqrt makes rare things more likely to appear occasionally
            
            // How often to check for new activations (seconds)
            activationCheckInterval: 0.1,
            
            // Envelope times (seconds) - scaled by abundance
            envelope: {
                // Abundant pathways: slow, gentle
                maxAttack: 2.0,
                maxSustain: 8.0,
                maxRelease: 3.0,
                
                // Rare pathways: quick sparkles
                minAttack: 0.1,
                minSustain: 0.3,
                minRelease: 0.2,
            },
            
            // "Always on" tier - most abundant pathways stay continuous
            alwaysOnCount: 32,  // Top N pathways are always sounding
            alwaysOnVolume: 0.3,  // But at reduced volume to leave room
        };
        
        // ╔════════════════════════════════════════════════════════════╗
        // ║  CATEGORY COLORS (for spatial separation)                  ║
        // ╚════════════════════════════════════════════════════════════╝
        
        this.categoryConfig = {
            energy:       { panHome:  0.0,  panRange: 0.3 },
            biosynthesis: { panHome:  0.5,  panRange: 0.3 },
            degradation:  { panHome: -0.5,  panRange: 0.3 },
            salvage:      { panHome:  0.3,  panRange: 0.2 },
            superpathways:{ panHome:  0.0,  panRange: 0.5 },
            other:        { panHome: -0.3,  panRange: 0.3 },
        };
        
        // ╔════════════════════════════════════════════════════════════╗
        // ║  STATE                                                     ║
        // ╚════════════════════════════════════════════════════════════╝
        
        this.pathways = [];
        this.sortedByAbundance = [];  // Indices sorted by abundance
        
        this.fundamental = 600;
        this.masterVolume = 0.4;
        this.sampleRate = 48000;
        this.time = 0;
        this.lastActivationCheck = 0;
        
        // Category gains (for mixing)
        this.categoryGains = {
            energy: 1.0, biosynthesis: 1.0, degradation: 1.0, 
            salvage: 1.0, superpathways: 1.0, other: 1.0
        };
        
        // Focus state
        this.focusedId = null;
        this.focusBoost = 1.0;
        this.duckAmount = 1.0;
        
        // Global LFO for gentle movement
        this.globalLfoPhase = 0;
        this.globalLfoRate = 0.03;
        
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
            case 'setFocus':
                this.focusedId = data.id;
                if (data.id) {
                    this.focusBoost = Math.pow(10, (data.boostDb || 6) / 20);
                    this.duckAmount = Math.pow(10, (data.duckDb || -6) / 20);
                } else {
                    this.focusBoost = 1.0;
                    this.duckAmount = 1.0;
                }
                break;
            case 'setBreathConfig':
                // Allow runtime tweaking
                Object.assign(this.BREATH_CONFIG, data);
                break;
            case 'triggerPathway':
                // Manual trigger for a specific pathway
                const p = this.pathways.find(pw => pw.id === data.id);
                if (p) this.activatePathway(p);
                break;
        }
    }
    
    initPathways(pathwayData) {
        this.sampleRate = globalThis.sampleRate || 48000;
        const cfg = this.BREATH_CONFIG;
        const env = cfg.envelope;
        
        // Find max abundance for normalization
        const maxAbund = Math.max(...pathwayData.map(p => p.amplitude || 0.001));
        
        this.pathways = pathwayData.map((p, index) => {
            const rawAbundance = p.amplitude || 0.001;
            const normalizedAbundance = rawAbundance / maxAbund;  // 0-1
            
            // Extreme volume scaling
            const volume = Math.pow(normalizedAbundance, cfg.volumeExponent);
            const clampedVolume = Math.max(cfg.volumeFloor, volume);
            
            // Activation probability (rare things still appear sometimes)
            const activationProb = cfg.baseProbability * Math.pow(normalizedAbundance, cfg.probExponent);
            
            // Envelope timing based on abundance
            // Abundant = slow and sustained, Rare = quick sparkles
            const t = normalizedAbundance;  // 0 = rare, 1 = abundant
            const attack = env.minAttack + t * (env.maxAttack - env.minAttack);
            const sustain = env.minSustain + t * (env.maxSustain - env.minSustain);
            const release = env.minRelease + t * (env.maxRelease - env.minRelease);
            
            // Random variation in timing (±30%)
            const variance = () => 0.7 + Math.random() * 0.6;
            
            // Panning based on category
            const catCfg = this.categoryConfig[p.category] || this.categoryConfig.other;
            const basePan = catCfg.panHome + (Math.random() - 0.5) * catCfg.panRange;
            
            return {
                id: p.id,
                index: index,
                ratio: p.ratio,
                category: p.category || 'other',
                subcategory: p.subcategory || 'Other',
                
                // Abundance & volume
                normalizedAbundance,
                baseVolume: clampedVolume,
                currentVolume: 0,  // Starts silent
                
                // Activation
                activationProb,
                isActive: false,
                
                // Envelope state
                envelopePhase: 'off',  // 'off', 'attack', 'sustain', 'release'
                envelopeTime: 0,
                attackTime: attack * variance(),
                sustainTime: sustain * variance(),
                releaseTime: release * variance(),
                envelopeValue: 0,
                
                // Oscillator
                phase: Math.random() * Math.PI * 2,
                
                // Panning
                pan: basePan,
                
                // Gentle per-pathway drift
                driftPhase: Math.random() * Math.PI * 2,
                driftRate: 0.02 + Math.random() * 0.03,
            };
        });
        
        // Sort indices by abundance (descending) for "always on" tier
        this.sortedByAbundance = this.pathways
            .map((p, i) => ({ index: i, abundance: p.normalizedAbundance }))
            .sort((a, b) => b.abundance - a.abundance)
            .map(x => x.index);
        
        // Activate "always on" pathways
        const alwaysOnCount = Math.min(cfg.alwaysOnCount, this.pathways.length);
        for (let i = 0; i < alwaysOnCount; i++) {
            const p = this.pathways[this.sortedByAbundance[i]];
            p.isActive = true;
            p.envelopePhase = 'sustain';
            p.envelopeValue = cfg.alwaysOnVolume;
            p.alwaysOn = true;  // Mark as permanent
        }
        
        this.port.postMessage({
            type: 'ready',
            count: this.pathways.length,
            alwaysOnCount: alwaysOnCount
        });
        
        console.log(`BreathingSynth initialized: ${this.pathways.length} pathways`);
        console.log(`  Always-on tier: ${alwaysOnCount} pathways`);
        console.log(`  Max polyphony: ${cfg.maxPolyphony}`);
    }
    
    activatePathway(pathway) {
        if (pathway.isActive || pathway.alwaysOn) return false;
        
        // Check polyphony limit
        const activeCount = this.pathways.filter(p => p.isActive).length;
        if (activeCount >= this.BREATH_CONFIG.maxPolyphony) return false;
        
        pathway.isActive = true;
        pathway.envelopePhase = 'attack';
        pathway.envelopeTime = 0;
        pathway.envelopeValue = 0;
        
        // Randomize timing for this activation
        const variance = () => 0.7 + Math.random() * 0.6;
        const env = this.BREATH_CONFIG.envelope;
        const t = pathway.normalizedAbundance;
        
        pathway.attackTime = (env.minAttack + t * (env.maxAttack - env.minAttack)) * variance();
        pathway.sustainTime = (env.minSustain + t * (env.maxSustain - env.minSustain)) * variance();
        pathway.releaseTime = (env.minRelease + t * (env.maxRelease - env.minRelease)) * variance();
        
        return true;
    }
    
    checkActivations() {
        const cfg = this.BREATH_CONFIG;
        
        // Shuffle pathway order for fairness
        const shuffled = [...this.pathways].sort(() => Math.random() - 0.5);
        
        for (const p of shuffled) {
            if (p.alwaysOn || p.isActive) continue;
            
            // Roll the dice
            if (Math.random() < p.activationProb * cfg.activationCheckInterval) {
                if (this.activatePathway(p)) {
                    // Successfully activated
                }
            }
        }
    }
    
    updateEnvelopes(dt) {
        for (const p of this.pathways) {
            if (!p.isActive) continue;
            
            if (p.alwaysOn) {
                // Always-on pathways gently breathe
                p.driftPhase += Math.PI * 2 * p.driftRate * dt;
                const drift = Math.sin(p.driftPhase) * 0.15;
                p.envelopeValue = this.BREATH_CONFIG.alwaysOnVolume * (1 + drift);
                continue;
            }
            
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
                    p.envelopeValue = 1.0;
                    // Gentle drift during sustain
                    p.driftPhase += Math.PI * 2 * p.driftRate * dt;
                    p.envelopeValue *= 1 + Math.sin(p.driftPhase) * 0.1;
                    
                    if (p.envelopeTime >= p.sustainTime) {
                        p.envelopePhase = 'release';
                        p.envelopeTime = 0;
                    }
                    break;
                    
                case 'release':
                    p.envelopeValue = 1.0 - (p.envelopeTime / p.releaseTime);
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
        
        // === PERIODIC ACTIVATION CHECK ===
        if (this.time - this.lastActivationCheck > this.BREATH_CONFIG.activationCheckInterval) {
            this.checkActivations();
            this.lastActivationCheck = this.time;
        }
        
        // === UPDATE ENVELOPES ===
        this.updateEnvelopes(dt);
        
        // === GLOBAL LFO ===
        this.globalLfoPhase += twoPi * this.globalLfoRate * dt;
        if (this.globalLfoPhase > twoPi) this.globalLfoPhase -= twoPi;
        const globalMod = 1.0 + Math.sin(this.globalLfoPhase) * 0.05;
        
        // === CLEAR BUFFERS ===
        for (let i = 0; i < blockSize; i++) {
            channelL[i] = 0;
            if (channelR !== channelL) channelR[i] = 0;
        }
        
        // === PROCESS ACTIVE PATHWAYS ===
        let activeCount = 0;
        
        for (const p of this.pathways) {
            if (!p.isActive || p.envelopeValue < 0.001) continue;
            
            activeCount++;
            
            // Volume calculation
            const categoryGain = this.categoryGains[p.category] ?? 1.0;
            
            let focusGain = 1.0;
            if (this.focusedId) {
                focusGain = (p.id === this.focusedId) ? this.focusBoost : this.duckAmount;
            }
            
            const finalVolume = p.baseVolume 
                * p.envelopeValue 
                * categoryGain 
                * focusGain
                * globalMod
                * this.masterVolume;
            
            if (finalVolume < 0.0001) continue;
            
            // Panning
            const panAngle = (p.pan + 1) * Math.PI / 4;
            const gainL = Math.cos(panAngle);
            const gainR = Math.sin(panAngle);
            
            // Frequency
            const freq = this.fundamental * p.ratio;
            const phaseInc = (twoPi * freq) / sr;
            
            // Render
            for (let i = 0; i < blockSize; i++) {
                const sample = Math.sin(p.phase) * finalVolume;
                
                channelL[i] += sample * gainL;
                if (channelR !== channelL) {
                    channelR[i] += sample * gainR;
                }
                
                p.phase += phaseInc;
                if (p.phase > twoPi) p.phase -= twoPi;
            }
        }
        
        // === SOFT LIMITING ===
        for (let i = 0; i < blockSize; i++) {
            channelL[i] = Math.tanh(channelL[i] * 0.7) * 0.9;
            if (channelR !== channelL) {
                channelR[i] = Math.tanh(channelR[i] * 0.7) * 0.9;
            }
        }
        
        // === REPORT ===
        if (Math.random() < 0.03) {  // ~30fps reporting
            this.reportState(activeCount);
        }
        
        return true;
    }
    
    reportState(activeCount) {
        // Report which pathways are currently active and their envelope state
        const activePathways = this.pathways
            .filter(p => p.isActive)
            .map(p => ({
                id: p.id,
                envelope: p.envelopeValue,
                phase: p.envelopePhase,
                alwaysOn: p.alwaysOn || false
            }));
        
        this.port.postMessage({
            type: 'breathState',
            data: {
                time: this.time,
                activeCount,
                maxPolyphony: this.BREATH_CONFIG.maxPolyphony,
                pathways: activePathways
            }
        });
    }
}

registerProcessor('breathing-synth', BreathingSynthProcessor);
