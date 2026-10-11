/* Renders chapters 02, 04–07 from window.CONTENT, plus scroll reveals, counters and the dog. */
window.Sections = (() => {
  "use strict";
  const C = window.CONTENT;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let L = "zh";
  const loc = (v) => (typeof v === "string" ? v : v[L]);
  const t = (k) => C.ui[L][k] || k;
  const bold = (s) => s.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");

  /* ------------------------------------------------------------ 02 About */
  function renderAbout() {
    $(".about__bio").innerHTML = bold(loc(C.about.bio));
    $(".mcard__tags").innerHTML = loc(C.about.tags).map((x) => `<span>${x}</span>`).join("");
    $(".mcard__rows").innerHTML = C.about.rows
      .map((r, i) => `<div style="--i:${i}"><dt>${loc(r.k)}</dt><dd>${r[L]}</dd></div>`).join("");
  }

  /* -------------------------------------------------------- 04 Education */
  function renderEdu() {
    const E = C.education, [a, b] = E.range;
    const pct = (y) => ((y - a) / (b - a)) * 100;
    let axis = "";
    for (let y = Math.ceil(a); y <= Math.floor(b); y++) axis += `<span style="left:${pct(y)}%">${y}</span>`;
    const rows = E.bars.map((bar, i) => {
      const s = pct(bar.start), e = pct(bar.end);
      const right = s > 45; // late bars anchor their label to the bar's end so it never overflows
      const pos = right ? `right:${100 - e}%` : `left:${s}%`;
      return `<div class="gantt__row">
        <div class="gantt__label${right ? " right" : ""}" style="${pos}"><b>${loc(bar.title)}</b><small>${loc(bar.sub)}</small></div>
        <div class="gantt__bar${bar.accent ? " accent" : ""}" style="left:${s}%;width:${e - s}%;--i:${i}"><em>${bar.label}</em></div>
      </div>`;
    }).join("");
    $(".gantt").innerHTML = `<div class="gantt__axis">${axis}</div>
      <div class="gantt__body"><div class="gantt__now" style="left:${pct(E.now)}%"><span>${t("edu.now")}</span></div>${rows}</div>`;
    $(".tokens").innerHTML = E.groups.map((g, gi) => `
      <div class="tokens__group" data-reveal style="--i:${gi}">
        <span class="lbl">${loc(g.k)}</span>
        <div>${g.items.map((it, i) => `<span class="token" style="--i:${i}">${loc(it)}</span>`).join("")}</div>
      </div>`).join("");
  }

  /* ------------------------------------------------------- 05 Experience */
  function pipelineSVG(v) {
    const nodes = v.nodes[L], xs = nodes.map((_, i) => 50 + i * 135), y = 78, r = 32;
    const links = xs.slice(0, -1).map((x, i) => `<line class="link" x1="${x + r}" y1="${y}" x2="${xs[i + 1] - r}" y2="${y}"/>`).join("");
    const loopD = `M${xs[4]},${y + r} C${xs[4]},${y + 140} ${xs[0]},${y + 140} ${xs[0]},${y + r}`;
    const motion = `M${xs[0]},${y} L${xs[4]},${y} L${xs[4]},${y + r} C${xs[4]},${y + 140} ${xs[0]},${y + 140} ${xs[0]},${y + r} Z`;
    const toks = [0, 1.4, 2.8].map((d) => `<circle class="tok" r="4"><animateMotion dur="4.2s" begin="-${d}s" repeatCount="indefinite" path="${motion}"/></circle>`).join("");
    const ns = nodes.map((n, i) => `<g class="node"><circle cx="${xs[i]}" cy="${y}" r="${r}"/>
      <text class="n" x="${xs[i]}" y="${y + 5}">0${i + 1}</text><text x="${xs[i]}" y="${y + r + 28}">${n}</text></g>`).join("");
    return `<svg class="pipe" viewBox="0 -8 640 250" role="img" aria-label="${nodes.join(" → ")}">
      ${links}<path class="loop" d="${loopD}"/>${ns}${toks}
      <text class="loopl" x="320" y="${y + 128}">↺ ${loc(v.loop)}</text></svg>`;
  }
  function baHTML(before, after, afterLabel) {
    const max = Math.max(before, after);
    return `<div class="ba">
      <div class="ba__row"><span>Before</span><div class="ba__track"><i style="--w:${(before / max) * 100}%"></i></div><b>${before}%</b></div>
      <div class="ba__row after"><span>After</span><div class="ba__track"><i style="--w:${(after / max) * 100}%"></i></div><b>${afterLabel}</b></div>
    </div>`;
  }
  function chipFlow(items) {
    return `<div class="chip-flow">${items.map((c, i) => (i ? "<i>→</i>" : "") + `<span class="${i === items.length - 1 ? "ok" : ""}">${c}</span>`).join("")}</div>`;
  }
  function vizHTML(v) {
    if (v.type === "pipeline") return pipelineSVG(v);
    if (v.type === "beforeafter") return `<span class="lbl">${loc(v.metric)}</span>${baHTML(v.before, v.after, v.afterLabel)}${chipFlow(v.chain[L])}`;
    if (v.type === "gauge") {
      const neg = v.neg ? `<span class="lbl">${loc(v.neg.metric)}</span>${baHTML(v.neg.before, v.neg.after, v.neg.afterLabel)}` : "";
      return `<div class="gauge">
          <svg viewBox="0 0 160 160"><defs><linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d9b77e"/><stop offset="1" stop-color="#ff7a59"/></linearGradient></defs>
            <circle class="bg" cx="80" cy="80" r="66" fill="none" stroke-width="10" pathLength="100"/>
            <circle class="fg" cx="80" cy="80" r="66" fill="none" stroke-width="10" pathLength="100" style="--off:${100 - v.value}"/></svg>
          <div><div class="gauge__num">${v.value}<small>%+</small></div><span class="lbl">${loc(v.label)}</span></div>
        </div>${chipFlow(v.flow[L])}${neg}`;
    }
    return "";
  }
  function renderWork() {
    const pad = (n) => String(n).padStart(2, "0");
    const cases = C.cases.map((c, i) => `
      <article class="case panel">
        <div class="case__text">
          <div class="case__meta"><span class="ck">${pad(i + 1)} / ${pad(C.cases.length)}</span><span>${loc(c.date)}</span></div>
          <div class="case__org">${loc(c.org)}</div>
          <div class="case__role">${loc(c.role)}</div>
          <h3 class="case__title">${loc(c.title)}</h3>
          <div class="case__pars">
            <div><span class="lbl">${t("case.p")}</span><p>${loc(c.p)}</p></div>
            <div><span class="lbl">${t("case.a")}</span><p>${loc(c.a)}</p></div>
            <div class="r"><span class="lbl">${t("case.r")}</span><p>${loc(c.r)}</p></div>
          </div>
          ${c.also ? `<p class="case__also"><span class="lbl">${t("case.also")}</span> · ${loc(c.also)}</p>` : ""}
        </div>
        <div class="case__viz" data-reveal>${vizHTML(c.viz)}</div>
      </article>`).join("");
    const earlier = `
      <article class="case case--earlier panel">
        <div>
          <div class="case__meta"><span class="ck">2022 — 2025</span></div>
          <h3 class="case__title">${t("work.earlier")}</h3>
          <div class="earlier">${C.earlier.map((e) => `<div><span class="d">${e.date}</span>
            <div><b>${loc(e.org)}</b><small>${loc(e.role)}</small><p>${loc(e.line)}</p></div></div>`).join("")}</div>
        </div>
      </article>`;
    $(".work__track").innerHTML = cases + earlier;
  }

  /* ------------------------------------------------------- 06 Highlights */
  function renderBench() {
    $(".bento").innerHTML = C.bench.map((b, i) => {
      const cls = `tile panel ${b.size || ""}`;
      const label = `<div class="tile__label">${loc(b.label)}</div><div class="tile__sub">${loc(b.sub)}</div>`;
      if (b.before != null) {
        return `<div class="${cls}" data-reveal style="--i:${i % 4}"><div>${label}</div>${baHTML(b.before, b.after, b.afterLabel)}</div>`;
      }
      const num = b.text != null ? b.text
        : `${b.pre ? `<small>${b.pre}</small>` : ""}<span data-count="${b.num}">${REDUCED ? b.num.toLocaleString("en-US") : 0}</span>${b.suf ? `<small>${b.suf}</small>` : ""}`;
      return `<div class="${cls}" data-reveal style="--i:${i % 4}"><div class="tile__num">${num}</div><div>${label}</div></div>`;
    }).join("");
  }

  /* ------------------------------------------------------------- 07 Life */
  function renderLife() {
    const F = C.life;
    $(".life__grid").innerHTML = `
      <div class="xhs panel" data-reveal>
        <div class="xhs__top"><div class="xhs__logo">小红书</div>
          <div><div class="xhs__name">${loc(F.xhs.title)}</div><div class="tile__sub">@柔小柔鸭</div></div></div>
        <div><div class="xhs__num"><span data-count="4000">${REDUCED ? "4,000" : 0}</span><small>${L === "zh" ? "粉丝" : "followers"}</small></div>
          <div class="tile__label">${loc(F.xhs.sub)}</div></div>
        <svg viewBox="0 0 300 110" preserveAspectRatio="none" aria-hidden="true">
          <defs><linearGradient id="xhsGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff2442" stop-opacity=".35"/><stop offset="1" stop-color="#ff2442" stop-opacity="0"/></linearGradient></defs>
          <path class="area" d="M0,108 C60,106 110,100 150,80 C190,58 230,30 300,6 L300,110 L0,110 Z"/>
          <path class="curve" pathLength="1" d="M0,108 C60,106 110,100 150,80 C190,58 230,30 300,6"/>
        </svg>
        <a class="btn" href="${C.xhs}" target="_blank" rel="noopener"><span class="dot" style="background:#ff2442"></span>${loc(F.xhs.cta)} ↗</a>
      </div>
      <div class="life__photo" data-reveal style="--i:1">
        <figure class="polaroid"><img src="assets/img/portrait-extended.jpg" alt="" loading="lazy" width="760" height="1013"><p>${loc(F.photo)}</p></figure>
      </div>
      <div class="life__col">
        <div class="mini panel" data-reveal style="--i:2"><span class="lbl">${loc(F.langTitle)}</span>
          <div class="langs">${F.langs.map((x) => `<div><b>${x.name}</b><span>${loc(x.lv)}</span></div>`).join("")}</div></div>
        <div class="mini panel" data-reveal style="--i:3"><span class="lbl">${loc(F.ops.title)}</span><p>${loc(F.ops.text)}</p></div>
        <div class="mini panel hint" data-reveal style="--i:4"><span class="lbl">🐕 easter egg</span><p>${t("life.dog")}</p></div>
      </div>`;
  }

  /* ------------------------------------------------ reveals and counters */
  function countUp(el) {
    const target = +el.dataset.count;
    if (REDUCED) { el.textContent = target.toLocaleString("en-US"); return; }
    const t0 = performance.now(), dur = 1600;
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      const e = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      el.textContent = Math.round(target * e).toLocaleString("en-US");
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  let io;
  function observe() {
    if (!io) {
      io = new IntersectionObserver((entries) => entries.forEach((en) => {
        if (!en.isIntersecting) return;
        en.target.classList.add("in");
        $$("[data-count]", en.target).forEach(countUp);
        io.unobserve(en.target);
      }), { threshold: 0.15, rootMargin: "0px 0px -6% 0px" });
    }
    $$("[data-reveal]:not(.in)").forEach((el) => io.observe(el));
  }

  /* ----------------------------------------------------------------- dog */
  // 红棕色五红土松犬: fluffy red-brown coat, prick ears, curled tail, and (the "five reds") a red-brown nose, not black.
  const DOG = `<svg viewBox="0 0 82 58" aria-hidden="true">
    <g class="tail"><path d="M58 30 C54 17 70 9 75 19 C78 27 67 30 66 24" fill="none" stroke="#c0602e" stroke-width="8.5" stroke-linecap="round"/>
      <path d="M60 27 C58 18 69 13 72 20" fill="none" stroke="#e08a4f" stroke-width="2.6" stroke-linecap="round"/></g>
    <rect class="lb" x="30" y="38" width="6.5" height="16" rx="3.2" fill="#8e3f1e"/>
    <rect class="la" x="50" y="38" width="6.5" height="16" rx="3.2" fill="#8e3f1e"/>
    <ellipse cx="42" cy="35" rx="19.5" ry="11.5" fill="#c0602e"/>
    <ellipse cx="44" cy="41.5" rx="13" ry="4.5" fill="#d9773d"/>
    <rect class="la" x="23" y="39" width="6.5" height="16" rx="3.2" fill="#b65829"/>
    <rect class="lb" x="56" y="38" width="6.5" height="16" rx="3.2" fill="#b65829"/>
    <ellipse cx="26" cy="33" rx="10" ry="12" fill="#d06b35"/>
    <path d="M19 13 L21.5 1.5 L28.5 12.5 Z" fill="#9a4521"/>
    <circle cx="20" cy="22" r="11" fill="#c0602e"/>
    <path d="M12.5 15 L13 2.5 L21 12 Z" fill="#c0602e"/>
    <path d="M14.3 13 L14.6 6 L18.8 11.4 Z" fill="#eba374"/>
    <ellipse cx="23.5" cy="29" rx="8" ry="5" fill="#d06b35"/>
    <ellipse cx="10" cy="26" rx="7.6" ry="4.8" fill="#d9773d"/>
    <ellipse cx="3.6" cy="25" rx="2.5" ry="2.1" fill="#6b2f1a"/>
    <path d="M5 29.2 q3 2.2 6.6 .4" stroke="#6b2f1a" stroke-width="1.2" fill="none" stroke-linecap="round"/>
    <ellipse cx="15" cy="20" rx="1.8" ry="2" fill="#2b140a"/><circle cx="14.4" cy="19.3" r=".6" fill="#fff"/>
  </svg>`;
  function runDog(delay = 0, size = 64, talk = true) {
    const d = document.createElement("div");
    d.className = "dog-run";
    d.style.width = size + "px";
    d.style.height = size * 0.71 + "px";
    d.style.animationDelay = delay + "s";
    d.style.setProperty("--dur", 3.8 + Math.random() * 1.6 + "s");
    d.innerHTML = DOG + (talk ? `<b>${t("dog.woof")}</b>` : "");
    document.body.appendChild(d);
    d.addEventListener("animationend", (e) => e.target === d && d.remove());
  }
  function parade() { for (let i = 0; i < 6; i++) runDog(i * 0.4, 46 + Math.random() * 28, i === 0); }
  function setupDog() {
    const btn = $("#dog");
    btn.innerHTML = DOG;
    let clicks = 0;
    btn.addEventListener("click", () => { clicks++; clicks % 3 === 0 ? parade() : runDog(); });
    let buf = "";
    window.addEventListener("keydown", (e) => {
      if (e.key.length !== 1) return;
      buf = (buf + e.key.toLowerCase()).slice(-4);
      if (buf.endsWith("dog") || buf === "wang") { parade(); buf = ""; }
    });
    console.log("%cYirou Tie · 铁亦柔", "font: italic 28px serif; color:#d9b77e",
      "\nHi, curious one 👋  You found the console. Try typing \"dog\" on the page.");
  }

  function render(lang) {
    L = lang;
    renderAbout(); renderEdu(); renderWork(); renderBench(); renderLife();
    observe();
  }
  return { render, setupDog };
})();
