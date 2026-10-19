/* Tiny synthesized sound layer (no audio files). */
(function(){
  let ctx = null, master = null, enabled = false, drone = null;

  function init(){
    if(ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
  }

  function startDrone(){
    if(drone || !ctx) return;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 320; lp.Q.value = 6;
    const g = ctx.createGain(); g.gain.value = .5;
    lp.connect(g); g.connect(master);
    const oscs = [55, 55.4, 82.5, 110.3].map((f, i) => {
      const o = ctx.createOscillator();
      o.type = i % 2 ? 'sawtooth' : 'triangle';
      o.frequency.value = f;
      const og = ctx.createGain(); og.gain.value = i < 2 ? .35 : .15;
      o.connect(og); og.connect(lp); o.start();
      return o;
    });
    const lfo = ctx.createOscillator(); lfo.frequency.value = .08;
    const lg = ctx.createGain(); lg.gain.value = 120;
    lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
    drone = { oscs, lfo };
  }

  function env(g, t, a, d, peak){
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  const Sfx = {
    get on(){ return enabled; },
    enable(){
      init(); if(!ctx) return;
      if(ctx.state === 'suspended') ctx.resume();
      enabled = true; startDrone();
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.linearRampToValueAtTime(.22, ctx.currentTime + 1.5);
    },
    disable(){
      enabled = false;
      if(ctx) master.gain.linearRampToValueAtTime(0, ctx.currentTime + .4);
    },
    toggle(){ enabled ? Sfx.disable() : Sfx.enable(); return enabled; },
    whoosh(){
      if(!enabled || !ctx) return;
      const t = ctx.currentTime, len = ctx.sampleRate * .9;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      for(let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource(); src.buffer = buf;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2;
      bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(3800, t + .8);
      const g = ctx.createGain(); env(g, t, .25, .6, .5);
      src.connect(bp); bp.connect(g); g.connect(master); src.start(t);
    },
    blip(f = 880){
      if(!enabled || !ctx) return;
      const t = ctx.currentTime;
      const o = ctx.createOscillator(); o.type = 'square'; o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(f * 1.5, t + .08);
      const g = ctx.createGain(); env(g, t, .01, .14, .12);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + .2);
    },
    hit(){
      if(!enabled || !ctx) return;
      const t = ctx.currentTime;
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + .35);
      const g = ctx.createGain(); env(g, t, .005, .45, .9);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + .6);
    },

    /* ---- intro sounds (the player's Play button) ---- */
    noise(t, dur, type, f0, f1, peak, a = .01){
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      for(let i = 0; i < len; i++) d[i] = Math.random()*2 - 1;
      const src = ctx.createBufferSource(); src.buffer = buf;
      const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = 1.1;
      f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
      const g = ctx.createGain(); env(g, t, a, Math.max(.02, dur - a), peak);
      src.connect(f); f.connect(g); g.connect(master); src.start(t);
    },
    click(){                                   // the press itself: a crisp tick and a low thunk
      if(!enabled || !ctx) return;
      const t = ctx.currentTime;
      Sfx.noise(t, .05, 'highpass', 2500, 5000, .5, .002);
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(260, t); o.frequency.exponentialRampToValueAtTime(70, t + .14);
      const g = ctx.createGain(); env(g, t, .004, .16, .8);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + .25);
    },
    charge(dur){                               // power-up: a rising whine while the screen fills
      if(!enabled || !ctx) return;
      const t = ctx.currentTime + .02;
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(1500, t + dur);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 5;
      lp.frequency.setValueAtTime(250, t); lp.frequency.exponentialRampToValueAtTime(4200, t + dur);
      const g = ctx.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.32, t + dur*.9); g.gain.exponentialRampToValueAtTime(.0001, t + dur + .06);
      o.connect(lp); lp.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .1);
    },
    glitch(from, dur){                         // data chirps while the symbols pour in
      if(!enabled || !ctx) return;
      const t0 = ctx.currentTime + from, n = Math.round(10 + dur*26);
      for(let i = 0; i < n; i++){
        const t = t0 + Math.random()*dur, f = 500 + Math.random()*3200;
        const o = ctx.createOscillator(); o.type = Math.random() < .5 ? 'square' : 'sawtooth';
        o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f*(Math.random() < .5 ? .5 : 1.8), t + .04);
        const g = ctx.createGain(); env(g, t, .002, .03 + Math.random()*.04, .07);
        o.connect(g); g.connect(master); o.start(t); o.stop(t + .1);
      }
    },
    boom(){                                    // the screen is full: a deep hit and a burst of air
      if(!enabled || !ctx) return;
      const t = ctx.currentTime;
      Sfx.hit(); Sfx.noise(t, .5, 'lowpass', 2400, 120, .6, .004);
    },
    reveal(dur){                               // the hole opens from the centre: air rushing outwards
      if(!enabled || !ctx) return;
      const t = ctx.currentTime;
      Sfx.noise(t, dur, 'bandpass', 600, 6500, .45, dur*.35);
    }
  };
  window.Sfx = Sfx;
})();
