/* Deck controller: navigation, intro edit, background grid, timer. */
(function(){
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const deck = $('#deck'), slides = $$('.slide'), N = slides.length;
  const dotsEl = $('#dots'), wipe = $('#wipe');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let idx = -1, locked = true, started = false, introPlayed = false, introTimers = [];

  /* ---------- background perspective grid ---------- */
  (function bg(){
    const cv = $('#bgGrid'), c = cv.getContext('2d');
    let w, h, dpr, t = 0, visible = true;
    function size(){ dpr = Math.min(devicePixelRatio || 1, 1.5); w = cv.width = innerWidth*dpr; h = cv.height = innerHeight*dpr; }
    size(); addEventListener('resize', size);
    document.addEventListener('visibilitychange', () => visible = !document.hidden);
    function draw(){
      requestAnimationFrame(draw); if(!visible) return;
      t += .006; c.clearRect(0, 0, w, h);
      const g = c.createRadialGradient(w/2, h*.55, 0, w/2, h*.55, w*.7);
      g.addColorStop(0, 'rgba(3,40,24,.75)'); g.addColorStop(1, 'rgba(1,10,6,0)');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      const hy = h*.58; c.lineWidth = 1*dpr;
      c.strokeStyle = 'rgba(45,255,143,.16)';
      for(let i = -16; i <= 16; i++){ c.beginPath(); c.moveTo(w/2 + i*w*.012, hy); c.lineTo(w/2 + i*w*.16, h); c.stroke(); }
      for(let i = 0; i < 12; i++){
        const k = ((i + t*3) % 12)/12, y = hy + k*k*(h - hy);
        c.strokeStyle = 'rgba(45,255,143,' + (.05 + k*.22) + ')'; c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke();
      }
      // faint ceiling lines
      c.strokeStyle = 'rgba(45,255,143,.05)';
      for(let i = -10; i <= 10; i++){ c.beginPath(); c.moveTo(w/2 + i*w*.012, hy - 1); c.lineTo(w/2 + i*w*.16, 0); c.stroke(); }
    }
    draw();
  })();

  /* ---------- decorative waveforms (slide 5) ---------- */
  $$('[data-wave]').forEach(p => {
    const [amp, f, w] = p.dataset.wave.split(',').map(Number);
    let d = 'M0 0';
    for(let x = 0; x <= w; x += 4) d += ' L' + x + ' ' + (Math.sin(x*f)*amp*(.6 + .4*Math.sin(x*f*.23))).toFixed(1);
    p.setAttribute('d', d);
  });

  /* ---------- dots ---------- */
  slides.forEach((s, i) => {
    const li = document.createElement('li'), b = document.createElement('button');
    b.type = 'button'; b.setAttribute('aria-label', 'Slide ' + (i + 1) + ': ' + s.dataset.title);
    b.addEventListener('click', () => go(i));
    li.appendChild(b); dotsEl.appendChild(li);
  });
  $('#tot').textContent = String(N).padStart(2, '0');

  /* ---------- slide-specific lifecycle ---------- */
  function onEnter(i){
    const s = slides[i];
    if(s.id === 's1') Hero.start(); else Hero.stop();
    if(s.id === 's4') Headset.start(); else Headset.stop();
    if(s.id === 's6') Demo.start(); else Demo.stop();
    if(s.id === 's5') MiniBrain.start(); else MiniBrain.stop();
    if(s.id === 's2'){
      const a = $('#curvePath'), b = $('#curveHeld');
      a.style.setProperty('--len', a.getTotalLength()); b.style.setProperty('--len2', b.getTotalLength());
      const dot = $('#curveDot'), len = a.getTotalLength(), t0 = performance.now() + 800;
      (function mv(now){
        const k = Math.min(1, Math.max(0, (now - t0)/2400)), e = k < .5 ? 4*k*k*k : 1 - Math.pow(-2*k + 2, 3)/2;
        const p = a.getPointAtLength(len*e); dot.setAttribute('cx', p.x); dot.setAttribute('cy', p.y);
        if(k < 1 && slides[idx] === s) requestAnimationFrame(mv);
      })(performance.now());
    }
    if(s.id === 's7') $$('[data-count]', s).forEach(el => countUp(el));
  }
  function countUp(el){
    const to = parseFloat(el.dataset.count), dec = parseInt(el.dataset.dec || '0', 10), t0 = performance.now() + 450;
    (function step(now){
      const k = Math.min(1, Math.max(0, (now - t0)/1400)), e = 1 - Math.pow(1 - k, 3);
      el.textContent = (to*e).toFixed(dec);
      if(k < 1) requestAnimationFrame(step);
    })(performance.now());
  }

  /* ---------- navigation ---------- */
  function go(n, opts = {}){
    n = Math.max(0, Math.min(N - 1, n));
    if(n === idx || (locked && !opts.force)) return;
    const prev = idx, back = n < prev;
    locked = true; setTimeout(() => locked = false, reduce ? 150 : 950);
    deck.classList.toggle('is-back', back);
    deck.classList.toggle('no-anim', prev < 0 || reduce);
    if(prev >= 0){
      const p = slides[prev]; p.classList.remove('is-active', 'is-in'); p.classList.add('is-leaving');
      setTimeout(() => p.classList.remove('is-leaving'), 960);
      wipe.classList.remove('go', 'back'); void wipe.offsetWidth; wipe.classList.add('go'); if(back) wipe.classList.add('back');
      window.Sfx && Sfx.whoosh();
    }
    idx = n; const s = slides[n];
    s.classList.add('is-active');
    requestAnimationFrame(() => requestAnimationFrame(() => s.classList.add('is-in')));
    $$('button', dotsEl).forEach((b, i) => b.classList.toggle('on', i === n));
    $('#cur').textContent = String(n + 1).padStart(2, '0');
    $('#slideName').textContent = s.dataset.title;
    history.replaceState(null, '', '#' + (n + 1));
    onEnter(n);
    if(s.id === 's1' && !introPlayed) playIntro(); else if(s.id !== 's1') stopIntro(true);
    updateTimer();
  }
  const next = () => go(idx + 1), prevS = () => go(idx - 1);

  addEventListener('wheel', e => {
    if(!started || e.ctrlKey) return;
    if(e.target.closest && e.target.closest('.editor__panel, .refs')) return;
    if(Math.abs(e.deltaY) < 18) return;
    e.deltaY > 0 ? next() : prevS();
  }, { passive:true });
  addEventListener('keydown', e => {
    if(!started) return;
    const k = e.key;
    if(['ArrowRight','ArrowDown','PageDown'].includes(k) || (k === ' ' && !e.target.closest('button,input'))){ e.preventDefault(); next(); }
    else if(['ArrowLeft','ArrowUp','PageUp'].includes(k)){ e.preventDefault(); prevS(); }
    else if(k === 'Home') go(0); else if(k === 'End') go(N - 1);
    else if(k === 't' || k === 'T') $('#timer').classList.toggle('is-hidden');
    else if(k === '0') resetTimer();
    else if(k === 'f' || k === 'F') toggleFs();
    else if(k === 'a' || k === 'A') AsciiFX.toggle();
    else if((k === 'r' || k === 'R') && idx === 0){ introPlayed = false; playIntro(); }
    else if((k === 'p' || k === 'P') && idx === 5) Demo.toggle();
  });
  let tx = 0, ty = 0;
  addEventListener('touchstart', e => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive:true });
  addEventListener('touchend', e => {
    if(!started) return;
    const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
    if(Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) dx < 0 ? next() : prevS();
    else if(Math.abs(dy) > 80 && matchMedia('(min-width:901px)').matches) dy < 0 ? next() : prevS();
  }, { passive:true });
  addEventListener('hashchange', () => { const n = parseInt(location.hash.slice(1), 10); if(n && started) go(n - 1, { force:true }); });

  /* ---------- intro edit (slide 1) ---------- */
  const SHOTS = [
    { t:'What if', c:'slam' },
    { t:'you could', c:'slam' },
    { t:'live', c:'shake green' },
    { t:'the best teacher’s', c:'slam' },
    { t:'memory?', c:'shake green' }
  ];
  function stopIntro(finalState){
    introTimers.forEach(clearTimeout); introTimers = [];
    const s1 = $('#s1'); s1.classList.remove('intro'); introPlayed = true;
    if(finalState) $('#edit').classList.remove('flash');
  }
  function playIntro(){
    stopIntro(); introPlayed = false;
    const s1 = $('#s1'), shot = $('#editShot'), edit = $('#edit'), tcEl = $('#editTc');
    if(reduce){ introPlayed = true; return; }
    s1.classList.add('intro'); s1.classList.remove('is-in'); requestAnimationFrame(() => requestAnimationFrame(() => s1.classList.add('is-in')));
    const t0 = performance.now(); let raf;
    (function tc(now){ const sec = (now - t0)/1000; tcEl.textContent = '00:00:0' + Math.min(9, Math.floor(sec)); raf = requestAnimationFrame(tc); })(t0);
    let at = 350;
    SHOTS.forEach(sh => {
      introTimers.push(setTimeout(() => {
        shot.className = 'edit__shot'; void shot.offsetWidth; shot.className = 'edit__shot ' + sh.c; shot.textContent = sh.t;
        window.Sfx && Sfx.hit();
      }, at));
      at += sh.t === 'live' ? 900 : 1000;
    });
    introTimers.push(setTimeout(() => {
      edit.classList.add('flash'); window.Sfx && Sfx.whoosh(); Hero.intro();
      s1.classList.remove('intro'); cancelAnimationFrame(raf);
      s1.classList.remove('is-in'); requestAnimationFrame(() => requestAnimationFrame(() => s1.classList.add('is-in')));
      introTimers.push(setTimeout(() => edit.classList.remove('flash'), 600));
      introPlayed = true;
    }, at + 150));
  }

  /* ---------- presenter timer ---------- */
  const TOTAL = 8*60, PART_END = [150, 270, 405, 480], PART_NAME = ['Device & problem', 'How it works', 'Benefits', 'Conclusion'];
  let tStart = 0;
  function resetTimer(){ tStart = performance.now(); }
  function updateTimer(){
    if(!tStart) return;
    const el = (performance.now() - tStart)/1000, m = String(Math.floor(el/60)).padStart(2, '0'), s = String(Math.floor(el%60)).padStart(2, '0');
    $('#timerVal').textContent = m + ':' + s;
    $('#timerFill').style.width = Math.min(100, el/TOTAL*100) + '%';
    const part = idx >= 0 ? parseInt(slides[idx].dataset.part, 10) : 1;
    $('#timerPart').textContent = 'Part ' + part + ' · ' + PART_NAME[part - 1];
    $('#timer').classList.toggle('is-late', el > PART_END[part - 1] + 15);
  }
  setInterval(updateTimer, 500);

  /* ---------- fullscreen + sound buttons ---------- */
  function toggleFs(){
    if(document.fullscreenElement) document.exitFullscreen && document.exitFullscreen();
    else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {});
  }
  $('#fsBtn').addEventListener('click', toggleFs);
  const asciiBtn = $('#asciiBtn');
  const syncAscii = on => asciiBtn.classList.toggle('on', on);
  syncAscii(AsciiFX.on); AsciiFX.onChange(syncAscii);
  asciiBtn.addEventListener('click', () => AsciiFX.toggle());
  const soundBtn = $('#soundBtn');
  soundBtn.addEventListener('click', () => { const on = Sfx.toggle(); soundBtn.classList.toggle('on', on); });

  /* ---------- entry: the intro (js/intro.js) calls Deck.enter once the player's Play button is pressed ---------- */
  function enter(sound){
    if(started) return; started = true;
    if(sound){ Sfx.enable(); soundBtn.classList.add('on'); }
    locked = false;
    resetTimer();
    const n = parseInt(location.hash.slice(1), 10);
    go(n && n > 1 && n <= N ? n - 1 : 0, { force:true });
  }
  window.Deck = { enter };})();
