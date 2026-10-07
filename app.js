(() => {
  const root = document.documentElement;
  const motion = root.classList.contains("motion");
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  // framer-motion-equivalent spring (semi-implicit Euler, 1ms sub-steps). set() retargets and keeps velocity.
  function spring(cfg, onUpdate, from = 0) {
    const k = cfg.stiffness, c = cfg.damping, m = cfg.mass || 1;
    let x = from, v = 0, target = from, raf = 0, last = 0, done = null;
    const tick = (now) => {
      const dt = Math.min(0.064, (now - last) / 1000); last = now;
      const n = Math.max(1, Math.ceil(dt / 0.001)), h = dt / n;
      for (let i = 0; i < n; i++) { const a = (-k * (x - target) - c * v) / m; v += a * h; x += v * h; }
      const big = Math.abs(cfg.span ?? (target - from)) >= 5;
      if (Math.abs(v) < (big ? 2 : 0.01) && Math.abs(target - x) < (big ? 0.5 : 0.005)) {
        x = target; v = 0; raf = 0; onUpdate(x); const d = done; done = null; d && d(); return;
      }
      onUpdate(x); raf = requestAnimationFrame(tick);
    };
    return {
      set(t, cb) { from = x; target = t; done = cb || null; if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } },
      jump(t) { cancelAnimationFrame(raf); raf = 0; x = target = from = t; v = 0; onUpdate(x); },
      get value() { return x; }, get target() { return target; },
    };
  }
  const SP_DOCK_TIP = { stiffness: 120, damping: 18 };
  const SP_DOCK_ICON = { stiffness: 300, damping: 24 };
  const SP_MAGNET = { stiffness: 260, damping: 18 };
  const SP_TAP = { stiffness: 500, damping: 25 };
  const SP_CAROUSEL = { stiffness: 92.1427, damping: 16.5104 };
  /* Framer-style springs with a shared ticker (stiffness/damping, mass 1, retarget keeps velocity) */
  const SPRINGS = new Set(), DIRTY = new Set();
  let sprRaf = 0, sprLast = 0;
  function sprTick(now) {
    const dt = Math.max(0, Math.min(64, now - sprLast)); sprLast = now;
    SPRINGS.forEach((s) => {
      for (let t = 0; t < dt; t += 1) {
        const h = Math.min(1, dt - t) / 1000;
        s.v += (-s.k * (s.x - s.to) - s.c * s.v) * h;
        s.x += s.v * h;
      }
      if (Math.abs(s.v) <= s.rs && Math.abs(s.to - s.x) <= s.rd) { s.x = s.to; s.v = 0; SPRINGS.delete(s); const d = s.done; s.done = null; d && d(); }
      if (s.owner) DIRTY.add(s.owner);
    });
    DIRTY.forEach((f) => f()); DIRTY.clear();
    sprRaf = SPRINGS.size ? requestAnimationFrame(sprTick) : 0;
  }
  function springB(x, owner, k = 100, c = 10) {
    const s = { x, v: 0, to: x, k, c, rs: 0.01, rd: 0.005, owner, done: null };
    s.set = (to, o = {}) => {
      if (o.k) s.k = o.k; if (o.c) s.c = o.c; if (o.v !== undefined) s.v = o.v;
      s.to = to;
      const big = Math.abs(to - s.x) >= 5;
      s.rs = o.rs ?? (big ? 2 : 0.01); s.rd = o.rd ?? (big ? 0.5 : 0.005);
      if (to === s.x && !s.v) { SPRINGS.delete(s); owner && owner(); const d = s.done; s.done = null; d && d(); return s; }
      SPRINGS.add(s);
      if (!sprRaf) { sprLast = performance.now(); sprRaf = requestAnimationFrame(sprTick); }
      return s;
    };
    s.jump = (val, v = 0) => { s.x = s.to = val; s.v = v; SPRINGS.delete(s); owner && owner(); };
    s.stop = () => SPRINGS.delete(s);
    return s;
  }
  const EASE_IO = "cubic-bezier(.42,0,.58,1)";
  /* ---------- framer-like helpers (shared by map, stack, products) ---------- */
  const NS = "http://www.w3.org/2000/svg";
  const EO_CSS = "cubic-bezier(0,0,.58,1)";            // framer "easeOut" (default when only duration is given)
  function bezier(x1, y1, x2, y2) {
    const ax = 1 - 3 * x2 + 3 * x1, bx = 3 * x2 - 6 * x1, cx = 3 * x1;
    const ay = 1 - 3 * y2 + 3 * y1, by = 3 * y2 - 6 * y1, cy = 3 * y1;
    const X = (t) => ((ax * t + bx) * t + cx) * t, Y = (t) => ((ay * t + by) * t + cy) * t;
    return (x) => {
      if (x <= 0) return 0; if (x >= 1) return 1;
      let lo = 0, hi = 1, t = x;
      for (let i = 0; i < 30; i++) { const d = X(t) - x; if (Math.abs(d) < 1e-6) break; d > 0 ? (hi = t) : (lo = t); t = (lo + hi) / 2; }
      return Y(t);
    };
  }
  const EASE_OUT = bezier(0, 0, .58, 1);
  // A motion value: spring (mass 1, same rest rules as framer) or tween/keyframes, with carried velocity.
  function mv(init, apply) {
    let x = init, v = 0, raf = 0;
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };
    const loop = (fn) => { const f = (t) => { raf = fn(t) === false ? 0 : requestAnimationFrame(f); }; raf = requestAnimationFrame(f); };
    const api = {
      get: () => x,
      stop,
      set(val) { stop(); x = val; v = 0; apply(x); },
      spring(to, k, c, restDelta, restSpeed) {
        stop();
        const g = Math.abs(to - x) < 5;                        // framer: "granular" springs rest tighter
        const rd = restDelta ?? (g ? 0.005 : 0.5), rs = restSpeed ?? (g ? 0.01 : 2);
        let last = performance.now();
        loop((t) => {
          const dt = Math.min(0.05, Math.max(0, t - last) / 1000); last = t;
          const n = Math.max(1, Math.ceil(dt * 240)), h = dt / n;
          for (let i = 0; i < n; i++) { v += (-k * (x - to) - c * v) * h; x += v * h; }
          if (Math.abs(to - x) <= rd && Math.abs(v) <= rs) { x = to; v = 0; apply(x); return false; }
          apply(x);
        });
      },
      run(fn, dur, { repeat = false, delay = 0 } = {}) {   // fn(progress 0..1) -> value
        stop();
        const t0 = performance.now() + delay * 1000; let px = x, pt = t0;
        loop((t) => {
          const p = (t - t0) / (dur * 1000);
          if (p < 0) return;
          if (p >= 1 && !repeat) { x = fn(1); v = 0; apply(x); return false; }
          x = fn(repeat ? p % 1 : p); if (t > pt) v = ((x - px) / (t - pt)) * 1000; px = x; pt = t; apply(x);
        });
      },
      tween(to, dur, ease, opts) { const from = x; api.run((p) => from + (to - from) * ease(p), dur, opts); },
    };
    return api;
  }
  // AnimatePresence mode="wait" for one element whose content is keyed:
  // exit (opacity 1→0, y 0→-y) then swap content, then enter (opacity 0→1, y +y→0). Duration `dur`, framer easeOut.
  function presence(el, render, { y, dur, initial = true }) {
    let shown, want, phase = "idle", anim = null;
    const enter = () => {
      shown = want; render(shown); phase = "enter"; anim?.cancel();
      anim = el.animate([{ opacity: 0, transform: `translateY(${y}px)` }, { opacity: 1, transform: "translateY(0px)" }], { duration: dur, easing: EO_CSS, fill: "both" });
      anim.onfinish = () => { phase = "idle"; };
    };
    const exit = () => {
      phase = "exit";
      const cs = getComputedStyle(el), from = { opacity: cs.opacity, transform: cs.transform === "none" ? "translateY(0px)" : cs.transform };
      anim?.cancel();
      anim = el.animate([from, { opacity: 0, transform: `translateY(${-y}px)` }], { duration: dur, easing: EO_CSS, fill: "both" });
      anim.onfinish = enter;
    };
    return (key) => {
      want = key;
      if (shown === undefined && phase === "idle") { if (initial) enter(); else { shown = key; render(key); } return; }
      if (phase !== "exit" && key !== shown) exit();
    };
  }
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");


  // Spring easings precomputed as CSS linear() curves (mass 1, from rest), matching framer-motion springs.
  const SPRING_300_26 = "linear(0, 0.0417, 0.142, 0.271, 0.4082, 0.5398, 0.6577, 0.7579, 0.8393, 0.9027, 0.9498, 0.9832, 1.0054, 1.0188, 1.0258, 1.0281, 1.0274, 1.0249, 1.0213, 1.0175, 1.0137, 1.0103, 1.0074, 1.005, 1.0031, 1.0017, 1.0006, 1, 0.9995, 0.9993, 0.9992, 0.9992, 0.9993, 0.9994, 0.9995, 0.9996, 0.9997, 0.9998, 0.9998, 0.9999, 1)";
  const SPRING_500_25 = "linear(0, 0.0593, 0.2028, 0.386, 0.5753, 0.7475, 0.8894, 0.9954, 1.0661, 1.1054, 1.1198, 1.116, 1.1006, 1.0793, 1.0564, 1.035, 1.017, 1.0032, 0.9937, 0.9881, 0.9858, 0.9858, 0.9874, 0.9898, 0.9926, 0.9952, 0.9975, 0.9993, 1.0005, 1.0013, 1.0017, 1.0017, 1.0016, 1.0013, 1.001, 1.0006, 1.0004, 1.0001, 1, 0.9999, 1)";
  const SPRING_260_20 = "linear(0, 0.0575, 0.1948, 0.3679, 0.5454, 0.7065, 0.8402, 0.942, 1.0129, 1.0564, 1.078, 1.0834, 1.0779, 1.0661, 1.0515, 1.0368, 1.0235, 1.0125, 1.0043, 0.9985, 0.9951, 0.9934, 0.9931, 0.9936, 0.9946, 0.9958, 0.997, 0.9981, 0.999, 0.9997, 1.0002, 1.0004, 1.0006, 1.0006, 1.0005, 1.0004, 1.0003, 1.0002, 1.0001, 1.0001, 1)";
  const SPRING_200_40 = "linear(0, 0.0789, 0.2169, 0.3518, 0.4686, 0.5659, 0.6458, 0.7112, 0.7645, 0.808, 0.8435, 0.8724, 0.896, 0.9152, 0.9309, 0.9436, 0.9541, 0.9626, 0.9695, 0.9751, 0.9797, 0.9835, 0.9865, 0.989, 0.991, 0.9927, 0.994, 0.9951, 0.996, 0.9968, 0.9974, 0.9979, 0.9983, 0.9986, 0.9988, 0.9991, 0.9992, 0.9994, 0.9995, 0.9996, 1)";
  const SPRING_550_30 = "linear(0, 0.0399, 0.1392, 0.2712, 0.4156, 0.5576, 0.6873, 0.799, 0.8899, 0.96, 1.0106, 1.0442, 1.0637, 1.0722, 1.0726, 1.0674, 1.0588, 1.0485, 1.0379, 1.0278, 1.0189, 1.0114, 1.0055, 1.001, 0.9979, 0.996, 0.995, 0.9946, 0.9948, 0.9953, 0.996, 0.9968, 0.9976, 0.9983, 0.9989, 0.9994, 0.9998, 1, 1.0002, 1.0003, 1)";

  $$("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));

  /* =========================================================================
     Mock screens. These stand in where the reference shows screenshots.
     All names and figures inside them are illustrative.
     ====================================================================== */
  const AV = ["#351366", "#2F9C8E", "#6D4BC2", "#1F6E64", "#4B2A86", "#49C9B8"];
  const bar = (title, tag) => `<div class="mk-bar"><i></i><i></i><i></i><b>${title}</b>${tag ? `<em>${tag}</em>` : ""}</div>`;
  const av = (t, i) => `<span class="mk-av" style="background:${AV[i % AV.length]}">${t}</span>`;
  const MOCKS = {
    profile: () => `${bar("rownok-hr-ls.github.io")}<div class="mk-body" style="justify-content:center"><div class="mk-glow"></div><img class="mk-photo" src="images/rownok.webp" alt=""><div style="position:relative;display:grid;gap:2cqw;max-width:58%"><span class="mk-k">HR Manager · Project Manager</span><span class="mk-h" style="font-size:max(14px,7cqw)">Rownok Rahman</span><span style="color:var(--muted-foreground)">LofiStack · Chittagong</span><span class="mk-row" style="flex-wrap:wrap;gap:1.2cqw"><span class="mk-pill ok">30 people</span><span class="mk-pill lilac">~20 accounts</span><span class="mk-pill ok">7 hires</span></span></div></div>`,
    mepps: () => `${bar("MEPPS · monthly points", "month end")}<div class="mk-body"><span class="mk-k">Points this month · same rules for all</span>${[["E1", "Employee 01", "ok", "+5 attendance", "+5"], ["E2", "Employee 02", "bad", "−2 late", "−2"], ["E3", "Employee 03", "ok", "+3 helped", "+3"], ["E4", "Employee 04", "bad", "−3 deadline", "−3"], ["E5", "Employee 05", "lilac", "no change", "0"]].map((r, i) => `<div class="mk-row">${av(r[0], i)}<span>${r[1]}</span><span class="mk-pill ${r[2]}">${r[3]}</span><b style="width:5cqw;text-align:right;font-family:var(--font-display)">${r[4]}</b></div>`).join("")}<div class="mk-row" style="margin-top:auto"><span class="mk-k">Status</span><span></span><span class="mk-pill ok">sent to finance</span></div></div>`,
    attendance: () => `${bar("LofiHRM · today", "live")}<div class="mk-body"><div class="mk-grid" style="grid-template-columns:1fr 1.5fr"><div class="mk-card"><span class="mk-k">Team</span><span class="mk-big">30</span><span class="mk-row"><span class="mk-pill ok">26 in</span></span><span class="mk-row"><span class="mk-pill warn">2 late</span></span><span class="mk-row"><span class="mk-pill lilac">2 leave</span></span></div><div class="mk-card">${[["Employee 01", "ok", "present"], ["Employee 02", "warn", "late"], ["Employee 03", "ok", "present"], ["Employee 04", "lilac", "leave"], ["Employee 05", "ok", "present"]].map((r, i) => `<div class="mk-row">${av("E" + (i + 1), i)}<span>${r[0]}</span><span class="mk-pill ${r[1]}">${r[2]}</span></div>`).join("")}</div></div></div>`,
    hiring: () => `${bar("Hiring · pipeline")}<div class="mk-body"><div class="mk-grid" style="grid-template-columns:repeat(4,1fr)">${[["Applied", 3], ["Interview", 2], ["Offer", 1], ["Onboarded", 2]].map(([h, n], c) => `<div class="mk-card"><span class="mk-k">${h} · ${n}</span>${Array.from({ length: n }, (_, i) => `<div class="mk-node" style="display:flex;align-items:center;gap:1.2cqw">${av(String.fromCharCode(65 + c * 3 + i), c + i)}<span class="mk-line" style="flex:1"></span></div>`).join("")}</div>`).join("")}</div></div>`,
    onboarding: () => `${bar("Onboarding · first week", "4 / 6")}<div class="mk-body"><span class="mk-h">New hire checklist</span>${[["Offer letter signed", 1], ["LofiHRM profile created", 1], ["MEPPS rules explained", 1], ["Team introduction", 1], ["Tools and access", 0], ["First-week check-in", 0]].map(([t, d]) => `<div class="mk-row"><span class="mk-check ${d ? "on" : ""}"></span><span class="${d ? "mk-done" : ""}">${t}</span></div>`).join("")}<div class="mk-line"><div class="mk-fill" style="width:66%"></div></div></div>`,
    delivery: () => `${bar("Client delivery · ~20 accounts", "this week")}<div class="mk-body"><div class="mk-grid" style="grid-template-columns:repeat(5,1fr)">${Array.from({ length: 20 }, (_, i) => { const s = [0, 0, 1, 0, 2, 0, 0, 1, 0, 0, 0, 2, 0, 0, 1, 0, 0, 0, 1, 0][i]; return `<div class="mk-card" style="padding:1.4cqw;gap:.8cqw"><span class="mk-k">Acct ${String(i + 1).padStart(2, "0")}</span><span class="mk-pill ${["ok", "warn", "lilac"][s]}" style="align-self:flex-start">${["on track", "review", "kickoff"][s]}</span></div>`; }).join("")}</div></div>`,
    crm: (t = "ARC Affiliates") => `${bar("GoHighLevel · " + t)}<div class="mk-body"><div class="mk-grid" style="grid-template-columns:repeat(4,1fr)">${[["New lead", 3, "#8a84a3"], ["Contacted", 2, "#B49CFF"], ["Booked", 2, "#6D4BC2"], ["Won", 1, "#49C9B8"]].map(([h, n, c], k) => `<div class="mk-card"><span class="mk-k" style="display:flex;align-items:center;gap:1cqw"><i style="width:1.4cqw;height:1.4cqw;border-radius:50%;background:${c}"></i>${h}</span>${Array.from({ length: n }, (_, i) => `<div class="mk-node" style="display:grid;gap:.8cqw"><span class="mk-line" style="width:${70 - i * 15}%"></span><span class="mk-line" style="width:40%;background:color-mix(in srgb,${c} 45%,transparent)"></span></div>`).join("")}</div>`).join("")}</div></div>`,
    flow: (t = "Automation") => `${bar("Workflow · " + t, "on")}<div class="mk-body" style="justify-content:center"><div class="mk-row" style="justify-content:space-between">${["Lead in", "Tagged", "Follow-up", "Booked"].map((s, i) => `${i ? '<span class="mk-line" style="flex:1;background:linear-gradient(90deg,var(--brand-soft),var(--teal))"></span>' : ""}<span class="mk-node">${s}</span>`).join("")}</div><div class="mk-row" style="justify-content:center;gap:3cqw;margin-top:2cqw"><span class="mk-pill ok">synced</span><span class="mk-pill lilac">pipeline</span><span class="mk-pill ok">automated</span></div></div>`,
    leave: () => `${bar("Leave · team calendar", "this month")}<div class="mk-body"><div class="mk-cal">${Array.from({ length: 35 }, (_, i) => { const d = i - 2; const c = [6, 13, 20, 27].includes(i) ? "h" : [9, 10, 16, 23, 24].includes(i) ? "l" : ""; return `<span class="${c}">${d > 0 && d <= 31 ? d : ""}</span>`; }).join("")}</div><div class="mk-row"><span class="mk-pill lilac">leave</span><span class="mk-pill ok">weekend</span></div></div>`,
    training: () => `${bar("Training · development")}<div class="mk-body"><span class="mk-h">This quarter</span>${[["Onboarding basics", 100], ["Client communication", 80], ["Project tools", 65], ["Workplace policy", 90], ["Leadership", 40]].map(([t, w]) => `<div style="display:grid;gap:.8cqw"><div class="mk-row" style="justify-content:space-between"><span>${t}</span><span class="mk-k">${w}%</span></div><div class="mk-line"><div class="mk-fill" style="width:${w}%"></div></div></div>`).join("")}</div>`,
    policy: () => `${bar("HR policy · written rules", "v3")}<div class="mk-body"><span class="mk-h">Attendance &amp; conduct</span><span class="mk-k">Section 2 · applies to everyone</span>${[92, 84, 96, 60].map((w) => `<span class="mk-line" style="width:${w}%"></span>`).join("")}<span class="mk-k" style="margin-top:1cqw">Section 3 · MEPPS points</span>${[88, 74, 40].map((w) => `<span class="mk-line" style="width:${w}%"></span>`).join("")}</div>`,
    finance: () => `${bar("MEPPS → finance", "approved")}<div class="mk-body"><div class="mk-grid" style="grid-template-columns:1fr 1fr"><div class="mk-card"><span class="mk-k">Rewards</span><span class="mk-big" style="color:var(--teal)">+18</span><span class="mk-k">points</span></div><div class="mk-card"><span class="mk-k">Deductions</span><span class="mk-big" style="color:var(--destructive)">−9</span><span class="mk-k">points</span></div></div><div class="mk-row"><span class="mk-check on"></span><span>Reviewed by HR</span><span class="mk-pill ok">done</span></div><div class="mk-row"><span class="mk-check on"></span><span>Sent to finance for payroll</span><span class="mk-pill ok">done</span></div></div>`,
    websites: () => `${bar("client-site.com")}<div class="mk-body" style="justify-content:center;align-items:flex-start;background:radial-gradient(circle at 80% 30%,color-mix(in srgb,var(--teal) 25%,transparent),transparent 55%)"><span class="mk-k">Built in 2024 · IT Officer</span><span class="mk-h" style="font-size:max(14px,7.5cqw);max-width:70%">Your business, online.</span><span class="mk-line" style="width:55%"></span><span class="mk-line" style="width:40%"></span><span class="mk-pill ok" style="padding:1cqw 2.4cqw">Get started</span></div>`,
    crmbuild: () => `${bar("Business CRM · contacts")}<div class="mk-body">${["Lead", "Customer", "Lead", "Partner", "Customer"].map((t, i) => `<div class="mk-row">${av(String.fromCharCode(75 + i), i + 1)}<span class="mk-line" style="flex:1;max-width:${60 - i * 6}%"></span><span class="mk-pill ${t === "Lead" ? "lilac" : "ok"}">${t}</span></div>`).join("")}</div>`,
  };
  const shot = (kind, arg) => `<div class="shot"><div class="mk">${(MOCKS[kind] || MOCKS.profile)(arg)}</div></div>`;

  /* =========================================================================
     Content
     ====================================================================== */
  const ABOUT = [
    "I'm the HR Manager and Project Manager at LofiStack, where I look after both the people and the delivery. On the people side, I run the everyday employee processes: communication, attendance, performance and training. On the operations side, I coordinate resources and day-to-day work so teams stay aligned and delivery stays on track.",
    "I joined LofiStack in 2024 as an IT Officer, moved into project management, and now lead HR alongside it. Coming up through the work itself gives me a practical view of how things actually get done, and of what people need to do them well.",
    "What I care about most is clear, fair processes, real support for employees, and accountability that helps both the team and the company grow.",
  ];
  const D = {
    profile: { kick: "About · Chittagong, Bangladesh", title: "Rownok Rahman", items: ABOUT },
    role1: { kick: "LofiStack · Jan 2026 – present", title: "HR Manager & Project Manager", items: ["Sole HR manager for a 30-person team, running the full employee lifecycle: communication, attendance, performance and training.", "Run recruitment end to end, from job posts and interviews to onboarding, with around 7 hires so far.", "Designed and launched MEPPS, the monthly point system that feeds finance the data for deductions and rewards.", "Manage delivery for around 20 client accounts at a time, working with the other project managers to keep operations running smoothly.", "Coordinate people and resources across teams so HR and delivery priorities stay aligned."] },
    role2: { kick: "LofiStack · Jan 2025 – Dec 2025", title: "Project Manager", items: ["Managed delivery for around 20 concurrent client accounts.", "Planned and tracked work in ClickUp and ProofHub, and ran team and client communication on Discord.", "Coordinated resources and timelines across teams to keep projects on track."] },
    role3: { kick: "LofiStack · Jan 2024 – Dec 2024", title: "IT Officer", items: ["Set up and maintained company systems and provided day-to-day IT support.", "Integrated business tools so data and workflows connect.", "Built 12 conversion-focused websites for clients.", "Built a business CRM."] },
    role4: { kick: "Felix Fashion Limited · Four H Group · May – Jul 2023", title: "Intern, Personnel Department", items: ["Supported the Personnel (HR) department's day-to-day work at Felix Fashion Limited, a sister concern of Four H Group, in Chittagong."] },
    mepps: { kick: "HR system · launched January 2026", title: "MEPPS: Monthly Employee Performance Point System", items: ["Designed and launched at LofiStack in January 2026.", "Each month, rule breaches and rewards are recorded as points against each employee.", "Finance uses those points to calculate deductions and rewards.", "Everyone works to the same clear, written rules, which helps prevent and resolve workplace conflicts fairly and consistently.", "Since launch: fewer disputes, fewer late arrivals, and rewards paid out to the employees who earned them."] },
    attendance: { kick: "HR systems · in-house software", title: "LofiHRM", items: ["I helped build and shape LofiHRM, LofiStack's in-house HR software.", "I use it every day to run HR for the team, including attendance."] },
    hiring: { kick: "HR · recruitment", title: "Recruitment, end to end", items: ["Job posts, interviews and onboarding, all run by me as the sole HR manager.", "Around 7 hires so far."] },
    onboarding: { kick: "HR · recruitment", title: "Onboarding", items: ["Onboarding is the last step of the recruitment I run end to end.", "New hires learn the written rules, including MEPPS, from day one."] },
    leave: { kick: "HR · attendance", title: "Attendance & leave", items: ["Attendance management for a 30-person team.", "Records kept in LofiHRM and reviewed at month end."] },
    training: { kick: "HR · development", title: "Training & development", items: ["Training is part of the employee lifecycle I run at LofiStack.", "Backed by a BBA and an MBA in Human Resource Management."] },
    policy: { kick: "HR · process design", title: "HR policy & written rules", items: ["HR policy and process design, so everyone works to the same clear, written rules.", "MEPPS turns those rules into monthly points."] },
    finance: { kick: "HR · payroll input", title: "Finance hand-off", items: ["Finance runs payroll; I supply the MEPPS points.", "Points become deductions and rewards on the monthly pay."] },
    delivery: { kick: "Project management · LofiStack", title: "Client delivery, ~20 accounts", items: ["Manage delivery for around 20 client accounts at a time, with the other project managers.", "Work planned and tracked in ClickUp and ProofHub; team and client communication on Discord."] },
    crm: { kick: "Case study · Project Manager & client communication", title: "ARC Affiliates: multi-industry CRM delivery on GoHighLevel", items: ["Sub-accounts across five industries: life insurance, credit, event management, spa/medical services, and life & health.", "Life insurance & credit: CRM workflows for lead management, follow-ups and opportunity tracking; mapped the challenges of maintaining these systems and costed the ongoing requirements.", "Event management: external systems connected to the CRM so leads and opportunities sync automatically.", "Spa/medical and life & health: workflows adapted to each business's specific requirements.", "The client confirmed that all requested work was completed successfully and gave positive feedback."] },
    websites: { kick: "IT Officer · 2024", title: "12 client websites", items: ["Built 12 conversion-focused websites for clients.", "Also built a business CRM, set up company systems, provided IT support and integrated business tools."] },
    crmbuild: { kick: "IT Officer · 2024", title: "Business CRM", items: ["Built a business CRM during my IT Officer year at LofiStack."] },
    mba: { kick: "Port City International University · 2023", title: "MBA in Human Resource Management", items: ["Master's degree in Human Resource Management."] },
    bba: { kick: "Port City International University · 2022", title: "BBA in Human Resource Management", items: ["Bachelor's degree in Human Resource Management.", "Began at East West University, then transferred credits to Port City International University."] },
  };

  const COVER = [
    ["profile", "Rownok Rahman"], ["mepps", "MEPPS monthly points"], ["attendance", "LofiHRM attendance"],
    ["hiring", "Hiring pipeline"], ["onboarding", "Onboarding checklist"], ["delivery", "Client delivery board"],
    ["crm", "ARC Affiliates CRM"], ["leave", "Leave calendar"], ["training", "Training tracker"],
  ];
  const RACK = [
    ["mepps", "MEPPS monthly points"], ["attendance", "LofiHRM attendance"], ["hiring", "Hiring pipeline"],
    ["onboarding", "Onboarding checklist"], ["leave", "Leave calendar"], ["training", "Training tracker"],
    ["policy", "HR policy"], ["finance", "Finance hand-off"], ["delivery", "Client delivery board"],
    ["crm", "ARC Affiliates CRM"], ["websites", "Client websites"], ["profile", "Rownok Rahman"],
  ];
  const ROWS = [
    ["role1", "profile", "HR Manager & Project Manager", "LofiStack · Jan 2026 – now"],
    ["role2", "delivery", "Project Manager", "LofiStack · 2025"],
    ["role3", "websites", "IT Officer", "LofiStack · 2024"],
    ["role4", "policy", "Intern, Personnel Department", "Felix Fashion Limited · 2023"],
    ["mepps", "mepps", "MEPPS", "Designed & launched · Jan 2026"],
    ["attendance", "attendance", "LofiHRM", "Helped build & shape"],
    ["crm", "crm", "ARC Affiliates", "GoHighLevel CRM delivery"],
    ["mba", "training", "MBA in Human Resource Management", "Port City Int'l University · 2023"],
    ["bba", "training", "BBA in Human Resource Management", "Port City Int'l University · 2022"],
  ];

  /* =========================================================================
     Preview overlay (device switcher + scaled frame), shared by rack, list and marquees
     ====================================================================== */
  const modal = $("[data-modal]");
  const pvBox = $(".pv-box", modal);
  const PV_DEV = { desktop: { label: "Desktop", w: 1280, h: 800 }, tablet: { label: "Tablet", w: 820, h: 1180 }, mobile: { label: "Phone", w: 390, h: 844 } };
  let pvDev = "desktop", pvCur = null, lastFocus = null, pvCloseT = 0;
  function pvRender() {
    if (!pvCur) return;
    const { d, key, mock } = pvCur, f = PV_DEV[pvDev], dev = pvDev !== "desktop";
    const W = f.w + (dev ? 24 : 0), H = f.h + (dev ? 24 : 44);
    const b = Math.min((innerWidth - 32) / W, (innerHeight - 140) / H, 1);
    $("[data-pv-dev]", modal).textContent = f.label;
    $$(".pv-tabs button", modal).forEach((t) => t.setAttribute("aria-selected", String(t.dataset.dev === pvDev)));
    pvBox.style.width = W * b + "px"; pvBox.style.height = H * b + "px";
    pvBox.innerHTML =
      `<div class="pv-frame${dev ? " device" : ""}" style="width:${W}px;height:${H}px;transform:scale(${b})">` +
      (dev ? "" : `<div class="pv-chrome"><i></i><i></i><i></i><span class="pv-url">rownok-hr-ls.github.io/${esc(key)}</span></div>`) +
      `<div class="pv-page" style="width:${f.w}px;height:${f.h}px"><div class="pv-scroll"><div class="pv-body ${pvDev}">` +
      `<div class="pv-shot">${shot(mock || key)}</div>` +
      `<div class="pv-info"><p class="modal-kick">${esc(d.kick)}</p><h3>${esc(d.title)}</h3><ul>${d.items.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div></div></div></div></div>`;
  }
  function pvEnter() {
    const draw = () => { pvBox.style.opacity = clamp(o.x, 0, 1); pvBox.style.transform = `translateY(${y.x}px) scale(${s.x})`; };
    const o = springB(0, draw, 260, 26), y = springB(12, draw, 260, 26), s = springB(0.96, draw, 260, 26);
    draw(); o.set(1); y.set(0); s.set(1);
  }
  function openModal(key, mock) {
    pvDev = "desktop";
    pvCur = { d: D[key] || D.profile, key, mock };
    clearTimeout(pvCloseT);
    lastFocus = document.activeElement;
    $("#pv-title").textContent = pvCur.d.title;
    modal.setAttribute("aria-label", `${pvCur.d.title} preview`);
    pvRender();
    modal.hidden = false; void modal.offsetWidth; modal.classList.add("open");
    document.body.style.overflow = "hidden";
    pvEnter();
    $(".modal-x", modal).focus({ preventScroll: true });
  }
  function closeModal() {
    if (modal.hidden || !modal.classList.contains("open")) return;
    modal.classList.remove("open");
    pvCloseT = setTimeout(() => { modal.hidden = true; pvBox.innerHTML = ""; pvCur = null; document.body.style.overflow = ""; }, 300);
    lastFocus?.focus({ preventScroll: true });
  }
  modal.addEventListener("click", closeModal);
  $(".pv-top", modal).addEventListener("click", (e) => e.stopPropagation());
  pvBox.addEventListener("click", (e) => e.stopPropagation());
  $("[data-close]", modal).addEventListener("click", closeModal);
  $$(".pv-tabs button", modal).forEach((t) => t.addEventListener("click", () => { pvDev = t.dataset.dev; pvRender(); pvEnter(); }));
  addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) closeModal(); });
  addEventListener("resize", () => { if (!modal.hidden) pvRender(); });

  /* =========================================================================
     Hero headline: word-by-word reveal on load (only the h1, like the reference)
     ====================================================================== */
  $$("[data-split]").forEach((el) => {
    const text = el.textContent.trim();
    el.setAttribute("aria-label", text);
    el.innerHTML = `<span class="split-outer" aria-hidden="true">` +
      text.split(" ").map((w, i) => `<span class="w"><span style="--i:${i}">${esc(w)} </span></span>`).join("") + `</span>`;
    if (motion) requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("in")));
    else el.classList.add("in");
  });
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.2 });

  /* =========================================================================
     Hero: rotating word (whole-word swap) and typed terminal line
     ====================================================================== */
  const rot = $(".rot");
  const words = rot.dataset.words.split("|");
  const mkWord = (w) => { const s = document.createElement("span"); s.textContent = w; return s; };
  rot.textContent = ""; let curWord = mkWord(words[0]); rot.append(curWord);
  const RE = "cubic-bezier(.22,1,.36,1)";
  if (motion) { let wi = 0; setInterval(() => {
    wi = (wi + 1) % words.length;
    const old = curWord;
    const { offsetTop: t, offsetLeft: l, offsetWidth: w, offsetHeight: h } = old;
    Object.assign(old.style, { position: "absolute", top: t + "px", left: l + "px", width: w + "px", height: h + "px" });
    curWord = mkWord(words[wi]); rot.append(curWord);
    curWord.animate([{ transform: "translateY(60%)", opacity: 0, filter: "blur(6px)" }, { transform: "translateY(0)", opacity: 1, filter: "blur(0px)" }], { duration: 450, easing: RE });
    old.animate([{ transform: "translateY(0)", opacity: 1, filter: "blur(0px)" }, { transform: "translateY(-60%)", opacity: 0, filter: "blur(6px)" }], { duration: 450, easing: RE, fill: "forwards" }).onfinish = () => old.remove();
  }, 2200); }

  const termGhost = $(".term-ghost"), term = $(".term-text"), caret = $(".term-caret");
  const LINES = [
    "close the month · attendance + MEPPS points + finance hand-off · 3 steps ✓",
    "onboard new hire · offer letter + LofiHRM profile + MEPPS rules · 4 steps ✓",
    "hire for delivery · job post + interviews + onboarding · 3 rounds ✓",
    "sync client accounts · ClickUp + ProofHub + Discord · ~20 accounts ✓",
  ];
  const SHORT = LINES.map((l) => l.split(" · ")[0] + " ✓");
  const narrowTerm = matchMedia("(max-width: 639px)");
  let lineIdx = 0, termTimers = [];
  const clearTermTimers = () => { termTimers.forEach(clearInterval); termTimers = []; };
  function runLine() {
    clearTermTimers();
    const text = (narrowTerm.matches ? SHORT : LINES)[lineIdx % LINES.length];
    termGhost.textContent = text;
    let I = 0, gate = true, blink = true, fired = false;
    const paint = () => {
      term.textContent = text.slice(0, Math.max(I, Math.min(text.length, 1)));
      const waiting = I === text.length || I === 0;
      caret.classList.toggle("gone", !(gate || waiting));
      caret.classList.toggle("off", !blink);
    };
    paint();
    if (!motion) { I = text.length; paint(); return; }
    termTimers.push(setInterval(() => { blink = !blink; paint(); }, 500));
    termTimers.push(setInterval(() => { gate = !gate; paint(); }, 100));
    const typer = setInterval(() => {
      I = Math.min(I + 1, text.length); paint();
      if (I === text.length && !fired) { fired = true; clearInterval(typer); setTimeout(() => { lineIdx++; runLine(); }, 1400); }
    }, 18);
    termTimers.push(typer);
  }
  runLine();

  /* =========================================================================
     Perspective carousel: flat strip, scale .82 + rotateY (P - r) * 40deg, spring 92/16.5
     ====================================================================== */
  const cfRegion = $("[data-coverflow]"), cfStage = $(".cf-stage", cfRegion), cfLabel = $(".cf-label");
  cfStage.innerHTML = COVER.map(([k, n]) => `<div class="cf-slide"><div class="cf-card"><button type="button" aria-label="Show ${esc(n)}">${shot(k)}</button></div></div>`).join("");
  const cfSlides = $$(".cf-slide", cfStage), cfCards = $$(".cf-card", cfStage), CF_N = COVER.length;
  const slideW = () => (innerWidth < 640 ? 280 : innerWidth < 1024 ? 400 : 480);
  let CF_A = slideW(), CF_P = 0;
  const stripX = spring(SP_CAROUSEL, (v) => (cfStage.style.transform = `translateX(${v}px)`), -(CF_A / 2));
  const cardSt = cfCards.map((c, r) => {
    const st = { s: r === 0 ? 1 : 0.82, ry: (0 - r) * 40 };
    const paint = () => (c.style.transform = `scale(${st.s}) rotateY(${st.ry}deg)`);
    paint();
    return { s: spring(SP_CAROUSEL, (v) => { st.s = v; paint(); }, st.s), ry: spring(SP_CAROUSEL, (v) => { st.ry = v; paint(); }, st.ry) };
  });
  const cfLayout = () => cfSlides.forEach((s) => (s.style.width = CF_A + "px"));
  function cfRender() {
    stripX.set(-(CF_P * CF_A + CF_A / 2));
    cardSt.forEach((c, r) => { c.ry.set((CF_P - r) * 40); c.s.set(CF_P === r ? 1 : 0.82); });
    cfCards.forEach((c, r) => { const b = c.firstElementChild; r === CF_P ? b.setAttribute("aria-current", "true") : b.removeAttribute("aria-current"); });
    cfLabel.textContent = `${String(CF_P + 1).padStart(2, "0")} / ${String(CF_N).padStart(2, "0")} · ${COVER[CF_P][1]}`;
  }
  const cfGo = (i) => { CF_P = (i + CF_N) % CF_N; cfRender(); };
  cfCards.forEach((c, r) => c.firstElementChild.addEventListener("click", () => cfGo(r)));
  $$("[data-cf]").forEach((b) => b.addEventListener("click", () => cfGo(CF_P + (b.dataset.cf === "next" ? 1 : -1))));
  cfRegion.addEventListener("keydown", (e) => { if (e.key === "ArrowLeft") { e.preventDefault(); cfGo(CF_P - 1); } if (e.key === "ArrowRight") { e.preventDefault(); cfGo(CF_P + 1); } });
  addEventListener("resize", () => { const a = slideW(); if (a !== CF_A) { CF_A = a; cfLayout(); cfRender(); } });
  cfLayout(); cfRender();
  if (motion) setInterval(() => cfGo(CF_P + 1), 3200);

  /* =========================================================================
     Scatter: every 3s the cards fly out to the nearest edge and new ones fly in
     ====================================================================== */
  const scatter = $("[data-scatter]"), scLayer = $(".scatter-cards", scatter), scTitle = $(".scatter-title");
  const SC = [
    { heading: "30 people, one set of rules", kinds: ["attendance", "mepps", "policy", "leave", "finance"] },
    { heading: "7 hires, post to onboarding", kinds: ["hiring", "onboarding", "profile", "training", "policy"] },
    { heading: "~20 client accounts at a time", kinds: ["delivery", "crm", "flow", "websites", "crmbuild"] },
    { heading: "2 promotions in two years", kinds: ["profile", "training", "delivery", "websites", "mepps"] },
  ];
  const ease3 = { in: (t) => t * t * t, out: (t) => 1 - Math.pow(1 - t, 3), inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2) };
  const tween = (el, from, to, dur, ef, delay = 0) => new Promise((res) => {
    const t0 = performance.now() + delay * 1000;
    const step = (now) => {
      const k = Math.min(1, Math.max(0, (now - t0) / (dur * 1000))), e = ef(k);
      const v = (p) => from[p] + (to[p] - from[p]) * e;
      if ("left" in to) { el.style.left = v("left") + "px"; el.style.top = v("top") + "px"; el.style.transform = `rotate(${v("rot")}deg)`; }
      if ("o" in to) el.style.opacity = v("o");
      k < 1 ? requestAnimationFrame(step) : res();
    };
    requestAnimationFrame(step);
  });
  const cardSize = () => (innerWidth < 640 ? { w: 170, h: 75 } : innerWidth < 1024 ? { w: 240, h: 105 } : { w: 320, h: 140 });
  let scState = null;
  function scInit() {
    if (scState) { clearInterval(scState.timer); scState.active.forEach((c) => c.el.remove()); }
    scLayer.innerHTML = "";
    const W = scatter.clientWidth, H = scatter.clientHeight, { w, h } = cardSize();
    const geo = { cx: W / 2, cy: H / 2, rMin: 0.35 * Math.min(W, H), rMax: 0.7 * Math.min(W, H) };
    const make = (s) => SC[s].kinds.map((k) => {
      const el = document.createElement("div");
      el.className = "sc-card"; el.style.width = w + "px"; el.style.height = h + "px"; el.innerHTML = shot(k);
      const a = Math.random() * Math.PI * 2, r = geo.rMin + Math.random() * (geo.rMax - geo.rMin);
      const cx = geo.cx + Math.cos(a) * r, cy = geo.cy + Math.sin(a) * r;
      const pos = { left: cx - w / 2, top: cy - h / 2, rot: 50 * Math.random() - 25 };
      el.style.left = pos.left + "px"; el.style.top = pos.top + "px"; el.style.transform = `rotate(${pos.rot}deg)`;
      scLayer.appendChild(el);
      return { el, cx, cy, pos };
    });
    const offscreen = (x, y) => {
      const n = { left: x, right: W - x, top: y, bottom: H - y }, m = Math.min(n.left, n.right, n.top, n.bottom), j = () => (Math.random() - 0.5) * 400;
      return m === n.left ? { left: -w - 100 - 200 * Math.random(), top: y - h / 2 + j() }
        : m === n.right ? { left: W + 50 + 200 * Math.random(), top: y - h / 2 + j() }
        : m === n.top ? { left: x - w / 2 + j(), top: -h - 100 - 200 * Math.random() }
        : { left: x - w / 2 + j(), top: H + 50 + 200 * Math.random() };
    };
    const st = { cur: 0, busy: false, active: make(0), timer: 0 };
    scTitle.textContent = SC[0].heading; scTitle.style.opacity = 1;
    if (motion) st.timer = setInterval(() => {
      if (st.busy) return;
      const next = (st.cur + 1) % SC.length; st.busy = true;
      const incoming = make(next);
      const outs = st.active.map((c) => { const o = offscreen(c.cx, c.cy);
        return tween(c.el, c.pos, { ...o, rot: 180 * Math.random() - 90 }, 0.8, ease3.in).then(() => c.el.remove()); });
      const ins = incoming.map((c) => { const o = offscreen(c.cx, c.cy), from = { ...o, rot: 180 * Math.random() - 90 };
        c.el.style.left = from.left + "px"; c.el.style.top = from.top + "px"; c.el.style.transform = `rotate(${from.rot}deg)`;
        const to = { left: c.cx - w / 2, top: c.cy - h / 2, rot: 50 * Math.random() - 25 }; c.pos = to;
        return tween(c.el, from, to, 0.8, ease3.out, 0.5); });
      const head = tween(scTitle, { o: 1 }, { o: 0 }, 0.5, ease3.inOut)
        .then(() => { scTitle.textContent = SC[next].heading; return tween(scTitle, { o: 0 }, { o: 1 }, 0.5, ease3.inOut); });
      Promise.all([...outs, ...ins, head]).then(() => { st.active = incoming; st.cur = next; st.busy = false; });
    }, 3000);
    scState = st;
  }
  scInit();
  let scW = innerWidth;
  addEventListener("resize", () => { if (innerWidth !== scW) { scW = innerWidth; scInit(); } });

  /* =========================================================================
     Rack: hover-driven fan (spring 240/24), free drag with momentum
     ====================================================================== */
  const rack = $("[data-rack]");
  const rackWrap = rack.parentElement;
  const RN = RACK.length;
  rack.innerHTML = RACK.map(([k, n], i) =>
    `<button class="rack-card" type="button" data-i="${i}" aria-label="${esc(n)}" style="margin-left:${i ? `calc(-300px + ${Math.round(1100 / RN)}px)` : "0"};z-index:${RN - i}">` +
    `<span class="frame">${shot(k)}</span>` +
    `<span class="rack-pill" aria-hidden="true"><span class="rp-n">${String(i + 1).padStart(2, "0")}</span><span class="rp-t">${esc(n)}</span><span class="rp-o">Open ↗</span></span></button>`).join("");
  const rCards = $$(".rack-card", rack);
  rCards.forEach((c) => {
    const draw = () => {
      const q = c._q;
      c.style.transform = `translateX(${q.x.x}px) translateY(${q.y.x}px) translateZ(${q.z.x}px) scale(${q.s.x}) rotateY(${q.r.x}deg)`;
      c.style.filter = `brightness(${q.b.x})`;
    };
    const S = (v) => springB(v, draw, 240, 24);
    c._q = { r: S(0), x: S(0), y: S(0), z: S(0), s: S(1), b: S(1) };
  });
  rCards.forEach((c) => (motion ? c._q.r.set(-34) : c._q.r.jump(-34)));

  const pillIn = (c) => {
    const p = $(".rack-pill", c); p.getAnimations().forEach((a) => a.cancel()); p.classList.add("on");
    p.animate([{ opacity: 0, transform: "translateY(-6px)" }, { opacity: 1, transform: "none" }], { duration: 200, easing: EASE_IO, fill: "forwards" });
  };
  const pillOut = (c) => {
    const p = $(".rack-pill", c); const o = getComputedStyle(p).opacity; p.getAnimations().forEach((a) => a.cancel());
    const a = p.animate([{ opacity: o, transform: "none" }, { opacity: 0, transform: "none" }], { duration: 200, easing: EASE_IO, fill: "forwards" });
    a.onfinish = () => p.classList.remove("on");
  };
  let rHov = null;
  function rackHover(h) {
    if (h === rHov) return;
    const prev = rHov; rHov = h;
    rCards.forEach((c, i) => {
      const on = h === i, l = h === null ? 0 : i - h, q = c._q;
      c.style.zIndex = on ? 60 : h !== null && i < h ? i : RN - i;
      q.r.set(on ? 0 : h === null ? -34 : l < 0 ? -42 : 42);
      q.x.set(h === null ? 0 : l < 0 ? -40 : l > 0 ? 40 : 0);
      q.z.set(on ? 120 : 0);
      q.y.set(on ? -24 : 0);
      q.s.set(on ? 1.06 : 1);
      q.b.set(h === null || on ? 1 : 0.78);
    });
    if (prev !== null) pillOut(rCards[prev]);
    if (h !== null) pillIn(rCards[h]);
  }
  rCards.forEach((c, i) => c.addEventListener("mouseenter", () => rackHover(i)));
  rackWrap.addEventListener("mouseleave", () => rackHover(null));

  const rXs = springB(0, () => { rack.style.transform = rXs.x ? `translateX(${rXs.x}px)` : "none"; });
  let rM = 0, rInert = 0, rDrag = null, rMoved = false;
  const rMeasure = () => { rM = Math.max(0, (rack.scrollWidth - rackWrap.clientWidth) / 2 + 40); };
  rMeasure(); addEventListener("resize", rMeasure);
  const rStop = () => { cancelAnimationFrame(rInert); rInert = 0; rXs.stop(); };
  const rOut = (x) => x < -rM || x > rM;
  const rBounce = (x, v) => { rXs.x = x; rXs.set(Math.abs(-rM - x) < Math.abs(rM - x) ? -rM : rM, { k: 200, c: 40, v, rd: 1, rs: 10 }); };
  function rInertia(vel) {
    const from = rXs.x, amp = 0.8 * vel, target = from + amp, tau = 750, t0 = performance.now();
    if (rOut(from)) return rBounce(from, (amp / tau) * 1000);
    const step = (now) => {
      const d = -amp * Math.exp(-(now - t0) / tau);
      const done = Math.abs(d) <= 1, x = done ? target : target + d;
      if (rOut(x)) { rInert = 0; return rBounce(x, (-d / tau) * 1000); }
      rXs.jump(x, (-d / tau) * 1000);
      rInert = done ? 0 : requestAnimationFrame(step);
    };
    rInert = requestAnimationFrame(step);
  }
  function rVel(h) {
    if (h.length < 2) return 0;
    const last = h[h.length - 1]; let i = h.length - 1, s = null;
    for (; i >= 0; i--) { s = h[i]; if (last.t - s.t > 100) break; }
    if (!s) return 0;
    if (s === h[0] && h.length > 2 && last.t - s.t > 200) s = h[1];
    const dt = (last.t - s.t) / 1000;
    return dt ? (last.x - s.x) / dt : 0;
  }
  rack.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" ? e.button !== 0 : !e.isPrimary) return;
    rStop();
    rDrag = { px: e.pageX, py: e.pageY, o: rXs.x, on: false, h: [{ x: e.pageX, t: performance.now() }] };
  });
  addEventListener("pointermove", (e) => {
    if (!rDrag) return;
    const dx = e.pageX - rDrag.px;
    if (!rDrag.on) {
      if (Math.hypot(dx, e.pageY - rDrag.py) < 3) return;
      rDrag.on = true; rDrag.o = rXs.x; rack.classList.add("dragging");
    }
    rDrag.h.push({ x: e.pageX, t: performance.now() });
    let x = rDrag.o + dx;
    if (x < -rM) x = -rM + (x + rM) * 0.08; else if (x > rM) x = rM + (x - rM) * 0.08;
    rXs.jump(x);
  });
  const rEnd = () => {
    if (!rDrag) return;
    const d = rDrag; rDrag = null;
    if (!d.on) return;
    rack.classList.remove("dragging");
    rMoved = true; setTimeout(() => (rMoved = false), 0);
    rInertia(rVel(d.h));
  };
  addEventListener("pointerup", rEnd);
  addEventListener("pointercancel", rEnd);
  const rArrow = (dir) => { rStop(); rXs.set(clamp(rXs.x - 360 * dir, -rM, rM), { k: 200, c: 26 }); };
  $$("[data-rack-btn]").forEach((b) => b.addEventListener("click", () => rArrow(Number(b.dataset.rackBtn))));
  rCards.forEach((c, i) => c.addEventListener("click", (e) => {
    if (rMoved) { e.preventDefault(); return; }
    openModal(RACK[i][0]);
  }));
  rack.addEventListener("keydown", (e) => { if (e.key === "ArrowRight") rArrow(1); if (e.key === "ArrowLeft") rArrow(-1); });

  /* =========================================================================
     Tilted list: rotateX(16deg) trapezoid, hover springs 260/24, anchored preview
     ====================================================================== */
  const tl = $("[data-tiltlist]");
  const tlWrap = tl.parentElement;
  const tlNarrow = matchMedia("(max-width: 639px)");
  tl.innerHTML = ROWS.map(([key, mock, title, where], i) =>
    `<li class="tl-row"><button type="button" data-key="${key}" data-mock="${mock}"><span class="tl-n">${String(i + 1).padStart(2, "0")}</span>` +
    `<span class="tl-t">${esc(title)}</span><span class="tl-w">${esc(where)}</span><span class="tl-o">Open ↗</span></button></li>`).join("");
  const tlRows = $$(".tl-row", tl);
  tlRows.forEach((li) => {
    const draw = () => {
      const q = li._q;
      li.style.transform = q.z.x || q.s.x !== 1 ? `translateZ(${q.z.x}px) scale(${q.s.x})` : "none";
      li.style.opacity = clamp(q.o.x, 0, 1);
    };
    li._q = { z: springB(0, draw, 260, 24), s: springB(1, draw, 260, 24), o: springB(1, draw, 260, 24) };
  });
  let tlPv = null;
  const tlExit = new Map();
  function tlPrevMake(i, left, top) {
    const el = document.createElement("div");
    el.className = "tl-preview"; el.setAttribute("aria-hidden", "true");
    el.style.left = left + "px"; el.style.top = top + "px";
    el.innerHTML = shot(ROWS[i][1]);
    const draw = () => {
      el.style.opacity = clamp(q.o.x, 0, 1);
      el.style.transform = `translateY(${q.y.x}px) translateX(-100%) translateY(-100%) scale(${q.s.x})`;
    };
    const q = { o: springB(0, draw, 260, 22), y: springB(18, draw, 260, 22), s: springB(0.96, draw, 260, 22) };
    draw(); tlWrap.appendChild(el);
    return { i, el, q };
  }
  function tlPrevHide() {
    if (!tlPv) return;
    const p = tlPv; tlPv = null; tlExit.set(p.i, p);
    p.q.o.done = () => { p.el.remove(); tlExit.delete(p.i); };
    p.q.y.set(10); p.q.s.set(0.98); p.q.o.set(0);
  }
  function tlPrevShow(i, left, top) {
    if (tlNarrow.matches) return;
    if (tlPv && tlPv.i === i) return;
    tlPrevHide();
    let p = tlExit.get(i);
    if (p) { tlExit.delete(i); p.q.o.done = null; } else p = tlPrevMake(i, left, top);
    p.q.o.set(1); p.q.y.set(0); p.q.s.set(1);
    tlPv = p;
  }
  function tlLayout() {
    const nar = tlNarrow.matches, n = tlRows.length;
    tl.style.transform = nar ? "none" : "rotateX(16deg)";
    tlRows.forEach((li, i) => {
      li.style.marginInline = `${-(nar ? 0 : (i - (n - 1) / 2) * 1.6)}%`;
      $(".tl-o", li).textContent = nar ? "↗" : "Open ↗";
    });
    if (nar) tlPrevHide();
  }
  tlNarrow.addEventListener("change", tlLayout);
  function tlHover(h) {
    tlRows.forEach((li, i) => {
      const on = h === i, q = li._q;
      li.classList.toggle("hov", on);
      q.z.set(on ? 70 : 0); q.s.set(on ? 1.02 : 1); q.o.set(h === null || on ? 1 : 0.55);
    });
  }
  tlRows.forEach((li, i) => {
    li.addEventListener("mouseenter", () => {
      tlHover(i);
      const w = tlWrap.getBoundingClientRect(), r = li.getBoundingClientRect();
      tlPrevShow(i, r.right - w.left - 24, r.top - w.top - 12);
    });
    $("button", li).addEventListener("click", (e) => { const b = e.currentTarget; openModal(b.dataset.key, b.dataset.mock); });
  });
  tl.addEventListener("mouseleave", () => { tlHover(null); tlPrevHide(); });
  tlLayout();

  /* =========================================================================
     Marquees
     ====================================================================== */
  const mqSets = { a: RACK.slice(0, 6), b: RACK.slice(6) };
  $$("[data-marquee]").forEach((m) => {
    const set = mqSets[m.dataset.marquee];
    const group = () => `<div class="mq-group">${set.map(([k, n]) => `<button class="mq-card" type="button" data-k="${k}"><span class="ratio">${shot(k)}</span><span class="mq-cap"><span>${esc(n)}</span><em>Open ↗</em></span></button>`).join("")}</div>`;
    m.innerHTML = Array.from({ length: 5 }, (_, k) => k ? group().replace('class="mq-group"', 'class="mq-group" aria-hidden="true"') : group()).join("");
    $$(".mq-card", m).forEach((c) => c.addEventListener("click", () => openModal(c.dataset.k)));
  });
  $$("[data-words-marquee]").forEach((m) => {
    const g = (hidden) => `<div class="mq-group"${hidden ? ' aria-hidden="true"' : ""}>${m.dataset.wordsMarquee.split("|").map((w) => `<span class="foot-word">${esc(w)} <span class="accent">✦</span></span>`).join("")}</div>`;
    m.innerHTML = g(false) + g(true) + g(true) + g(true) + g(true);
  });

  /* =========================================================================
     MEPPS map: 1:1 port of the reference node map (SiteAutomation <N/>)
     ====================================================================== */
  const isCoarse = matchMedia("(pointer: coarse)").matches;            // ref useCoarsePointer()
  const map = $("[data-map]");
  const consoleEl = $("[data-console]");
  const svg = $(".map-svg", map);
  // Reference root: one relative box holding [svg, overlay, grid, console]
  const mapRoot = document.createElement("div");
  mapRoot.className = "map-root";
  map.before(mapRoot);
  const dropZone = document.createElement("div");
  dropZone.className = "drop-zone";
  dropZone.setAttribute("aria-hidden", "true");
  dropZone.innerHTML = "<span>Drop here to go live</span>";
  mapRoot.append(svg, dropZone, map, consoleEl);

  const mapCols = $$(".map-col", map);
  const NODES = $$(".node", map).map((el) => {
    const col = mapCols.indexOf(el.parentElement);
    const n = { id: el.dataset.n, el, col, tone: col === 2, label: $(".ntitle", el).textContent, x: 0, y: 0, s: 1, target: 1, dragging: false };
    const apply = () => (el.style.transform = `translateX(${n.x}px) translateY(${n.y}px) scale(${n.s})`);
    n.mx = mv(0, (v) => { n.x = v; apply(); });
    n.my = mv(0, (v) => { n.y = v; apply(); });
    n.ms = mv(1, (v) => { n.s = v; apply(); });
    return n;
  });
  const byId = Object.fromEntries(NODES.map((n) => [n.id, n]));
  const LINKS = [["late", "points"], ["deadline", "points"], ["points", "review"], ["points", "finance"], ["review", "deduct"], ["review", "reward"], ["finance", "reward"], ["finance", "deduct"], ["finance", "closed"]];
  // Fixed routes, cycled in order (reference T). Content is ours; each consecutive pair must be an edge in LINKS.
  const ROUTES = [["late", "points", "review", "deduct"], ["deadline", "points", "finance", "reward"], ["late", "points", "finance", "closed"]];
  // Per-node narrative (reference W). COPY IS OURS: edit freely.
  const DESC = {
    late: "A late check-in is logged against the written rule, not argued about.",
    deadline: "A missed deadline is recorded with the task and the date, the same way for everyone.",
    points: "Every breach and every reward becomes points on that person's monthly sheet.",
    review: "At month end HR reviews each sheet and corrects mistakes before anything is applied.",
    finance: "Approved totals go to finance as payroll input. One clean hand-off.",
    deduct: "Deductions show on the payslip, with the breakdown in the monthly summary.",
    reward: "Rewards are paid to the people who earned them, on the same payslip.",
    closed: "Same written rules for everyone, so disputes close quickly and fairly.",
  };

  // ---- SVG: per edge <g><path.base/><path.flow pathLength=1/> [circle.spark] </g>
  svg.innerHTML = LINKS.map((_, i) => `<g data-e="${i}"><path class="base" stroke-dasharray="6 8"/><path class="flow" pathLength="1" style="transition:stroke-dashoffset .9s cubic-bezier(.42,0,.58,1) ${(0.15 * i).toFixed(2)}s,opacity .3s ${EO_CSS},stroke-width .3s ${EO_CSS}"/></g>`).join("");
  const EDGES = LINKS.map(([a, b], i) => { const g = $(`[data-e="${i}"]`, svg); return { a, b, g, base: $(".base", g), flow: $(".flow", g), d: "", spark: null }; });
  function drawMap() {                                                 // reference X()
    const R = mapRoot.getBoundingClientRect();
    EDGES.forEach((E) => {
      const A = byId[E.a].el.getBoundingClientRect(), B = byId[E.b].el.getBoundingClientRect();
      const n = A.right - R.left, o = A.top + A.height / 2 - R.top, u = B.left - R.left, l = B.top + B.height / 2 - R.top;
      const c = Math.max(40, (u - n) / 2);
      E.d = `M${n},${o} C${n + c},${o} ${u - c},${l} ${u},${l}`;
      E.base.setAttribute("d", E.d); E.flow.setAttribute("d", E.d);
      if (E.spark) E.spark.firstChild.setAttribute("path", E.d);
    });
  }
  new ResizeObserver(drawMap).observe(mapRoot);
  drawMap();
  document.fonts?.ready.then(drawMap);

  // ---- state (names follow the reference)
  let started = false;   // b
  let live = false;      // w
  let hovered = null;    // g
  let routeIdx = 0;      // m
  let step = -1;         // C
  let waiting = 3;       // A
  let booked = 0;        // I
  let bob = false;       // F
  let bobRunning = false;
  let seqTimer = 0, countTimer = 0;

  const cWait = $(".c-wait", consoleEl), cDone = $(".c-done", consoleEl);
  const textEl = $(".console-text", consoleEl);
  const resetBtn = document.createElement("button");
  resetBtn.type = "button"; resetBtn.className = "map-reset"; resetBtn.textContent = "Reset ↺"; resetBtn.hidden = true;
  $(".console-count", consoleEl).appendChild(resetBtn);

  const narrative = (V) => !live
    ? `<b class="c-head is-off">9:05 AM. Nobody is keeping score.</b> <span class="c-body">Late arrivals get argued, deadlines slip quietly, good work goes unnoticed. ${isCoarse ? "Tap the RR mark to switch MEPPS on." : "Drag the RR mark onto the map to switch MEPPS on."}</span>`
    : V ? `<b class="c-head">${esc(byId[V].label)}.</b> <span class="c-body">${esc(DESC[V])}</span>`
        : `<b class="c-head is-on">MEPPS is on.</b> <span class="c-body">Watch a check-in move, hover any node, drag nodes around. The points on each node are what that rule is worth.</span>`;
  let curV = null;
  const swapText = presence(textEl, () => { textEl.innerHTML = narrative(curV); }, { y: 6, dur: 250, initial: true });

  function render() {
    const route = ROUTES[routeIdx];
    const V = hovered ?? (step >= 0 && step < route.length ? route[step] : null);
    const Y = new Set(hovered ? [hovered] : route.slice(0, Math.max(0, step + 1)));
    NODES.forEach((n) => {
      const lit = Y.has(n.id) || hovered === n.id;
      n.el.classList.toggle("off", !live);
      n.el.classList.toggle("lit", live && lit);
      n.el.classList.toggle("dim", live && !lit && (!!hovered || step >= 0));
      n.el.classList.toggle("tone", live && n.tone);
      const t = n.dragging ? 1.05 : V === n.id ? 1.04 : 1;          // whileDrag beats animate
      if (t !== n.target) { n.target = t; n.ms.spring(t, 300, 22); }
    });
    const on = started && live;
    EDGES.forEach((E) => {
      const act = hovered ? E.a === hovered || E.b === hovered : Y.has(E.a) && Y.has(E.b) && route.indexOf(E.b) === route.indexOf(E.a) + 1;
      E.base.setAttribute("stroke-dasharray", live ? "0" : "6 8");
      E.flow.style.strokeDashoffset = on ? "0" : "1";               // pathLength 0 ↔ 1
      E.flow.style.opacity = on ? (act ? "1" : "0.28") : "0";
      if (on) E.flow.style.strokeWidth = act ? "3" : "2";
      E.flow.style.filter = act ? "drop-shadow(0 0 6px var(--accent))" : "";
      if (on && act && !E.spark) {
        E.spark = document.createElementNS(NS, "circle");
        E.spark.setAttribute("r", "5"); E.spark.setAttribute("class", "spark");
        const am = document.createElementNS(NS, "animateMotion");
        am.setAttribute("dur", "1.1s"); am.setAttribute("repeatCount", "indefinite"); am.setAttribute("path", E.d);
        E.spark.appendChild(am); E.g.appendChild(E.spark);
      } else if (!(on && act) && E.spark) { E.spark.remove(); E.spark = null; }
    });
    consoleEl.classList.toggle("on", live);
    resetBtn.hidden = !live;
    cWait.textContent = waiting; cDone.textContent = booked;
    curV = V;
    swapText((live ? "on-" : "off-") + (V ?? "idle"));
    syncBob();
  }

  function startCounters() {                                           // reference: 1300ms, deps [b, w, A]
    clearInterval(countTimer);
    if (!started) return;
    countTimer = setInterval(() => {
      if (live) { if (waiting > 0) { waiting--; booked++; } } else waiting = Math.min(14, waiting + 1);
      cWait.textContent = waiting; cDone.textContent = booked;
    }, 1300);
  }
  function startSeq() {                                                // reference: 1100ms, deps [b, w]
    clearInterval(seqTimer);
    if (!started || !live) return;
    let e = -1, t = 0;                                                 // quirk: t restarts at 0, routeIdx keeps its value
    seqTimer = setInterval(() => {
      if ((e += 1) >= ROUTES[t].length + 1) { e = -1; routeIdx = t = (t + 1) % ROUTES.length; }
      step = e; render();
    }, 1100);
  }
  function setLive(v) { if (live === v) return; live = v; render(); startSeq(); startCounters(); }
  function goLive() { bob = false; setLive(true); render(); }           // reference z(): S(true), L(false)

  // ---- hover + drag on nodes
  const elastic = (p, min, max) => (p < min ? min + (p - min) * 0.12 : p > max ? max + (p - max) * 0.12 : p);
  NODES.forEach((n) => {
    n.el.addEventListener("mouseenter", () => { hovered = n.id; render(); });
    n.el.addEventListener("mouseleave", () => { hovered = null; render(); });
    if (isCoarse) { n.el.style.touchAction = "auto"; return; }       // reference: drag = !coarse
    let ds = null;
    n.el.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      const R = mapRoot.getBoundingClientRect(), E = n.el.getBoundingClientRect();
      const lw = n.el.offsetWidth, lh = n.el.offsetHeight;
      const lx = E.left + E.width / 2 - lw / 2 - n.x, ly = E.top + E.height / 2 - lh / 2 - n.y;   // layout box
      ds = { px: e.clientX, py: e.clientY, ox: 0, oy: 0, on: false, minX: R.left - lx, maxX: R.right - lx - lw, minY: R.top - ly, maxY: R.bottom - ly - lh };
      n.el.setPointerCapture(e.pointerId);
    });
    n.el.addEventListener("pointermove", (e) => {
      if (!ds) return;
      const dx = e.clientX - ds.px, dy = e.clientY - ds.py;
      if (!ds.on) {
        if (Math.hypot(dx, dy) < 3) return;                          // framer distance threshold
        ds.on = true; n.mx.stop(); n.my.stop(); ds.ox = n.x; ds.oy = n.y;
        n.dragging = true; n.el.style.zIndex = "40"; render();
      }
      n.mx.set(elastic(ds.ox + dx, ds.minX, ds.maxX));
      n.my.set(elastic(ds.oy + dy, ds.minY, ds.maxY));
      drawMap();                                                       // onDrag: X
    });
    const end = () => {
      if (!ds) return; const b = ds; ds = null;
      if (!b.on) return;
      n.dragging = false; n.el.style.zIndex = ""; render();
      if (n.x < b.minX || n.x > b.maxX) n.mx.spring(clamp(n.x, b.minX, b.maxX), 200, 40, 1, 10);
      if (n.y < b.minY || n.y > b.maxY) n.my.spring(clamp(n.y, b.minY, b.maxY), 200, 40, 1, 10);
      drawMap();                                                       // onDragEnd: X (reference does not redraw during the bounce)
    };
    n.el.addEventListener("pointerup", end);
    n.el.addEventListener("pointercancel", end);
  });

  // ---- the RR mark
  const mark = $(".console-mark", consoleEl);
  mark.insertAdjacentHTML("beforeend", '<i class="live-dot" aria-hidden="true"></i>');
  const MK = { x: 0, y: 0, s: 1, r: 0 };
  const mkApply = () => (mark.style.transform = `translateX(${MK.x}px) translateY(${MK.y}px) scale(${MK.s}) rotate(${MK.r}deg)`);
  const mX = mv(0, (v) => { MK.x = v; mkApply(); }), mY = mv(0, (v) => { MK.y = v; mkApply(); });
  const mS = mv(1, (v) => { MK.s = v; mkApply(); }), mR = mv(0, (v) => { MK.r = v; mkApply(); });
  function syncBob() {                                                 // animate: !w && F ? {y:[0,-4,0]} : {y:0}
    const want = !live && bob;
    if (want === bobRunning) return;
    bobRunning = want;
    if (want) mY.run((p) => (p < 0.5 ? -4 * EASE_OUT(p * 2) : -4 + 4 * EASE_OUT((p - 0.5) * 2)), 1.4, { repeat: true });
    else mY.spring(0, 500, 25, undefined, 10);
  }
  function markGesture(scale, rot) {                                   // whileDrag on/off; uses the mark's `transition` prop
    if (!live && bob && scale !== 1) {                                                // {repeat: Infinity, duration: 1.4} → looping easeOut tween (reference quirk)
      mS.tween(scale, 1.4, EASE_OUT, { repeat: true }); mR.tween(rot, 1.4, EASE_OUT, { repeat: true });
      // For a clean settle on release instead of the reference's endless loop, use springs when scale === 1.
    } else { mS.spring(scale, 550, 30, undefined, 10); mR.spring(rot, 500, 25, undefined, 10); }
  }
  let md = null;
  mark.addEventListener("pointerdown", (e) => {
    if (live || isCoarse || e.button !== 0) return;                    // drag: !w && !B
    md = { px: e.clientX, py: e.clientY, ox: 0, oy: 0, on: false };
    mark.setPointerCapture(e.pointerId);
  });
  mark.addEventListener("pointermove", (e) => {
    if (!md) return;
    const dx = e.clientX - md.px, dy = e.clientY - md.py;
    if (!md.on) {
      if (Math.hypot(dx, dy) < 3) return;
      md.on = true; mX.stop(); mY.stop(); md.ox = MK.x; md.oy = MK.y;  // drag stops the bob for good
      dropZone.classList.add("on");                                    // onDragStart → H(true)
      markGesture(1.15, -6);
    }
    mX.set(md.ox + dx); mY.set(md.oy + dy);
  });
  const markUp = (e) => {
    if (!md) return; const was = md.on; md = null;
    if (!was) return;
    dropZone.classList.remove("on");                                   // H(false)
    mX.spring(0, 200, 40, 1, 10); mY.spring(0, 200, 40, 1, 10);       // dragSnapToOrigin
    markGesture(1, 0);                                                 // evaluated before going live, like the reference
    const R = mapRoot.getBoundingClientRect();                         // drop target = whole root (map + console)
    if (e.clientX >= R.left && e.clientX <= R.right && e.clientY >= R.top && e.clientY <= R.bottom) goLive();
  };
  mark.addEventListener("pointerup", markUp);
  mark.addEventListener("pointercancel", markUp);
  mark.addEventListener("dblclick", goLive);
  mark.addEventListener("click", () => { if (isCoarse) goLive(); });
  mark.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); goLive(); } });  // a11y extra (not in reference)

  // ---- reset (reference: S(false), M(3), E(0), x(-1), P+1 → nodes remount at their slots)
  resetBtn.addEventListener("click", () => {
    clearInterval(seqTimer);
    waiting = 3; booked = 0; step = -1;
    NODES.forEach((n) => { n.mx.set(0); n.my.set(0); n.ms.set(1); n.target = 1; n.dragging = false; n.el.style.zIndex = ""; });
    live = false; render(); startCounters(); drawMap();
  });

  // ---- start gate: in view (20%) OR 1.5s after load; bob 2.5s after the gate; coarse pointers auto-live after 1.5s
  function start() {
    if (started) return;
    started = true; render(); startCounters(); startSeq();
    setTimeout(() => { bob = true; render(); }, 2500);
  }
  new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { o.disconnect(); start(); } }, { threshold: 0.2 }).observe(mapRoot);
  setTimeout(start, 1500);
  if (isCoarse) setTimeout(() => setLive(true), 1500);
  render();

  /* =========================================================================
     Five layers: reference SiteAutomation <L/>
     ====================================================================== */
  // TOP → BOTTOM. Index r is "Layer 0{r+1}"; colours follow reference F in this order.
  const LAYERS = [
    { name: "Hiring & onboarding", c: "#351366", desc: "From the job post to the first day.", chips: [["Job posts", ""], ["Interviews", ""], ["Onboarding", ""], ["Hires", "7"]], items: [["Job posts", "end to end"], ["Interviews", "end to end"], ["Onboarding", "end to end"], ["Hires so far", "~7"]] },
    { name: "Attendance & records", c: "#49C9B8", desc: "Who's in, who's late, who's on leave, every day.", chips: [["Attendance", "daily"], ["LofiHRM", ""], ["Leave", ""], ["Records", ""]], items: [["Attendance management", "daily"], ["LofiHRM", "helped build"], ["Leave & records", "30 people"]] },
    { name: "Performance & MEPPS", c: "#6D4BC2", desc: "Monthly points, reviewed fairly, applied by finance.", chips: [["Performance", ""], ["MEPPS points", "monthly"], ["Rewards", ""], ["Discipline", ""], ["Payroll input", ""]], items: [["Performance management", "monthly"], ["MEPPS points", "since Jan 2026"], ["Reward & disciplinary systems", "points"], ["Payroll input to finance", "month end"]] },
    { name: "Training & policy", c: "#2F9C8E", desc: "Helping people grow, with the rules written down.", chips: [["Training & development", ""], ["HR policy", ""], ["Process design", ""]], items: [["Training & development", "ongoing"], ["HR policy", "written"], ["Process design", "for everyone"]] },
    { name: "Communication & relations", c: "#B49CFF", desc: "Keeping people informed and problems small.", chips: [["Internal comms", ""], ["Employee relations", ""], ["Conflict resolution", ""]], items: [["Internal communication", "daily"], ["Employee relations", "30 people"], ["Conflict resolution", "same rules"]] },
  ];
  const NL = LAYERS.length;
  const stack = $("[data-stack]");
  // DOM order = bottom first (reference renders [...P].reverse(), zIndex 10 - s)
  stack.innerHTML = LAYERS.map((l, r) => ({ l, r })).reverse().map(({ l, r }, s) =>
    `<div class="layer" data-r="${r}" style="--c:${l.c};z-index:${10 - s}" tabindex="0" role="button" aria-label="Layer 0${r + 1}: ${esc(l.name)}"><div class="layer-top"><span class="mono-label">Layer 0${r + 1}</span><b>${esc(l.name)}</b></div><div class="layer-chips">${l.chips.map(([t, v]) => `<span>${esc(t)}${v ? ` <em>${esc(v)}</em>` : ""}</span>`).join("")}</div></div>`).join("");
  let gapH = 14, hl = null;
  const LS = LAYERS.map((_, r) => {
    const el = $(`.layer[data-r="${r}"]`, stack), st = { z: (NL - 1 - r) * gapH, s: 1 };
    const ap = () => (el.style.transform = `translateZ(${st.z}px) scale(${st.s})`);
    ap();
    return { el, z: mv(st.z, (v) => { st.z = v; ap(); }), s: mv(1, (v) => { st.s = v; ap(); }) };
  });
  const zTarget = (r) => (NL - 1 - r) * gapH + (hl === r ? 40 : 0);
  const info = $(".layer-info");
  const swapPanel = presence(info, (y) => {
    const l = LAYERS[y];
    $(".li-num", info).textContent = `Layer 0${y + 1} of 5`;
    $(".li-name", info).textContent = l.name;
    $(".li-desc", info).textContent = l.desc;
    $(".li-items", info).innerHTML = l.items.map(([t, v]) => `<li><span>${esc(t)}</span><em>${esc(v)}</em></li>`).join("");
  }, { y: 10, dur: 250, initial: false });
  function setHover(r) {
    if (r === hl) return;
    hl = r;
    LS.forEach((L, i) => { L.el.classList.toggle("hl", hl === i); L.z.spring(zTarget(i), 220, 24); L.s.spring(hl === i ? 1.03 : 1, 220, 24); });
    swapPanel(hl ?? 1);
  }
  LS.forEach((L, r) => { L.el.addEventListener("mouseenter", () => setHover(r)); L.el.addEventListener("focus", () => setHover(r)); });
  $(".stack-box").addEventListener("mouseleave", () => setHover(null));
  swapPanel(1);                                                        // default panel = index 1 ("Layer 02"), nothing highlighted
  const layersSec = $("#layers");
  function updateLayers() {                                            // useScroll offset ["start 85%","end 40%"] → [14, 78]
    const r = layersSec.getBoundingClientRect(), vh = innerHeight;
    const p = clamp((0.85 * vh - r.top) / (r.height + 0.45 * vh), 0, 1);
    const g = 14 + 64 * p;
    if (g === gapH) return;
    gapH = g;
    LS.forEach((L, i) => L.z.spring(zTarget(i), 220, 24));
  }

  /* =========================================================================
     Horizontal delivery row + product cards
     ====================================================================== */
  const SUBS = [
    ["Sub-account 01", "Life insurance", "CRM workflows for lead management, follow-ups and opportunity tracking, plus day-to-day client operations.", "crm", "flow", "Life insurance"],
    ["Sub-account 02", "Credit", "Lead and follow-up workflows. I also mapped the challenges of maintaining these systems and costed the ongoing requirements, so the client could plan ahead.", "crm", "flow", "Credit"],
    ["Sub-account 03", "Event management", "External systems connected to the CRM, so leads and opportunities sync automatically and the team tracks them in one place.", "flow", "crm", "Event management"],
    ["Sub-account 04", "Spa / medical", "CRM workflows developed for spa and medical agencies, adapted to the business's specific requirements.", "crm", "flow", "Spa / medical"],
    ["Sub-account 05", "Life & health", "Workflows adapted to each life and health client's own process and requirements.", "crm", "flow", "Life & health"],
    ["Across all accounts", "Work completed. Client happy.", "Pipelines and automations that follow each lead from first contact to the right stage. The client confirmed the work was completed successfully and gave positive feedback.", "flow", "crm", "All accounts"],
  ];
  const track = $("[data-hs-track]");
  track.innerHTML = SUBS.map(([k, t, d, a, b, label]) => `<article class="hs-card"><div class="tall">${shot(a, label)}</div><div class="hs-right"><div class="wide">${shot(b, label)}</div><div class="meta"><p class="kicker">${esc(k)}</p><h3><a href="#" data-open="crm">${esc(t)} ↗</a></h3><p>${esc(d)}</p></div></div></article>`).join("");
  $$("[data-open]", track).forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); openModal("crm"); }));
  const hs = $("[data-hs]"), hsFill = $(".hs-fill");
  // Reference: x = useTransform(progress, [0,1], ["0%", "-100*(N-1.4)/N %"]), a % of the TRACK'S OWN WIDTH (≈ viewport).
  const HS_END = -100 * Math.max(0, (SUBS.length - 1.4) / SUBS.length);
  function updateHs() {
    const r = hs.getBoundingClientRect();
    const p = clamp(-r.top / (r.height - innerHeight), 0, 1);          // offset ["start start","end end"]
    // Option B (shows every card, not reference-exact):
    track.style.transform = `translateX(${-p * Math.max(0, track.scrollWidth - track.offsetWidth)}px)`;
    hsFill.style.width = p * 100 + "%";
  }
  $$("[data-hs-btn]").forEach((b) => b.addEventListener("click", () => {
    scrollBy({ top: Number(b.dataset.hsBtn) * ((hs.offsetHeight - innerHeight) / SUBS.length), behavior: "smooth" });
  }));

  const PRODUCTS = [
    { name: "LofiHRM", c: "#351366", badge: "Live", mock: "attendance", key: "attendance", desc: "LofiStack's in-house HR software. I helped build and shape it, and use it every day to run HR.", tags: ["HR", "Attendance", "In-house"], caps: ["Attendance logged as people check in", "Leave and records kept in one place", "Ready for the month-end review"] },
    { name: "MEPPS", c: "#49C9B8", badge: "Since Jan 2026", mock: "mepps", key: "mepps", desc: "The Monthly Employee Performance Point System I designed and launched. Same written rules for everyone.", tags: ["Monthly", "Points", "Finance"], caps: ["Breaches and rewards logged as points", "Totals reviewed at month end", "Finance applies deductions and rewards"] },
    { name: "Business CRM", c: "#6D4BC2", badge: "2024", mock: "crmbuild", key: "crmbuild", desc: "A business CRM I built during my IT Officer year at LofiStack.", tags: ["CRM", "IT Officer"], caps: ["Contacts captured in one place", "Leads and customers kept apart", "Built in my IT Officer year"] },
    { name: "Client websites", c: "#2F9C8E", badge: "12 sites", mock: "websites", key: "websites", desc: "Twelve conversion-focused websites built for clients as IT Officer.", tags: ["Websites", "IT Officer"], caps: ["Twelve client sites, built in 2024", "Designed to turn visitors into leads", "Connected to the client's tools"] },
  ];
  const grid = $("[data-products]");
  grid.innerHTML = PRODUCTS.map((p) => `<li><a class="prod" href="#" data-k="${p.key}" style="--c:${p.c}"><div class="prod-top"><span class="prod-badge">${esc(p.badge)}</span><div class="prod-ui"><div class="scr">${shot(p.mock)}</div><div class="prod-cap"><div class="segs">${p.caps.map((_, i) => `<button type="button" aria-label="Step ${i + 1}"><span><i></i></span></button>`).join("")}</div><p></p></div></div></div><div class="prod-body"><h4>${esc(p.name)}<span>↗</span></h4><p>${esc(p.desc)}</p><div class="tags">${p.tags.map((t) => `<span>${esc(t)}</span>`).join("")}</div></div></a></li>`).join("");
  const PERIOD = 1600;                                                 // DemoShell period
  $$(".prod", grid).forEach((a, pi) => {
    const P = PRODUCTS[pi], ui = $(".prod-ui", a), cap = $(".prod-cap p", a);
    const fills = $$(".segs i", a), rows = $$(".scr .mk-row", a);
    let o = 0, paused = false, timer = 0;
    const swapCap = presence(cap, (k) => { cap.innerHTML = `<span class="n">${k + 1}/${P.caps.length}</span>${esc(P.caps[k])}`; }, { y: 4, dur: 200, initial: true });
    function paint() {
      fills.forEach((f, r) => {
        f.getAnimations().forEach((x) => x.cancel());
        f.style.width = r < o ? "100%" : r === o ? (paused ? "40%" : "100%") : "0%";
        if (r === o && !paused) f.animate([{ width: "0%" }, { width: "100%" }], { duration: PERIOD, easing: "linear" });
      });
      // Mini UI reacts to the step (approximation of the reference demos dimming rows i > step to .35)
      const upto = Math.ceil(((o + 1) * rows.length) / P.caps.length);
      rows.forEach((el, i) => el.classList.toggle("dim", i >= upto));
      swapCap(o);
    }
    const run = () => { clearInterval(timer); if (!paused) timer = setInterval(() => { o = (o + 1) % P.caps.length; paint(); }, PERIOD); };
    ui.addEventListener("mouseenter", () => { paused = true; run(); paint(); });
    ui.addEventListener("mouseleave", () => { paused = false; run(); paint(); });
    $$(".segs button", a).forEach((b, r) => b.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); o = r; paint(); }));  // no interval restart (reference)
    paint(); run();
    a.addEventListener("click", (e) => { e.preventDefault(); openModal(a.dataset.k, P.mock); });
    // whileHover { y: -4 }, spring 300/22 (mouse/pen only, like framer's hover gesture)
    const hy = mv(0, (v) => (a.style.transform = v ? `translateY(${v}px)` : ""));
    a.addEventListener("pointerenter", (e) => { if (e.pointerType !== "touch") hy.spring(-4, 300, 22); });
    a.addEventListener("pointerleave", (e) => { if (e.pointerType !== "touch") hy.spring(0, 300, 22); });
  });

  /* =========================================================================
     Kanban: auto move every 1400ms, layout FLIP with spring 300/26,
     drag with scale 1.06 + dashed columns + 1200ms ring (mirrors the reference)
     ====================================================================== */
  const COLS = [["Applied", "var(--muted-foreground)"], ["Screened", "#B49CFF"], ["Interview", "#6D4BC2"], ["Offer", "var(--accent)"], ["Onboarded", "var(--accent)"]];
  const KAV = ["#351366", "#1F6E64", "#4B2A86", "#17524B", "#2A1750"];
  const STAGE_NOTE = { 3: "Offer sent · this week", 4: "Hired · onboarding" };
  const CANDS = [
    ["CA", "Candidate A", "Frontend developer", "LinkedIn", "1d"], ["CB", "Candidate B", "Project coordinator", "Referral", "2d"],
    ["CC", "Candidate C", "Support executive", "Job board", "3h"], ["CD", "Candidate D", "Designer", "LinkedIn", "4d"],
    ["CE", "Candidate E", "QA tester", "Job board", "1d"], ["CF", "Candidate F", "Sales executive", "Referral", "2d"],
    ["CG", "Candidate G", "Content writer", "LinkedIn", "5d"], ["CH", "Candidate H", "Backend developer", "Referral", "1d"],
    ["CI", "Candidate I", "Ops assistant", "Job board", "6d"], ["CJ", "Candidate J", "HR assistant", "Referral", "2d"],
  ];
  const kCards = CANDS.map((c, id) => ({ id, stage: +(id % 3 === 0) }));
  const kb = $("[data-kanban]");
  kb.innerHTML = COLS.map(([n, c], i) => `<div class="k-col${i >= 3 ? " k-col-win" : ""}" data-col="${i}"><div class="k-head"><span><i style="background:${c}"></i><p>${n}</p></span><em>0</em></div><div class="k-list"></div></div>`).join("");
  const kColEls = $$(".k-col", kb);
  const colList = (i) => $(".k-list", kColEls[i]);
  const cardEl = new Map();
  CANDS.forEach(([ini, name, role, src, when], id) => {
    const el = document.createElement("div");
    el.className = "k-card"; el.dataset.id = id;
    el.innerHTML = `<div class="k-top"><span class="k-av" style="background:${KAV[id % 5]}">${ini}</span><div><div class="k-name">${esc(name)}</div><div class="k-role">${esc(role)}</div></div></div><div class="k-foot"><span class="k-tag">${src}</span><span class="k-when">${when}</span></div><div class="k-note"></div>`;
    cardEl.set(id, el);
  });
  const kPlay = $("[data-k-play]"), kWon = $("[data-k-won]"), kBooked = $("[data-k-booked]");
  function kPlace() {
    COLS.forEach((_, s) => {
      const list = colList(s);
      kCards.filter((c) => c.stage === s).forEach((c) => {
        const el = cardEl.get(c.id);
        el.classList.toggle("k-win", c.stage >= 3);
        $(".k-note", el).textContent = STAGE_NOTE[c.stage] || "";
        list.appendChild(el);
      });
      $(".k-head em", kColEls[s]).textContent = kCards.filter((c) => c.stage === s).length;
    });
    if (kPlay) kPlay.textContent = kCards.filter((c) => c.stage >= 2 && c.stage < 4).length;
    if (kWon) kWon.textContent = kCards.filter((c) => c.stage === 4).length;
    if (kBooked) kBooked.textContent = kCards.filter((c) => c.stage >= 3).length;
  }
  kPlace();
  if (motion) cardEl.forEach((el) => el.animate([{ opacity: 0, transform: "scale(.9)" }, { opacity: 1, transform: "none" }], { duration: 720, easing: SPRING_300_26 }));

  function kCommit(mutate) {
    const kbR = kb.getBoundingClientRect();
    const before = new Map(), prev = new Map(), clones = new Map();
    kCards.forEach((c) => {
      const el = cardEl.get(c.id);
      before.set(c.id, el.getBoundingClientRect());
      prev.set(c.id, c.stage);
      if (motion) clones.set(c.id, el.cloneNode(true));
    });
    cardEl.forEach((el) => el.getAnimations().forEach((a) => { if (!(a instanceof CSSTransition)) a.cancel(); }));
    mutate();
    kPlace();
    if (!motion) return;
    kCards.forEach((c) => {
      const el = cardEl.get(c.id), a = before.get(c.id), b = el.getBoundingClientRect();
      const dx = a.left + a.width / 2 - (b.left + b.width / 2), dy = a.top + a.height / 2 - (b.top + b.height / 2);
      const sx = a.width / b.width, sy = a.height / b.height;
      const from = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
      if (prev.get(c.id) !== c.stage) {
        el.animate([{ transform: `${from} scale(.9)`, opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 720, easing: SPRING_300_26 });
        const g = clones.get(c.id);
        g.classList.add("k-ghost"); g.classList.remove("dragging", "ring");
        g.removeAttribute("data-id");
        g.style.cssText = `left:${a.left - kbR.left}px;top:${a.top - kbR.top}px;width:${a.width}px;height:${a.height}px`;
        kb.appendChild(g);
        g.animate([{ transform: "none", opacity: 1 }, { transform: `translate(${-dx}px, ${-dy}px) scale(${(b.width / a.width) * 0.9}, ${(b.height / a.height) * 0.9})`, opacity: 0 }],
          { duration: 720, easing: SPRING_300_26, fill: "forwards" }).onfinish = () => g.remove();
      } else if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5 || Math.abs(sy - 1) > 0.001) {
        el.animate([{ transform: from }, { transform: "none" }], { duration: 720, easing: SPRING_300_26 });
      }
    });
  }

  let kDragId = null, kTimer = 0;
  const kTick = () => {
    if (kDragId !== null) return;
    const open = kCards.filter((c) => c.stage < 4);
    kCommit(() => {
      if (!open.length) kCards.forEach((c) => (c.stage = 0));
      else open[Math.floor(Math.random() * open.length)].stage++;
    });
  };
  const kStart = () => { clearInterval(kTimer); kTimer = setInterval(kTick, 1400); };
  kStart();

  const coarseQ = matchMedia("(pointer: coarse)");
  const K_SHADOW_T = "box-shadow .3s cubic-bezier(.25,.1,.35,1)";
  kb.addEventListener("pointerdown", (e) => {
    const el = e.target.closest(".k-card:not(.k-ghost)");
    if (!el || coarseQ.matches || e.button !== 0) return;
    e.preventDefault();
    const id = Number(el.dataset.id), card = kCards[id];
    el.getAnimations().forEach((a) => { if (!(a instanceof CSSTransition)) a.cancel(); });
    kDragId = id; kStart();
    const sx = e.clientX, sy = e.clientY;
    el.setPointerCapture(e.pointerId);
    el.classList.add("dragging"); kb.classList.add("drag-on");
    el.style.transition = `scale .515s ${SPRING_550_30}, ${K_SHADOW_T}`;
    el.style.translate = "0px 0px";
    el.style.scale = "1.06";
    const move = (ev) => { el.style.translate = `${ev.clientX - sx}px ${ev.clientY - sy}px`; };
    const up = (ev) => {
      el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up);
      kb.classList.remove("drag-on"); el.classList.remove("dragging");
      const target = kColEls.findIndex((col) => { const r = col.getBoundingClientRect(); return ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom; });
      if (target >= 0 && target !== card.stage) {
        el.style.transition = K_SHADOW_T;
        kCommit(() => { card.stage = target; el.style.translate = ""; el.style.scale = ""; });
      } else {
        el.style.transition = `translate 1.395s ${SPRING_200_40}, scale .515s ${SPRING_550_30}, ${K_SHADOW_T}`;
        el.style.translate = "0px 0px"; el.style.scale = "1";
        setTimeout(() => { if (kDragId === null && !el.classList.contains("dragging")) { el.style.transition = ""; el.style.translate = ""; el.style.scale = ""; } }, 1400);
      }
      if (target >= 0) { el.classList.add("ring"); setTimeout(() => el.classList.remove("ring"), 1200); }
      kDragId = null; kStart();
    };
    el.addEventListener("pointermove", move); el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
  });

  /* =========================================================================
     Inbox: chained timeline, typewriter 16ms/char (mirrors the reference)
     ====================================================================== */
  const THREADS = [
    { ini: "EA", name: "Employee A.", team: "Delivery team · leave request", tag: "Approved", acc: 1, q: "Can I take leave next Thursday?", a: "Approved. It's recorded in LofiHRM, enjoy the day off.", s: "Approved · Thursday" },
    { ini: "EB", name: "Employee B.", team: "Design team · attendance", tag: "Fixed", acc: 0, q: "I clocked in late, but the system was down.", a: "Thanks for flagging it. I checked the log and corrected it, so no MEPPS points.", s: "Corrected · no points" },
    { ini: "EC", name: "Employee C.", team: "Support team · payslip", tag: "Replied", acc: 0, q: "Why was there a deduction this month?", a: "Two late arrivals under MEPPS this month. The breakdown is in your monthly summary.", s: "Explained · MEPPS" },
    { ini: "ED", name: "Employee D.", team: "Delivery team · training", tag: "Scheduled", acc: 1, q: "Can I join the next project management training?", a: "Yes. You're booked for the next session, and it counts toward your development plan.", s: "Scheduled · next session" },
  ];
  const ib = $("[data-inbox]");
  const ibList = $(".inbox-list", ib), thread = $(".thread", ib);
  const IB_EASE = "cubic-bezier(.25,.1,.35,1)";
  ibList.innerHTML = THREADS.map((t, i) => `<li><button type="button" data-t="${i}"><span class="ib-av" style="background:${AV[i % AV.length]}">${t.ini}</span><span class="ib-main"><b>${esc(t.name)} <em>· ${esc(t.team)}</em></b><span>${esc(t.q)}</span></span><span class="ib-tag ${t.acc ? "acc" : ""}">${t.tag}</span></button></li>`).join("");
  const ibBtns = $$("button", ibList);
  let ibR = 0, ibRun = 0;
  function setThread(next) {
    ibR = next; const run = ++ibRun; const t = THREADS[ibR % THREADS.length];
    ibBtns.forEach((b, j) => b.classList.toggle("sel", j === ibR % THREADS.length));
    $(".pane-name", ib).textContent = t.name;
    $(".pane-meta", ib).textContent = t.team;
    const mount = () => {
      if (run !== ibRun) return;
      thread.innerHTML = `<div class="convo"><div class="msg in">${esc(t.q)}</div></div>`;
      const convo = thread.firstElementChild;
      if (motion) {
        convo.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: IB_EASE });
        convo.animate([{ transform: "translateY(8px)" }, { transform: "none" }], { duration: 662, easing: SPRING_500_25 });
      }
    };
    const old = thread.firstElementChild;
    if (old && motion) {
      const op = getComputedStyle(old).opacity;
      old.getAnimations().forEach((a) => a.cancel());
      old.style.opacity = op;
      old.animate([{ opacity: op }, { opacity: 0 }], { duration: 300, easing: IB_EASE, fill: "forwards" }).onfinish = mount;
    } else mount();
    setTimeout(() => { if (run === ibRun) showReply(run, t); }, 900);
  }
  function showReply(run, t) {
    const convo = $(".convo", thread); if (!convo) return;
    const bub = document.createElement("div");
    bub.className = "msg out";
    bub.innerHTML = `<div class="tw typing"><div class="tw-ghost">${esc(t.a)}</div><div class="tw-live"><span class="tw-text"></span><span class="tw-cur">|</span></div></div>`;
    convo.appendChild(bub);
    const txt = $(".tw-text", bub), tw = $(".tw", bub), L = t.a.length;
    const done = () => { tw.classList.remove("typing"); setTimeout(() => { if (run === ibRun) showStatus(run, t, convo); }, 400); };
    if (!motion) { txt.textContent = t.a; return done(); }
    let i = 0;
    txt.textContent = t.a.slice(0, 1);
    const iv = setInterval(() => {
      if (run !== ibRun) return clearInterval(iv);
      i = Math.min(i + 1, L);
      txt.textContent = t.a.slice(0, Math.max(i, 1));
      if (i >= L) { clearInterval(iv); done(); }
    }, 16);
  }
  function showStatus(run, t, convo) {
    const s = document.createElement("div");
    s.className = "msg status" + (t.acc ? " acc" : "");
    s.innerHTML = `<i></i><span>${esc(t.s)}</span>`;
    convo.appendChild(s);
    if (motion) s.animate([{ opacity: 0, transform: "translateY(8px) scale(.95)" }, { opacity: 1, transform: "none" }], { duration: 910, easing: SPRING_260_20 });
    setTimeout(() => { if (run === ibRun) setThread(ibR + 1); }, (motion ? 700 : 0) + 2600);
  }
  ibBtns.forEach((b) => b.addEventListener("click", () => setThread(Number(b.dataset.t))));
  $("[data-inbox-next]").addEventListener("click", () => setThread(ibR + 1));
  setThread(0);

  /* CountUp: 0 -> value, 1.6s, ease [.22,1,.36,1]; starts on 20% in view OR 1800ms after load, once */
  const bez = (x1, y1, x2, y2) => {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const sx = (t) => ((ax * t + bx) * t + cx) * t, sy = (t) => ((ay * t + by) * t + cy) * t, dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
    return (x) => { let t = x; for (let i = 0; i < 8; i++) { const e = sx(t) - x, d = dx(t); if (Math.abs(e) < 1e-6 || !d) break; t -= e / d; } return sy(Math.min(1, Math.max(0, t))); };
  };
  const easeCU = bez(0.22, 1, 0.36, 1);
  $$("[data-countup]").forEach((el) => {
    const to = Number(el.dataset.countup);
    if (!motion) { el.textContent = to.toLocaleString(); return; }
    el.textContent = "0";
    let started = false, tm = 0;
    const io2 = new IntersectionObserver((es) => { if (es[0].isIntersecting) go(); }, { threshold: 0.2 });
    function go() {
      if (started) return; started = true; io2.disconnect(); clearTimeout(tm);
      const t0 = performance.now();
      const step = (now) => { const p = Math.min(1, (now - t0) / 1600); el.textContent = Math.round(to * easeCU(p)).toLocaleString(); if (p < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    }
    io2.observe(el); tm = setTimeout(go, 1800);
  });

  /* =========================================================================
     Scroll-driven bits
     ====================================================================== */
  let ticking = false;
  const onScroll = () => { ticking = false; updateLayers(); updateHs(); };
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  addEventListener("resize", onScroll);
  onScroll();

  /* =========================================================================
     Dock: hovered tile fills with accent and springs up; one shared tooltip
     ====================================================================== */
  const dock = $("[data-dock]");
  const allDk = $$(".dk", dock);
  const narrowMq = matchMedia("(max-width: 639px)");
  const visDk = () => allDk.filter((d) => !(narrowMq.matches && d.hasAttribute("data-narrow-hide")));
  const tip = $(".dk-tip", dock), tipBox = $(".dk-tip-box", tip), tipTrack = $(".dk-tip-track", tip);
  let hov = null, dir = 0, curLbl = null;
  const tp = { x: 0, y: 12, s: 0.92, o: 0 };
  const paintTip = () => { tip.style.transform = `translateX(${tp.x}px) translateY(${tp.y}px) scale(${tp.s})`; tip.style.opacity = tp.o; };
  const tX = spring(SP_DOCK_TIP, (v) => { tp.x = v; paintTip(); }, 0);
  const tY = spring(SP_DOCK_TIP, (v) => { tp.y = v; paintTip(); }, 12);
  const tS = spring(SP_DOCK_TIP, (v) => { tp.s = v; paintTip(); }, 0.92);
  const tO = spring(SP_DOCK_TIP, (v) => { tp.o = v; paintTip(); }, 0);
  const tW = spring({ ...SP_DOCK_TIP, span: 10 }, (v) => (tipBox.style.width = v + "px"), 100);
  const tiles = allDk.map((d) => {
    const inn = $(".dk-in", d), st = { y: 0, s: 1 };
    const paint = () => (inn.style.transform = `translateY(${st.y}px) scale(${st.s})`);
    return { d, y: spring(SP_DOCK_ICON, (v) => { st.y = v; paint(); }, 0), s: spring(SP_DOCK_ICON, (v) => { st.s = v; paint(); }, 1), pressed: false };
  });
  const tileFor = (d) => tiles.find((t) => t.d === d);
  function setLabel(text) {
    const old = curLbl;
    const el = document.createElement("span");
    el.textContent = text; el.dataset.f = dir;
    if (old) {
      old.style.position = "absolute"; old.style.left = old.offsetLeft + "px"; old.style.top = old.offsetTop + "px";
      const f = Number(old.dataset.f);
      old.animate([{ transform: "translateX(0)", opacity: 1, filter: "blur(0px)" }, { transform: `translateX(${f > 0 ? -35 : 35}px)`, opacity: 0, filter: "blur(6px)" }],
        { duration: 300, easing: "cubic-bezier(0,0,.58,1)", fill: "forwards" }).onfinish = () => old.remove();
    }
    tipTrack.appendChild(el);
    el.animate([{ transform: `translateX(${dir > 0 ? 35 : -35}px)`, opacity: 0, filter: "blur(6px)" }, { transform: "translateX(0)", opacity: 1, filter: "blur(0px)" }],
      { duration: 300, easing: "cubic-bezier(0,0,.58,1)" });
    curLbl = el;
    const w = Math.max(100, el.offsetWidth + 40 + 2);
    if (!tip.classList.contains("show")) tW.jump(w); else tW.set(w);
  }
  function setHover(i) {
    const vis = visDk();
    vis.forEach((d, j) => {
      const on = j === i, t = tileFor(d);
      d.classList.toggle("on", on);
      if (!t.pressed) { t.y.set(on ? -3 : 0); t.s.set(on ? 1.1 : 1); }
    });
    if (i === null) {
      tO.set(0, () => { if (hov === null) { tip.classList.remove("show"); tipTrack.textContent = ""; curLbl = null; tX.jump(0); } });
      tS.set(0.92); tY.set(12);
      return;
    }
    const wasHidden = !tip.classList.contains("show");
    if (wasHidden) { tX.jump(0); tY.jump(12); tS.jump(0.92); tO.jump(0); tipTrack.textContent = ""; curLbl = null; tip.classList.add("show"); }
    setLabel(vis[i].dataset.label);
    tX.set(52 * i + 12); tY.set(-60); tS.set(1); tO.set(1);
  }
  allDk.forEach((d) => {
    d.addEventListener("mouseenter", () => {
      const r = visDk().indexOf(d);
      if (hov !== null && r !== hov) dir = r > hov ? 1 : -1;
      if (r === hov) return;
      hov = r; setHover(r);
    });
    const t = tileFor(d);
    d.addEventListener("pointerdown", () => { t.pressed = true; t.s.set(0.95); });
    const release = () => { if (!t.pressed) return; t.pressed = false; const on = d.classList.contains("on"); t.s.set(on ? 1.1 : 1); t.y.set(on ? -3 : 0); };
    d.addEventListener("pointerup", release); d.addEventListener("pointerleave", release);
  });
  dock.addEventListener("mouseleave", () => { hov = null; dir = 0; setHover(null); });

  const themeBtn = $("[data-theme-toggle]");
  const syncTheme = () => {
    const dark = root.classList.contains("dark");
    themeBtn.dataset.label = dark ? "Light mode" : "Dark mode";
    themeBtn.setAttribute("aria-label", themeBtn.dataset.label);
    $('meta[name="theme-color"]').setAttribute("content", dark ? "#0e0a1c" : "#faf9fd");
  };
  themeBtn.addEventListener("click", () => {
    const dark = !root.classList.contains("dark");
    root.classList.toggle("dark", dark);
    try { localStorage.setItem("rr-theme", dark ? "dark" : "light"); } catch (e) {}
    syncTheme();
    const vis = visDk(); if (hov !== null && vis[hov] === themeBtn) setLabel(themeBtn.dataset.label);
    setTimeout(drawMap, 50);
  });
  syncTheme();


  /* Copy email */
  $$("[data-copy]").forEach((b) => {
    const lbl = $(".lbl", b), text = lbl.textContent;
    b.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(b.dataset.copy); lbl.textContent = "Copied!"; } catch { lbl.textContent = b.dataset.copy; }
      setTimeout(() => (lbl.textContent = text), 2000);
    });
  });

  /* Magnetic buttons + press scale (spring 260/18, factor .28 accent / .2 outline, tap .97) */
  if (fine) $$(".btn").forEach((b) => {
    const f = b.classList.contains("btn-accent") ? 0.28 : 0.2;
    const st = { x: 0, y: 0, s: 1 };
    const paint = () => { b.style.transform = st.x || st.y || st.s !== 1 ? `translateX(${st.x}px) translateY(${st.y}px) scale(${st.s})` : ""; };
    const sx = spring({ ...SP_MAGNET, span: 10 }, (v) => { st.x = v; paint(); }), sy = spring({ ...SP_MAGNET, span: 10 }, (v) => { st.y = v; paint(); });
    const ss = spring(SP_TAP, (v) => { st.s = v; paint(); }, 1);
    b.addEventListener("mousemove", (e) => { const r = b.getBoundingClientRect(); sx.set((e.clientX - (r.left + r.width / 2)) * f); sy.set((e.clientY - (r.top + r.height / 2)) * f); });
    b.addEventListener("mouseleave", () => { sx.set(0); sy.set(0); ss.set(1); });
    b.addEventListener("pointerdown", () => ss.set(0.97));
    addEventListener("pointerup", () => ss.set(1));
  });

  root.classList.add("ready");
})();
