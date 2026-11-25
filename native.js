/* Aleph dans l'appli Android (coque Capacitor, dossier android/) :
   la page web n'a pas accès à la voix ni à l'écoute dans une appli, on branche donc
   speechSynthesis et SpeechRecognition sur la synthèse et la reconnaissance vocales d'Android,
   et on bascule l'écoute sur le micro du kit voiture / des oreillettes Bluetooth quand il y en a.
   Dans un navigateur normal, ce fichier ne fait rien. */
(function () {
  const C = window.Capacitor;
  if (!C || !(C.isNativePlatform && C.isNativePlatform())) return;
  const P = n => (C.Plugins && C.Plugins[n]) || null;
  const call = (p, m, o) => (P(p) && typeof P(p)[m] === 'function' ? P(p)[m](o || {}) : C.nativePromise(p, m, o || {}));
  const on = (p, ev, cb) => {
    try {
      if (P(p) && typeof P(p).addListener === 'function') return P(p).addListener(ev, cb);
      C.nativeCallback(p, 'addListener', { eventName: ev }, cb);
    } catch (e) {}
  };
  window.ALEPH_NATIVE = true;
  // petit message d'état sous la carte (pour comprendre ce qui se passe dans l'appli)
  const status = t => { try { const h = document.getElementById('dHeard'); if (h && !/Entendu/.test(h.textContent)) h.textContent = t; } catch (e) {} };

  /* micro Bluetooth : allumé pendant l'écoute, éteint pendant que la voix parle (son de meilleure qualité) */
  let btOn = false, btTimer = 0;
  const bt = {
    async on() {
      clearTimeout(btTimer); if (btOn) return;
      try { const r = await call('BtMic', 'on'); btOn = !!(r && r.bt); if (btOn) await new Promise(r => setTimeout(r, 700)); } catch (e) {}
    },
    offSoon() { clearTimeout(btTimer); btTimer = setTimeout(() => bt.off(), 1200); },
    async off() { clearTimeout(btTimer); if (!btOn) return; btOn = false; try { await call('BtMic', 'off'); } catch (e) {} }
  };

  /* reconnaissance vocale */
  let cur = null, perm = null;
  class NativeSR {
    constructor() { this.lang = 'fr-FR'; this.interimResults = true; this.maxAlternatives = 1; this.continuous = false; this._t = ''; this._done = false; }
    start() {
      cur = this; this._done = false; this._t = ''; this._stopped = false;
      (async () => {
        if (!perm) perm = call('SpeechRecognition', 'requestPermissions').catch(() => {});
        await perm; await bt.on(); if (this._done) return;
        this.onstart && this.onstart();
        status(btOn ? '🎙️ Écoute (micro Bluetooth)…' : '🎙️ Écoute (micro du téléphone)…');
        const w = (window.__beepEnd || 0) - Date.now(); if (w > 0) await new Promise(r => setTimeout(r, w)); // laisser finir le bip
        if (this._done) return;
        try { await call('SpeechRecognition', 'start', { language: this.lang, maxResults: 1, partialResults: true, popup: false }); }
        catch (e) { status('⚠️ Écoute impossible : ' + ((e && e.message) || e)); this._fail(e); return; }
        // Android coupe l'écoute tout seul après un court silence (sans prévenir la page) :
        // on le détecte pour relancer aussitôt une nouvelle écoute, comme dans Chrome
        const t0 = Date.now();
        this._poll = setInterval(async () => {
          if (this._done) { clearInterval(this._poll); return; }
          if (this._stopped || Date.now() - t0 < 800) return;
          try { const r = await call('SpeechRecognition', 'isListening'); if (r && r.listening === false && !this._done && !this._stopped) this._end(); } catch (e) {}
        }, 400);
      })();
    }
    _res(t, fin) {
      if (this._done || !t) return; this._t = t;
      const r = [{ transcript: t, confidence: 1 }]; r.isFinal = fin;
      this.onresult && this.onresult({ results: [r] });
    }
    _fail(e) {
      if (this._done) return;
      const m = String((e && e.message) || e);
      this.onerror && this.onerror({ error: /permission/i.test(m) ? 'not-allowed' : /network/i.test(m) ? 'network' : 'no-speech' });
      this._end();
    }
    _end() { clearTimeout(this._endT); clearInterval(this._poll); if (this._done) return; if (this._t) this._res(this._t, true); this._done = true; if (cur === this) cur = null; bt.offSoon(); this.onend && this.onend(); }
    stop() { call('SpeechRecognition', 'stop').catch(() => {}); }
    abort() { clearInterval(this._poll); clearTimeout(this._endT); this._done = true; if (cur === this) cur = null; call('SpeechRecognition', 'stop').catch(() => {}); bt.offSoon(); }
  }
  on('SpeechRecognition', 'partialResults', d => {
    const m = d && d.matches && d.matches[0], c = cur; if (!c || !m) return;
    c._res(m, false);
    if (c._stopped && !c._done) { clearTimeout(c._endT); c._endT = setTimeout(() => c._end(), 300); } // résultat définitif reçu
  });
  on('SpeechRecognition', 'listeningState', d => {
    if (!d || !cur) return;
    if (d.status === 'started') status('🎙️ Je t\'entends…');
    if (d.status === 'stopped') { const c = cur; c._stopped = true; c._endT = setTimeout(() => c._end(), 2500); }
  });
  window.SpeechRecognition = window.webkitSpeechRecognition = NativeSR;

  /* voix */
  class Utterance { constructor(t) { this.text = t || ''; this.lang = 'fr-FR'; this.rate = 1; this.pitch = 1; this.volume = 1; this.voice = null; } }
  const synth = {
    speaking: false, pending: false, onvoiceschanged: null, _v: [],
    getVoices() { return this._v; },
    speak(u) {
      (async () => {
        await bt.off();
        const w = (window.__beepEnd || 0) - Date.now(); if (w > 0) await new Promise(r => setTimeout(r, w)); // ne pas couper le bip
        this.speaking = true; u.onstart && u.onstart();
        try {
          await call('TextToSpeech', 'speak', { text: u.text, lang: String(u.lang || 'fr-FR').replace(/^iw/, 'he'), rate: u.rate || 1, pitch: 1, volume: u.volume == null ? 1 : u.volume, category: 'playback' });
        } catch (e) {}
        this.speaking = false; u.onend && u.onend();
      })();
    },
    cancel() { call('TextToSpeech', 'stop').catch(() => {}); this.speaking = false; },
    pause() {}, resume() {}
  };
  call('TextToSpeech', 'getSupportedVoices').then(r => {
    synth._v = ((r && r.voices) || []).map(v => ({ name: v.name, lang: String(v.lang || '').replace('_', '-'), voiceURI: v.voiceURI, localService: true }));
    synth.onvoiceschanged && synth.onvoiceschanged();
  }).catch(() => {});
  window.SpeechSynthesisUtterance = Utterance;
  try { Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true }); } catch (e) {}
})();
