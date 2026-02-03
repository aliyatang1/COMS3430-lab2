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
    // ...existing code...
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
                g.exponentialRampToValueAtTime(Math.max(0.0001, peak * ADSR.sustain), now + 0.02);
            });
        }

        function playNote(key) {
            if (activeOscillators[key]) return;
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();

            // use UI waveform
            osc.type = (waveformSelect && waveformSelect.value) ? waveformSelect.value : 'sine';
            osc.frequency.setValueAtTime(keyboardFrequencyMap[key], audioCtx.currentTime);

            const now = audioCtx.currentTime;
            // compute peak for new voice (including it)
            const newCount = Object.keys(activeOscillators).length + 1;
            const peak = perVoicePeak(newCount);

            // ADSR: tiny start, ramp to peak, then decay to sustain*peak
            gainNode.gain.setValueAtTime(0.0001, now);
            gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), now + ADSR.attack);
            gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * ADSR.sustain), now + ADSR.attack + ADSR.decay);

            osc.connect(gainNode);
            gainNode.connect(globalGain);

            osc.start(now);
            activeOscillators[key] = { osc, gainNode };

            // rescale existing voices so total stays bounded
            rescaleActiveVoices();
        }

        function stopNote(key) {
            const entry = activeOscillators[key];
            if (!entry) return;
            const now = audioCtx.currentTime;
            // smooth release to avoid click
            const g = entry.gainNode.gain;
            g.cancelScheduledValues(now);
            g.setValueAtTime(g.value, now);
            // use setTargetAtTime for natural release curve
            g.setTargetAtTime(0.0001, now, ADSR.release / 4);
            // stop oscillator after release completes
            const stopTime = now + ADSR.release + 0.05;
            try { entry.osc.stop(stopTime); } catch (e) {}
            // cleanup and delete after stop completes
            const cleanupDelay = (ADSR.release + 0.1) * 1000;
            setTimeout(() => {
                try { entry.osc.disconnect(); } catch(e){}
                try { entry.gainNode.disconnect(); } catch(e){}
                delete activeOscillators[key];
            }, cleanupDelay);
            // rescale remaining voices down/up smoothly
            setTimeout(rescaleActiveVoices, 20);
        }
    // ...existing code...    // explicit order: C, C#, D, D#, E, F, F#, G, G#, A, A#, B, then next octave C..B
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

    if (keyboardEl) {
        keyOrder.forEach(code => {
            const k = document.createElement('div');
            k.className = 'key';
            k.dataset.key = code;
            k.textContent = noteNameMap[code] || String.fromCharCode(code); // show note name
            keyboardEl.appendChild(k);

            // mouse/touch handlers (resume audioCtx before playing; log for debug)
            k.addEventListener('mousedown', (ev) => {
                ev.preventDefault();
                if (audioCtx.state === 'suspended') audioCtx.resume();
                playNote(code);
                console.log('playNote -> activeOscillators:', Object.keys(activeOscillators));
                k.classList.add('active');
            });
            k.addEventListener('mouseup', (ev) => {
                ev.preventDefault();
                stopNote(code);
                console.log('stopNote -> activeOscillators:', Object.keys(activeOscillators));
                k.classList.remove('active');
            });
            // keep mouseleave/touch handlers but also resume on touchstart
            k.addEventListener('mouseleave', () => { if (k.classList.contains('active')) { stopNote(code); k.classList.remove('active'); }});
            k.addEventListener('touchstart', (ev) => {
                ev.preventDefault();
                if (audioCtx.state === 'suspended') audioCtx.resume();
                playNote(code);
                console.log('playNote (touch) -> activeOscillators:', Object.keys(activeOscillators));
                k.classList.add('active');
            }, {passive:false});
            k.addEventListener('touchend', (ev) => {
                ev.preventDefault();
                stopNote(code);
                console.log('stopNote (touch) -> activeOscillators:', Object.keys(activeOscillators));
                k.classList.remove('active');
            }, {passive:false});
        });
    }

    // use simple key handlers and oscillator storage as requested
    window.addEventListener('keydown', keyDown, false);
    window.addEventListener('keyup', keyUp, false);

    function keyDown(event) {
        const key = (event.detail || event.which).toString();
        if (keyboardFrequencyMap[key] && !activeOscillators[key]) {
            playNote(key);
        }
    }

    function keyUp(event) {
        const key = (event.detail || event.which).toString();
        if (keyboardFrequencyMap[key] && activeOscillators[key]) {
            activeOscillators[key].stop();
            delete activeOscillators[key];
        }
    }

    function playNote(key) {
        const osc = audioCtx.createOscillator();
        osc.frequency.setValueAtTime(keyboardFrequencyMap[key], audioCtx.currentTime);
        osc.type = 'sine';
        osc.connect(audioCtx.destination);
        osc.start();
        activeOscillators[key] = osc;
    }
});