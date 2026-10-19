/* Product slide: the ENGRAM headset (modelled in Blender) on a ghost head, always shown as plain 3D (no ASCII).
   Drag to orbit, camera presets, and hotspots that fly the camera to the sensors, the memory core and the cheek arms. */
(function(){
  const $ = (s, r = document) => r.querySelector(s);
  const gl = $('#headCanvas'), ascii = $('#headAscii'), hotsEl = $('#hots'), thumbsEl = $('#prodThumbs'), prod = $('#prod');
  const feats = Array.from(document.querySelectorAll('#featList li'));
  if(!gl || !ascii || !window.THREE || !THREE.GLTFLoader || !window.AsciiFX || !window.MODEL_DATA){ window.Headset = { start(){}, stop(){} }; return; }
  const T = THREE;

  const renderer = new T.WebGLRenderer({ canvas:gl, antialias:true, alpha:true });
  renderer.setClearColor(0x000000, 0);
  const scene = new T.Scene();
  scene.environment = window.makeEnv(renderer);
  const camera = new T.PerspectiveCamera(32, 1, .1, 60);
  const stage = AsciiFX.stage({ gl, ascii, renderer, plain:true, fovFor:a => a < 1 ? 52 : 32, cellFor:w => Math.max(3.8, Math.min(6.5, w/150)),
    asciiOpts:{ mode:'color', saturate:1.5, gamma:.7, floorV:.2, stretch:true } });

  scene.add(new T.AmbientLight(0xffffff, .5));
  const key = new T.DirectionalLight(0xffffff, 1.2); key.position.set(3, 5, 6); scene.add(key);
  const rimG = new T.DirectionalLight(0x6dffb4, 1.0); rimG.position.set(-6, 2, -4); scene.add(rimG);
  const rimB = new T.DirectionalLight(0x6db8ff, .8); rimB.position.set(6, 1, -4); scene.add(rimB);

  const rig = new T.Group(); scene.add(rig);
  // The headset: your supplied cyberpunk goggles model (head removed, materials re-done).
  loadModel('headset').then(m => {
    m.traverse(o => {
      if(!o.isMesh || !o.material) return;
      const mt = o.material; mt.envMapIntensity = 1.5;
      if(!mt.emissive || mt.emissive.getHex() === 0){ mt.color.multiplyScalar(2.4); mt.metalness = Math.min(mt.metalness, .7); mt.roughness = Math.max(.3, Math.min(mt.roughness, .5)); }
    });
    rig.add(m);
  });
  /* camera orbit state */
  const view = { yaw:.5, pitch:.3, dist:7.6, tx:0, ty:0, tz:0 };
  const goal = Object.assign({}, view);
  const PRESETS = { front:{ yaw:.5, pitch:.3, dist:7.6, tx:0, ty:0, tz:0 }, side:{ yaw:1.5, pitch:.2, dist:7.6, tx:0, ty:0, tz:0 }, top:{ yaw:.3, pitch:1.15, dist:7.6, tx:0, ty:0, tz:0 } };
  const buttons = Object.keys(PRESETS).map(k => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'vbtn'; b.textContent = k;
    b.addEventListener('click', () => { sel = -1; syncSel(); Object.assign(goal, PRESETS[k]); idle = 0; $('#prodView').textContent = 'VIEW: ' + k.toUpperCase(); buttons.forEach(x => x.classList.toggle('on', x === b)); if(window.Sfx) Sfx.blip(540); });
    thumbsEl.appendChild(b); return b;
  });

  /* hotspots (positions in glTF space: x right, y up, z toward the front of the head) */
  const SPOTS = [
    { name:'Neural reader', txt:'Visor sensors read attention and focus.', p:new T.Vector3(0, .06, 1.8), cam:{ yaw:.35, pitch:.15, dist:4.4, tx:0, ty:.05, tz:1.6 } },
    { name:'Memory core',   txt:'Records, stores and plays back a lesson.',  p:new T.Vector3(1.52, -.06, -.35), cam:{ yaw:1.35, pitch:.2, dist:4.4, tx:1.4, ty:-.05, tz:-.35 } },
    { name:'Side modules',  txt:'Sound and touch cues at the temples.',      p:new T.Vector3(-1.2, -.1, 1.14), cam:{ yaw:-1.2, pitch:.15, dist:4.2, tx:-1.1, ty:-.1, tz:1.1 } }
  ];
  let sel = -1, idle = 0;
  const hotEls = SPOTS.map((s, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'hot'; b.setAttribute('aria-label', s.name);
    b.innerHTML = (i + 1) + '<span class="hot__card' + (i === 1 ? ' hot__card--l' : '') + '"><b>' + s.name + '</b>' + s.txt + '</span>';
    b.addEventListener('click', e => { e.stopPropagation(); select(i); });
    hotsEl.appendChild(b); return b;
  });
  function syncSel(){
    hotEls.forEach((h, n) => h.classList.toggle('on', n === sel));
    feats.forEach((f, n) => f.classList.toggle('on', n === sel));
    prod.classList.toggle('has-sel', sel >= 0);
  }
  function select(i){
    sel = (i === sel) ? -1 : i; syncSel(); idle = 0;
    if(sel >= 0) Object.assign(goal, SPOTS[sel].cam); else Object.assign(goal, PRESETS.front, { yaw:view.yaw });
    buttons.forEach(x => x.classList.remove('on'));
    if(window.Sfx) Sfx.blip(660 + Math.max(0, sel)*140);
  }
  feats.forEach((f, i) => f.addEventListener('click', () => select(i)));

  /* drag to orbit (on the visible layer, which is the ASCII canvas in ASCII mode) */
  let dragging = false, lx = 0, ly = 0;
  const layer = ascii.parentElement;
  [gl, ascii].forEach(cv => {
    cv.style.touchAction = 'pan-y'; cv.style.cursor = 'grab';
    cv.addEventListener('pointerdown', e => { dragging = true; lx = e.clientX; ly = e.clientY; cv.setPointerCapture(e.pointerId); if(sel >= 0){ sel = -1; syncSel(); Object.assign(goal, PRESETS.front, { yaw:view.yaw }); } });
    cv.addEventListener('pointermove', e => {
      const r = cv.getBoundingClientRect(); ptr.x = e.clientX - r.left; ptr.y = e.clientY - r.top;
      if(!dragging) return;
      goal.yaw -= (e.clientX - lx)*.008; goal.pitch = Math.max(-.5, Math.min(1.3, goal.pitch + (e.clientY - ly)*.006));
      lx = e.clientX; ly = e.clientY; idle = 0; buttons.forEach(x => x.classList.remove('on'));
    });
    cv.addEventListener('pointerup', () => { dragging = false; }); cv.addEventListener('pointercancel', () => { dragging = false; });
  });
  const ptr = { x:null, y:null };

  let running = false, raf = 0, last = 0, time = 0;
  const v = new T.Vector3(), c3 = new T.Vector3();
  function frame(now){
    raf = requestAnimationFrame(frame);
    const dt = Math.min(.05, (now - last)/1000 || .016); last = now; time += dt; idle += dt;
    if(!dragging && sel < 0 && idle > 3) goal.yaw += dt*.12;
    const k = 1 - Math.pow(.0009, dt);
    for(const key of ['yaw', 'pitch', 'dist', 'tx', 'ty', 'tz']) view[key] += (goal[key] - view[key])*k;
    const cp = Math.cos(view.pitch);
    camera.position.set(view.tx + Math.sin(view.yaw)*cp*view.dist, view.ty + Math.sin(view.pitch)*view.dist, view.tz + Math.cos(view.yaw)*cp*view.dist);
    camera.lookAt(view.tx, view.ty, view.tz);
    const W = ascii.clientWidth, H = ascii.clientHeight;
    camera.setViewOffset(W, H, W/H > 1.3 ? -W*.2 : 0, 0, W, H);       // keep the model right of the text column
    rig.position.y = Math.sin(time*1.2)*.03;
    
    
    stage.render(scene, camera, time, { pointer:ptr.x == null ? null : ptr, scan:true });

    camera.getWorldDirection(c3);
    SPOTS.forEach((s, i) => {
      v.copy(s.p).add(rig.position).project(camera);
      const facing = -s.p.clone().setY(s.p.y - .2).normalize().dot(c3), el = hotEls[i];
      el.style.transform = 'translate(' + ((v.x*.5 + .5)*W) + 'px,' + ((-v.y*.5 + .5)*H) + 'px) translate(-50%,-50%)';
      el.style.opacity = facing > 0 ? 1 : 0; el.style.pointerEvents = facing > 0 ? 'auto' : 'none';
    });
  }

  window.Headset = {
    start(){ if(running) return; running = true; idle = 0; stage.resize(); stage.view.reveal(1800, 300); last = performance.now(); raf = requestAnimationFrame(frame); },
    stop(){ running = false; cancelAnimationFrame(raf); if(sel >= 0){ sel = -1; syncSel(); Object.assign(goal, PRESETS.front); } }
  };
  buttons[0].classList.add('on');
})();
