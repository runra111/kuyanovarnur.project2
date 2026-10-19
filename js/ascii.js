/* ASCII renderer for the 3D scenes.
   A WebGL render is shrunk to one pixel per character cell and every cell is drawn as a glyph chosen by its brightness.
   Extras: decode/scramble reveal, flicker, scan band, pointer ripple, falling-code rain in empty cells.
   AsciiFX.on switches every stage between ASCII and plain 3D (key A / HUD button). */
(function(){
  const RAMP = " .'`,:;-~=+*!?oO#%&@";
  const NR = RAMP.length - 1;
  const NOISE = "01#$%&*+<>?/\\|{}[]=~^:;ABCDEFXZ";

  function hash(i, s){
    let h = Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(s + 7, 0x85ebca6b);
    h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
    return (h >>> 0) / 4294967295;
  }
  const GREEN = Array.from({ length:16 }, (_, k) => {
    const t = k/15, a = t < .7 ? t/.7 : 1, w = t < .7 ? 0 : (t - .7)/.3;
    return 'rgb(' + Math.round(10 + a*35 + w*190) + ',' + Math.round(60 + a*195) + ',' + Math.min(255, Math.round(35 + a*108 + w*102)) + ')';
  });

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
      const dpr = Math.min(window.devicePixelRatio || 1, 2); this.dpr = dpr;
      this.cv.width = Math.round(this.W*dpr); this.cv.height = Math.round(this.H*dpr);
      this.fs = this.o.cell*1.7;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.ctx.font = this.fs + 'px ' + this.o.font;
      this.cw = Math.max(2, this.ctx.measureText('M').width); this.ch = this.fs*1.05;
      this.cols = Math.max(8, Math.floor(this.W/this.cw)); this.rows = Math.max(6, Math.floor(this.H/this.ch));
      this.sample.width = this.cols; this.sample.height = this.rows;
      this.ox = (this.W - this.cols*this.cw)/2; this.oy = (this.H - this.rows*this.ch)/2;
    }
    reveal(ms, delay){
      cancelAnimationFrame(this._anim); this.rv = 0;
      const t0 = performance.now() + (delay || 0);
      const step = now => { this.rv = Math.min(1, Math.max(0, (now - t0)/ms)); if(this.rv < 1) this._anim = requestAnimationFrame(step); };
      this._anim = requestAnimationFrame(step);
    }
    draw(t, f){
      f = f || {};
      const { cols, rows, cw, ch, ctx, o } = this, n = cols*rows;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, this.W, this.H);
      if(this.rv <= 0 && !o.rain) return;
      const d = this.sctx.getImageData(0, 0, cols, rows).data;
      const tick = Math.floor(t*10), rv = this.rv;
      const V = this._V && this._V.length === n ? this._V : (this._V = new Float32Array(n));
      const P = this._P && this._P.length === n ? this._P : (this._P = new Uint8Array(n));
      let lo = 1, hi = 0;
      for(let i = 0; i < n; i++){
        if(d[i*4 + 3]/255 < o.minAlpha){ P[i] = 0; continue; }
        P[i] = 1;
        const L = (.299*d[i*4] + .587*d[i*4 + 1] + .114*d[i*4 + 2])/255;
        V[i] = L; if(L < lo) lo = L; if(L > hi) hi = L;
      }
      for(let i = 0; i < n; i++){
        if(!P[i]) continue;
        let v = V[i];
        if(o.stretch) v = (v - lo)/(hi - lo + 1e-4);
        V[i] = o.floorV + (1 - o.floorV)*Math.pow(Math.min(1, Math.max(0, v)), o.gamma);
      }
      const buckets = new Map();
      const push = (key, col, x, y, chr) => { let b = buckets.get(key); if(!b){ b = { col, items:[] }; buckets.set(key, b); } b.items.push(x, y, chr); };
      const px = f.pointer ? f.pointer.x - this.ox : -1e4, py = f.pointer ? f.pointer.y - this.oy : -1e4;
      const scanRow = f.scan ? ((t*.22) % 1.3 - .15)*rows : -99;
      for(let j = 0; j < rows; j++){
        for(let c = 0; c < cols; c++){
          const i = j*cols + c, x = c*cw + this.ox, y = j*ch + this.oy + this.fs*.82;
          if(!P[i]){
            if(o.rain && rv > 0){
              const hs = hash(c, 3), sp = .6 + hs*1.3, trail = 6 + hs*12, cyc = rows*1.8;
              const head = ((t*sp*7 + hs*cyc) % cyc) - rows*.15, dist = head - j;
              if(dist >= 0 && dist < trail){
                const k = Math.max(0, Math.min(15, Math.round((1 - dist/trail)*.5*Math.min(1, rv*2)*15)));
                push('r' + k, GREEN[k], x, y, NOISE[Math.floor(hash(i, tick)*NOISE.length)]);
              }
            }
            continue;
          }
          let v = V[i];
          if(rv < 1){
            const p = rv*1.45 - hash(i, 999)*.8 - (j/rows)*.15;
            if(p <= 0) continue;
            if(p < .22){ push('n', GREEN[15], x, y, NOISE[Math.floor(hash(i, tick)*NOISE.length)]); continue; }
          }
          if(f.pointer){
            const dx = x - px - cw/2, dy = y - py - ch/2, dd = Math.sqrt(dx*dx + dy*dy);
            if(dd < 90) v = Math.min(1, v + .35*(1 - dd/90));
          }
          if(Math.abs(j - scanRow) < 1.6) v = Math.min(1, v + .4);
          let idx = Math.round(v*NR); const h = hash(i, tick);
          if(h < .05) idx += h < .025 ? 1 : -1;
          idx = Math.max(0, Math.min(NR, idx));
          const chr = RAMP[idx]; if(chr === ' ') continue;
          if(o.mode === 'color'){
            const m0 = (d[i*4] + d[i*4 + 1] + d[i*4 + 2])/3, sat = o.saturate;
            const r = Math.max(0, m0 + (d[i*4] - m0)*sat), g = Math.max(0, m0 + (d[i*4 + 1] - m0)*sat), b = Math.max(0, m0 + (d[i*4 + 2] - m0)*sat);
            const mx = Math.max(r, g, b, 1), k = (40 + 215*v)/mx;
            const R = Math.min(255, r*k), G = Math.min(255, g*k), B = Math.min(255, b*k);
            const key = ((R >> 5) << 6) | ((G >> 5) << 3) | (B >> 5);
            push('c' + key, 'rgb(' + ((key >> 6)*32 + 16) + ',' + (((key >> 3) & 7)*32 + 16) + ',' + ((key & 7)*32 + 16) + ')', x, y, chr);
          } else {
            const k = Math.max(0, Math.min(15, Math.round(v*15)));
            push('g' + k, GREEN[k], x, y, chr);
          }
        }
      }
      ctx.font = this.fs + 'px ' + o.font; ctx.textBaseline = 'alphabetic';
      buckets.forEach(b => { ctx.fillStyle = b.col; const it = b.items; for(let k = 0; k < it.length; k += 3) ctx.fillText(it[k + 2], it[k], it[k + 1]); });
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
      let W = 0, H = 0, mode = null;
      const useAscii = () => !opt.plain && on;         // opt.plain: always show the plain 3D render (e.g. the headset)
      const st = {
        view,
        resize(){ W = 0; },                          // force a re-layout on the next frame
        render(scene, camera, t, f){
          const w = ascii.clientWidth, h = ascii.clientHeight;
          if(!w || !h) return;
          if(w !== W || h !== H || mode !== useAscii()){
            W = w; H = h; mode = useAscii();
            if(mode){
              view.o.cell = opt.cellFor ? opt.cellFor(w) : Math.max(4.6, Math.min(8, w/190));
              view.resize();
              renderer.setPixelRatio(1); renderer.setSize(view.cols*3, view.rows*3, false);
            } else {
              renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setSize(w, h, false);
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
