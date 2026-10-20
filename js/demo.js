/* Interactive "lesson editor": a first-person titration recorded by an expert, with toggleable layers. */
(function(){
  const canvas = document.getElementById('demoCanvas');
  if(!canvas){ window.Demo = { start(){}, stop(){} }; return; }
  const ctx = canvas.getContext('2d');
  const bpmCv = document.getElementById('bpmCanvas'), bctx = bpmCv.getContext('2d');
  const $ = id => document.getElementById(id);
  const L = { gaze:$('lGaze'), thought:$('lThought'), body:$('lBody') };
  const DUR = 24;               // seconds of lesson
  let t = 0, playing = true, speed = 1, running = false, raf = 0, last = 0, W = 0, H = 0, dpr = 1;
  const look = { x:0, y:0, sx:0, sy:0 };
  const bpmHist = [];

  const THOUGHTS = [
    { a:.03, b:.24, txt:'Rinse the burette with the acid first — water would dilute it.' },
    { a:.27, b:.55, txt:'Far from the endpoint I can add quickly. Swirl all the time.' },
    { a:.58, b:.79, txt:'Colour flashes and fades. Slow down — one drop at a time.' },
    { a:.80, b:.97, txt:'Faint pink that lasts 30 s: that’s the endpoint. Stop.' }
  ];
  // gaze targets (normalised in the scene): burette tip, flask, liquid, burette scale, flask
  const GAZE = [ [0,.05,'burette'], [.25,.5,'flask'], [.5,.35,'tip'], [.72,.5,'flask'], [.85,.55,'colour'], [1,.5,'flask'] ];

  const ease = x => x*x*(3 - 2*x);
  const lerp = (a, b, x) => a + (b - a)*x;

  function resize(){
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect(); W = r.width; H = r.height;
    canvas.width = Math.round(W*dpr); canvas.height = Math.round(H*dpr);
  }
  window.addEventListener('resize', () => { if(running) resize(); });

  function dropTimes(){
    // drops get slower toward the endpoint (t = 0.8)
    const arr = []; let x = .1;
    while(x < .84){
      arr.push(x);
      x += x < .55 ? .022 : (x < .72 ? .05 : .09);
    }
    return arr;
  }
  const DROPS = dropTimes();

  function mix(c1, c2, k){ return c1.map((v, i) => Math.round(lerp(v, c2[i], k))); }

  function draw(){
    const c = ctx; c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);

    // free-look parallax
    look.sx += (look.x - look.sx)*.08; look.sy += (look.y - look.sy)*.08;
    const ox = -look.sx*22, oy = -look.sy*14;

    // background room + bench (perspective)
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#001a10'); g.addColorStop(.62, '#00110a'); g.addColorStop(.62, '#021f14'); g.addColorStop(1, '#00110a');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.save(); c.translate(ox*.4, oy*.4);
    c.strokeStyle = 'rgba(45,255,143,.16)'; c.lineWidth = 1;
    const hy = H*.62;
    for(let i = -12; i <= 12; i++){ c.beginPath(); c.moveTo(W/2 + i*W*.02, hy); c.lineTo(W/2 + i*W*.2, H + 20); c.stroke(); }
    for(let i = 1; i < 9; i++){ const y = hy + Math.pow(i/9, 2)*(H - hy + 20); c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    // wall shelves
    c.strokeStyle = 'rgba(74,168,255,.22)';
    for(let i = 0; i < 3; i++){ c.strokeRect(W*.06 + i*W*.075, H*.2, W*.05, H*.22); }
    c.restore();

    const cx = W*.5 + ox, base = H*.82 + oy;
    const s = Math.min(W/760, H/460);
    const flaskX = cx, flaskY = base;
    const tipY = base - 250*s;
    const sw = Math.sin(t*DUR*2.4)*(t < .82 ? 7 : 1.5)*s;      // swirling motion

    // burette (hanging from the top)
    c.save(); c.translate(cx, 0);
    const bw = 22*s, level = lerp(.92, .22, ease(Math.min(1, t/.84)));
    const bTop = H*.02 + oy*.3, bBot = tipY - 20*s;
    c.fillStyle = 'rgba(74,168,255,.06)'; c.fillRect(-bw/2, bTop, bw, bBot - bTop);
    c.fillStyle = 'rgba(180,230,255,.38)'; const ly = lerp(bBot, bTop, level); c.fillRect(-bw/2 + 2, ly, bw - 4, bBot - ly);
    c.strokeStyle = 'rgba(190,235,255,.8)'; c.lineWidth = 2; c.strokeRect(-bw/2, bTop, bw, bBot - bTop);
    c.lineWidth = 1; for(let i = 0; i < 18; i++){ const y = lerp(bTop + 10, bBot - 6, i/17); c.beginPath(); c.moveTo(bw/2 - (i % 5 ? 6 : 12)*s, y); c.lineTo(bw/2, y); c.stroke(); }
    // stopcock + tip
    c.fillStyle = '#9fe8ff'; c.fillRect(-bw*.9, bBot, bw*1.8, 6*s);
    c.fillStyle = 'rgba(190,235,255,.85)'; c.beginPath(); c.moveTo(-5*s, bBot + 6*s); c.lineTo(5*s, bBot + 6*s); c.lineTo(1.5*s, tipY); c.lineTo(-1.5*s, tipY); c.closePath(); c.fill();
    c.restore();

    // flask (Erlenmeyer) with liquid colour change
    const endK = ease(Math.max(0, Math.min(1, (t - .78)/.07)));
    const flash = (t > .55 && t < .8) ? (Math.max(0, Math.sin((t*DUR)*3.1))*.35)*Math.min(1, (t - .55)/.1) : 0;
    const col = mix([120, 220, 255], [255, 80, 180], Math.min(1, endK + flash));
    const fw = 120*s, fh = 140*s, neckW = 34*s;
    c.save(); c.translate(flaskX + sw, flaskY);
    const fillH = lerp(.28, .5, ease(Math.min(1, t)))*fh;
    const topW = lerp(fw, neckW, 1 - fillH/fh);
    c.beginPath(); c.moveTo(-neckW/2, -fh); c.lineTo(neckW/2, -fh); c.lineTo(fw/2, 0); c.lineTo(-fw/2, 0); c.closePath();
    c.save(); c.clip();
    c.fillStyle = 'rgba(' + col.join(',') + ',' + (.35 + endK*.4 + flash*.3) + ')'; c.fillRect(-fw/2, -fillH + Math.sin(t*DUR*3)*2, fw, fillH + 10);
    c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(-fw/2, -fillH + Math.sin(t*DUR*3)*2, fw, 2);
    c.restore();
    c.strokeStyle = 'rgba(190,235,255,.9)'; c.lineWidth = 2.4;
    c.beginPath(); c.moveTo(-neckW/2, -fh); c.lineTo(-neckW/2, -fh - 18*s); c.moveTo(neckW/2, -fh); c.lineTo(neckW/2, -fh - 18*s);
    c.moveTo(-neckW/2, -fh); c.lineTo(-fw/2, 0); c.lineTo(fw/2, 0); c.lineTo(neckW/2, -fh); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.4)'; c.lineWidth = 1; c.beginPath(); c.moveTo(-fw*.25, -fh*.2); c.lineTo(-neckW*.5, -fh*.85); c.stroke();
    if(endK > .2){ c.shadowColor = 'rgb(255,80,180)'; c.shadowBlur = 30*endK; c.fillStyle = 'rgba(255,80,180,' + .18*endK + ')'; c.fillRect(-fw/2, -fillH, fw, fillH); c.shadowBlur = 0; }
    c.restore();

    // drops
    c.fillStyle = 'rgba(200,240,255,.95)';
    DROPS.forEach(d => {
      const age = t - d, fall = .028;
      if(age > 0 && age < fall){
        const k = age/fall, y = lerp(tipY + 4*s, flaskY - fillH + 6, k*k);
        c.beginPath(); c.ellipse(cx + sw*k, y, 3*s, 4.6*s, 0, 0, 7); c.fill();
      }
    });
    // hanging drop near tip
    const nextDrop = DROPS.find(d => d > t);
    if(nextDrop && nextDrop - t < .05){ const k = 1 - (nextDrop - t)/.05; c.beginPath(); c.ellipse(cx, tipY + 3*s + k*3*s, 2*s + k*1.4*s, 3*s + k*2.2*s, 0, 0, 7); c.fill(); }

    // first-person hands (wire outline) on the burette and flask
    c.save(); c.strokeStyle = 'rgba(233,255,244,.55)'; c.lineWidth = 1.4; c.fillStyle = 'rgba(0,26,16,.7)';
    function hand(x, y, flip, sc){
      c.save(); c.translate(x, y); c.scale(flip*sc, sc);
      c.beginPath(); c.moveTo(0, 90); c.quadraticCurveTo(-30, 40, -22, 0); c.lineTo(-18, -34); c.lineTo(-10, -34); c.lineTo(-8, -6);
      c.lineTo(-4, -44); c.lineTo(4, -44); c.lineTo(6, -6); c.lineTo(10, -40); c.lineTo(18, -40); c.lineTo(16, 0);
      c.quadraticCurveTo(34, 40, 30, 90); c.closePath(); c.fill(); c.stroke();
      for(let i = 1; i < 6; i++){ c.beginPath(); c.moveTo(-24 + i*2, 90 - i*14); c.quadraticCurveTo(0, 70 - i*14, 28 - i*2, 90 - i*14); c.globalAlpha = .25; c.stroke(); c.globalAlpha = 1; }
      c.restore();
    }
    c.restore();

    // ---- layers ----
    if(L.gaze.checked){
      let gx = .5, gy = .5, i = 0;
      while(i < GAZE.length - 1 && GAZE[i + 1][0] <= t) i++;
      const a = GAZE[i], b = GAZE[Math.min(i + 1, GAZE.length - 1)];
      const k = b[0] > a[0] ? ease((t - a[0])/(b[0] - a[0])) : 0;
      const pos = n => n[2] === 'burette' ? [cx, tipY - 120*s] : n[2] === 'tip' ? [cx, tipY + 20*s] : n[2] === 'colour' ? [cx + sw, flaskY - fh*.2] : [cx + sw, flaskY - fh*.45];
      const pa = pos(a), pb = pos(b);
      gx = lerp(pa[0], pb[0], k) + Math.sin(t*DUR*9)*3; gy = lerp(pa[1], pb[1], k) + Math.cos(t*DUR*7)*3;
      c.save(); c.strokeStyle = '#4aa8ff'; c.lineWidth = 2; c.shadowColor = '#4aa8ff'; c.shadowBlur = 16;
      c.beginPath(); c.arc(gx, gy, 26*s, 0, 7); c.stroke();
      c.beginPath(); c.arc(gx, gy, 5, 0, 7); c.fillStyle = '#4aa8ff'; c.fill();
      c.shadowBlur = 0; c.font = '11px "Share Tech Mono", monospace'; c.fillStyle = '#9fd0ff'; c.fillText('EXPERT GAZE', gx + 32*s, gy - 4);
      c.restore();
    }
  }

  function drawBpm(){
    const bpm = 64 + 13*ease(Math.max(0, Math.min(1, (t - .62)/.2))) - 5*ease(Math.max(0, Math.min(1, (t - .9)/.1))) + Math.sin(t*DUR*2.2)*1.5;
    $('bpmVal').textContent = Math.round(bpm);
    bpmHist.push(bpm); if(bpmHist.length > 80) bpmHist.shift();
    const w = bpmCv.width, h = bpmCv.height; bctx.clearRect(0, 0, w, h);
    bctx.strokeStyle = '#ff4d6d'; bctx.lineWidth = 2; bctx.beginPath();
    bpmHist.forEach((v, i) => { const x = i/79*w, y = h - ((v - 56)/30)*h; i ? bctx.lineTo(x, y) : bctx.moveTo(x, y); });
    bctx.stroke();
  }

  function ui(){
    const m = Math.floor(t*DUR/60), sec = Math.floor(t*DUR % 60), pad = n => String(n).padStart(2, '0');
    $('edTime').textContent = pad(m) + ':' + pad(sec) + ' / 00:' + DUR;
    $('tlFill').style.width = (t*100) + '%'; $('tlHead').style.left = (t*100) + '%';
    const th = THOUGHTS.find(o => t >= o.a && t < o.b);
    const box = $('thought');
    if(L.thought.checked && th){ if(box.dataset.k !== th.txt){ box.textContent = th.txt; box.dataset.k = th.txt; } box.classList.add('show'); }
    else box.classList.remove('show');
    $('bpmBox').classList.toggle('hide', !L.body.checked);
  }

  function frame(now){
    raf = requestAnimationFrame(frame);
    const dt = Math.min(.3, (now - last)/1000 || .016); last = now;
    if(playing){ t += dt*speed/DUR; if(t >= 1){ t = 0; bpmHist.length = 0; } }
    draw(); if(L.body.checked) drawBpm(); ui();
  }

  /* controls */
  const view = $('edView');
  view.addEventListener('pointermove', e => { const r = view.getBoundingClientRect(); look.x = (e.clientX - r.left)/r.width*2 - 1; look.y = (e.clientY - r.top)/r.height*2 - 1; });
  view.addEventListener('pointerleave', () => { look.x = 0; look.y = 0; });
  const playBtn = $('edPlay');
  function setPlay(p){ playing = p; playBtn.textContent = p ? '❚❚' : '▶'; }
  playBtn.addEventListener('click', () => setPlay(!playing));
  view.addEventListener('click', () => setPlay(!playing));
  document.querySelectorAll('#speedSeg button').forEach(b => b.addEventListener('click', () => {
    speed = parseFloat(b.dataset.s); document.querySelectorAll('#speedSeg button').forEach(x => x.classList.toggle('on', x === b));
  }));
  const tl = $('timeline'); let scrub = false;
  const seek = e => { const r = tl.getBoundingClientRect(); t = Math.max(0, Math.min(.999, (e.clientX - r.left)/r.width)); bpmHist.length = 0; };
  tl.addEventListener('pointerdown', e => { scrub = true; tl.setPointerCapture(e.pointerId); seek(e); });
  tl.addEventListener('pointermove', e => { if(scrub) seek(e); });
  tl.addEventListener('pointerup', () => { scrub = false; });
  Object.values(L).forEach(el => el.addEventListener('change', () => window.Sfx && Sfx.blip(el.checked ? 900 : 500)));

  let held = false, wanted = false;                       // held: the video tab is showing, so the simulation does not need to run
  window.Demo = {
    start(){ wanted = true; if(running || held) return; running = true; resize(); last = performance.now(); raf = requestAnimationFrame(frame); },
    stop(){ wanted = false; running = false; cancelAnimationFrame(raf); },
    hold(on){ held = !!on; if(on){ running = false; cancelAnimationFrame(raf); } else if(wanted && !running){ running = true; resize(); last = performance.now(); raf = requestAnimationFrame(frame); } },
    toggle(){ setPlay(!playing); }
  };
})();
