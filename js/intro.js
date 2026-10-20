/* Intro: a video-player page with a real video (the clip, a local file). Pressing Play floods the page with symbols and starts the site.
   At the end of the site the big button switches it off like an old TV, the player page comes back and the clip plays;
   at the key line the screen fills with "The Matrix has you..." (js/matrix.js). */
(function(){
  const $ = (s, r = document) => r.querySelector(s);
  const intro = $('#intro');
  if(!intro || !window.Deck){ if(window.Deck) Deck.enter(false); return; }

  // deep links (#2, #3 ...) and ?nointro skip the intro, so single slides can still be opened directly
  const hashN = parseInt(location.hash.slice(1), 10);
  const skipIntro = (hashN && hashN > 1) || /nointro/.test(location.search);

  /* ---- the video: the clip is a local file (no YouTube, so no ads); the page draws its own player UI on top ---- */
  const NEO_AT = 40.5;                       // second of the clip where the screen starts filling with "The Matrix has you..." (tune here)
  const POSTER = 'assets/img/matrix-poster.jpg';
  const mv = $('#matrixVid');
  let yt = null, ytReady = false, ytFailed = false, wantPlay = false;   // "yt" is a small wrapper around the <video> element
  if(mv){
    const play = () => { const p = mv.play(); if(p && p.catch) p.catch(() => {}); };
    yt = { getCurrentTime:() => mv.currentTime, getDuration:() => mv.duration || 179, seekTo:s => { try{ mv.currentTime = s; }catch(e){} },
           unMute:() => { mv.muted = false; }, setVolume:v => { mv.volume = Math.max(0, Math.min(1, v/100)); }, playVideo:play,
           pauseVideo:() => mv.pause(), getPlayerState:() => mv.paused ? 2 : 1 };
    mv.addEventListener('canplay', () => { ytReady = true; if(wantPlay) startVideo(); });
    mv.addEventListener('ended', () => videoEnded());
    mv.addEventListener('error', () => { ytFailed = true; if(wantPlay) videoFallback(); });
    const pl = $('#player'); if(pl) pl.style.setProperty('--poster', 'url("' + new URL(POSTER, document.baseURI).href + '")');   // var() urls resolve against the stylesheet, so give it the full address
  }
  function loadYT(){ if(mv && mv.preload !== 'auto'){ mv.preload = 'auto'; mv.load(); } }   // start downloading the clip (10 MB) once the site starts
  const fmt = t => Math.floor(t/60) + ':' + String(Math.floor(t%60)).padStart(2, '0');
  const tm = $('.player__time'), dot = $('.player__track i');
  const HANDOVER = 40.8, FADE = 1.6;       // the clip's own sound hands over to the looped melody at 40.8 s and is gone by 42.4 s, before Neo's words (~43 s)
  const LOOP_FROM = 39;                    // the loop is the clip's 0:39-0:43
  let mode = 'poster', watch = 0, flooded = false, voiceGone = false, idleT = 0, fbTimer = 0;

  const playBtn = $('#introPlay'), soundBtn = $('#introSound'), skipBtn = $('#introSkip');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let sound = true, busy = false;

  soundBtn.addEventListener('click', e => { e.stopPropagation(); sound = !sound; intro.classList.toggle('snd-off', !sound); });
  setTimeout(() => { try{ playBtn.focus({ preventScroll:true }); }catch(e){} }, 300);

  function hash(i, s){
    let h = Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(s + 7, 0x85ebca6b);
    h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; return (h >>> 0)/4294967295;
  }

  function start(){
    if(busy) return; busy = true;
    mode = 'site'; loadYT();
    if(reduce){ Deck.enter(sound); intro.classList.add('is-gone'); setTimeout(() => { if(mode === 'site') intro.style.display = 'none'; }, 1300); return; }

    const W = Math.max(320, innerWidth), H = Math.max(240, innerHeight), dpr = Math.min(devicePixelRatio || 1, 2);
    const CW = Math.round(Math.max(9, Math.min(14, W/140))*(window.Perf ? Perf.cellScale : 1)), CH = Math.round(CW*1.55), cols = Math.ceil(W/CW), rows = Math.ceil(H/CH);
    const GLYPHS = '01#$%&*+<>?/\\|{}[]=~^:;ABCDEFXZ';
    const cv = document.createElement('canvas'); cv.className = 'intro-dust';
    cv.width = Math.round(W*dpr); cv.height = Math.round(H*dpr); cv.style.width = W + 'px'; cv.style.height = H + 'px';
    document.body.appendChild(cv);
    const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // flood: every column fills from the top at its own pace, so the front is ragged like falling code
    // fast: the whole thing is over in about a second, so it reads as one quick glitch before slide 1
    const col = Array.from({ length:cols }, (_, c) => ({ d:hash(c, 1)*.15, v:75 + hash(c, 2)*60 }));
    const FILL_END = Math.max(...col.map(k => k.d + rows/k.v));            // all columns covered
    const T_COVER = FILL_END + .03;                                          // at this moment the page is fully covered
    const MAXD = Math.hypot(W/2, H/2), REVEAL = .6;                          // then the symbols vanish from the centre outwards
    const T_END = T_COVER + REVEAL + .1;
    const PRESS = .3;                                                        // the "button pressed, something boots" beat before the flood
    const T0 = performance.now() + PRESS*1000;
    intro.classList.add('is-press');
    if(tm) tm.textContent = '0:00 / 2:59';
    setTimeout(() => { if(tm) tm.textContent = '0:01 / 2:59'; if(dot) dot.style.left = '1.4%'; }, 120);
    if(sound && window.Sfx){
      Sfx.enable(); Sfx.click(); Sfx.charge(PRESS + T_COVER);
      setTimeout(() => Sfx.glitch(0, T_COVER + .05), PRESS*1000);
      setTimeout(() => { Sfx.boom(); Sfx.reveal(REVEAL); }, (PRESS + T_COVER)*1000);
    }
    let entered = false;
    const GREENS = ['#eafff3', '#59ffa6', '#2dff8f', '#16c46f', '#0c7a45'];
    // Speed: a row is drawn as a handful of whole strings (one per green) instead of one call per symbol, and the dark backing is
    // drawn as runs of cells instead of one rectangle per cell.
    const FONT = '"Share Tech Mono", ui-monospace, Consolas, monospace';
    ctx.font = '100px ' + FONT; const adv = ctx.measureText('M').width/100 || .6;      // advance of one character per px of font size
    const FS = Math.max(8, CW/adv);                                                       // the size at which one character is exactly one cell wide
    const n = cols*rows, jit = new Float32Array(n), HT = new Float32Array(n), head = new Float32Array(cols), bot = new Int16Array(cols);
    for(let i = 0; i < n; i++) jit[i] = hash(i, 5);
    let lastTick = -1;
    const SP = ' '.repeat(cols + 2), GL = GLYPHS.length;

    function frame(now){
      const t = (now - T0)/1000, tick = Math.floor(t*24);
      if(tick !== lastTick){ lastTick = tick; for(let i = 0; i < n; i++) HT[i] = hash(i, tick); }
      ctx.clearRect(0, 0, W, H);
      ctx.font = FS.toFixed(1) + 'px ' + FONT; ctx.textBaseline = 'top';
      if(!entered && t >= T_COVER){ entered = true; Deck.enter(sound); intro.style.display = 'none'; }
      const covered = t >= T_COVER, R = covered ? (t - T_COVER)/REVEAL*MAXD*1.12 : -1;   // radius of the cleared hole
      for(let c = 0; c < cols; c++){ const k = col[c]; head[c] = (t - k.d)*k.v; bot[c] = head[c] < 0 ? -1 : Math.min(rows - 1, Math.floor(head[c])); }
      const cmds = [];
      ctx.fillStyle = '#020c07';                                                          // dark backing so the page below is hidden while flooded
      for(let r = 0; r < rows; r++){
        const y = r*CH, base = r*cols, dy = (r + .5)*CH - H/2, sr = [null, null, null, null, null], st = [0, 0, 0, 0, 0], en = [0, 0, 0, 0, 0];
        let run = -1;
        for(let c = 0; c < cols; c++){
          let vis = r <= bot[c], dd = 0;
          if(vis && covered){ const dx = (c + .5)*CW - W/2; dd = Math.sqrt(dx*dx + dy*dy) + jit[base + c]*MAXD*.07 - R; if(dd < 0) vis = false; }   // < 0: already cleared
          if(!vis){ if(run >= 0){ ctx.fillRect(run*CW, y, (c - run)*CW, CH); run = -1; } continue; }
          if(run < 0) run = c;
          const h = HT[base + c], dh = head[c] - r;
          let g = 4;                                                                      // settled: dim green
          if(dh < 1.2) g = 0;                                                             // the flooding front: near white
          else if(dh < 6) g = 1 + ((dh - 1.2)/2.4 | 0);                                   // bright trail behind the front
          else if(h < .08) g = 3;                                                         // random sparkle
          if(covered && dd < MAXD*.1) g = Math.min(g, dd < MAXD*.03 ? 0 : 2);            // the edge of the hole glows
          const ch = GLYPHS[(h*GL) | 0];
          if(sr[g] === null){ sr[g] = ch; st[g] = c; en[g] = c + 1; }
          else { const gap = c - en[g]; sr[g] += (gap > 0 ? SP.substr(0, gap) : '') + ch; en[g] = c + 1; }
        }
        if(run >= 0) ctx.fillRect(run*CW, y, (cols - run)*CW, CH);
        for(let g = 0; g < 5; g++) if(sr[g] !== null) cmds.push(g, st[g]*CW, y, sr[g]);
      }
      for(let k = 0; k < cmds.length; k += 4){ ctx.fillStyle = GREENS[cmds[k]]; ctx.fillText(cmds[k + 3], cmds[k + 1], cmds[k + 2]); }
      if(t < T_END) requestAnimationFrame(frame); else cv.remove();
    }
    requestAnimationFrame(frame);
    setTimeout(() => { if(mode === 'site') intro.style.display = 'none'; if(cv.isConnected) cv.remove(); }, 9000);
  }

  /* ---- the way back: the finale button, the CRT shutdown, then the player with the video ---- */
  function videoTick(){
    if(mode !== 'video') return;
    let t = 0, d = 179;
    if(yt && ytReady){ try{ t = yt.getCurrentTime() || 0; d = yt.getDuration() || d; }catch(e){} }
    else t = (performance.now() - fbTimer)/1000;
    if(tm) tm.textContent = fmt(t) + ' / ' + fmt(d);
    if(dot) dot.style.left = Math.min(100, t/d*100) + '%';
    if(!voiceGone && t >= HANDOVER){ voiceGone = true; handOver(); }
    if(!flooded && t >= NEO_AT){ flooded = true; if(window.MatrixText) MatrixText.start(); }
    idleT += .1; if(idleT > 3.2) intro.classList.add('is-idle');
  }
  function handOver(){                                       // cross-fade: the clip's sound out, the looped melody in, from the same spot of the sound
    const getT = () => { try{ return yt && ytReady ? yt.getCurrentTime() : (performance.now() - fbTimer)/1000; }catch(e){ return HANDOVER; } };
    if(window.Sfx) Sfx.dread({ fade:FADE, offset:() => getT() - LOOP_FROM + .06 });
    const t0 = performance.now();
    const iv = setInterval(() => { const k = Math.min(1, (performance.now() - t0)/1000/FADE); try{ yt && yt.setVolume(Math.round(100*(1 - k))); }catch(e){} if(k >= 1) clearInterval(iv); }, 40);
  }
  function startVideo(){
    wantPlay = false; voiceGone = false;
    try{ yt.seekTo(0, true); yt.unMute(); yt.setVolume(100); yt.playVideo(); }catch(e){ videoFallback(); return; }
    idleT = 4; intro.classList.add('is-idle');            // our fake controls stay hidden while the clip starts (the player's own title shows for a moment)
    clearInterval(watch); watch = setInterval(videoTick, 100);
  }
  function videoFallback(){                // the clip could not be loaded: keep the finale alive with a timer
    if(mode !== 'video') return;
    fbTimer = performance.now() - 0; clearInterval(watch); watch = setInterval(videoTick, 100);
    if(tm) tm.textContent = '0:00 / 2:59';
  }
  function videoEnded(){
    if(mode !== 'video' || flooded) return;                // after the Matrix message the black screen stays (Esc goes back)
    setTimeout(() => resetToPoster(), 4000);
  }
  function resetToPoster(){
    clearInterval(watch); mode = 'poster'; flooded = false; voiceGone = false; busy = false;
    if(window.Sfx) Sfx.dreadStop(.6);
    if(window.MatrixText) MatrixText.stop();
    try{ yt && yt.pauseVideo(); }catch(e){}
    intro.classList.remove('is-video', 'is-idle', 'is-press', 'is-gone');
    if(tm) tm.textContent = '0:00 / 2:59'; if(dot) dot.style.left = '0%';
  }
  function showPlayer(auto){
    intro.style.display = ''; intro.classList.remove('is-press', 'is-gone', 'is-idle'); intro.classList.add('is-video');
    mode = 'video'; flooded = false; voiceGone = false; idleT = 0; busy = true;
    if(tm) tm.textContent = '0:00 / 2:59'; if(dot) dot.style.left = '0%';
    if(auto === false) return;
    if(yt && ytReady) startVideo(); else { wantPlay = true; if(ytFailed) videoFallback(); else loadYT(); }
  }

  let finaleBusy = false;
  /* The site switches off like an old TV (the reference clip): snow, a flat grey flash, the picture squashes to a bright
     line, the line shrinks to a dot, the dot fades. Then a black pause, and the player page is simply back. */
  function finale(){
    if(finaleBusy || !Deck.started) return; finaleBusy = true;
    const site = $('#site'), crt = $('#crt'), root = document.documentElement;
    if(!crt || !site){ Deck.leave(); showPlayer(); finaleBusy = false; return; }
    loadYT(); if(window.Sfx) Sfx.dreadPrepare();            // make sure the clip is loading and decode the loop while the TV is "switching off"
    if(window.Sfx && Sfx.on){ Sfx.crtOff(); setTimeout(() => Sfx.disable(), 1700); }
    // the "picture" that gets squashed: noise over the whole site
    const fx = document.createElement('div'); fx.className = 'crtfx';
    const nz = document.createElement('canvas'); nz.width = 192; nz.height = 108; fx.appendChild(nz); site.appendChild(fx);
    const nctx = nz.getContext('2d'), img = nctx.createImageData(192, 108);
    root.classList.add('crt-run'); crt.style.display = 'block'; crt.style.opacity = '1'; crt.style.background = 'transparent';
    const SL = /crtslow/.test(location.search) ? 8 : 1;                    // ?crtslow plays the shutdown in slow motion (for checking the look)
    const E = { snow:550, flat:640, s1:730, s2:810, s3:930, dot:1060, fade:1750, hold:950 }, t0 = performance.now();
    Object.keys(E).forEach(k => E[k] *= SL);
    const easeIn = k => k*k, easeOut = k => 1 - Math.pow(1 - k, 2), set = (k, v) => crt.style.setProperty(k, v);
    let left = false, ph = 0;
    function snow(t){
      const d = img.data; ph += .35;
      for(let y = 0; y < 108; y++){
        const band = .62 + .38*Math.sin(y*.32 + ph + Math.sin(y*.05)*3);
        for(let x = 0; x < 192; x++){ const v = Math.min(255, (60 + Math.random()*195)*band) | 0, i = (y*192 + x)*4; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
      }
      nctx.putImageData(img, 0, 0);
    }
    (function step(now){
      const t = now - t0;
      if(t < E.snow){                                         // snow fades in over the site, the picture shakes
        const k = t/E.snow; fx.style.opacity = Math.min(1, k*1.6).toFixed(3); snow(t);
        site.style.transform = 'translateX(' + ((Math.random() - .5)*14*k).toFixed(1) + 'px)';
        site.style.filter = 'brightness(' + (1 + .6*k).toFixed(2) + ')';
      } else if(t < E.flat){                                  // flat grey
        fx.style.opacity = 1; nz.style.opacity = 0; fx.style.background = '#7b7b7b'; site.style.transform = ''; site.style.filter = '';
      } else if(t < E.s1){                                    // squash to a light grey band (about a third of the height)
        const k = (t - E.flat)/(E.s1 - E.flat); fx.style.background = 'rgb(' + (123 + 80*k | 0) + ',' + (123 + 80*k | 0) + ',' + (123 + 80*k | 0) + ')';
        site.style.transform = 'scaleY(' + (1 - .66*easeIn(k)).toFixed(4) + ')';
      } else if(t < E.s2){                                    // thinner, whiter
        const k = (t - E.s1)/(E.s2 - E.s1); const c = 203 + 52*k | 0; fx.style.background = 'rgb(' + c + ',' + c + ',' + c + ')';
        site.style.transform = 'scaleY(' + (.34 - .2*easeIn(k)).toFixed(4) + ')';
      } else if(t < E.s3){                                    // a thin white line
        const k = (t - E.s2)/(E.s3 - E.s2); fx.style.background = '#fff';
        site.style.transform = 'scaleY(' + Math.max(.004, .14 - .136*easeIn(k)).toFixed(4) + ')';
        site.style.filter = 'brightness(' + (1.6 + 2*k).toFixed(2) + ')';
      } else if(t < E.dot){                                   // the line shrinks to a dot
        const k = (t - E.s3)/(E.dot - E.s3);
        site.style.visibility = 'hidden'; crt.style.background = '#000';
        set('--lo', 1); set('--lw', (1 - easeIn(k)*.985).toFixed(4)); set('--lh', (3 + k*4).toFixed(1));
      } else if(t < E.fade){                                  // the dot fades away
        const k = (t - E.dot)/(E.fade - E.dot);
        crt.style.background = '#000'; set('--lw', .012); set('--lh', 7); set('--lo', Math.max(0, 1 - easeOut(k)*1.02 + Math.sin(t*.06)*.05*(1 - k)).toFixed(3));
      } else { crt.style.background = '#000'; set('--lo', 0); }
      if(t >= E.fade && !left){ left = true; Deck.leave(); showPlayer(false); site.style.transform = ''; site.style.filter = ''; site.style.visibility = ''; fx.remove(); }
      if(t < E.fade + E.hold){ requestAnimationFrame(step); return; }
      // the pause is over: the player page is simply there again, as if nothing had happened
      crt.style.transition = 'opacity 260ms linear'; crt.style.opacity = '0';
      if(ytReady) startVideo(); else { wantPlay = true; if(ytFailed) videoFallback(); }
      setTimeout(() => { crt.style.display = 'none'; crt.style.transition = ''; crt.style.background = 'transparent'; ['--lo', '--lw', '--lh'].forEach(k => crt.style.removeProperty(k)); root.classList.remove('crt-run'); finaleBusy = false; }, 320);
    })(t0);
  }
  const pm = $('#pressMe'); if(pm) pm.addEventListener('click', finale);

  // the video page behaves like one: click toggles pause, controls fade when the mouse rests
  const playerEl = $('#player');
  if(playerEl){
    playerEl.addEventListener('click', e => {
      if(mode !== 'video' || !yt || !ytReady || e.target.closest('button')) return;
      try{ yt.getPlayerState() === 1 ? yt.pauseVideo() : yt.playVideo(); }catch(err){}
    });
  }
  addEventListener('pointermove', () => { idleT = 0; intro.classList.remove('is-idle'); });

  playBtn.addEventListener('click', start);
  skipBtn.addEventListener('click', start);
  addEventListener('keydown', e => { if(e.key === 'Escape' && mode === 'video'){ resetToPoster(); return; }
    if(mode === 'poster' && !busy && intro.style.display !== 'none' && (e.key === 'Enter' || e.key === ' ')){ e.preventDefault(); start(); } });

  if(skipIntro){ intro.style.display = 'none'; Deck.enter(false); }
})();
