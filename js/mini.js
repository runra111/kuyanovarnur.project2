/* Slide 5, "Record" card: the Blender brain, slowly turning (ASCII or plain 3D). */
(function(){
  const gl = document.getElementById('miniBrain'), ascii = document.getElementById('miniAscii');
  if(!gl || !ascii || !window.THREE || !THREE.GLTFLoader || !window.AsciiFX || !window.MODEL_DATA){ window.MiniBrain = { start(){}, stop(){} }; return; }
  const T = THREE;
  const renderer = new T.WebGLRenderer({ canvas:gl, antialias:true, alpha:true });
  renderer.setClearColor(0x000000, 0);
  const scene = new T.Scene(); scene.environment = window.makeEnv(renderer);
  const camera = new T.PerspectiveCamera(30, 1, .1, 50); camera.position.set(0, .5, 8); camera.lookAt(0, .1, 0);
  const stage = AsciiFX.stage({ gl, ascii, renderer, cellFor:w => Math.max(3.2, Math.min(5, w/34)), asciiOpts:{ mode:'color', saturate:1.9, gamma:.8, floorV:.22 } });
  scene.add(new T.AmbientLight(0xffffff, .5));
  const key = new T.DirectionalLight(0xffffff, 1.2); key.position.set(3, 4, 5); scene.add(key);
  const rim = new T.DirectionalLight(0x6dffb4, .9); rim.position.set(-5, 2, -3); scene.add(rim);
  const g = new T.Group(); scene.add(g);
  loadModel('brain').then(m => {
    m.traverse(o => {
      if(!o.isMesh) return; o.material.roughness = .5; o.material.emissive = new T.Color(0x2a1219);
      const c = o.geometry.attributes.color;
      if(c && !o.geometry.userData.lifted){ for(let i = 0; i < c.count; i++) c.setXYZ(i, Math.min(1, c.getX(i)*.85 + .22), Math.min(1, c.getY(i)*.85 + .2), Math.min(1, c.getZ(i)*.85 + .2)); c.needsUpdate = true; o.geometry.userData.lifted = true; }
    });
    m.scale.setScalar(.75); g.add(m);
  });
  let raf = 0, last = 0, t = 0, active = false;
  function loop(now){
    raf = requestAnimationFrame(loop);
    t += Math.min(.05, (now - last)/1000 || .016); last = now;
    g.rotation.y = t*.7; g.rotation.x = -.15; g.position.y = Math.sin(t*1.2)*.06;
    stage.render(scene, camera, t, { scan:true });
  }
  window.MiniBrain = {
    start(){ if(active) return; active = true; stage.resize(); stage.view.reveal(1800, 700); last = performance.now(); raf = requestAnimationFrame(loop); },
    stop(){ active = false; cancelAnimationFrame(raf); }
  };
})();
