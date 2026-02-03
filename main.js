document.addEventListener("DOMContentLoaded", function(event) {
    const activeOscillators = {};
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const globalGain = audioCtx.createGain();
    globalGain.gain.setValueAtTime(0.8, audioCtx.currentTime);
    globalGain.connect(audioCtx.destination);   

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
    if (volumeSlider) {
        volumeSlider.addEventListener('input', (e) => {
            const v = parseFloat(e.target.value);
            globalGain.gain.setValueAtTime(v, audioCtx.currentTime);
        });
        // initialize
        globalGain.gain.setValueAtTime(parseFloat(volumeSlider.value), audioCtx.currentTime);
    }

    // Build visual keyboard (show note names in correct musical order)
    const keyboardEl = document.getElementById('keyboard');
    // ADSR + polyphony helpers
    const ADSR = { attack: 0.01, decay: 0.08, sustain: 0.7, release: 0.12 };

    function perVoicePeak(count) {
        return 1 / Math.max(1, count); // simple equal-energy scaling
    }

    function rescaleActiveVoices() {
        const keys = Object.keys(activeOscillators);
        const peak = perVoicePeak(keys.length);
        const now = audioCtx.currentTime;
        keys.forEach(k => {
            const g = activeOscillators[k].gainNode.gain;
            g.cancelScheduledValues(now);
            // move smoothly to new sustain level to avoid clicks
            g.setValueAtTime(g.value, now);
            g.exponentialRampToValueAtTime(Math.max(0.01, peak * ADSR.sustain), now + 0.02);
        });
    }

    function playNote(key) {
        if (activeOscillators[key]) return;
        
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain(); 

        const waveform = (waveformSelect && waveformSelect.value) ? waveformSelect.value : 'sine';
        osc.type = waveform;
        osc.frequency.setValueAtTime(keyboardFrequencyMap[key], audioCtx.currentTime);

        const now = audioCtx.currentTime;
        
        const newCount = Object.keys(activeOscillators).length + 1;
        // Calculate per-voice peak based on new count 
        const peak = perVoicePeak(newCount);

        gainNode.gain.setValueAtTime(0.0001, now);
        gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), now + ADSR.attack);
        gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * ADSR.sustain), now + ADSR.attack + ADSR.decay);

        (osc.connect(gainNode)).connect(globalGain);
        osc.start(now);
        osc.onended = () => {
            try { osc.disconnect(); } catch {}
            try { gainNode.disconnect(); } catch {}
        };

        activeOscillators[key] = { osc, gainNode };
        rescaleActiveVoices();
    }

    function stopNote(key) {
        const entry = activeOscillators[key];
        if (!entry) return;

        const { osc, gainNode } = entry;
        const now = audioCtx.currentTime;

        // Trigger Release phase
        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(gainNode.gain.value, now);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + ADSR.release);

        // Stop and cleanup after the release finishes
        osc.stop(now + ADSR.release);
        
        // Remove from active list immediately so keys can be re-pressed
        delete activeOscillators[key];
        rescaleActiveVoices(); 
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
            k.textContent = noteNameMap[code] || String.fromCharCode(code);
            
            // ATTACH TO DOM
            keyboardEl.appendChild(k);

            // ADD INTERACTIVITY
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

    // 1. Updated Listeners
    window.addEventListener("keydown", (e) => {
        if (e.repeat) return;

        // Use e.code to get the physical key string (e.g., "KeyZ")
        const code = e.code; 

        if (keyboardFrequencyMap[code] && !activeOscillators[code]) {
            if (audioCtx.state === 'suspended') audioCtx.resume();
            playNote(code);
            
            // Find the visual element using the same code
            const el = document.querySelector(`.key[data-key="${code}"]`);
            if (el) el.classList.add("active");
        }
    });

    window.addEventListener("keyup", (e) => {
        const code = e.code;
        if (activeOscillators[code]) {
            stopNote(code);
            const el = document.querySelector(`.key[data-key="${code}"]`);
            if (el) el.classList.remove("active");
        }
    });
});