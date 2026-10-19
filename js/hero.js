/* Hero: three models made in Blender (a folded brain and two mannequin hands) floating in the dark.
   The 3D scene is drawn as animated ASCII (press A / the HUD button to see the plain 3D version). */
(function(){
  const gl = document.getElementById('heroGL'), ascii = document.getElementById('heroCanvas');
  if(!gl || !ascii || !window.THREE || !THREE.GLTFLoader || !window.AsciiFX || !window.MODEL_DATA){ window.Hero = { start(){}, stop(){}, intro(){}, resize(){} }; return; }
  const T = THREE;

  const renderer = new T.WebGLRenderer({ canvas:gl, antialias:true, alpha:true });
  renderer.setClearColor(0x000000, 0);
  const scene = new T.Scene();
  scene.environment = window.makeEnv(renderer);
  const camera = new T.PerspectiveCamera(40, 1, .1, 200);
  const stage = AsciiFX.stage({ gl, ascii, renderer, fovFor:a => a < 1 ? 62 : 40, cellFor:w => Math.max(3.8, Math.min(7, w/230)),
    asciiOpts:{ mode:'color', saturate:1.9, gamma:.8, floorV:.16, rain:true } });

  /* lights */
  scene.add(new T.AmbientLight(0xffffff, .5));
  const key = new T.DirectionalLight(0xffffff, 1.25); key.position.set(3, 4, 5); scene.add(key);
  const rimG = new T.DirectionalLight(0x6dffb4, .9); rimG.position.set(-5, 2, -3); scene.add(rimG);
  const rimB = new T.DirectionalLight(0x6db8ff, .7); rimB.position.set(5, 0, -3); scene.add(rimB);

  /* ---- models (made in Blender) ---- */
  const brain = new T.Group(); scene.add(brain);
  const BRAIN_Y = .45;
  // Brain: your supplied model, geometry untouched. Only the material changes with the view mode:
  //  - plain 3D: translucent blue hologram (fresnel glow + the model's texture as veins + a fine mesh), like the reference picture
  //  - ASCII:    opaque, textured and brightened, so the characters follow the real folds
  const brainMeshes = [], brainWires = [];
  loadModel('brain').then(m => {
    m.traverse(o => {
      if(!o.isMesh) return;
      const orig = o.material;
      const solid = orig.clone();
      solid.transparent = false; solid.opacity = 1; solid.depthWrite = true;
      if(solid.map){ solid.emissiveMap = solid.map; solid.emissive = new T.Color(0xffffff); solid.emissiveIntensity = .75; }
      solid.roughness = .55; solid.envMapIntensity = .8;
      const holo = new T.ShaderMaterial({
        transparent:true, depthWrite:false, side:T.DoubleSide, blending:T.AdditiveBlending,
        uniforms:{ map:{ value:orig.map || null }, hasMap:{ value:orig.map ? 1 : 0 }, uTime:{ value:0 } },
        vertexShader:'varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 mv = modelViewMatrix*vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
        fragmentShader:'uniform sampler2D map; uniform float hasMap; uniform float uTime; varying vec2 vUv; varying vec3 vN; varying vec3 vV;' +
          'void main(){ float lum = hasMap > .5 ? dot(texture2D(map, vUv).rgb, vec3(.33)) : .3;' +
          ' float fres = pow(1. - abs(dot(normalize(vN), normalize(vV))), 1.5);' +
          ' vec3 col = mix(vec3(.10,.42,.95), vec3(.65,.92,1.), clamp(lum*2.6, 0., 1.));' +
          ' float a = .16 + fres*.55 + lum*.35;' +
          ' gl_FragColor = vec4(col*(.55 + fres*.9), a); }'
      });
      o.userData.solid = solid; o.userData.holo = holo; o.material = holo; brainMeshes.push(o);
      const wire = new T.LineSegments(new T.WireframeGeometry(o.geometry), new T.LineBasicMaterial({ color:0x9fd8ff, transparent:true, opacity:.28, blending:T.AdditiveBlending, depthWrite:false }));
      o.add(wire); brainWires.push(wire);
    });
    m.updateMatrixWorld(true);
    const box = new T.Box3().setFromObject(m), size = new T.Vector3(), ctr = new T.Vector3();
    box.getSize(size); box.getCenter(ctr);
    const k = 3.1/Math.max(size.x, size.y, size.z);
    m.position.sub(ctr); const wrap = new T.Group(); wrap.add(m); wrap.scale.setScalar(k);
    brain.add(wrap);
  });
  // Hands: your supplied hand model (smoothed, mirrored for the second one). Fingers point toward the viewer, palms face the brain.
  const HAND = { x:2.6, y:-.5, pitch:1.1, turn:1.3, scale:1.1 };
  const hands = {}, handMeshes = [];
  const handPearl = new T.MeshStandardMaterial({ color:0xeaf6f0, roughness:.4, metalness:.05, envMapIntensity:1.0 });
  // plain-3D look: white contour lines on a dark body, like the reference hologram
  const handHolo = new T.ShaderMaterial({
    side:T.DoubleSide, uniforms:{ uTime:{ value:0 } },
    vertexShader:'varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vP = position; vec4 mv = modelViewMatrix*vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
    fragmentShader:'uniform float uTime; varying vec3 vN; varying vec3 vV; varying vec3 vP;' +
      'void main(){ float f = (vP.y + vP.z*.6)*9.; float d = min(fract(f), 1.-fract(f)); float line = 1.-smoothstep(.05,.2,d);' +
      ' float rim = pow(1.-abs(dot(normalize(vN), normalize(vV))), 2.);' +
      ' vec3 base = vec3(.01,.06,.045) + vec3(0.,.3,.16)*rim; vec3 lc = vec3(.9,1.,.95)*(.6+.7*rim) + vec3(.1,.9,.5)*rim*.5;' +
      ' gl_FragColor = vec4(mix(base, lc, line), 1.); }'
  });
  [['hand-thumb-left', -1], ['hand-thumb-right', 1]].forEach(([model, s]) => {
    const holder = new T.Group(); scene.add(holder); hands[s < 0 ? 'left' : 'right'] = holder;
    holder.scale.setScalar(HAND.scale); holder.position.set(s*HAND.x, HAND.y, .2);
    holder.rotation.order = 'ZXY'; holder.rotation.set(HAND.pitch, 0, s*HAND.turn);
    loadModel(model).then(m => { m.traverse(o => { if(o.isMesh){ o.material = handPearl; handMeshes.push(o); } }); holder.add(m); });
  });
  /* ---- loop ---- */
  const pointer = { x:0, y:0, sx:0, sy:0, px:null };
  window.addEventListener('pointermove', e => {
    pointer.x = e.clientX/innerWidth*2 - 1; pointer.y = e.clientY/innerHeight*2 - 1;
    const r = ascii.getBoundingClientRect(); pointer.px = { x:e.clientX - r.left, y:e.clientY - r.top };
  });
  let running = false, raf = 0, last = 0, time = 0, introT = 1;

  /* drag the brain to turn it (it keeps its own slow spin when you let go) */
  const AUTO = .6, spin = { ang:0, pit:0, v:AUTO, drag:false, lx:0, ly:0, lt:0 };
  [gl, ascii].forEach(cv => {
    cv.style.cursor = 'grab'; cv.style.touchAction = 'pan-y';
    cv.addEventListener('pointerdown', e => {
      spin.drag = true; spin.lx = e.clientX; spin.ly = e.clientY; spin.lt = performance.now(); spin.v = 0;
      try{ cv.setPointerCapture(e.pointerId); }catch(err){} cv.style.cursor = 'grabbing';
    });
    cv.addEventListener('pointermove', e => {
      if(!spin.drag) return;
      const now = performance.now(), dtm = Math.max(8, now - spin.lt)/1000, dx = (e.clientX - spin.lx), dy = (e.clientY - spin.ly);
      spin.ang += dx*.012; spin.pit = Math.max(-.9, Math.min(.9, spin.pit + dy*.008));
      spin.v = Math.max(-9, Math.min(9, dx*.012/dtm)); spin.lx = e.clientX; spin.ly = e.clientY; spin.lt = now;
    });
    const end = () => { spin.drag = false; cv.style.cursor = 'grab'; };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  });

  function frame(now){
    raf = requestAnimationFrame(frame);
    const dt = Math.min(.05, (now - last)/1000 || .016); last = now; time += dt;
    if(introT < 1) introT = Math.min(1, introT + dt/3.2);
    const k = 1 - Math.pow(1 - introT, 3);
    pointer.sx += (pointer.x - pointer.sx)*.05; pointer.sy += (pointer.y - pointer.sy)*.05;

    camera.position.set(pointer.sx*1.1, .9 - pointer.sy*.5 + (1 - k)*1.5, 7.6 + (1 - k)*9);
    camera.lookAt(0, 1.05, 0);
    brain.position.y = BRAIN_Y + Math.sin(time*1.1)*.07;
    if(!spin.drag){ spin.ang += spin.v*dt; spin.v += (AUTO - spin.v)*Math.min(1, dt*1.6); spin.pit += (0 - spin.pit)*Math.min(1, dt*.9); }
    brain.rotation.y = spin.ang + (1 - k)*1.8;                                 // full 360 degree turn, or whatever you dragged
    brain.rotation.x = spin.pit;
    hands.left.position.y = hands.right.position.y = HAND.y + Math.sin(time*1.1 + 1)*.05;
    handMeshes.forEach(o => { o.material = AsciiFX.on ? handPearl : handHolo; });
    brainMeshes.forEach(o => { o.material = AsciiFX.on ? o.userData.solid : o.userData.holo; });
    brainWires.forEach(w => { w.visible = !AsciiFX.on; });
    handHolo.uniforms.uTime.value = time;
    stage.render(scene, camera, time, { pointer:pointer.px, scan:true });
  }

  window.Hero = {
    start(){ if(running) return; running = true; stage.resize(); last = performance.now(); raf = requestAnimationFrame(frame); },
    stop(){ running = false; cancelAnimationFrame(raf); },
    intro(){ introT = 0; stage.view.reveal(2800); },
    resize(){ stage.resize(); }
  };
})();
