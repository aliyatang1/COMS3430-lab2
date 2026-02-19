document.addEventListener("DOMContentLoaded", function(event) {
    const activeOscillators = {};
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const globalGain = audioCtx.createGain();
    globalGain.gain.setValueAtTime(0.8, audioCtx.currentTime);
    globalGain.connect(audioCtx.destination);
    // // Uncomment to double check no amplitude > 1 / waveform visualizer
    var globalAnalyser;
    // // Uncomment to double check no amplitude > 1
    globalAnalyser = audioCtx.createAnalyser();
    globalGain.disconnect();
    globalGain.connect(globalAnalyser);
    globalAnalyser.connect(audioCtx.destination);
    amplitudeLogger();

    // // // Uncomment to show waveform visualizer
    // globalGain.disconnect();
    // globalAnalyser = audioCtx.createAnalyser();
    // globalGain.connect(globalAnalyser);
    // globalAnalyser.connect(audioCtx.destination);
    // draw();

    // Synthesis mode settings
    var synthesisMode = 'additive'; // 'additive', 'am', 'fm'
    var antiClipping = false;

    // User-controllable synthesis parameters
    var AM_MODULATOR_FREQ = 10; // Hz
    var FM_MODULATOR_FREQ = 5; // Hz
    var FM_MODULATION_INDEX = 50; // controls depth of frequency modulation
    var NUM_HARMONICS = 5; // for additive synthesis
    var ADDITIVE_MIX = 1.0; // amplitude scaling for additive (0-1)
    var LFO_ENABLED = true; // enable global LFO modulation
    var LFO_SPEED = 0.8; // Hz - speed of LFO
    var LFO_DEPTH = 0.3; // how much the LFO affects parameters (0-1)



    const keyboardFrequencyMap = {
        '90': 261.625565300598634,  //Z - C
        '83': 277.182630976872096, //S - C#
        '88': 293.664767917407560,  //X - D
        '68': 311.126983722080910, //D - D#
        '67': 329.627556912869929,  //C - E
        '86': 349.228231433003884,  //V - F
        '71': 369.994422711634398, //G - F#
        '66': 391.995435981749294,  //B - G
        '72': 415.304697579945138, //H - G#
        '78': 440.000000000000000,  //N - A
        '74': 466.163761518089916, //J - A#
        '77': 493.883301256124111,  //M - B
        '81': 523.251130601197269,  //Q - C
        '50': 554.365261953744192, //2 - C#
        '87': 587.329535834815120,  //W - D
        '51': 622.253967444161821, //3 - D#
        '69': 659.255113825739859,  //E - E
        '82': 698.456462866007768,  //R - F
        '53': 739.988845423268797, //5 - F#
        '84': 783.990871963498588,  //T - G
        '54': 830.609395159890277, //6 - G#
        '89': 880.000000000000000,  //Y - A
        '55': 932.327523036179832, //7 - A#
        '85': 987.766602512248223,  //U - B
    };

    // resume on Play button
    const btn = document.getElementById('btn');
    if (btn) {
        btn.addEventListener('click', () => {
            if (audioCtx.state === 'suspended') audioCtx.resume();
        });
    }

    // settings UI
    const volumeSlider = document.getElementById('volume');
    const waveformSelect = document.getElementById('waveform');
    const synthesisSelect = document.getElementById('synthesis');
    const antiClippingCheckbox = document.getElementById('anti-clipping');
    const amModFreqSlider = document.getElementById('am-mod-freq');
    const fmModFreqSlider = document.getElementById('fm-mod-freq');
    const fmModIndexSlider = document.getElementById('fm-mod-index');
    const numHarmonicsSlider = document.getElementById('num-harmonics');
    const lfoEnabledCheckbox = document.getElementById('lfo-enabled');
    const lfoSpeedSlider = document.getElementById('lfo-speed');
    const lfoDepthSlider = document.getElementById('lfo-depth');

    if (synthesisSelect) {
        synthesisSelect.addEventListener('change', (e) => {
            synthesisMode = e.target.value;
        });
    }

    if (antiClippingCheckbox) {
        antiClippingCheckbox.addEventListener('change', (e) => {
            antiClipping = e.target.checked;
        });
    }

    if (amModFreqSlider) {
        amModFreqSlider.addEventListener('input', (e) => {
            AM_MODULATOR_FREQ = parseFloat(e.target.value);
            document.getElementById('am-freq-display').textContent = e.target.value;
        });
    }

    if (fmModFreqSlider) {
        fmModFreqSlider.addEventListener('input', (e) => {
            FM_MODULATOR_FREQ = parseFloat(e.target.value);
            document.getElementById('fm-freq-display').textContent = e.target.value;
        });
    }

    if (fmModIndexSlider) {
        fmModIndexSlider.addEventListener('input', (e) => {
            FM_MODULATION_INDEX = parseFloat(e.target.value);
            document.getElementById('fm-index-display').textContent = e.target.value;
        });
    }

    if (numHarmonicsSlider) {
        numHarmonicsSlider.addEventListener('input', (e) => {
            NUM_HARMONICS = parseInt(e.target.value);
            document.getElementById('harm-display').textContent = e.target.value;
        });
    }

    if (lfoEnabledCheckbox) {
        lfoEnabledCheckbox.addEventListener('change', (e) => {
            LFO_ENABLED = e.target.checked;
        });
    }

    if (lfoSpeedSlider) {
        lfoSpeedSlider.addEventListener('input', (e) => {
            LFO_SPEED = parseFloat(e.target.value);
            document.getElementById('lfo-speed-display').textContent = e.target.value;
        });
    }

    if (lfoDepthSlider) {
        lfoDepthSlider.addEventListener('input', (e) => {
            LFO_DEPTH = parseFloat(e.target.value);
            document.getElementById('lfo-depth-display').textContent = e.target.value;
        });
    }

    if (volumeSlider) {
        volumeSlider.addEventListener('input', (e) => {
            const v = parseFloat(e.target.value);
            globalGain.gain.setValueAtTime(v, audioCtx.currentTime);
            document.getElementById('vol-display').textContent = v.toFixed(2);
        });
        // initialize
        globalGain.gain.setValueAtTime(parseFloat(volumeSlider.value), audioCtx.currentTime);
        document.getElementById('vol-display').textContent = parseFloat(volumeSlider.value).toFixed(2);
    }

    // Build visual keyboard (show note names in correct musical order)
    const keyboardEl = document.getElementById('keyboard');
    // ADSR + polyphony helpers
    const ADSR = { attack: 0.01, decay: 0.08, sustain: 0.7, release: 0.12 };

    function perVoicePeak(count) {
        return 1 / Math.max(1, count); 
    }

    function rescaleActiveVoices() {
        const keys = Object.keys(activeOscillators);
        const peak = perVoicePeak(keys.length);
        const now = audioCtx.currentTime;
        keys.forEach(k => {
            const g = activeOscillators[k].gainNode.gain;
            g.cancelScheduledValues(now);
            g.setValueAtTime(g.value, now);
            g.exponentialRampToValueAtTime(Math.max(0.01, peak * ADSR.sustain), now + 0.02);
        });
    }

    function playNote(key) {
        if (activeOscillators[key]) return;

        const now = audioCtx.currentTime;
        const noteFreq = keyboardFrequencyMap[key];
        const newCount = Object.keys(activeOscillators).length + 1;
        const peak = perVoicePeak(newCount);

        let oscillators = [];
        let gainNode = audioCtx.createGain();

        if (synthesisMode === 'additive') {
            // ADDITIVE SYNTHESIS: multiple harmonics (configurable count)
            const harmonicGains = []; // store for LFO modulation
            for (let harmonic = 1; harmonic <= NUM_HARMONICS; harmonic++) {
                const osc = audioCtx.createOscillator();
                osc.type = waveformSelect?.value || 'sine';

                // Add slight detuning to upper harmonics for richness
                const detuneAmount = harmonic > 1 ? (Math.random() - 0.5) * 15 : 0;
                osc.frequency.setValueAtTime(noteFreq * harmonic + detuneAmount, now);

                // Each harmonic gets scaled by 1/harmonic for natural decay
                const harmonyGain = audioCtx.createGain();
                const targetVoicePeak = 0.8; // headroom for LFO / phases
                const norm = targetVoicePeak / (harmonicSum(NUM_HARMONICS) || 1);
                const baseAmplitude = (0.7 * norm / harmonic) * ADDITIVE_MIX;

                harmonyGain.gain.setValueAtTime(baseAmplitude, now);
                osc.connect(harmonyGain);
                harmonyGain.connect(gainNode);

                oscillators.push(osc);
                harmonicGains.push({ gain: harmonyGain, baseAmplitude, harmonic });
            }

            // Add LFO to modulate harmonic levels
            if (LFO_ENABLED && harmonicGains.length > 0) {
                const lfo = audioCtx.createOscillator();
                lfo.frequency.setValueAtTime(LFO_SPEED, now);
                
                // For each odd harmonic, create a separate chain with its own LFO depth control
                harmonicGains.forEach((hg, idx) => {
                    if (idx % 2 === 1) { // modulate odd harmonics
                        const lfoDeptheControl = audioCtx.createGain();
                        lfoDeptheControl.gain.setValueAtTime(LFO_DEPTH * hg.baseAmplitude * 0.3, now);
                        lfo.connect(lfoDeptheControl);
                        lfoDeptheControl.connect(hg.gain);
                    }
                });

                oscillators.push(lfo);
            }
        } else if (synthesisMode === 'am') {
            // AMPLITUDE MODULATION SYNTHESIS
            const carrier = audioCtx.createOscillator();
            carrier.type = waveformSelect?.value || 'sine';
            carrier.frequency.setValueAtTime(noteFreq, now);

            const carrierGain = audioCtx.createGain();
            carrierGain.gain.setValueAtTime(0.7, now);

            const modulator = audioCtx.createOscillator();
            modulator.frequency.setValueAtTime(AM_MODULATOR_FREQ, now);

            const modDepth = audioCtx.createGain();
            modDepth.gain.setValueAtTime(0.4, now);  // modulation depth (0-1)

            // AM: modulator modulates the carrier's amplitude
            // Formula: output = carrier * (1 + modulator * depth)
            carrier.connect(carrierGain);
            modulator.connect(modDepth);
            modDepth.connect(carrierGain.gain);
            carrierGain.connect(gainNode);
            
            oscillators.push(carrier, modulator);

            // Add LFO to modulate the modulation depth
            if (LFO_ENABLED) {
                const lfo = audioCtx.createOscillator();
                lfo.frequency.setValueAtTime(LFO_SPEED, now);
                const lfoModDepth = audioCtx.createGain();
                lfoModDepth.gain.setValueAtTime(LFO_DEPTH * 0.15, now);
                lfo.connect(lfoModDepth);
                lfoModDepth.connect(modDepth.gain);
                oscillators.push(lfo);
            }
        } else if (synthesisMode === 'fm') {
            // FREQUENCY MODULATION SYNTHESIS
            const carrier = audioCtx.createOscillator();
            carrier.type = waveformSelect?.value || 'sine';
            carrier.frequency.setValueAtTime(noteFreq, now);

            const modulator = audioCtx.createOscillator();
            modulator.frequency.setValueAtTime(FM_MODULATOR_FREQ, now);

            const modulationGain = audioCtx.createGain();
            modulationGain.gain.setValueAtTime(FM_MODULATION_INDEX, now);

            // FM: modulator's amplitude modulates the carrier's frequency
            modulator.connect(modulationGain);
            modulationGain.connect(carrier.frequency);

            carrier.connect(gainNode);
            oscillators.push(carrier, modulator);

            // Add LFO to modulate the modulation index (creates evolving timbre)
            if (LFO_ENABLED) {
                const lfo = audioCtx.createOscillator();
                lfo.frequency.setValueAtTime(LFO_SPEED, now);
                const lfoModGain = audioCtx.createGain();
                lfoModGain.gain.setValueAtTime(LFO_DEPTH * FM_MODULATION_INDEX * 0.3, now);
                lfo.connect(lfoModGain);
                lfoModGain.connect(modulationGain.gain);
                oscillators.push(lfo);
            }
        }

        // Apply envelope
        const calcPeak = antiClipping ? peak * 0.35 : peak * 0.6;
        gainNode.gain.setValueAtTime(0.0001, now);
        gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0001, calcPeak), now + ADSR.attack);
        gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0001, calcPeak * ADSR.sustain), now + ADSR.attack + ADSR.decay);

        gainNode.connect(globalGain);

        // Start all oscillators
        oscillators.forEach(osc => osc.start(now));

        activeOscillators[key] = { oscillators, gainNode };
        rescaleActiveVoices();
        updateKeyVisuals();

        // Cleanup handler
        const allOscillators = oscillators;
        const gn = gainNode;
        Promise.resolve().then(() => {
            const osc = allOscillators[0];
            if (osc) {
                osc.onended = () => {
                    try { allOscillators.forEach(o => o.disconnect()); } catch {}
                    try { gn.disconnect(); } catch {}
                };
            }
        });
    }

    function stopNote(key) {
        const entry = activeOscillators[key];
        if (!entry) return;

        const { oscillators, gainNode } = entry;
        const now = audioCtx.currentTime;

        // Trigger Release phase
        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(gainNode.gain.value, now);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + ADSR.release);

        // Stop and cleanup after the release finishes
        oscillators.forEach(osc => osc.stop(now + 5 * ADSR.release));

        // Remove from active list immediately so keys can be repressed
        delete activeOscillators[key];
        rescaleActiveVoices();
        const el = document.querySelector(`.key[data-key="${key}"]`);
        if (el) {
            el.classList.remove('active');
            el.style.removeProperty('--key-color');
        }
        updateKeyVisuals();
    }
    const keyOrder = [
      '90','83','88','68','67','86','71','66','72','78','74','77',
      '81','50','87','51','69','82','53','84','54','89','55','85'
    ];

    const noteNameMap = {
        '90': 'C',   // Z
        '83': 'C#',  // S
        '88': 'D',   // X
        '68': 'D#',  // D
        '67': 'E',   // C
        '86': 'F',   // V
        '71': 'F#',  // G
        '66': 'G',   // B
        '72': 'G#',  // H
        '78': 'A',   // N
        '74': 'A#',  // J
        '77': 'B',   // M
        '81': 'C',   // Q (next octave)
        '50': 'C#',  // 2
        '87': 'D',   // W
        '51': 'D#',  // 3
        '69': 'E',   // E
        '82': 'F',   // R
        '53': 'F#',  // 5
        '84': 'G',   // T
        '54': 'G#',  // 6
        '89': 'A',   // Y
        '55': 'A#',  // 7
        '85': 'B'    // U
    };

    // Create visual keyboard
    if (keyboardEl) {
        keyOrder.forEach(code => {
            const k = document.createElement('div');
            k.className = 'key';
            k.dataset.key = code;
            const noteName = noteNameMap[code] || String.fromCharCode(code);
            k.textContent = noteName;

            // Add black class for sharps/flats
            if (noteName.includes('#')) {
                k.classList.add('black');
            }

            keyboardEl.appendChild(k);

            k.addEventListener('mousedown', () => {
                if (audioCtx.state === 'suspended') audioCtx.resume();
                playNote(code);
                k.classList.add('active');
            });
            k.addEventListener('mouseup', () => {
                stopNote(code);
                k.classList.remove('active');
            });
            k.addEventListener('mouseleave', () => {
                if (activeOscillators[code]) {
                    stopNote(code);
                    k.classList.remove('active');
                }
            });
        });
    }
    function setKeyActive(code, isActive) {
        const el = document.querySelector(`.key[data-key="${code}"]`);
        if (!el) return;
        el.classList.toggle('active', isActive);
    }
    // use simple key handlers and oscillator storage as requested
    window.addEventListener('keydown', keyDown, false);
    window.addEventListener('keyup', keyUp, false);

    function keyDown(event) {
        if (event.repeat) return; // prevents retrigger while holding

        const key = (event.which || event.keyCode).toString(); 
        if (keyboardFrequencyMap[key] && !activeOscillators[key]) {
            if (audioCtx.state === 'suspended') audioCtx.resume();
            playNote(key);
            setKeyActive(key, true); 
        }
    }

    function keyUp(event) {
        const key = (event.which || event.keyCode).toString();
        if (activeOscillators[key]) {
            stopNote(key);
            setKeyActive(key, false); 
        }
    }
    function randomBrightColor() {
        const hue = Math.floor(Math.random() * 360);
        return `hsl(${hue}, 80%, 65%)`;
    }
    function updateKeyVisuals() {
        const keys = Object.keys(activeOscillators);
        const multi = keys.length >= 2;

        keys.forEach(code => {
            const el = document.querySelector(`.key[data-key="${code}"]`);
            if (!el) return;

            el.classList.add('active');

            if (multi) {
            // random color per key
            el.style.setProperty('--key-color', randomBrightColor());
            } else {
            // single key -> default color
            el.style.removeProperty('--key-color');
            }
        });
    }
    function harmonicSum(n) {
        let s = 0;
        for (let i = 1; i <= n; i++) s += 1 / i;
        return s;
    }


    // // Uncomment to double check no amplitude > 1
    var maxAlltime = 0
    function amplitudeLogger() {
        globalAnalyser.fftSize = 2048;
        var bufferLength = globalAnalyser.frequencyBinCount;
        var dataArray = new Uint8Array(bufferLength);
        globalAnalyser.getByteTimeDomainData(dataArray);

        //values range 0-255, over the range -1,1, so we find the max value from a frame, and then scale
        var maxValue = (dataArray.reduce((max, curr) => (curr > max ? curr : max)) - 128) / 127.0;
        console.log(maxValue);
        if (maxValue > maxAlltime){
            maxAlltime = maxValue;
        }
        console.log("Max amplitude so far: " + maxAlltime);
        if (maxAlltime > 1.0) {
            console.warn("WARNING: Clipping detected! Amplitude " + maxAlltime + " exceeds 1.0");
        }
        requestAnimationFrame(amplitudeLogger);
    }

    // // Uncomment to show waveform visualizer
    // function draw() {
    //     globalAnalyser.fftSize = 2048;
    //     var bufferLength = globalAnalyser.frequencyBinCount;
    //     var dataArray = new Uint8Array(bufferLength);
    //     globalAnalyser.getByteTimeDomainData(dataArray);

    //     var canvas = document.querySelector("#globalVisualizer");
    //     var canvasCtx = canvas.getContext("2d");

    //     requestAnimationFrame(draw);

    //     globalAnalyser.getByteTimeDomainData(dataArray);

    //     canvasCtx.fillStyle = "white";
    //     canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

    //     canvasCtx.lineWidth = 2;
    //     canvasCtx.strokeStyle = "rgb(0, 0, 0)";

    //     canvasCtx.beginPath();

    //     var sliceWidth = canvas.width * 1.0 / bufferLength;
    //     var x = 0;

    //     for (var i = 0; i < bufferLength; i++) {
    //         var v = dataArray[i] / 128.0;
    //         var y = v * canvas.height / 2;
    //         if (i === 0) {
    //             canvasCtx.moveTo(x, y);
    //         } else {
    //             canvasCtx.lineTo(x, y);
    //         }
    //         x += sliceWidth;
    //     }

    //     canvasCtx.lineTo(canvas.width, canvas.height / 2);
    //     canvasCtx.stroke();
    // }

});