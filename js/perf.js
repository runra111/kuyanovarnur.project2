/* Quality levels, so the site stays smooth on slower laptops.
     0 = full   1 = lighter (bigger ASCII cells, fewer frames, no heavy overlays)   2 = lite (even lighter)
   The level is chosen automatically: weak machines start at 1, and if the frame rate stays low while the site runs it drops a level
   (and remembers it for next time). Force it with ?lite or ?full in the address, or press L to cycle the levels. */
(function(){
  const KEY = 'engram-perf';
  let level = 0;
  try{ const s = localStorage.getItem(KEY); if(s !== null) level = Math.max(0, Math.min(2, +s || 0)); }catch(e){}
  const cores = navigator.hardwareConcurrency || 8, mem = navigator.deviceMemory || 8;
  if(level === 0 && (cores <= 4 || mem <= 4)) level = 1;
  if(/[?&]lite\b/.test(location.search)) level = 2;
  if(/[?&]full\b/.test(location.search)) level = 0;
  const subs = [];
  const root = document.documentElement; root.dataset.perf = level;

  const Perf = {
    watch:false,                                      // the frame-rate watchdog runs only while the site is on screen
    get level(){ return level; },
    get cellScale(){ return [1, 1.25, 1.6][level]; }, // how much bigger the ASCII characters get
    get frameMs(){ return [33, 40, 50][level]; },     // minimum time between two ASCII frames
    get maxDpr(){ return [1.5, 1, 1][level]; },       // pixel ratio cap for the plain 3D views
    set(l, save){
      l = Math.max(0, Math.min(2, l)); if(l === level) return;
      level = l; root.dataset.perf = l;
      try{ if(save) localStorage.setItem(KEY, String(l)); }catch(e){}
      subs.forEach(f => f(l));
    },
    onChange(f){ subs.push(f); }
  };
  window.Perf = Perf;

  // watchdog: two seconds of slow frames, twice in a row -> one level lighter
  let last = performance.now(), acc = 0, n = 0, bad = 0;
  (function tick(now){
    requestAnimationFrame(tick);
    const dt = now - last; last = now;
    if(document.hidden || dt > 300 || !Perf.watch){ acc = 0; n = 0; return; }
    acc += dt; n++;
    if(acc >= 2000){
      bad = acc/n > 31 ? bad + 1 : 0; acc = 0; n = 0;
      if(bad >= 2 && level < 2){ Perf.set(level + 1, true); bad = 0; }
    }
  })(last);

  addEventListener('keydown', e => { if((e.key === 'l' || e.key === 'L') && !e.ctrlKey && !e.metaKey) Perf.set((level + 1) % 3, true); });
})();
