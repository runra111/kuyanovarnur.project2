/* Slide 6: the real example. A video we filmed, run through the same "lesson editor" layers as the simulation:
   the expert's gaze, his inner thoughts (like subtitles) and body signals (heart rate), with a speed control. No sound. */
(function(){
  const $ = id => document.getElementById(id);
  const vid = $('realVid'), editor = document.querySelector('.editor'), view = $('edView'), stage = $('rvStage');
  if(!vid || !editor || !stage){ window.RealVid = { start(){}, stop(){}, pause(){} }; return; }
  const big = $('realBig'), play = $('rvPlay'), tl = $('rvTl'), fill = $('rvFill'), head = $('rvHead'), time = $('rvTime'), fs = $('rvFs');
  const kicker = $('demoKicker'), title = $('demoTitle'), tip = $('demoTip'), seg = $('demoMode');
  const gazeEl = $('rvGaze'), thoughtEl = $('rvThought'), bpmBox = $('rvBpm'), bpmVal = $('rvBpmVal'), bpmCv = $('rvBpmCv'), bctx = bpmCv.getContext('2d');
  const L = { gaze:$('rGaze'), thought:$('rThought'), body:$('rBody') };
  const SIM = { kicker:kicker.textContent, title:title.innerHTML, tip:'Move the mouse to look around · toggle layers' };
  const VID = { kicker:'06 — Our real example', title:'Our own test, <span class="hl">filmed for this pitch</span>', tip:'Filmed by our team · switch the layers' };
  const fmt = t => Math.floor(t/60) + ':' + String(Math.floor(t%60)).padStart(2, '0');
  const lerp = (a, b, k) => a + (b - a)*k, smooth = k => k*k*(3 - 2*k);

  /* the video never makes a sound */
  vid.muted = true; vid.defaultMuted = true; vid.volume = 0;
  vid.addEventListener('volumechange', () => { if(!vid.muted || vid.volume) { vid.muted = true; vid.volume = 0; } });

  /* ---- the recorded layers (what the expert looked at, thought and felt), keyed to the clip's seconds ---- */
  const THOUGHTS = [
    [0, 'Today is the day. Let’s go.'], [2.2, 'Watch the cracks — steady steps.'], [4, 'Two things to remember.'], [5, 'One last look at my notes.'],
    [6.8, 'Formula first, then the example.'], [8.2, 'Okay. I know this.'], [10, 'Time to practise.'], [11.4, 'Switching to the screen…'],
    [12.4, 'Focus. Eyes on the crosshair.'], [14.6, 'Check the corner. Clear.'], [17, 'Stay calm. Breathe out.'], [19.4, 'That felt right.'],
    [20.8, 'Now I can explain it to anyone.'], [23.2, 'This is what ENGRAM records.']
  ];
  const GAZE = [   // t, x, y (0..1 inside the picture)
    [0, .5, .56], [1.6, .46, .64], [3, .56, .52], [4.2, .62, .36], [5.2, .38, .62], [6.4, .56, .58], [7.6, .46, .68], [8.6, .5, .5],
    [10, .44, .6], [11.6, .5, .5], [12.6, .5, .52], [14, .64, .46], [15.4, .36, .42], [17, .52, .5], [18.6, .5, .56], [20.4, .5, .42], [22, .5, .38], [25, .5, .4]
  ];
  const BPM = [[0, 78], [3, 86], [5, 82], [8, 76], [10, 90], [11.5, 96], [12.5, 104], [15, 120], [17, 126], [19, 108], [21, 92], [25, 84]];
  const TICKS = [4, 5, 8.2, 11.4, 12.4, 20.5];

  function at(arr, t, i){                                   // smooth interpolation through keyframes [t, v, ...]
    let k = 0; while(k < arr.length - 2 && arr[k + 1][0] <= t) k++;
    const a = arr[k], b = arr[k + 1] || a, f = b[0] > a[0] ? smooth(Math.max(0, Math.min(1, (t - a[0])/(b[0] - a[0])))) : 0;
    return a.slice(1).map((v, n) => lerp(v, b[n + 1], f));
  }
  const g = (x, c, w, a) => a*Math.exp(-Math.pow((x - c)/w, 2));
  const ecg = x => g(x, .12, .035, .13) - g(x, .27, .012, .14) + g(x, .3, .012, 1) - g(x, .33, .014, .28) + g(x, .56, .06, .28);
  const trace = new Array(160).fill(0); let phase = 0;

  /* ---- keep the picture stage 16:9 inside the editor view, so overlays sit on the picture ---- */
  function fit(){
    const W = view.clientWidth, H = view.clientHeight; if(!W || !H) return;
    let w = W, h = W*9/16; if(h > H){ h = H; w = H*16/9; }
    stage.style.width = w + 'px'; stage.style.height = h + 'px';
  }
  if(window.ResizeObserver) new ResizeObserver(fit).observe(view); addEventListener('resize', fit); fit();

  /* ---- per-frame overlay update ---- */
  let running = false, raf = 0, last = 0, gx = .5, gy = .5, lastThought = -1, lastTick = -1;
  function frame(now){
    if(!running) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(.1, (now - last)/1000); last = now;
    const t = vid.currentTime || 0, playing = !vid.paused && !vid.ended;

    if(L.gaze.checked){
      const [tx, ty] = at(GAZE, t);
      const j = playing ? 1 : .2;
      gx += (tx + Math.sin(t*9.3)*.006*j - gx)*Math.min(1, dt*9); gy += (ty + Math.cos(t*7.1)*.008*j - gy)*Math.min(1, dt*9);
      gazeEl.style.left = (gx*100) + '%'; gazeEl.style.top = (gy*100) + '%';
    }
    gazeEl.classList.toggle('hide', !L.gaze.checked);

    let ti = 0; while(ti < THOUGHTS.length - 1 && THOUGHTS[ti + 1][0] <= t) ti++;
    if(ti !== lastThought){ lastThought = ti; thoughtEl.classList.remove('show'); setTimeout(() => { thoughtEl.textContent = THOUGHTS[ti][1]; thoughtEl.classList.toggle('show', L.thought.checked); }, 160); }
    else thoughtEl.classList.toggle('show', L.thought.checked);

    const bpm = at(BPM, t)[0] + Math.sin(t*2.1)*1.5;
    bpmVal.textContent = Math.round(bpm);
    bpmBox.classList.toggle('hide', !L.body.checked);
    if(playing && L.body.checked){
      const steps = Math.max(1, Math.round(dt*60));
      for(let n = 0; n < steps; n++){ phase += bpm/60*(dt/steps)*(vid.playbackRate || 1); trace.push(ecg(phase % 1)); trace.shift(); }
      const w = bpmCv.width, h = bpmCv.height; bctx.clearRect(0, 0, w, h);
      bctx.strokeStyle = '#ff4d6d'; bctx.lineWidth = 2; bctx.beginPath();
      trace.forEach((v, i) => { const x = i/(trace.length - 1)*w, y = h*.78 - v*h*.62; i ? bctx.lineTo(x, y) : bctx.moveTo(x, y); });
      bctx.stroke();
    }
  }

  function ui(){
    const d = vid.duration || 0, t = vid.currentTime || 0, k = d ? t/d : 0;
    fill.style.width = (k*100) + '%'; head.style.left = (k*100) + '%';
    time.textContent = fmt(t) + ' / ' + fmt(d || 0);
    const playing = !vid.paused && !vid.ended;
    play.textContent = playing ? '❚❚' : '▶'; editor.classList.toggle('vid-playing', playing);
  }
  ['loadedmetadata', 'timeupdate', 'play', 'pause', 'ended', 'seeked'].forEach(ev => vid.addEventListener(ev, ui));
  vid.addEventListener('loadedmetadata', () => { if(!tl.querySelector('.tick')) TICKS.forEach(s => { const e = document.createElement('span'); e.className = 'tick'; e.style.left = (s/vid.duration*100) + '%'; tl.appendChild(e); }); });

  function toggle(){ vid.paused || vid.ended ? vid.play().catch(() => {}) : vid.pause(); }
  big.addEventListener('click', e => { e.stopPropagation(); if(vid.ended) vid.currentTime = 0; toggle(); });
  play.addEventListener('click', () => { if(vid.ended) vid.currentTime = 0; toggle(); });
  vid.addEventListener('click', toggle);
  fs.addEventListener('click', () => { (stage.requestFullscreen || stage.webkitRequestFullscreen || (() => {})).call(stage); });

  let scrub = false;
  const seek = e => { const r = tl.getBoundingClientRect(); if(vid.duration) vid.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left)/r.width))*vid.duration; };
  tl.addEventListener('pointerdown', e => { scrub = true; tl.setPointerCapture(e.pointerId); seek(e); });
  tl.addEventListener('pointermove', e => { if(scrub) seek(e); });
  tl.addEventListener('pointerup', () => { scrub = false; });

  /* speed */
  document.querySelectorAll('#rvSpeed button').forEach(b => b.addEventListener('click', () => {
    vid.playbackRate = parseFloat(b.dataset.s);
    document.querySelectorAll('#rvSpeed button').forEach(x => x.classList.toggle('on', x === b));
    if(window.Sfx) Sfx.blip(660);
  }));
  Object.values(L).forEach(el => el.addEventListener('change', () => window.Sfx && Sfx.blip(el.checked ? 900 : 500)));

  function mode(m){
    const isVid = m === 'vid', T = isVid ? VID : SIM;
    editor.classList.toggle('is-video', isVid);
    seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.m === m));
    kicker.textContent = T.kicker; title.innerHTML = T.title; tip.textContent = T.tip;
    if(!isVid) vid.pause();
    if(window.Demo && Demo.hold) Demo.hold(isVid);
    fit();
  }
  seg.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { mode(b.dataset.m); if(window.Sfx) Sfx.blip(b.dataset.m === 'vid' ? 700 : 520); }));
  mode('vid');
  ui();

  window.RealVid = {
    start(){ if(running) return; running = true; fit();
      if(vid.preload !== 'metadata'){ vid.preload = 'metadata'; vid.load(); }   // the 57 MB file is only touched once slide 6 is reached
      last = performance.now(); raf = requestAnimationFrame(frame); },
    stop(){ running = false; cancelAnimationFrame(raf); vid.pause(); },
    pause(){ vid.pause(); }
  };
})();
