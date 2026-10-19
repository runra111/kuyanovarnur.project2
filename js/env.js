/* Shared helpers for the Blender-made models: a soft studio environment for reflections and a loader that reads the
   models embedded in js/models.js (so the site also works when opened from disk). */
(function(){
  if(!window.THREE) return;
  const T = THREE;

  function envTexture(){
    const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, '#1b3a34'); g.addColorStop(.5, '#0b1c19'); g.addColorStop(1, '#030a08');
    x.fillStyle = g; x.fillRect(0, 0, 1024, 512);
    const panel = (cx, cy, w, h, col, a) => {
      const r = x.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h));
      r.addColorStop(0, 'rgba(' + col + ',' + a + ')'); r.addColorStop(1, 'rgba(' + col + ',0)');
      x.fillStyle = r; x.fillRect(cx - w*2, cy - h*2, w*4, h*4);
    };
    panel(256, 120, 150, 70, '255,255,255', 1);
    panel(768, 150, 130, 60, '170,255,210', .8);
    panel(520, 60, 200, 40, '255,255,255', .6);
    panel(900, 300, 120, 60, '120,190,255', .6);
    panel(100, 300, 120, 60, '255,255,255', .35);
    const tex = new T.CanvasTexture(c);
    tex.mapping = T.EquirectangularReflectionMapping;
    return tex;
  }
  window.makeEnv = function(renderer){
    const pm = new T.PMREMGenerator(renderer);
    const tex = envTexture(); const rt = pm.fromEquirectangular(tex);
    tex.dispose(); pm.dispose();
    return rt.texture;
  };

  const cache = {};
  /* name: 'brain' | 'headset' | 'hand-left' | 'hand-right' -> Promise<THREE.Group> (a fresh clone each call) */
  window.loadModel = function(name){
    if(!cache[name]) cache[name] = new Promise((res, rej) => {
      const b64 = window.MODEL_DATA && window.MODEL_DATA[name];
      if(!b64){ rej(new Error('model not found: ' + name)); return; }
      const bin = atob(b64), buf = new Uint8Array(bin.length);
      for(let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      new T.GLTFLoader().parse(buf.buffer, '', g => res(g.scene), rej);
    });
    return cache[name].then(s => s.clone(true));
  };
})();
