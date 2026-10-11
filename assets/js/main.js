(() => {
  "use strict";
  const C = window.CONTENT;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  gsap.registerPlugin(ScrollTrigger);

  /* ------------------------------------------------------------------ i18n */
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  let L = store.get("yirou.lang") || "zh";
  if (!C.ui[L]) L = "zh";
  const t = (k) => C.ui[L][k] || k;
  const loc = (v) => (typeof v === "string" ? v : v[L]);

  function applyLang(lang, opts = {}) {
    L = lang;
    store.set("yirou.lang", lang);
    document.documentElement.lang = lang === "zh" ? "zh" : "en";
    $$("[data-i18n]").forEach((el) => (el.textContent = t(el.dataset.i18n)));
    $$("[data-i18n-html]").forEach((el) => (el.innerHTML = t(el.dataset.i18nHtml)));
    $$(".lang button").forEach((b) => b.classList.toggle("is-on", b.dataset.lang === lang));
    buildChips();
    buildBridge();
    buildSteps();
    renderCard(activeStep, true);
    Sections.render(lang);
    if (scrollReady) ScrollTrigger.refresh();
    labels.forEach((l) => { l.el.textContent = loc(l.stop.city); l.el.dataset.year = loc(l.stop.year); });
    if (opts.rerun) {
      $$(".hero__name .decode").forEach((el, i) => decode(el, 700 + i * 200));
      ask(chatIdx, true);
    }
  }
  $$(".lang button").forEach((b) => b.addEventListener("click", () => b.dataset.lang !== L && applyLang(b.dataset.lang, { rerun: true })));

  /* -------------------------------------------------------- text effects */
  const POOL_ZH = "组织战略模型数据产品全球巴黎上海首尔增长智能策略算法选品召回精排迭代";
  const POOL_EN = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789#%&";
  function decode(el, dur = 1100, finalText) {
    const final = finalText || el.dataset.final || el.textContent;
    const pool = /[一-鿿]/.test(final) ? POOL_ZH : POOL_EN;
    if (REDUCED) { el.textContent = final; return; }
    const start = performance.now();
    cancelAnimationFrame(el._raf);
    const tick = (now) => {
      const p = clamp((now - start) / dur);
      const shown = Math.floor(p * final.length);
      let s = "";
      for (let i = 0; i < final.length; i++) {
        const ch = final[i];
        s += i < shown || ch === " " ? ch : pool[(Math.random() * pool.length) | 0];
      }
      el.textContent = s;
      if (p < 1) el._raf = requestAnimationFrame(tick);
    };
    el._raf = requestAnimationFrame(tick);
  }

  /* ------------------------------------------------------------ terminal */
  const termQ = $(".term__q"), termA = $(".term__a"), chipsEl = $(".term__chips");
  let chatIdx = 0, chatRun = 0;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function buildChips() {
    chipsEl.innerHTML = "";
    C.chat[L].forEach((c, i) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "chip" + (i === chatIdx ? " is-on" : "");
      b.textContent = c.q;
      b.addEventListener("click", () => ask(i));
      chipsEl.appendChild(b);
    });
  }

  async function ask(i, fast = false) {
    const run = ++chatRun;
    chatIdx = i;
    $$(".chip", chipsEl).forEach((b, j) => b.classList.toggle("is-on", j === i));
    const { q, a } = C.chat[L][i];
    const caret = document.createElement("span");
    caret.className = "caret";
    termA.innerHTML = "";
    termQ.textContent = "";
    if (REDUCED) { termQ.textContent = q; termA.innerHTML = a.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>"); return; }

    for (let k = 1; k <= q.length; k++) {
      if (run !== chatRun) return;
      termQ.textContent = q.slice(0, k);
      await sleep(fast ? 8 : 34 + Math.random() * 30);
    }
    termA.appendChild(caret);
    await sleep(fast ? 60 : 420); // "thinking"
    const parts = a.split(/(\*\*.+?\*\*)/).filter(Boolean).map((p) => ({ bold: p.startsWith("**"), text: p.replace(/\*\*/g, "") }));
    for (const part of parts) {
      const node = part.bold ? document.createElement("b") : document.createTextNode("");
      termA.insertBefore(node, caret);
      let k = 0;
      while (k < part.text.length) {
        if (run !== chatRun) return;
        k += 1 + ((Math.random() * (L === "zh" ? 2 : 4)) | 0); // token-ish chunks
        node.textContent = part.text.slice(0, k);
        await sleep(fast ? 4 : 22 + Math.random() * 26);
      }
    }
  }

  /* -------------------------------------------------------------- bridge */
  const bridgeText = $(".bridge__text");
  let bridgeWords = [];
  function buildBridge() {
    const src = C.bridge[L];
    bridgeText.innerHTML = "";
    src.split(/(\[\[.+?\]\])/).filter(Boolean).forEach((seg) => {
      const hl = seg.startsWith("[[");
      const text = seg.replace(/\[\[|\]\]/g, "");
      const units = L === "zh" ? Array.from(text) : text.split(/(\s+)/);
      units.forEach((u) => {
        if (/^\s+$/.test(u)) { bridgeText.appendChild(document.createTextNode(u)); return; }
        const s = document.createElement("span");
        s.className = "w" + (hl ? " hl" : "");
        s.textContent = u;
        bridgeText.appendChild(s);
      });
    });
    bridgeWords = $$(".w", bridgeText);
  }

  /* ------------------------------------------------------- regions panel */
  const stepsEl = $(".steps"), card = $(".card");
  const N = C.stops.length;
  let activeStep = 0, regionsST = null, scrollReady = false;

  function buildSteps() {
    stepsEl.innerHTML = "";
    C.stops.forEach((s, i) => {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      b.innerHTML = `0${i + 1}<span>${loc(s.city).split(" · ")[0]}</span>`;
      b.addEventListener("click", () => goToStep(i));
      li.appendChild(b);
      stepsEl.appendChild(li);
    });
    paintSteps();
  }
  function paintSteps() {
    $$("button", stepsEl).forEach((b, i) => {
      b.classList.toggle("is-on", i === activeStep);
      b.classList.toggle("is-done", i < activeStep);
    });
  }
  function renderCard(i, instant) {
    const s = C.stops[i];
    card.innerHTML = `
      <div class="card__head"><div class="card__city">${loc(s.city)}</div><div class="card__year">${loc(s.year)}</div></div>
      <div class="card__org">${loc(s.org)}</div>
      <div class="card__role">${loc(s.role)}</div>
      <div class="card__metric"><div class="v">${s.metric.v}</div><div class="l">${loc(s.metric.l)}</div></div>
      <ul class="card__notes">${loc(s.notes).map((n) => `<li>${n}</li>`).join("")}</ul>
      <div class="card__idx">0${i + 1}</div>`;
    if (instant || REDUCED) return;
    gsap.fromTo(card.children, { y: 14, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.045, duration: 0.55, ease: "power3.out" });
    decode($(".card__metric .v", card), 650, s.metric.v);
  }
  function setStep(i) {
    if (i === activeStep) return;
    activeStep = i;
    paintSteps();
    renderCard(i);
    globe.onStep(i);
  }
  function goToStep(i) {
    if (!regionsST) return;
    const y = regionsST.start + ((i + 0.5) / N) * (regionsST.end - regionsST.start);
    window.scrollTo({ top: y, behavior: REDUCED ? "auto" : "smooth" });
  }


  /* --------------------------------------------------------------- globe */
  const labels = [];
  const globe = createGlobe();

  function createGlobe() {
    const host = $("#stage");
    // raw passthrough so shader colors match the CSS hex values exactly
    THREE.ColorManagement.enabled = false;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(0, 0, 10);

    const R = 2;
    const world = new THREE.Group();      // layout: position / scale
    const spin = new THREE.Group();       // rotation
    world.add(spin);
    scene.add(world);

    const GOLD = new THREE.Color("#d9b77e"), GOLD2 = new THREE.Color("#f6e3bf"), CORAL = new THREE.Color("#ff7a59");

    const latLon = (lat, lon, r) => {
      const phi = (90 - lat) * Math.PI / 180, th = (lon + 180) * Math.PI / 180;
      return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th));
    };

    /* --- land dots that start life as floating dust --- */
    const D = window.LAND_DOTS, n = D.length / 2;
    const pos = new Float32Array(n * 3), scat = new Float32Array(n * 3), rnd = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const v = latLon(D[i * 2], D[i * 2 + 1], R);
      pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
      scat[i * 3] = (Math.random() * 2 - 1) * 11;
      scat[i * 3 + 1] = (Math.random() * 2 - 1) * 6.5;
      scat[i * 3 + 2] = -7 + Math.random() * 10;
      rnd[i] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aScatter", new THREE.BufferAttribute(scat, 3));
    g.setAttribute("aRand", new THREE.BufferAttribute(rnd, 1));
    const pMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 }, uMorph: { value: 0 }, uSize: { value: 26 }, uPR: { value: renderer.getPixelRatio() },
        uScale: { value: 1 }, uOpacity: { value: 1 }, uActiveAmt: { value: 0 }, uActivePos: { value: new THREE.Vector3() },
        uGold: { value: GOLD }, uGold2: { value: GOLD2 }, uCoral: { value: CORAL }
      },
      vertexShader: `
        uniform float uTime, uMorph, uSize, uPR, uScale, uActiveAmt;
        uniform vec3 uActivePos;
        attribute vec3 aScatter;
        attribute float aRand;
        varying float vAlpha;
        varying float vRand;
        varying float vHl;
        void main() {
          float m = clamp(uMorph * 1.5 - aRand * 0.5, 0.0, 1.0);
          m = m * m * (3.0 - 2.0 * m);
          vec3 dust = aScatter + vec3(sin(uTime * 0.15 + aRand * 40.0) * 0.35, cos(uTime * 0.12 + aRand * 25.0) * 0.25, sin(uTime * 0.1 + aRand * 10.0) * 0.2);
          vec4 gw = modelMatrix * vec4(position, 1.0);
          vec3 wp = mix(dust, gw.xyz, m);
          wp.y += sin(m * 3.14159) * (aRand - 0.5) * 1.6;
          vec4 mv = viewMatrix * vec4(wp, 1.0);
          vec3 nrm = normalize(mat3(modelMatrix) * position);
          float facing = dot(nrm, normalize(cameraPosition - gw.xyz));
          float vis = mix(1.0, smoothstep(-0.05, 0.35, facing), m);
          float hl = uActiveAmt * (1.0 - smoothstep(0.0, 0.6, distance(position, uActivePos)));
          vHl = hl * m;
          vRand = aRand;
          float tw = 0.6 + 0.4 * sin(uTime * 1.3 + aRand * 60.0);
          float dustA = (0.06 + 0.5 * pow(aRand, 4.0)) * tw;
          float globeA = 0.32 + 0.5 * aRand + vHl * 0.7;
          vAlpha = mix(dustA, globeA, m) * vis;
          float s = mix(0.7 + aRand * 1.3, (0.8 + aRand * 0.45) * uScale * (1.0 + vHl * 0.9), m);
          gl_PointSize = uSize * uPR * s / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 uGold, uGold2, uCoral;
        uniform float uOpacity;
        varying float vAlpha;
        varying float vRand;
        varying float vHl;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          if (d > 0.5) discard;
          float a = smoothstep(0.5, 0.08, d);
          vec3 col = mix(uGold, uGold2, vRand);
          if (vRand > 0.985) col = uCoral;
          col = mix(col, uCoral, vHl * 0.85);
          gl_FragColor = vec4(col, a * vAlpha * uOpacity);
        }`
    });
    const points = new THREE.Points(g, pMat);
    points.frustumCulled = false;
    spin.add(points);

    /* --- globe body + atmosphere --- */
    const bodyMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uOpacity: { value: 0 }, uGold: { value: GOLD } },
      vertexShader: `varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform float uOpacity; uniform vec3 uGold; varying vec3 vN;
        void main(){ float f = pow(1.0 - max(dot(vN, vec3(0.0,0.0,1.0)), 0.0), 6.0);
          vec3 col = mix(vec3(0.045,0.04,0.035), uGold * 0.32, f);
          gl_FragColor = vec4(col, (0.8 + f * 0.15) * uOpacity); }`
    });
    const body = new THREE.Mesh(new THREE.SphereGeometry(R * 0.985, 64, 48), bodyMat);
    body.renderOrder = -1;
    spin.add(body);

    const atmoMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide,
      uniforms: { uOpacity: { value: 0 }, uColor: { value: new THREE.Color("#f0c58a") } },
      vertexShader: `varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform float uOpacity; uniform vec3 uColor; varying vec3 vN;
        void main(){
          // glow only in the band between the globe limb (~0.57) and the halo's outer edge (0)
          float x = clamp(-dot(vN, vec3(0.0,0.0,1.0)), 0.0, 1.0);
          float i = smoothstep(0.0, 0.55, x) * (1.0 - smoothstep(0.55, 0.58, x));
          gl_FragColor = vec4(uColor, i * i * 0.38 * uOpacity); }`
    });
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.22, 64, 48), atmoMat);
    atmo.renderOrder = -2;
    world.add(atmo); // not rotated: it is symmetric

    /* --- markers --- */
    const markers = [];
    C.stops.forEach((s, i) => {
      if (s.lat == null) { markers.push(null); return; }
      const p = latLon(s.lat, s.lon, R * 1.004);
      const m = new THREE.Group();
      m.position.copy(p);
      m.lookAt(p.clone().multiplyScalar(2));
      const big = s.region ? 1.8 : 1;
      const dot = new THREE.Mesh(new THREE.CircleGeometry(0.032 * big, 24),
        new THREE.MeshBasicMaterial({ color: GOLD2, transparent: true, opacity: 0, depthWrite: false }));
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.05 * big, 0.06 * big, 48),
        new THREE.MeshBasicMaterial({ color: CORAL, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      m.add(dot, ring);
      spin.add(m);
      markers.push({ group: m, dot, ring, local: latLon(s.lat, s.lon, R), phase: i * 0.37 });

      const el = document.createElement("div");
      el.className = "g-label";
      el.textContent = loc(s.city);
      el.dataset.year = loc(s.year);
      el.addEventListener("click", () => goToStep(i));
      $("#globe-labels").appendChild(el);
      labels.push({ el, stop: s, index: i, marker: m });
    });

    /* --- journey arcs: drawn when you reach their destination --- */
    const SEG = 96, RAD = 6;
    const arcDefs = [[0, 1], [1, 2], [2, 3], [3, 5]];
    const arcs = arcDefs.map(([a, b]) => {
      const A = markers[a].local.clone().normalize(), B = markers[b].local.clone().normalize();
      const ang = A.angleTo(B), h = 0.12 + 0.32 * ang / Math.PI;
      const pts = [];
      for (let k = 0; k <= 64; k++) {
        const tt = k / 64;
        const v = new THREE.Vector3().copy(A).lerp(B, tt).normalize(); // cheap slerp, fine for < 180°
        pts.push(v.multiplyScalar(R * (1 + h * Math.sin(Math.PI * tt))));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const geo = new THREE.TubeGeometry(curve, SEG, 0.007, RAD, false);
      const mat = new THREE.MeshBasicMaterial({ color: GOLD2, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
      const mesh = new THREE.Mesh(geo, mat);
      geo.setDrawRange(0, 0);
      spin.add(mesh);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 12),
        new THREE.MeshBasicMaterial({ color: CORAL, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      spin.add(head);
      return { to: b, curve, geo, mesh, head, p: 0 };
    });

    /* --- orbit ring for the "Global" step --- */
    const orbitMat = new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const orbit = new THREE.Mesh(new THREE.TorusGeometry(R * 1.32, 0.005, 8, 240), orbitMat);
    orbit.rotation.set(1.25, 0.25, 0);
    const sat = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 16), new THREE.MeshBasicMaterial({ color: CORAL, transparent: true, opacity: 0 }));
    world.add(orbit, sat);

    /* --- state --- */
    const S = { morph: 0, x: 0, y: 0, scale: 1, opacity: 1, labels: 0, rotY: -2.1, rotX: 0.35, dragY: 0, dragX: 0, global: 0 };
    let visH = 1, visW = 1, mobile = false;
    let stepIdx = 0;

    function onStep(i) {
      stepIdx = i;
      arcs.forEach((a) => gsap.to(a, { p: i >= a.to ? 1 : 0, duration: i >= a.to ? 1.4 : 0.5, ease: "power2.inOut", overwrite: true }));
    }
    onStep(0);

    function resize() {
      const w = window.innerWidth, h = window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      visH = camera.position.z * Math.tan((camera.fov / 2) * Math.PI / 180);
      visW = visH * camera.aspect;
      mobile = w < 900;
      pMat.uniforms.uPR.value = renderer.getPixelRatio();
    }
    window.addEventListener("resize", resize);
    resize();

    /* drag to spin (mouse / pen only so touch keeps scrolling) */
    let dragging = false, lx = 0, ly = 0;
    window.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "touch" || S.labels < 0.5) return;
      if (e.target.closest(".regions__panel, .nav, a, button")) return;
      dragging = true; lx = e.clientX; ly = e.clientY;
    });
    window.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      S.dragY += (e.clientX - lx) * 0.006; S.dragX += (e.clientY - ly) * 0.004;
      S.dragX = clamp(S.dragX, -0.8, 0.8);
      lx = e.clientX; ly = e.clientY;
    });
    window.addEventListener("pointerup", () => (dragging = false));

    const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    const tmp = new THREE.Vector3(), ctr = new THREE.Vector3(), cam = camera.position;

    function frame(time, dt, scroll) {
      const k = 1 - Math.exp(-dt * 3.2);
      pMat.uniforms.uTime.value = time;

      /* layout targets from scroll (see main loop) */
      const bridgeL = { x: 0, y: -visH * 1.05 - R * 0.55, s: 1.65 };
      const regionL = mobile ? { x: 0, y: visH * 0.5, s: Math.min(0.5, (visW * 0.78) / R) } : { x: visW * 0.36, y: 0, s: 1 };
      // after the regions chapter the globe recedes into an ambient background, then rises again as a horizon at the contact section
      const ambientL = mobile ? { x: visW * 0.35, y: visH * 0.2, s: 0.55 } : { x: visW * 0.62, y: visH * 0.12, s: 0.9 };
      let tx = lerp(bridgeL.x, regionL.x, scroll.q), ty = lerp(bridgeL.y, regionL.y, scroll.q), ts = lerp(bridgeL.s, regionL.s, scroll.q);
      tx = lerp(tx, ambientL.x, scroll.c); ty = lerp(ty, ambientL.y, scroll.c); ts = lerp(ts, ambientL.s, scroll.c);
      tx = lerp(tx, bridgeL.x, scroll.f); ty = lerp(ty, bridgeL.y, scroll.f); ts = lerp(ts, bridgeL.s, scroll.f);
      const tOpacity = lerp(lerp(1, 0.16, scroll.c), 1, scroll.f);

      S.morph = lerp(S.morph, scroll.morph, REDUCED ? 1 : k * 1.4);
      S.x = lerp(S.x, tx, k); S.y = lerp(S.y, ty, k); S.scale = lerp(S.scale, ts, k);
      S.opacity = lerp(S.opacity, tOpacity, k);
      S.labels = lerp(S.labels, scroll.q > 0.92 && scroll.c < 0.3 ? 1 : 0, k * 1.6);
      const inRegions = scroll.q > 0.5 && scroll.c < 0.5;
      const isGlobal = stepIdx === 4 && inRegions ? 1 : 0;
      S.global = lerp(S.global, isGlobal, k);

      world.position.set(S.x, S.y, 0);
      world.scale.setScalar(S.scale);
      pMat.uniforms.uMorph.value = S.morph;
      pMat.uniforms.uScale.value = S.scale;
      pMat.uniforms.uOpacity.value = S.opacity;
      const solid = Math.pow(clamp((S.morph - 0.55) / 0.45), 2);
      bodyMat.uniforms.uOpacity.value = solid * S.opacity;
      atmoMat.uniforms.uOpacity.value = solid * 0.9 * S.opacity;

      /* rotation: face the active stop, or free-spin for "Global" / before arrival */
      const stop = C.stops[stepIdx];
      let tY, tX;
      if (stop.lat != null && !isGlobal && scroll.c < 0.5) {
        const p = latLon(stop.lat, stop.lon, 1);
        tY = Math.atan2(-p.x, p.z);
        tX = Math.asin(p.y) * (mobile ? 0.6 : 0.75);
        if (scroll.q < 0.5) tX = 0.55; // planet-horizon view during the bridge
        S.rotY += wrap(tY - S.rotY) * k * 0.9;
        S.rotX = lerp(S.rotX, tX, k * 0.9);
      } else {
        S.rotY += dt * (scroll.c > 0.5 ? 0.12 : 0.35);
        S.rotX = lerp(S.rotX, scroll.f > 0.3 ? 0.55 : 0.25, k);
      }
      if (!dragging) { S.dragY *= Math.exp(-dt * 1.4); S.dragX *= Math.exp(-dt * 1.4); }
      spin.rotation.set(S.rotX + S.dragX, S.rotY + S.dragY, 0, "XYZ");

      /* highlight dots around the active stop */
      if (stop.lat != null) pMat.uniforms.uActivePos.value.copy(latLon(stop.lat, stop.lon, R));
      pMat.uniforms.uActiveAmt.value = lerp(pMat.uniforms.uActiveAmt.value, stop.lat != null && !isGlobal ? scroll.q * (1 - scroll.c) : 0, k);

      /* markers */
      markers.forEach((m, i) => {
        if (!m) return;
        const on = i === stepIdx;
        const vis = solid * S.opacity;
        m.dot.material.opacity = vis * (on ? 1 : 0.55 + S.global * 0.45);
        m.dot.material.color.copy(on ? CORAL : GOLD2);
        const ph = ((time * 0.6 + m.phase) % 1);
        m.ring.scale.setScalar(1 + ph * (on ? 3.2 : 2));
        m.ring.material.opacity = vis * (1 - ph) * (on ? 0.9 : 0.25 + S.global * 0.6);
      });

      /* arcs */
      arcs.forEach((a, i) => {
        const steps = Math.floor(a.p * SEG);
        a.geo.setDrawRange(0, steps * RAD * 6);
        a.mesh.material.opacity = 0.85 * solid * S.opacity * (1 - scroll.f * 0.65);
        const done = a.p > 0.98;
        const u = done ? (time * 0.28 + i * 0.25) % 1 : a.p;
        a.head.position.copy(a.curve.getPointAt(clamp(u, 0, 1)));
        a.head.material.opacity = a.p > 0.02 ? solid * S.opacity * (done ? Math.sin(Math.PI * u) : 1) : 0;
      });

      /* orbit */
      orbitMat.opacity = S.global * 0.7 * S.opacity;
      sat.material.opacity = S.global * S.opacity;
      const oa = time * 0.8;
      tmp.set(Math.cos(oa) * R * 1.32, Math.sin(oa) * R * 1.32, 0).applyEuler(orbit.rotation);
      sat.position.copy(tmp);
      orbit.rotation.z = time * 0.05;

      renderer.render(scene, camera);

      /* HTML labels */
      world.getWorldPosition(ctr);
      const W = window.innerWidth, H = window.innerHeight;
      const pts = labels.map((l) => {
        l.marker.getWorldPosition(tmp);
        const nrm = tmp.clone().sub(ctr).normalize();
        const facing = nrm.dot(cam.clone().sub(tmp).normalize());
        tmp.project(camera);
        return { x: ((tmp.x + 1) / 2) * W, y: ((1 - tmp.y) / 2) * H, facing };
      });
      const act = pts[labels.findIndex((l) => l.index === stepIdx)];
      labels.forEach((l, i) => {
        const p = pts[i];
        let o = S.labels * clamp((p.facing - 0.15) / 0.25);
        // hide labels that would collide with the active one
        if (act && l.index !== stepIdx && Math.abs(p.y - act.y) < 22 && p.x > act.x - 40 && p.x < act.x + 200) o = 0;
        l.el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) translate(2px, -50%)`;
        l.el.style.opacity = o.toFixed(3);
        l.el.style.pointerEvents = o > 0.5 ? "auto" : "none";
        l.el.classList.toggle("is-active", l.index === stepIdx);
      });
    }

    return { frame, onStep, resize };
  }

  /* ---------------------------------------------------------- hero motion */
  const depthEls = $$("[data-depth]");
  const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
  window.addEventListener("pointermove", (e) => {
    mouse.x = e.clientX / window.innerWidth - 0.5;
    mouse.y = e.clientY / window.innerHeight - 0.5;
  });

  /* ---------------------------------------------------------- main loop */
  const bridge = $("#bridge"), regions = $("#regions"), education = $("#education"), contact = $("#contact");
  const progress = $(".progress i");
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const vh = window.innerHeight;

    const bR = bridge.getBoundingClientRect();
    const rR = regions.getBoundingClientRect();
    const eR = education.getBoundingClientRect();
    const cR = contact.getBoundingClientRect();
    const scroll = {
      morph: clamp((vh * 0.9 - bR.top) / (bR.height * 0.7)),
      q: clamp((vh - rR.top) / vh),            // entering the globe chapter
      c: clamp((vh * 0.9 - eR.top) / (vh * 0.7)), // leaving it → ambient background
      f: clamp((vh * 0.9 - cR.top) / (vh * 0.8))  // contact → horizon finale
    };
    const maxScroll = document.documentElement.scrollHeight - vh;
    progress.style.transform = `scaleX(${maxScroll > 0 ? (window.scrollY / maxScroll).toFixed(4) : 0})`;

    /* bridge words light up one by one */
    const bp = clamp((vh * 0.55 - bR.top) / (bR.height - vh * 0.9));
    const lit = bp * bridgeWords.length;
    bridgeWords.forEach((w, i) => (w.style.opacity = (0.14 + 0.86 * clamp(lit - i)).toFixed(2)));

    /* hero parallax: mouse + scroll */
    mouse.sx = lerp(mouse.sx, mouse.x, 0.06);
    mouse.sy = lerp(mouse.sy, mouse.y, 0.06);
    const sy = window.scrollY;
    if (sy < vh * 1.3) {
      depthEls.forEach((el) => {
        const d = parseFloat(el.dataset.depth);
        el.style.transform = `translate3d(${(-mouse.sx * 26 * d).toFixed(2)}px, ${(-mouse.sy * 14 * d + sy * (0.42 - d * 0.28)).toFixed(2)}px, 0)`;
      });
    }

    globe.frame(now / 1000, dt, scroll);
    requestAnimationFrame(loop);
  }

  /* -------------------------------------------------------- scroll pinning */
  function setupScroll() {
    regionsST = ScrollTrigger.create({
      trigger: regions,
      start: "top top",
      end: () => "+=" + window.innerHeight * N * 0.85,
      pin: ".regions__pin",
      onUpdate: (self) => setStep(Math.min(N - 1, Math.floor(self.progress * N)))
    });

    /* 05 · Experience: vertical scroll drives a horizontal track (desktop only) */
    const track = $(".work__track"), bar = $(".work__bar i");
    const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
    gsap.matchMedia().add("(min-width: 901px)", () => {
      gsap.to(track, {
        x: () => -dist(), ease: "none",
        scrollTrigger: {
          trigger: "#work", start: "top top", end: () => "+=" + dist(), pin: ".work__pin", scrub: 0.6,
          invalidateOnRefresh: true,
          onUpdate: (self) => (bar.style.transform = `scaleX(${self.progress.toFixed(4)})`)
        }
      });
    });
    scrollReady = true;
  }

  /* -------------------------------------------------------------- contact */
  function setupContact() {
    const mail = $("#mail");
    mail.textContent = C.email;
    mail.href = "mailto:" + C.email;
    $("#xhs").href = C.xhs;
    const toast = $("#toast");
    $("#copy-mail").addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(C.email); }
      catch (e) {
        const ta = document.createElement("textarea"); ta.value = C.email; document.body.appendChild(ta); ta.select();
        try { document.execCommand("copy"); } catch (_) {} ta.remove();
      }
      toast.textContent = t("toast.copied");
      toast.classList.add("show");
      setTimeout(() => toast.classList.remove("show"), 1800);
    });
  }

  /* --------------------------------------------------------------- loader */
  function runLoader() {
    const lines = $("#loader .ld-lines"), count = $("#loader .ld-count span"), bar = $("#loader .ld-bar i");
    const img = $(".hero__portrait");
    const ready = Promise.all([
      img.decode ? img.decode().catch(() => {}) : Promise.resolve(),
      document.fonts ? document.fonts.ready : Promise.resolve(),
      new Promise((r) => setTimeout(r, REDUCED ? 0 : 1500))
    ]);
    const say = (txt, cls) => { const d = document.createElement("div"); d.innerHTML = `› ${txt}` + (cls ? ` <span class="${cls}">✓</span>` : ""); lines.appendChild(d); };
    say(t("loader.1"));
    const prog = { v: 0 };
    let assetsDone = false;
    ready.then(() => (assetsDone = true));
    const t0 = performance.now();
    return new Promise((resolve) => {
      const tick = () => {
        // time-based (not frame-based) so throttled tabs still finish on time
        const el = (performance.now() - t0) / 1000;
        const cap = assetsDone ? 100 : 88;
        prog.v = Math.min(cap, Math.max(prog.v, 100 * (1 - Math.exp(-el * 2.4))));
        if (assetsDone && el > 1.4) prog.v = Math.min(100, prog.v + 4);
        count.textContent = Math.round(prog.v);
        bar.style.width = prog.v + "%";
        if (prog.v > 30 && lines.children.length === 1) say(t("loader.2"));
        if (prog.v > 70 && lines.children.length === 2) say(t("loader.3"));
        if (prog.v >= 99.5) {
          count.textContent = "100";
          say(t("loader.ok"), "ok");
          setTimeout(resolve, REDUCED ? 0 : 280);
          return;
        }
        requestAnimationFrame(tick);
      };
      tick();
    });
  }

  function intro() {
    document.body.classList.remove("is-loading");
    const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
    tl.to("#loader", { yPercent: -100, duration: REDUCED ? 0.01 : 1.1, ease: "expo.inOut", onComplete: () => $("#loader").remove() })
      .from(".hero__portrait", { y: 120, opacity: 0, duration: 1.6 }, "-=0.45")
      .from(".hero__word", { yPercent: 40, opacity: 0, duration: 1.8 }, "<0.1")
      .from(".hero__sun", { scale: 0.6, opacity: 0, duration: 2 }, "<")
      .from(".hero__inner > *", { y: 26, opacity: 0, stagger: 0.08, duration: 1.1 }, "<0.25")
      .from(".hero__foot, .nav, .hero__cn", { opacity: 0, duration: 1 }, "<0.3");
    $$(".hero__name .decode").forEach((el, i) => setTimeout(() => decode(el, 1000 + i * 250), 900));
    setTimeout(() => ask(0), REDUCED ? 0 : 1500);
  }

  /* ----------------------------------------------------------------- boot */
  applyLang(L);
  setupContact();
  Sections.setupDog();
  setupScroll();
  window.addEventListener("load", () => ScrollTrigger.refresh());
  requestAnimationFrame(loop);
  runLoader().then(intro);
})();
