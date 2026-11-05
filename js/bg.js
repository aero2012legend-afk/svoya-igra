/* bg.js — живой фон экрана игры (WebGL): небо, облака, сияние, лучи, солнце/луна, звёзды + погода (снег, дождь, гроза, листья, светлячки).
   Управление: BG.set({ rnd: '1'|'2'|'3'|'f', p: 0..1 (сколько вопросов раунда сыграно), weather: 'snow'|'leaves'|'rain'|'night'|'storm'|'fog' }).
   Если WebGL недоступен или включён лёгкий режим (body.lite) — остаётся обычный CSS-фон. */
(function () {
  'use strict';
  const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const FS = `
precision highp float;
uniform vec2 R; uniform float T; uniform vec3 A; uniform vec3 B; uniform vec3 C; uniform vec3 G;
uniform vec2 SUN; uniform float SK; uniform float NIGHT; uniform float CLOUD; uniform float AUR; uniform float FLASH; uniform float FOG;
float h(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);for(int i=0;i<6;i++){v+=a*n(p);p=m*p;a*=.5;}return v;}
void main(){
  vec2 uv=gl_FragCoord.xy/R; vec2 q=(gl_FragCoord.xy-.5*R)/R.y; float t=T;
  // небо: три цвета палитры раунда, сверху вниз
  vec3 col=mix(C,B,smoothstep(-.1,.55,uv.y)); col=mix(col,A,smoothstep(.45,1.15,uv.y)*.85);
  // медленно плывущая «туманность»
  float neb=fbm(q*1.6+vec2(t*.012,-t*.008)); col+=G*.22*smoothstep(.45,.9,neb);
  // мягкие подвижные лучи из-за верхнего края
  vec2 rp=q-vec2(0.,.75); float ang=atan(rp.x,-rp.y); float rays=.5+.5*sin(ang*14.+t*.15+fbm(vec2(ang*3.,t*.05))*4.);
  col+=G*.07*pow(rays,3.)*smoothstep(1.4,.1,length(rp))*(1.-NIGHT*.6);
  // северное сияние (ночью)
  if(AUR>0.){float y=uv.y-.62-.08*sin(q.x*2.3+t*.21)-.05*fbm(vec2(q.x*3.,t*.06));
    float band=exp(-y*y*90.)*(.55+.45*fbm(vec2(q.x*6.,t*.12)));
    col+=AUR*band*mix(vec3(.1,1.,.6),vec3(.6,.2,1.),.5+.5*sin(q.x*3.+t*.1));}
  // звёзды
  if(NIGHT>0.){vec2 g=gl_FragCoord.xy/2.2; vec2 id=floor(g); float s=h(id); if(s>.9965){float tw=.5+.5*sin(t*(1.5+s*4.)+s*90.);
    float d=length(fract(g)-.5); col+=NIGHT*vec3(1.)*smoothstep(.5,0.,d)*tw*smoothstep(.2,.6,uv.y);}}
  // солнце / луна
  vec2 sp=SUN; vec2 sd=q-sp; float r=length(sd);
  if(SK<1.5){ // солнце (SK 0) или закат (SK 1)
    vec3 sc=mix(vec3(1.,.93,.65),vec3(1.,.55,.25),SK); float core=smoothstep(.065,.055,r);
    float glow=exp(-r*7.)*.8+exp(-r*2.2)*.25; float a2=atan(sd.y,sd.x);
    float cor=pow(.5+.5*sin(a2*18.+t*.4),6.)*exp(-r*5.)*.25;
    col+=sc*(core*1.2+glow+cor);
    // блик
    vec2 fl=-sp*1.2; col+=sc*.12*smoothstep(.06,0.,length(q-fl))+sc*.06*smoothstep(.12,0.,length(q-sp*.3));
  } else { // луна
    float disk=smoothstep(.06,.055,r); vec3 mc=vec3(.9,.93,1.)*(.82+.18*fbm(sd*28.)); mc-=.12*smoothstep(.5,.65,fbm(sd*14.+3.));
    col=mix(col,mc,disk); col+=vec3(.6,.7,1.)*(exp(-r*9.)*.35+exp(-r*3.)*.12);
  }
  // облака (подсвечены солнцем)
  if(CLOUD>0.){vec2 cp=q*vec2(1.2,2.4)+vec2(t*.018,0.); float c=fbm(cp*1.4)+.5*fbm(cp*3.1-t*.01);
    float cov=smoothstep(1.05-CLOUD*.55,1.35-CLOUD*.4,c)*smoothstep(.15,.6,uv.y);
    vec3 cc=mix(B*.6+vec3(.08),vec3(1.)*(.55+.45*(1.-NIGHT)),.45)+G*.15; float lit=exp(-length(q-sp)*2.)*.6;
    col=mix(col,cc+lit*vec3(1.,.85,.6),cov*.75);}
  // туман у земли
  col=mix(col,mix(B,vec3(.75),.35),FOG*smoothstep(.45,0.,uv.y)*(.6+.4*fbm(vec2(q.x*2.-t*.03,uv.y*3.))));
  // вспышка молнии
  col+=FLASH*vec3(.75,.8,1.);
  // виньетка
  col*=1.-.35*smoothstep(.55,1.25,length(q*vec2(.9,1.2)));
  gl_FragColor=vec4(col,1.);
}`;
  const PAL = { // небо (верх, середина, низ), цвет свечения
    '1': { A: '#2f63d8', B: '#173b9a', C: '#081440', G: '#7fd8ff' },
    '2': { A: '#c2507a', B: '#4b1e78', C: '#140826', G: '#ffb070' },
    '3': { A: '#0e3f5a', B: '#06202e', C: '#020a12', G: '#5ffff0' },
    'f': { A: '#5a3510', B: '#1d0f04', C: '#060302', G: '#ffcc55' },
  };
  const hex = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16) / 255);
  const lerp = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
  const S = { rnd: '1', p: 0, weather: 'snow', on: false };
  const cur = { A: hex(PAL['1'].A), B: hex(PAL['1'].B), C: hex(PAL['1'].C), G: hex(PAL['1'].G), sun: [-.6, .1], sk: 0, night: 0, cloud: .35, aur: 0, fog: 0 };
  let gl, prog, U = {}, cv, wcv, wcx, parts = [], flash = 0, nextBolt = 0, bolt = null, t0 = performance.now(), last = 0;

  function init() {
    const bg = document.getElementById('bg'); if (!bg) return false;
    cv = document.createElement('canvas'); cv.id = 'bgl'; bg.appendChild(cv);
    wcv = document.createElement('canvas'); wcv.id = 'wx'; bg.appendChild(wcv); wcx = wcv.getContext('2d');
    gl = cv.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' });
    if (!gl) { cv.remove(); cv = null; }
    else {
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
      try {
        prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      } catch (e) { console.warn('bg.js:', e); cv.remove(); cv = null; gl = null; }
      if (gl) {
        gl.useProgram(prog);
        const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        ['R', 'T', 'A', 'B', 'C', 'G', 'SUN', 'SK', 'NIGHT', 'CLOUD', 'AUR', 'FLASH', 'FOG'].forEach(k => { U[k] = gl.getUniformLocation(prog, k); });
        document.body.classList.add('glbg');
      }
    }
    S.on = true; requestAnimationFrame(frame); return true;
  }
  function target() {
    const P = PAL[S.rnd] || PAL['1'], p = S.p;
    const arc = [-.75 + 1.5 * p, -.05 + .42 * Math.sin(Math.PI * Math.min(1, p * 1.05))];
    const W = S.weather;
    return {
      A: hex(P.A), B: hex(P.B), C: hex(P.C), G: hex(P.G), sun: arc,
      sk: S.rnd === '1' ? 0 : S.rnd === '2' ? 1 : 2, night: S.rnd === '3' || S.rnd === 'f' ? 1 : 0,
      cloud: { snow: .45, leaves: .35, rain: .85, storm: 1, fog: .6, night: .2 }[W] || .3,
      aur: S.rnd === '3' ? .55 : 0, fog: W === 'fog' ? .7 : W === 'rain' || W === 'storm' ? .25 : 0,
    };
  }
  function frame(now) {
    requestAnimationFrame(frame);
    const lite = document.body.classList.contains('lite') || document.hidden;
    if (lite) { if (cv) cv.style.display = 'none'; wcv.style.display = 'none'; return; }
    if (cv) cv.style.display = ''; wcv.style.display = '';
    if (now - last < 1000 / 45) return; // 45 кадров хватает фону
    const dt = Math.min(.1, (now - (last || now)) / 1000); last = now;
    const tg = target(), k = Math.min(1, dt * .6);
    ['A', 'B', 'C', 'G', 'sun'].forEach(key => { cur[key] = lerp(cur[key], tg[key], key === 'sun' ? Math.min(1, dt * .3) : k); });
    ['night', 'cloud', 'aur', 'fog'].forEach(key => { cur[key] += (tg[key] - cur[key]) * k; });
    cur.sk = tg.sk;
    // молнии в грозу
    if (S.weather === 'storm' && now > nextBolt) { flash = 1; bolt = mkBolt(); nextBolt = now + 5000 + Math.random() * 9000; try { if (window.Sound) Sound.play('thunder'); } catch (e) { /* без звука */ } }
    flash *= Math.pow(.02, dt);
    if (gl) {
      const sc = Math.min(1, 1600 / Math.max(innerWidth, 1)), W = Math.round(innerWidth * sc), H = Math.round(innerHeight * sc);
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; gl.viewport(0, 0, W, H); }
      gl.uniform2f(U.R, W, H); gl.uniform1f(U.T, (now - t0) / 1000);
      gl.uniform3fv(U.A, cur.A); gl.uniform3fv(U.B, cur.B); gl.uniform3fv(U.C, cur.C); gl.uniform3fv(U.G, cur.G);
      gl.uniform2fv(U.SUN, cur.sun); gl.uniform1f(U.SK, cur.sk); gl.uniform1f(U.NIGHT, cur.night); gl.uniform1f(U.CLOUD, cur.cloud);
      gl.uniform1f(U.AUR, cur.aur); gl.uniform1f(U.FLASH, flash * .55); gl.uniform1f(U.FOG, cur.fog);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    weather(dt, now);
  }
  function mkBolt() {
    const pts = [[.15 + Math.random() * .7, 0]]; let x = pts[0][0], y = 0;
    while (y < .75) { y += .03 + Math.random() * .06; x += (Math.random() - .5) * .07; pts.push([x, y]); }
    return { pts, born: performance.now() };
  }
  function weather(dt, now) {
    const W = Math.round(innerWidth / 1.5), H = Math.round(innerHeight / 1.5);
    if (wcv.width !== W || wcv.height !== H) { wcv.width = W; wcv.height = H; parts = []; }
    const k = S.weather, cx = wcx, rnd = Math.random;
    const want = { snow: 220, leaves: 40, rain: 320, storm: 420, night: 60, fog: 0 }[k] || 0;
    if (parts.k !== k) { parts = []; parts.k = k; }
    while (parts.length < want) parts.push({ x: rnd() * W, y: rnd() * H * (k === 'night' ? 1 : 1.2) - (k === 'night' ? 0 : H * .2), z: .25 + rnd() * .75, a: rnd() * 6.28, v: rnd() });
    cx.clearRect(0, 0, W, H);
    const wind = Math.sin(now / 7000) * 30;
    for (const o of parts) {
      if (k === 'snow') {
        o.y += (18 + 40 * o.z) * dt; o.x += (Math.sin(now / 1600 + o.a) * 14 + wind * .4) * o.z * dt;
        const r = .6 + 2.4 * o.z * o.z; cx.globalAlpha = .25 + .6 * o.z; cx.fillStyle = '#fff';
        cx.beginPath(); cx.arc(o.x, o.y, r, 0, 6.28); cx.fill();
        if (o.z > .85) { cx.globalAlpha = .08; cx.beginPath(); cx.arc(o.x, o.y, r * 3.2, 0, 6.28); cx.fill(); } // ближние — с ореолом
      } else if (k === 'rain' || k === 'storm') {
        const sp = (520 + 520 * o.z) * (k === 'storm' ? 1.25 : 1); o.y += sp * dt; o.x += (wind - 90) * o.z * dt;
        cx.globalAlpha = .12 + .35 * o.z; cx.strokeStyle = '#cfe2ff'; cx.lineWidth = .6 + 1.1 * o.z;
        cx.beginPath(); cx.moveTo(o.x, o.y); cx.lineTo(o.x - (wind - 90) * o.z * .03, o.y - (8 + 16 * o.z)); cx.stroke();
        if (o.y > H - 4 && o.z > .55) { // брызги у нижнего края
          cx.globalAlpha = .35; cx.beginPath(); cx.ellipse(o.x, H - 3, 3 + 4 * o.z, 1.2, 0, 0, 6.28); cx.stroke();
        }
      } else if (k === 'leaves') {
        o.y += (24 + 30 * o.z) * dt; o.x += (Math.sin(now / 1000 + o.a) * 34 + 14 + wind * .3) * dt; o.a += dt * (1 + o.v * 2);
        cx.save(); cx.translate(o.x, o.y); cx.rotate(o.a); cx.scale(1, Math.abs(Math.sin(o.a * 1.7)) * .8 + .2);
        cx.globalAlpha = .45 + .45 * o.z; cx.fillStyle = ['#ff8a3c', '#e8552c', '#ffc23d', '#b8422a'][Math.floor(o.v * 4)];
        const s = 3 + 6 * o.z; cx.beginPath(); cx.moveTo(0, -s); cx.quadraticCurveTo(s, 0, 0, s); cx.quadraticCurveTo(-s, 0, 0, -s); cx.fill(); cx.restore();
      } else if (k === 'night') { // светлячки
        o.x += Math.cos(now / 1900 + o.a) * 12 * dt; o.y += Math.sin(now / 2300 + o.a * 2) * 9 * dt;
        const g = .5 + .5 * Math.sin(now / 600 + o.a * 5); cx.globalAlpha = .15 + .55 * g * o.z;
        const gr = cx.createRadialGradient(o.x, o.y, 0, o.x, o.y, 4 + 6 * o.z); gr.addColorStop(0, '#fffbb0'); gr.addColorStop(1, 'rgba(255,240,120,0)');
        cx.fillStyle = gr; cx.beginPath(); cx.arc(o.x, o.y, 4 + 6 * o.z, 0, 6.28); cx.fill();
        if (o.y > H * .7 || o.y < H * .45) o.y = H * (.5 + .2 * rnd());
      }
      if (o.y > H + 20) { o.y = -20 - rnd() * 60; o.x = rnd() * W; }
      if (o.x > W + 30) o.x = -30; if (o.x < -30) o.x = W + 30;
    }
    cx.globalAlpha = 1;
    if (bolt) { // молния
      const age = (performance.now() - bolt.born) / 1000; if (age > .45) bolt = null; else {
        cx.strokeStyle = '#e8f0ff'; cx.shadowColor = '#9fc0ff'; cx.shadowBlur = 18; cx.lineWidth = 2.6 * (1 - age * 1.8); cx.globalAlpha = 1 - age * 2;
        cx.beginPath(); bolt.pts.forEach(([x, y], i) => (i ? cx.lineTo(x * W, y * H) : cx.moveTo(x * W, y * H))); cx.stroke(); cx.shadowBlur = 0; cx.globalAlpha = 1;
      }
    }
  }
  window.BG = {
    set(o) { Object.assign(S, o || {}); if (!S.on) init(); },
    flash() { flash = 1; },
  };
})();
