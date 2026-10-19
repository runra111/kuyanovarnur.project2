/* Intro: a video-player page. Pressing Play floods the page from the top with green 1s and 0s; once it is covered, slide 1 starts
   and the digits drain away from the top, revealing the site. */
(function(){
  const $ = (s, r = document) => r.querySelector(s);
  const intro = $('#intro');
  if(!intro || !window.Deck){ if(window.Deck) Deck.enter(false); return; }

  // deep links (#2, #3 ...) and ?nointro skip the intro, so single slides can still be opened directly
  const hashN = parseInt(location.hash.slice(1), 10);
  if((hashN && hashN > 1) || /nointro/.test(location.search)){ intro.remove(); Deck.enter(false); return; }

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
    if(reduce){ Deck.enter(sound); intro.classList.add('is-gone'); setTimeout(() => intro.remove(), 1300); return; }

    const W = innerWidth, H = innerHeight, dpr = Math.min(devicePixelRatio || 1, 2);
    const CW = Math.round(Math.max(9, Math.min(14, W/140))), CH = Math.round(CW*1.55), cols = Math.ceil(W/CW), rows = Math.ceil(H/CH);
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
    const tm = $('.player__time'), dot = $('.player__track i');
    if(tm) tm.textContent = '0:00 / 8:00';
    setTimeout(() => { if(tm) tm.textContent = '0:01 / 8:00'; if(dot) dot.style.left = '1.4%'; }, 120);
    if(sound && window.Sfx){
      Sfx.enable(); Sfx.click(); Sfx.charge(PRESS + T_COVER);
      setTimeout(() => Sfx.glitch(0, T_COVER + .05), PRESS*1000);
      setTimeout(() => { Sfx.boom(); Sfx.reveal(REVEAL); }, (PRESS + T_COVER)*1000);
    }
    let entered = false;
    const GREENS = ['#eafff3', '#59ffa6', '#2dff8f', '#16c46f', '#0c7a45'];

    function frame(now){
      const t = (now - T0)/1000, tick = Math.floor(t*24);
      ctx.clearRect(0, 0, W, H);
      ctx.font = Math.round(CW*1.45) + 'px "Share Tech Mono", ui-monospace, Consolas, monospace'; ctx.textBaseline = 'top';
      if(!entered && t >= T_COVER){ entered = true; Deck.enter(sound); intro.remove(); }
      const R = t < T_COVER ? -1 : (t - T_COVER)/REVEAL*MAXD*1.12;          // radius of the cleared hole
      const buckets = [[], [], [], [], []];
      ctx.fillStyle = '#020c07'; ctx.beginPath();                            // dark backing so the page below is hidden while flooded
      for(let c = 0; c < cols; c++){
        const k = col[c], head = (t - k.d)*k.v;                              // row index of the flooding front
        if(head < 0) continue;
        const bot = Math.min(rows - 1, Math.floor(head));
        for(let r = 0; r <= bot; r++){
          const i = c*rows + r, dx = (c + .5)*CW - W/2, dy = (r + .5)*CH - H/2;
          const dd = Math.hypot(dx, dy) + hash(i, 5)*MAXD*.07 - R;           // > 0: still covered, < 0: already cleared
          if(t >= T_COVER && dd < 0) continue;
          ctx.rect(c*CW, r*CH, CW, CH);
          const dh = head - r;
          let g = 4;                                                          // settled: dim green
          if(dh < 1.2) g = 0;                                                 // the flooding front: near white
          else if(dh < 6) g = 1 + ((dh - 1.2)/2.4 | 0);                       // bright trail behind the front
          else if(hash(i, tick) < .08) g = 3;                                 // random sparkle
          if(t >= T_COVER && dd < MAXD*.1) g = Math.min(g, dd < MAXD*.03 ? 0 : 2);   // the edge of the hole glows
          buckets[g].push(c*CW, r*CH, GLYPHS[Math.floor(hash(i, tick)*GLYPHS.length)]);
        }
      }
      ctx.fill();
      for(let g = 0; g < 5; g++){
        ctx.fillStyle = GREENS[g]; const b = buckets[g];
        for(let k = 0; k < b.length; k += 3) ctx.fillText(b[k + 2], b[k], b[k + 1]);
      }
      if(t < T_END) requestAnimationFrame(frame); else cv.remove();
    }
    requestAnimationFrame(frame);
    setTimeout(() => { if(intro.isConnected) intro.remove(); if(cv.isConnected) cv.remove(); }, 9000);
  }

  playBtn.addEventListener('click', start);
  skipBtn.addEventListener('click', start);
  addEventListener('keydown', e => { if(!busy && intro.isConnected && (e.key === 'Enter' || e.key === ' ')){ e.preventDefault(); start(); } });
})();
