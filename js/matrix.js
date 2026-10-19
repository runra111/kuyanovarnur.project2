/* "The Matrix has you...": once started, the whole screen fills with more and more of these captions, in green, in every size. */
(function(){
  // the same words and the same look as in the clip: a green Courier-style terminal font with a soft glow
  const PHRASES = ['The Matrix has you...', 'The Matrix has you...', 'The Matrix has you...', 'The Matrix has you...', 'The Matrix has you...', 'Wake up, Neo...', 'The Matrix has you...', 'Follow the white rabbit.', 'Knock, knock, Neo.'];
  const COLORS = ['#7fe3b6', '#6fd9a8', '#9ff0c8', '#5fd09b', '#b8f7da', '#7fe3b6', '#4fc68c'];
  const MAXN = 460, RAMP = 8;                  // most captions on screen at once; seconds until the screen is dense
  const DARK_AT = 5.5, BLACK_AT = 13.5;        // the pile-up slowly sinks the screen into black from 5.5 s; at 13.5 s the letters fade out too
  const FINAL = 'The Matrix has you...';       // the line that is left alone on the black screen, typed like in the clip
  let layer = null, fill = null, raf = 0, t0 = 0, last = 0, acc = 0, n = 0, running = false, phase = 'flood', timers = [], onBlack = null;

  function make(){
    const el = document.createElement('span'); el.className = 'mtx';
    const r = Math.random();
    const size = r < .55 ? 13 + Math.random()*16 : r < .9 ? 30 + Math.random()*46 : 80 + Math.random()*110;   // many small, some big, a few huge
    el.textContent = PHRASES[Math.floor(Math.random()*PHRASES.length)];
    el.style.fontSize = size.toFixed(1) + 'px';
    el.style.left = (Math.random()*112 - 8).toFixed(1) + '%';
    el.style.top = (Math.random()*108 - 4).toFixed(1) + '%';
    const c = COLORS[Math.floor(Math.random()*COLORS.length)];
    el.style.color = c; el.style.textShadow = '0 0 ' + (size*.28).toFixed(0) + 'px ' + c + ', 0 0 ' + (size*.08).toFixed(1) + 'px ' + c;
    if(Math.random() < .22) el.style.transform = 'rotate(' + ((Math.random() - .5)*14).toFixed(1) + 'deg)';
    const life = 2.2 + Math.random()*3.6;
    el.style.animationDuration = life.toFixed(2) + 's';
    el.addEventListener('animationend', () => { el.remove(); n--; });
    fill.appendChild(el); n++;
  }

  function frame(now){
    if(!running) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(.1, (now - last)/1000); last = now;
    const ts = (now - t0)/1000;
    if(phase !== 'flood') return;
    const k = Math.min(1, ts/RAMP), rate = 3 + 120*k*k + (ts > RAMP ? 90*(ts - RAMP)/(BLACK_AT - RAMP) : 0);      // captions per second
    acc += rate*dt;
    while(acc >= 1){ acc--; if(n < MAXN) make(); }
    if(ts >= DARK_AT && !layer.classList.contains('dark')) layer.classList.add('dark');   // too many letters: the screen sinks into black
    if(ts >= BLACK_AT){
      phase = 'black'; layer.classList.add('hush');                                        // the screen is black; the letters melt away gently
      fill.style.transition = 'opacity 2.6s ease-in-out'; fill.style.opacity = '0';
      if(onBlack) onBlack();
      timers.push(setTimeout(() => { fill.textContent = ''; n = 0; }, 2800));
      timers.push(setTimeout(typeFinal, 3600));
    }
  }

  function typeFinal(){
    if(!layer || phase !== 'black') return;
    const el = document.createElement('div'); el.className = 'mtx-final'; layer.appendChild(el);
    let i = 0;
    (function tick(){
      if(phase !== 'black') return;
      el.textContent = FINAL.slice(0, ++i);
      if(i < FINAL.length) timers.push(setTimeout(tick, 95 + Math.random()*90));
    })();
  }

  window.MatrixText = {
    start(opts){
      if(running) return;
      onBlack = opts && opts.onBlack || null; phase = 'flood';
      if(!layer){ layer = document.createElement('div'); layer.className = 'mtx-layer'; layer.setAttribute('aria-hidden', 'true'); document.body.appendChild(layer); }
      layer.textContent = ''; fill = document.createElement('div'); fill.className = 'mtx-fill'; layer.appendChild(fill);
      layer.style.display = 'block'; void layer.offsetWidth; layer.classList.add('on');
      running = true; t0 = last = performance.now(); acc = 0;
      raf = requestAnimationFrame(frame);
    },
    stop(){
      running = false; cancelAnimationFrame(raf);
      timers.forEach(clearTimeout); timers = []; phase = 'flood';
      if(layer){ layer.classList.remove('on', 'dark', 'hush'); layer.style.display = 'none'; layer.textContent = ''; n = 0; }
    }
  };
})();
