/* ASCII renderer for the 3D scenes.
   A WebGL render is shrunk to one pixel per character cell and every cell is drawn as a glyph chosen by its brightness.
   Extras: decode/scramble reveal, flicker, scan band, pointer ripple, falling-code rain in empty cells.
   AsciiFX.on switches every stage between ASCII and plain 3D (key A / HUD button).
   Speed: instead of one fillText per cell, every row is drawn as a few whole strings (one per colour, with spaces between the
   cells of that colour), so a frame needs a couple of thousand text calls instead of tens of thousands. Per-cell random numbers
   are computed once per tick, and the rain only visits the cells it actually draws. */
(function(){
  const RAMP = " .'`,:;-~=+*!?oO#%&@";
  const NR = RAMP.length - 1;
  const NOISE = "01#$%&*+<>?/\\|{}[]=~^:;ABCDEFXZ";
  const GLYPHS = Array.from(new Set((RAMP + NOISE).split('')));          // every character that can appear
  const GI = {}; GLYPHS.forEach((g, i) => GI[g] = i);
  const RAMP_I = Array.from(RAMP).map(c => GI[c]), NOISE_I = Array.from(NOISE).map(c => GI[c]);
  const NG = GLYPHS.length, SPACES = ' '.repeat(1024);

  function hash(i, s){
    let h = Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(s + 7, 0x85ebca6b);
    h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
    return (h >>> 0) / 4294967295;
  }
  const GREEN = Array.from({ length:16 }, (_, k) => {
    const t = k/15, a = t < .7 ? t/.7 : 1, w = t < .7 ? 0 : (t - .7)/.3;
    return 'rgb(' + Math.round(10 + a*35 + w*190) + ',' + Math.round(60 + a*195) + ',' + Math.min(255, Math.round(35 + a*108 + w*102)) + ')';
  });
  // colour table: 0..511 quantised rgb (colour mode), 512..527 green ramp (grey mode), 528..543 rain, 544 reveal flash
  const PAL = new Array(545);
  for(let key = 0; key < 512; key++) PAL[key] = 'rgb(' + ((key >> 6)*32 + 16) + ',' + (((key >> 3) & 7)*32 + 16) + ',' + ((key & 7)*32 + 16) + ')';
  for(let k = 0; k < 16; k++){ PAL[512 + k] = GREEN[k]; PAL[528 + k] = GREEN[k]; }
  PAL[544] = GREEN[15];

  class AsciiView {
    constructor(canvas, opt){
      this.cv = canvas; this.ctx = canvas.getContext('2d');
      this.o = Object.assign({ cell:6, mode:'color', saturate:1.7, gamma:.85, floorV:.14, stretch:false, rain:false, minAlpha:.15,
        font:'"Share Tech Mono", ui-monospace, Consolas, monospace' }, opt);
      this.sample = document.createElement('canvas');
      this.sctx = this.sample.getContext('2d', { willReadFrequently:true });
      this.rv = 1; this._anim = 0;
      this.resize();
    }
    resize(){
      const r = this.cv.getBoundingClientRect();
      this.W = Math.max(1, r.width); this.H = Math.max(1, r.height);
      const dpr = Math.min(window.devicePixelRatio || 1, window.Perf ? Perf.maxDpr : 1.5); this.dpr = dpr;
      this.cv.width = Math.round(this.W*dpr); this.cv.height = Math.round(this.H*dpr);
      this.fs = this.o.cell*1.7;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.ctx.font = this.fs + 'px ' + this.o.font;
      this.cw = Math.max(2, this.ctx.measureText('M').width); this.ch = this.fs*1.05;
      this.cols = Math.max(8, Math.floor(this.W/this.cw)); this.rows = Math.max(6, Math.floor(this.H/this.ch));
      this.sample.width = this.cols; this.sample.height = this.rows;
      this.ox = (this.W - this.cols*this.cw)/2; this.oy = (this.H - this.rows*this.ch)/2;
      const n = this.cols*this.rows;
      this.V = new Float32Array(n); this.P = new Uint8Array(n);
      this.Hn = new Float32Array(n); this._tick = -1;                  // random number per cell, renewed every tick
      this.Rv = new Float32Array(n); for(let i = 0; i < n; i++) this.Rv[i] = hash(i, 999);   // reveal order, fixed
      this.rainSp = new Float32Array(this.cols); this.rainTrail = new Float32Array(this.cols); this.rainOff = new Float32Array(this.cols);
      for(let c = 0; c < this.cols; c++){ const hs = hash(c, 3); this.rainSp[c] = .6 + hs*1.3; this.rainTrail[c] = 6 + hs*12; this.rainOff[c] = hs; }
      this.KEY = new Int16Array(n); this.GLY = new Uint8Array(n);       // what to draw in each cell (key -1 = nothing)
      this.rs = new Array(545).fill(''); this.rstart = new Int16Array(545); this.rend = new Int16Array(545);   // per-row string builders
    }
    reveal(ms, delay){
      cancelAnimationFrame(this._anim); this.rv = 0;
      const t0 = performance.now() + (delay || 0);
      const step = now => { this.rv = Math.min(1, Math.max(0, (now - t0)/ms)); if(this.rv < 1) this._anim = requestAnimationFrame(step); };
      this._anim = requestAnimationFrame(step);
    }
    draw(t, f){
      f = f || {};
      const { cols, rows, cw, ch, ctx, o, V, P, Hn, Rv, KEY, GLY } = this, n = cols*rows;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, this.W, this.H);
      if(this.rv <= 0 && !o.rain) return;
      const d = this.sctx.getImageData(0, 0, cols, rows).data;
      const tick = Math.floor(t*10), rv = this.rv;
      if(tick !== this._tick){ this._tick = tick; for(let i = 0; i < n; i++) Hn[i] = hash(i, tick); }
      let lo = 1, hi = 0;
      const minA = o.minAlpha*255;
      for(let i = 0; i < n; i++){
        const a = d[i*4 + 3];
        if(a < minA){ P[i] = 0; continue; }
        P[i] = 1;
        const L = (.299*d[i*4] + .587*d[i*4 + 1] + .114*d[i*4 + 2])/255;
        V[i] = L; if(L < lo) lo = L; if(L > hi) hi = L;
      }
      KEY.fill(-1);
      const fl = o.floorV, gm = o.gamma, span = hi - lo + 1e-4, stretch = o.stretch;
      const ox = this.ox, oy = this.oy, colorMode = o.mode === 'color', sat = o.saturate;
      const px = f.pointer ? f.pointer.x - ox : -1e4, py = f.pointer ? f.pointer.y - oy : -1e4;
      const scanRow = f.scan ? ((t*.22) % 1.3 - .15)*rows : -99;
      const NRn = NOISE_I.length, fsb = this.fs*.82;

      // 1) decide what every cell shows
      for(let j = 0; j < rows; j++){
        for(let c = 0; c < cols; c++){
          const i = j*cols + c;
          if(!P[i]) continue;
          if(rv < 1){
            const p = rv*1.45 - Rv[i]*.8 - (j/rows)*.15;
            if(p <= 0) continue;
            if(p < .22){ KEY[i] = 544; GLY[i] = NOISE_I[(Hn[i]*NRn) | 0]; continue; }
          }
          let v = V[i];
          if(stretch) v = (v - lo)/span;
          v = fl + (1 - fl)*Math.pow(v < 0 ? 0 : v > 1 ? 1 : v, gm);
          if(f.pointer){
            const dx = c*cw + ox - px - cw/2, dy = j*ch + oy + fsb - py - ch/2;
            if(dx < 90 && dx > -90 && dy < 90 && dy > -90){ const dd = Math.sqrt(dx*dx + dy*dy); if(dd < 90) v = Math.min(1, v + .35*(1 - dd/90)); }
          }
          if(j - scanRow < 1.6 && scanRow - j < 1.6) v = Math.min(1, v + .4);
          let idx = Math.round(v*NR); const h = Hn[i];
          if(h < .05) idx += h < .025 ? 1 : -1;
          idx = idx < 0 ? 0 : idx > NR ? NR : idx;
          if(idx === 0) continue;                                       // a space
          let key;
          if(colorMode){
            const i4 = i*4, r0 = d[i4], g0 = d[i4 + 1], b0 = d[i4 + 2], m0 = (r0 + g0 + b0)/3;
            const r = Math.max(0, m0 + (r0 - m0)*sat), g = Math.max(0, m0 + (g0 - m0)*sat), b = Math.max(0, m0 + (b0 - m0)*sat);
            const k = (40 + 215*v)/Math.max(r, g, b, 1);
            key = ((Math.min(255, r*k) >> 5) << 6) | ((Math.min(255, g*k) >> 5) << 3) | (Math.min(255, b*k) >> 5);
          } else key = 512 + Math.max(0, Math.min(15, Math.round(v*15)));
          KEY[i] = key; GLY[i] = RAMP_I[idx];
        }
      }
      // falling code in the empty cells: only the cells inside each column's trail are visited
      if(o.rain && rv > 0){
        const cyc = rows*1.8, kk = Math.min(1, rv*2)*.5*15;
        for(let c = 0; c < cols; c++){
          const sp = this.rainSp[c], trail = this.rainTrail[c];
          const head = ((t*sp*7 + this.rainOff[c]*cyc) % cyc) - rows*.15;
          const j0 = Math.max(0, Math.ceil(head - trail + .0001)), j1 = Math.min(rows - 1, Math.floor(head));
          for(let j = j0; j <= j1; j++){
            const i = j*cols + c; if(P[i]) continue;
            const dist = head - j; if(dist < 0 || dist >= trail) continue;
            KEY[i] = 528 + Math.max(0, Math.min(15, Math.round((1 - dist/trail)*kk))); GLY[i] = NOISE_I[(Hn[i]*NRn) | 0];
          }
        }
      }

      // 2) draw every row as a few strings: one per colour, spaces fill the gaps between that colour's cells
      ctx.font = this.fs + 'px ' + o.font; ctx.textBaseline = 'alphabetic';
      const rs = this.rs, rstart = this.rstart, rend = this.rend, usedKeys = [];
      for(let j = 0; j < rows; j++){
        const base = j*cols;
        for(let c = 0; c < cols; c++){
          const key = KEY[base + c]; if(key < 0) continue;
          const g = GLYPHS[GLY[base + c]];
          if(rs[key] === ''){ rs[key] = g; rstart[key] = c; rend[key] = c + 1; usedKeys.push(key); }
          else { const gap = c - rend[key]; rs[key] += (gap > 0 ? SPACES.substr(0, gap) : '') + g; rend[key] = c + 1; }
        }
        if(usedKeys.length){
          const y = j*ch + oy + fsb;
          for(let u = 0; u < usedKeys.length; u++){ const key = usedKeys[u]; ctx.fillStyle = PAL[key]; ctx.fillText(rs[key], rstart[key]*cw + ox, y); rs[key] = ''; }
          usedKeys.length = 0;
        }
      }
    }
  }

  /* global ASCII on/off */
  let on = true;
  try{ if(localStorage.getItem('engram-ascii') === '0') on = false; }catch(e){}
  const listeners = [];
  const AsciiFX = {
    get on(){ return on; },
    set(v){ on = !!v; try{ localStorage.setItem('engram-ascii', on ? '1' : '0'); }catch(e){} listeners.forEach(f => f(on)); },
    toggle(){ AsciiFX.set(!on); return on; },
    onChange(f){ listeners.push(f); },

    /* A stage = a WebGL canvas + an ASCII canvas on top of it. render() draws either the 3D view or its ASCII version. */
    stage(opt){
      const { gl, ascii, renderer } = opt;
      const view = new AsciiView(ascii, opt.asciiOpts || {});
      let W = 0, H = 0, mode = null, lastMs = -1e9;
      const useAscii = () => !opt.plain && on;         // opt.plain: always show the plain 3D render (e.g. the headset)
      const P = window.Perf;
      if(P) P.onChange(() => { W = 0; });               // a new quality level -> lay everything out again
      const st = {
        view,
        resize(){ W = 0; },                          // force a re-layout on the next frame
        render(scene, camera, t, f){
          const w = ascii.clientWidth, h = ascii.clientHeight;
          if(!w || !h) return;
          const isAscii = useAscii();
          if(isAscii && W && w === W && h === H && mode === isAscii){            // ASCII frames are limited in rate (the draw is the costly part)
            const now = performance.now(), gap = P ? P.frameMs : 33;
            if(now - lastMs < gap) return; lastMs = now;
          }
          if(w !== W || h !== H || mode !== isAscii){
            W = w; H = h; mode = isAscii;
            if(mode){
              view.o.cell = (opt.cellFor ? opt.cellFor(w) : Math.max(4.6, Math.min(8, w/190)))*(P ? P.cellScale : 1);
              view.resize();
              renderer.setPixelRatio(1); renderer.setSize(view.cols*3, view.rows*3, false);
            } else {
              renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, P ? P.maxDpr : 2)); renderer.setSize(w, h, false);
            }
            camera.aspect = w/h; if(opt.fovFor) camera.fov = opt.fovFor(w/h); camera.updateProjectionMatrix();
            gl.style.visibility = mode ? 'hidden' : 'visible'; ascii.style.visibility = mode ? 'visible' : 'hidden';
          }
          renderer.render(scene, camera);
          if(mode){
            view.sctx.clearRect(0, 0, view.cols, view.rows);
            view.sctx.drawImage(gl, 0, 0, view.cols, view.rows);
            view.draw(t, f);
          }
        }
      };
      return st;
    }
  };

  window.AsciiView = AsciiView;
  window.AsciiFX = AsciiFX;
})();
