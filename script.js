(() => {
  const root = document.documentElement;
  const motion = root.classList.contains("motion");
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  $$("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));

  /* ---------------------------------------------------------------------------
     Living pixel grid: a slow glowing ring of square cells, brighter near the
     cursor, that turns and drifts as you scroll.
     ------------------------------------------------------------------------ */
  const canvas = $(".pixels");
  const ctx = canvas.getContext("2d");
  const CELL = 22;
  let W = 0, H = 0, dpr = 1, mx = -9999, my = -9999, last = 0;
  function sizeCanvas() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
  function drawPixels(t) {
    ctx.clearRect(0, 0, W, H);
    const s = scrollY;
    const cx = W * 0.5 + Math.sin(t * 0.00012 + s * 0.0006) * W * 0.12;
    const cy = H * 0.5 + Math.cos(t * 0.0001 + s * 0.0009) * H * 0.1;
    const R = Math.min(W, H) * 0.36;
    const spin = t * 0.00015 + s * 0.0015;
    // Full strength behind the hero, quieter behind reading sections.
    const dim = 1 - 0.5 * clamp(s / H, 0, 1);
    const cols = Math.ceil(W / CELL) + 1, rows = Math.ceil(H / CELL) + 1;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const x = i * CELL + CELL / 2, y = j * CELL + CELL / 2;
        const dx = x - cx, dy = y - cy;
        const d = Math.sqrt(dx * dx + dy * dy);
        const ring = Math.exp(-(((d - R) / (R * 0.24)) ** 2));
        const ang = Math.atan2(dy, dx);
        const arc = 0.45 + 0.55 * Math.max(0, Math.sin(ang * 2 + spin));
        const h = hash(i, j);
        const twinkle = 0.85 + 0.15 * Math.sin(t * 0.0012 + h * 6.28);
        const mdx = x - mx, mdy = y - my;
        const glow = Math.exp(-(mdx * mdx + mdy * mdy) / (150 * 150)) * 0.55;
        let v = ring * arc * twinkle + glow + h * 0.035;
        v = Math.round(clamp(v, 0, 1) * 7) / 7; // quantise for the blocky look
        if (v < 0.05) continue;
        const a = v * 0.42 * dim;
        ctx.fillStyle = v > 0.55 ? `rgba(110,226,200,${a})` : `rgba(66,160,150,${a})`;
        ctx.fillRect(i * CELL + 1, j * CELL + 1, CELL - 2, CELL - 2);
      }
    }
  }
  function loop(t) {
    if (!document.hidden && t - last > 33) { drawPixels(t); last = t; }
    requestAnimationFrame(loop);
  }
  sizeCanvas();
  addEventListener("resize", () => { sizeCanvas(); if (!motion) drawPixels(0); });
  if (motion) {
    requestAnimationFrame(loop);
    if (finePointer) addEventListener("pointermove", (e) => { mx = e.clientX; my = e.clientY; }, { passive: true });
  } else {
    drawPixels(0);
  }

  /* ---------------------------------------------------------------------------
     Headings build in word by word; stagger groups reveal one after another.
     ------------------------------------------------------------------------ */
  $$("[data-split]").forEach((el) => {
    const text = el.textContent.trim();
    el.setAttribute("aria-label", text);
    el.innerHTML = text.split(/\s+/)
      .map((w, i) => `<span class="w" aria-hidden="true"><span style="--i:${i}">${w}</span></span>`)
      .join(" ");
    if (el.tagName === "H1") el.style.setProperty("--base", "150ms");
  });
  $$("[data-stagger]").forEach((group) => {
    [...group.children].forEach((child, i) => {
      child.classList.add("reveal");
      child.style.setProperty("--d", `${i * 110}ms`);
    });
  });

  function countUp(el) {
    const end = Number(el.dataset.count);
    const prefix = el.dataset.prefix || "";
    const start = el.hasAttribute("data-plain") ? end - 12 : 0;
    const holder = el.closest(".reveal");
    const delay = holder ? parseInt(getComputedStyle(holder).getPropertyValue("--d"), 10) || 0 : 0;
    el.textContent = prefix + start;
    setTimeout(() => {
      const t0 = performance.now();
      const tick = (t) => {
        const k = clamp((t - t0) / 1400, 0, 1);
        el.textContent = prefix + Math.round(start + (end - start) * (1 - Math.pow(1 - k, 4)));
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, delay);
  }

  const watched = ".reveal, [data-split], [data-count], .mini-ui, .stairs, .langs";
  if (motion && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add("in");
        if (e.target.dataset.count) countUp(e.target);
        io.unobserve(e.target);
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -6% 0px" });
    $$(watched).forEach((el) => io.observe(el));
  } else {
    $$(watched).forEach((el) => el.classList.add("in"));
  }

  /* ---------------------------------------------------------------------------
     Hero: rotating word and a terminal that types HR commands.
     ------------------------------------------------------------------------ */
  async function typeLoop(el, items, { typeMs = 70, eraseMs = 35, hold = 1600 } = {}) {
    let i = 0;
    for (;;) {
      const word = items[i % items.length];
      for (let k = 1; k <= word.length; k++) { el.textContent = word.slice(0, k); await wait(typeMs); }
      await wait(hold);
      for (let k = word.length; k >= 0; k--) { el.textContent = word.slice(0, k); await wait(eraseMs); }
      await wait(250);
      i++;
    }
  }
  const rot = $(".rot-word");
  const commands = [
    "onboard --new-hire --team=delivery",
    "attendance review --month=current",
    "mepps tally --month=end --send=finance",
    "sync clients --accounts=20",
    "interviews schedule --this-week",
  ];
  const term = $(".term-text");
  if (motion) {
    typeLoop(rot, rot.dataset.words.split("|"), { typeMs: 80, hold: 1500 });
    setTimeout(() => typeLoop(term, commands, { typeMs: 45, eraseMs: 18, hold: 1400 }), 900);
  } else {
    term.textContent = commands[0];
  }

  /* ---------------------------------------------------------------------------
     MEPPS map: drag the RR mark onto the map (or click it) to switch it on.
     ------------------------------------------------------------------------ */
  const map = $(".map");
  const svg = $(".map-lines");
  const token = $(".token");
  const story = $(".map-story");
  const cDisputes = $(".c-disputes");
  const cPoints = $(".c-points");
  const links = [["late", "points"], ["deadline", "points"], ["helped", "points"], ["points", "review"], ["review", "deduct"], ["review", "reward"], ["review", "fair"]];
  const node = (k) => $(`[data-node="${k}"]`, map);
  const storyOff = story.innerHTML;
  const storyOn = "MEPPS on. The late check-in and the missed deadline are logged as points, and the teammate who helped gets credit. At month end I review the totals and finance applies them. <strong>Same written rules for everyone, nothing left to argue about.</strong> Click the mark again to switch it off.";

  function drawLines() {
    const r = map.getBoundingClientRect();
    svg.setAttribute("viewBox", `0 0 ${r.width} ${r.height}`);
    svg.innerHTML = links.map(([a, b]) => {
      const ra = node(a).getBoundingClientRect(), rb = node(b).getBoundingClientRect();
      const x1 = ra.right - r.left, y1 = ra.top + ra.height / 2 - r.top;
      const x2 = rb.left - r.left, y2 = rb.top + rb.height / 2 - r.top;
      const mx2 = (x1 + x2) / 2;
      return `<path d="M${x1} ${y1} C${mx2} ${y1}, ${mx2} ${y2}, ${x2} ${y2}"/>`;
    }).join("");
  }
  drawLines();
  addEventListener("resize", drawLines);
  document.fonts?.ready.then(drawLines);

  function animateNumber(el, from, to, ms) {
    if (!motion) { el.textContent = to; return; }
    const t0 = performance.now();
    const step = (t) => {
      const k = clamp((t - t0) / ms, 0, 1);
      el.textContent = Math.round(from + (to - from) * k);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  const order = [["late", "deadline", "helped"], ["points"], ["review"], ["deduct", "reward", "fair"]];
  let mapOn = false, busy = false;
  async function setMap(on) {
    if (busy || on === mapOn) return;
    busy = true; mapOn = on;
    map.dataset.state = on ? "on" : "off";
    token.classList.toggle("used", on);
    token.setAttribute("aria-label", on ? "Switch MEPPS off" : "Switch MEPPS on");
    story.innerHTML = on ? storyOn : storyOff;
    animateNumber(cDisputes, on ? 3 : 0, on ? 0 : 3, 1500);
    animateNumber(cPoints, on ? 0 : 3, on ? 3 : 0, 1500);
    cDisputes.style.color = on ? "var(--dim)" : "";
    for (const group of on ? order : [...order].reverse()) {
      for (const k of group) {
        const n = node(k);
        n.classList.toggle("lit", on);
        const b = $(".badge", n);
        b.textContent = on ? b.dataset.on : b.dataset.off;
        if (motion) await wait(140);
      }
      if (motion) await wait(160);
    }
    busy = false;
  }

  // Dragging the token
  let drag = null;
  token.addEventListener("pointerdown", (e) => {
    drag = { x: e.clientX, y: e.clientY, moved: false };
    token.setPointerCapture(e.pointerId);
    token.classList.add("dragging");
  });
  token.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 6) drag.moved = true;
    token.style.transform = `translate(${dx}px, ${dy}px) scale(1.08)`;
    const r = map.getBoundingClientRect();
    map.classList.toggle("drop-hover", e.clientX > r.left && e.clientX < r.right && e.clientY > r.top && e.clientY < r.bottom);
  });
  token.addEventListener("pointerup", (e) => {
    if (!drag) return;
    const overMap = map.classList.contains("drop-hover");
    const wasDrag = drag.moved;
    drag = null;
    token.classList.remove("dragging");
    map.classList.remove("drop-hover");
    token.style.transition = "transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)";
    token.style.transform = "";
    setTimeout(() => (token.style.transition = ""), 500);
    if (wasDrag) { if (overMap) setMap(true); }
    else setMap(!mapOn);
  });
  token.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setMap(!mapOn); }
  });

  /* ---------------------------------------------------------------------------
     Sample-month simulator
     ------------------------------------------------------------------------ */
  const sim = $(".sim");
  const needle = $(".needle", sim);
  const scoreEl = $(".score", sim);
  const scoreN = $(".score-n", sim);
  const verdict = $(".verdict", sim);
  let shown = 0;
  const fmt = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");
  function updateSim(animate) {
    const total = $$(".ev[aria-pressed='true']", sim).reduce((s, b) => s + Number(b.dataset.points), 0);
    needle.style.setProperty("--a", `${(clamp(total, -10, 10) / 10) * 90}deg`);
    scoreEl.style.setProperty("--c", total > 0 ? "var(--pos)" : total < 0 ? "var(--neg)" : "var(--text)");
    verdict.textContent = total > 0 ? "Reward: finance adds it to this month's pay."
      : total < 0 ? "Deduction: finance takes it from this month's pay."
      : "Neutral month: no reward and no deduction.";
    if (!animate || !motion) { scoreN.textContent = fmt(total); shown = total; return; }
    const from = shown, t0 = performance.now();
    const step = (t) => {
      const k = clamp((t - t0) / 450, 0, 1);
      scoreN.textContent = fmt(Math.round(from + (total - from) * k));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    shown = total;
    scoreEl.classList.remove("bump"); void scoreEl.offsetWidth; scoreEl.classList.add("bump");
  }
  $$(".ev", sim).forEach((b) => b.addEventListener("click", () => {
    b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") === "true" ? "false" : "true");
    updateSim(true);
  }));
  updateSim(false);

  /* ---------------------------------------------------------------------------
     Five layers: the stack opens as you scroll; hover or click picks a layer.
     ------------------------------------------------------------------------ */
  const layersSec = $(".layers-sec");
  const layers = $$(".layer").sort((a, b) => a.dataset.i - b.dataset.i);
  const detail = {
    num: $(".ld-num"), name: $(".ld-name"), desc: $(".ld-desc"), items: $(".ld-items"),
  };
  // Higher layers sit on top, so each lower layer's label shows below the one above it.
  layers.forEach((l) => (l.style.zIndex = Number(l.dataset.i) + 1));
  let hoverLayer = null, shownLayer = -1;
  function showLayer(i) {
    if (i === shownLayer) return;
    shownLayer = i;
    layers.forEach((l) => l.classList.toggle("active", Number(l.dataset.i) === i));
    const l = layers[i];
    detail.num.textContent = `LAYER 0${i + 1} OF 5`;
    detail.name.textContent = l.dataset.name;
    detail.desc.textContent = l.dataset.desc;
    detail.items.innerHTML = "";
    l.dataset.items.split("|").forEach((t) => {
      const li = document.createElement("li");
      li.textContent = t;
      detail.items.appendChild(li);
    });
  }
  const wideLayout = () => innerWidth >= 900 && motion;
  function updateLayers() {
    let p = 1;
    if (wideLayout()) {
      const r = layersSec.getBoundingClientRect();
      p = clamp(-r.top / (r.height - innerHeight), 0, 1);
    }
    const gap = 14 + clamp(p / 0.45, 0, 1) * (innerWidth < 600 ? 34 : 58);
    layers.forEach((l) => l.style.setProperty("--y", `${(2 - Number(l.dataset.i)) * gap}px`));
    if (hoverLayer === null && wideLayout()) showLayer(clamp(Math.floor(((p - 0.25) / 0.7) * 5), 0, 4));
  }
  layers.forEach((l) => {
    const pick = () => { hoverLayer = Number(l.dataset.i); showLayer(hoverLayer); };
    l.addEventListener("pointerenter", pick);
    l.addEventListener("focus", pick);
    l.addEventListener("click", pick);
  });
  $(".stack").addEventListener("pointerleave", () => { hoverLayer = null; updateLayers(); });
  showLayer(0);

  /* ---------------------------------------------------------------------------
     Horizontal case study: the row slides sideways while you scroll down.
     ------------------------------------------------------------------------ */
  const hs = $(".hscroll");
  const track = $(".hs-track");
  const hsBar = $(".hs-progress span");
  function updateHs() {
    const useStatic = !motion || innerWidth < 760;
    hs.classList.toggle("static", useStatic);
    if (useStatic) { track.style.transform = ""; return; }
    const r = hs.getBoundingClientRect();
    const p = clamp(-r.top / (r.height - innerHeight), 0, 1);
    const dist = Math.max(0, track.scrollWidth - innerWidth);
    track.style.transform = `translate3d(${-p * dist}px, 0, 0)`;
    hsBar.style.setProperty("--p", p);
  }

  let ticking = false;
  function onScroll() { ticking = false; updateLayers(); updateHs(); }
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  addEventListener("resize", onScroll);
  onScroll();

  /* ---------------------------------------------------------------------------
     Experience rows open and close.
     ------------------------------------------------------------------------ */
  $$(".row-head").forEach((head) => head.addEventListener("click", () => {
    const row = head.closest(".row");
    const open = !row.classList.contains("open");
    row.classList.toggle("open", open);
    head.setAttribute("aria-expanded", open);
  }));

  /* ---------------------------------------------------------------------------
     Dock: highlight the section on screen.
     ------------------------------------------------------------------------ */
  const dockLinks = $$(".dock a");
  const dockFor = { top: "#top", numbers: "#top", about: "#about", mepps: "#mepps", how: "#how", highlights: "#how", experience: "#experience", work: "#work", skills: "#skills", education: "#skills", contact: "#contact" };
  if ("IntersectionObserver" in window) {
    const sio = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const target = dockFor[e.target.id];
        dockLinks.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === target));
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    $$("main > section[id]").forEach((s) => sio.observe(s));
  }

  /* ---------------------------------------------------------------------------
     Copy email, with a burst of teal confetti.
     ------------------------------------------------------------------------ */
  $$("[data-copy]").forEach((button) => {
    const label = button.textContent;
    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(button.dataset.copy);
        button.textContent = "Copied!";
        if (motion) burst(button);
      } catch {
        button.textContent = button.dataset.copy;
      }
      setTimeout(() => (button.textContent = label), 2000);
    });
  });
  function burst(el) {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const colors = ["#5cd6bb", "#e9e6f2", "#8b7dff", "#2fa58b"];
    for (let i = 0; i < 24; i++) {
      const d = document.createElement("span");
      d.className = "burst";
      d.style.left = `${cx}px`; d.style.top = `${cy}px`;
      d.style.background = colors[i % colors.length];
      document.body.appendChild(d);
      const a = (Math.PI * 2 * i) / 24 + Math.random() * 0.4;
      const dist = 60 + Math.random() * 80;
      d.animate([
        { transform: "translate(-50%, -50%) rotate(0) scale(1)", opacity: 1 },
        { transform: `translate(calc(-50% + ${Math.cos(a) * dist}px), calc(-50% + ${Math.sin(a) * dist + 30}px)) rotate(${Math.random() * 360}deg) scale(0.3)`, opacity: 0 },
      ], { duration: 800 + Math.random() * 400, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }).onfinish = () => d.remove();
    }
  }

  if (!motion || !finePointer) { root.classList.add("ready"); return; }

  // Spotlight on cards
  $$(".spot").forEach((card) => card.addEventListener("pointermove", (e) => {
    const r = card.getBoundingClientRect();
    card.style.setProperty("--mx", `${e.clientX - r.left}px`);
    card.style.setProperty("--my", `${e.clientY - r.top}px`);
  }));

  // Magnetic buttons
  $$(".magnetic").forEach((btn) => {
    btn.addEventListener("pointermove", (e) => {
      const r = btn.getBoundingClientRect();
      btn.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.25}px, ${(e.clientY - r.top - r.height / 2) * 0.35}px)`;
    });
    btn.addEventListener("pointerleave", () => (btn.style.transform = ""));
  });

  root.classList.add("ready");
})();
