(() => {
  const root = document.documentElement;
  const motion = root.classList.contains("motion");
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

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
     Modal + hover preview
     ====================================================================== */
  const modal = $("[data-modal]");
  let lastFocus = null;
  function openModal(key, mock) {
    const d = D[key] || D.profile;
    lastFocus = document.activeElement;
    $(".modal-shot", modal).innerHTML = shot(mock || key);
    $(".modal-kick", modal).textContent = d.kick;
    $("#modal-title").textContent = d.title;
    $(".modal-list", modal).innerHTML = d.items.map((t) => `<li>${esc(t)}</li>`).join("");
    modal.hidden = false;
    $(".modal-x", modal).focus();
  }
  function closeModal() { modal.hidden = true; lastFocus?.focus(); }
  $$("[data-close]", modal).forEach((b) => b.addEventListener("click", closeModal));
  addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) closeModal(); });

  const preview = $(".hover-preview");
  const showPreview = (kind) => { if (!fine) return; preview.innerHTML = shot(kind); preview.classList.add("on"); };
  const hidePreview = () => preview.classList.remove("on");
  addEventListener("pointermove", (e) => { if (preview.classList.contains("on")) { preview.style.left = e.clientX + "px"; preview.style.top = e.clientY + "px"; } }, { passive: true });

  /* =========================================================================
     Headings split into words; reveal on scroll
     ====================================================================== */
  $$("[data-split]").forEach((el) => {
    const text = el.textContent.trim();
    el.setAttribute("aria-label", text);
    el.innerHTML = text.split(/\s+/).map((w, i) => `<span class="w" aria-hidden="true"><span style="--i:${i}">${esc(w)}</span></span>`).join(" ");
  });
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.2 });
  $$("[data-split], .rv").forEach((el) => (motion ? io.observe(el) : el.classList.add("in")));

  /* =========================================================================
     Hero: rotating word and typed terminal line
     ====================================================================== */
  const rot = $(".rot");
  const words = rot.dataset.words.split("|");
  const setWord = (w) => { rot.innerHTML = [...w].map((c, i) => `<span class="ch" style="--c:${i}">${c === " " ? "&nbsp;" : esc(c)}</span>`).join(""); };
  setWord(words[0]);
  if (motion) { let wi = 0; setInterval(() => setWord(words[++wi % words.length]), 2200); }

  const term = $(".term-text");
  const LINES = [
    "close the month · attendance + MEPPS points + finance hand-off · 3 steps · done ✓",
    "onboard new hire · offer letter + LofiHRM profile + MEPPS rules · 4 steps · done ✓",
    "hire for delivery · job post + interviews + onboarding · 3 rounds · done ✓",
    "sync client accounts · ClickUp + ProofHub + Discord · ~20 accounts · done ✓",
  ];
  (async () => {
    if (!motion) { term.textContent = LINES[0]; return; }
    for (let i = 0; ; i++) {
      const line = LINES[i % LINES.length];
      for (let k = 1; k <= line.length; k++) { term.textContent = line.slice(0, k); await wait(34); }
      await wait(1800);
      for (let k = line.length; k >= 0; k -= 2) { term.textContent = line.slice(0, k); await wait(12); }
      await wait(300);
    }
  })();

  /* =========================================================================
     Coverflow carousel
     ====================================================================== */
  const cfStage = $(".cf-stage");
  const cfLabel = $(".cf-label");
  cfStage.innerHTML = COVER.map(([k, n], i) => `<button class="cf-card" type="button" data-i="${i}" aria-label="${esc(n)}">${shot(k)}</button>`).join("");
  const cfCards = $$(".cf-card", cfStage);
  let cfA = 0, cfTimer = null;
  function cfRender() {
    const n = cfCards.length;
    const w = cfCards[0].offsetWidth || 560;
    cfCards.forEach((c, i) => {
      let o = i - cfA;
      if (o > n / 2) o -= n; if (o < -n / 2) o += n;
      const a = Math.abs(o);
      c.style.setProperty("--x", `${o * w * 0.62}px`);
      c.style.setProperty("--z", `${-a * 220}px`);
      c.style.setProperty("--ry", `${clamp(-o * 38, -60, 60)}deg`);
      c.style.opacity = a > 2 ? 0 : a === 2 ? 0.55 : 1;
      c.style.filter = a ? `brightness(${1 - a * 0.18})` : "none";
      c.style.zIndex = 10 - a;
      c.style.pointerEvents = a > 2 ? "none" : "auto";
      c.tabIndex = a === 0 ? 0 : -1;
    });
    cfLabel.textContent = `${String(cfA + 1).padStart(2, "0")} / ${String(n).padStart(2, "0")} · ${COVER[cfA][1]}`;
  }
  const cfGo = (i) => { cfA = (i + cfCards.length) % cfCards.length; cfRender(); };
  const cfAuto = () => { clearInterval(cfTimer); if (motion) cfTimer = setInterval(() => cfGo(cfA + 1), 4200); };
  cfCards.forEach((c, i) => c.addEventListener("click", () => { if (i === cfA) openModal(COVER[i][0] === "crm" ? "crm" : COVER[i][0]); else cfGo(i); cfAuto(); }));
  $$("[data-cf]").forEach((b) => b.addEventListener("click", () => { cfGo(cfA + (b.dataset.cf === "next" ? 1 : -1)); cfAuto(); }));
  $(".coverflow").addEventListener("pointerenter", () => clearInterval(cfTimer));
  $(".coverflow").addEventListener("pointerleave", cfAuto);
  addEventListener("resize", cfRender);
  cfRender(); cfAuto();

  /* =========================================================================
     Scatter: floating cards drift to new spots; the headline cycles
     ====================================================================== */
  const scatter = $("[data-scatter]");
  const scWrap = $(".scatter-cards", scatter);
  const scKinds = ["attendance", "mepps", "crm", "onboarding", "delivery"];
  scWrap.innerHTML = scKinds.map((k) => `<div class="sc-card">${shot(k)}</div>`).join("");
  const scCards = $$(".sc-card", scWrap);
  const scTitle = $(".scatter-title");
  const HEADS = ["30 people, one set of rules", "7 hires, post to onboarding", "~20 client accounts at a time", "2 promotions in two years", "1 point system, every month"];
  let hi = 0;
  function scPlace() {
    const W = scatter.clientWidth, H = scatter.clientHeight;
    const cw = Math.min(320, W * 0.42), ch = cw * 0.44;
    const zones = [[0.02, 0.08], [0.62, 0.04], [0.04, 0.66], [0.6, 0.62], [0.32, 0.82], [0.7, 0.34], [0.0, 0.38], [0.36, 0.0]];
    const pick = zones.sort(() => Math.random() - 0.5).slice(0, scCards.length);
    scCards.forEach((c, i) => {
      c.style.width = cw + "px"; c.style.height = ch + "px";
      const [zx, zy] = pick[i];
      const x = clamp(zx * W + (Math.random() - 0.5) * 40, -cw * 0.15, W - cw * 0.85);
      const y = clamp(zy * H + (Math.random() - 0.5) * 40, 0, H - ch);
      c.style.left = "0px"; c.style.top = "0px";
      c.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${(Math.random() * 40 - 20).toFixed(2)}deg)`;
    });
  }
  scPlace();
  if (motion) setInterval(() => {
    scPlace();
    scTitle.classList.add("out");
    setTimeout(() => { scTitle.textContent = HEADS[++hi % HEADS.length]; scTitle.classList.remove("out"); }, 500);
  }, 3600);
  addEventListener("resize", scPlace);

  /* =========================================================================
     Rack: an overlapping row of cards; drag or use the arrows
     ====================================================================== */
  const rack = $("[data-rack]");
  rack.innerHTML = RACK.map(([k, n], i) => `<button class="rack-card" type="button" data-i="${i}" aria-label="${esc(n)}"><span class="frame">${shot(k)}</span><span class="rack-name">${esc(n)}</span></button>`).join("");
  const rCards = $$(".rack-card", rack);
  let rA = 2;
  function rackRender() {
    const w = rCards[0].offsetWidth;
    rCards.forEach((c, i) => {
      const o = i - rA, a = Math.abs(o);
      const tight = -w * 0.67, open = -w * 0.18;
      c.style.marginLeft = i === 0 ? "0px" : (i === rA || i === rA + 1 ? open : tight) + "px";
      c.style.zIndex = 100 - a;
      c.style.transform = o === 0 ? "rotateY(0deg) translateZ(40px)" : `rotateY(${o < 0 ? 34 : -34}deg)`;
      c.style.filter = `brightness(${o === 0 ? 1 : Math.max(0.45, 0.92 - a * 0.07)})`;
      c.classList.toggle("active", o === 0);
    });
    requestAnimationFrame(() => {
      const wr = rack.parentElement.getBoundingClientRect();
      const cr = rCards[rA].getBoundingClientRect();
      const cur = new DOMMatrix(getComputedStyle(rack).transform).m41 || 0;
      const shift = cur + (wr.left + wr.width / 2) - (cr.left + cr.width / 2);
      rack.style.transform = `translateX(${shift}px)`;
    });
  }
  const rackGo = (i) => { rA = clamp(i, 0, rCards.length - 1); rackRender(); };
  $$("[data-rack-btn]").forEach((b) => b.addEventListener("click", () => rackGo(rA + Number(b.dataset.rackBtn))));
  let rDrag = null;
  rack.addEventListener("pointerdown", (e) => { rDrag = { x: e.clientX, start: rA, moved: false }; });
  addEventListener("pointermove", (e) => {
    if (!rDrag) return;
    const dx = e.clientX - rDrag.x;
    if (Math.abs(dx) > 6) { rDrag.moved = true; rack.classList.add("dragging"); }
    if (rDrag.moved) { const next = clamp(rDrag.start - Math.round(dx / 70), 0, rCards.length - 1); if (next !== rA) rackGo(next); }
  });
  addEventListener("pointerup", () => { if (rDrag?.moved) setTimeout(() => rack.classList.remove("dragging"), 0); setTimeout(() => (rDrag = null), 0); });
  rCards.forEach((c, i) => c.addEventListener("click", (e) => {
    if (rDrag?.moved) { e.preventDefault(); return; }
    if (i === rA) openModal(RACK[i][0]); else rackGo(i);
  }));
  rack.addEventListener("keydown", (e) => { if (e.key === "ArrowRight") rackGo(rA + 1); if (e.key === "ArrowLeft") rackGo(rA - 1); });
  addEventListener("resize", rackRender);
  rackRender();

  /* =========================================================================
     Tilted list
     ====================================================================== */
  const tl = $("[data-tiltlist]");
  tl.innerHTML = ROWS.map(([key, mock, title, where], i) => `<li class="tl-row" style="margin-inline:${Math.max(0, 8.8 - i * 1.1).toFixed(1)}%;--i:${i}"><button type="button" data-key="${key}" data-mock="${mock}"><span class="tl-n">${String(i + 1).padStart(2, "0")}</span><span class="tl-t">${esc(title)}</span><span class="tl-w">${esc(where)}</span><span class="tl-o">Open ↗</span></button></li>`).join("");
  $$("button", tl).forEach((b) => {
    b.addEventListener("pointerenter", () => showPreview(b.dataset.mock));
    b.addEventListener("pointerleave", hidePreview);
    b.addEventListener("click", () => { hidePreview(); openModal(b.dataset.key, b.dataset.mock); });
  });
  motion ? io.observe(tl) : tl.classList.add("in");

  /* =========================================================================
     Marquees
     ====================================================================== */
  const mqSets = { a: RACK.slice(0, 6), b: RACK.slice(6) };
  $$("[data-marquee]").forEach((m) => {
    const set = mqSets[m.dataset.marquee];
    const group = () => `<div class="mq-group">${set.map(([k, n]) => `<button class="mq-card" type="button" data-k="${k}"><span class="ratio">${shot(k)}</span><span class="mq-cap"><span>${esc(n)}</span><em>Open ↗</em></span></button>`).join("")}</div>`;
    m.innerHTML = group() + group().replace('class="mq-group"', 'class="mq-group" aria-hidden="true"') + group().replace('class="mq-group"', 'class="mq-group" aria-hidden="true"');
    $$(".mq-card", m).forEach((c) => c.addEventListener("click", () => openModal(c.dataset.k)));
  });
  $$("[data-words-marquee]").forEach((m) => {
    const g = `<div class="mq-group">${m.dataset.wordsMarquee.split("|").map((w) => `<span class="foot-word">${esc(w)}</span>`).join("")}</div>`;
    m.innerHTML = g + g.replace('class="mq-group"', 'class="mq-group" aria-hidden="true"');
  });

  /* =========================================================================
     MEPPS map: draggable nodes, live connectors, drag-the-mark console
     ====================================================================== */
  const map = $("[data-map]");
  const svg = $(".map-svg", map);
  const nodeEl = (k) => $(`[data-n="${k}"]`, map);
  const LINKS = [["late", "points"], ["deadline", "points"], ["points", "review"], ["points", "finance"], ["review", "deduct"], ["review", "reward"], ["finance", "reward"], ["finance", "deduct"], ["finance", "closed"]];
  const ROUTES = [["late", "points", "review", "deduct"], ["deadline", "points", "finance", "deduct"], ["late", "points", "finance", "closed"], ["deadline", "points", "review", "reward"], ["late", "points", "finance", "reward"]];
  function pathFor(a, b) {
    const r = map.getBoundingClientRect();
    const ra = nodeEl(a).getBoundingClientRect(), rb = nodeEl(b).getBoundingClientRect();
    const x1 = ra.right - r.left, y1 = ra.top + ra.height / 2 - r.top;
    const x2 = rb.left - r.left, y2 = rb.top + rb.height / 2 - r.top;
    const mx = (x1 + x2) / 2;
    return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
  }
  svg.innerHTML = LINKS.map(([a, b]) => `<path class="base" data-l="${a}-${b}"/><path class="flow" data-f="${a}-${b}" pathLength="1" stroke-dasharray="0 1"/>`).join("") + `<circle class="pulse-dot" r="5" fill="var(--accent)" opacity="0"/>`;
  function drawMap() {
    LINKS.forEach(([a, b]) => {
      const d = pathFor(a, b);
      $(`[data-l="${a}-${b}"]`, svg).setAttribute("d", d);
      $(`[data-f="${a}-${b}"]`, svg).setAttribute("d", d);
    });
  }
  drawMap();
  addEventListener("resize", drawMap);
  document.fonts?.ready.then(drawMap);

  // Drag nodes; they spring back to their slot on release.
  $$(".node", map).forEach((n) => {
    let s = null;
    n.addEventListener("pointerdown", (e) => { s = { x: e.clientX, y: e.clientY }; n.setPointerCapture(e.pointerId); n.classList.add("dragging"); n.style.transition = "none"; });
    n.addEventListener("pointermove", (e) => { if (!s) return; n.style.transform = `translate(${e.clientX - s.x}px, ${e.clientY - s.y}px)`; drawMap(); });
    n.addEventListener("pointerup", () => {
      if (!s) return; s = null; n.classList.remove("dragging");
      n.style.transition = "transform .6s cubic-bezier(.34,1.56,.64,1), border-color .4s, box-shadow .4s";
      n.style.transform = "";
      const t0 = performance.now();
      const follow = (t) => { drawMap(); if (t - t0 < 700) requestAnimationFrame(follow); };
      requestAnimationFrame(follow);
    });
  });

  const consoleEl = $("[data-console]");
  const mark = $(".console-mark", consoleEl);
  const cWait = $(".c-wait"), cDone = $(".c-done");
  const cHead = $(".c-head"), cBody = $(".c-body");
  const OFF_TEXT = ["9:05 AM. Nobody is keeping score.", "Late arrivals get argued, deadlines slip quietly, good work goes unnoticed. Drag the RR mark onto the map to switch MEPPS on."];
  const ON_TEXT = ["MEPPS is on.", "Every late check-in and missed deadline is logged as points, reviewed at month end and applied by finance. Same rules for everyone. Click the mark to switch it off."];
  let mapOn = false, waiting = 14, settled = 0, pulseBusy = false;
  function setMap(on) {
    mapOn = on;
    map.classList.toggle("on", on);
    consoleEl.classList.toggle("on", on);
    mark.setAttribute("aria-label", on ? "Switch MEPPS off" : "Switch MEPPS on");
    cHead.textContent = (on ? ON_TEXT : OFF_TEXT)[0];
    cBody.textContent = (on ? ON_TEXT : OFF_TEXT)[1];
    $$(".node", map).forEach((n, i) => setTimeout(() => {
      n.classList.toggle("lit", on);
      const b = $(".nbadge", n);
      if (!b.dataset.off) b.dataset.off = b.textContent;
      b.textContent = on ? b.dataset.on : b.dataset.off;
    }, motion ? i * 90 : 0));
    $$(".flow", svg).forEach((p, i) => {
      p.style.transition = motion ? `stroke-dasharray .7s ease ${i * 80}ms` : "none";
      p.setAttribute("stroke-dasharray", on ? "1 0" : "0 1");
    });
    if (!on) { settled = 0; cDone.textContent = 0; }
  }
  async function runPulse() {
    if (!mapOn || pulseBusy || !motion) return;
    pulseBusy = true;
    const dot = $(".pulse-dot", svg);
    const route = ROUTES[Math.floor(Math.random() * ROUTES.length)];
    for (let i = 0; i < route.length - 1 && mapOn; i++) {
      const p = $(`[data-l="${route[i]}-${route[i + 1]}"]`, svg);
      if (!p || !p.getTotalLength) break;
      const L = p.getTotalLength();
      const t0 = performance.now();
      dot.setAttribute("opacity", 1);
      await new Promise((res) => {
        const step = (t) => {
          const k = clamp((t - t0) / 650, 0, 1);
          const pt = p.getPointAtLength(L * k);
          dot.setAttribute("cx", pt.x); dot.setAttribute("cy", pt.y);
          if (k < 1 && mapOn) requestAnimationFrame(step); else res();
        };
        requestAnimationFrame(step);
      });
      const n = nodeEl(route[i + 1]);
      n.classList.remove("pulse"); void n.offsetWidth; n.classList.add("pulse");
    }
    dot.setAttribute("opacity", 0);
    if (mapOn) {
      waiting = Math.max(0, waiting - 1); settled++;
      cWait.textContent = waiting; cDone.textContent = settled;
    }
    pulseBusy = false;
  }
  setInterval(() => {
    if (mapOn) runPulse();
    else if (waiting < 24) { waiting++; cWait.textContent = waiting; }
  }, 1500);

  let mDrag = null;
  mark.addEventListener("pointerdown", (e) => { mDrag = { x: e.clientX, y: e.clientY, moved: false }; mark.setPointerCapture(e.pointerId); mark.classList.add("dragging"); mark.style.transition = "none"; });
  mark.addEventListener("pointermove", (e) => {
    if (!mDrag) return;
    const dx = e.clientX - mDrag.x, dy = e.clientY - mDrag.y;
    if (Math.abs(dx) + Math.abs(dy) > 6) mDrag.moved = true;
    mark.style.transform = `translate(${dx}px, ${dy}px) scale(1.08)`;
    const r = map.getBoundingClientRect();
    map.classList.toggle("drop-target", e.clientX > r.left && e.clientX < r.right && e.clientY > r.top && e.clientY < r.bottom);
  });
  mark.addEventListener("pointerup", () => {
    if (!mDrag) return;
    const over = map.classList.contains("drop-target"), moved = mDrag.moved;
    mDrag = null;
    mark.classList.remove("dragging");
    map.classList.remove("drop-target");
    mark.style.transition = "transform .55s cubic-bezier(.34,1.56,.64,1)";
    mark.style.transform = "";
    if (moved) { if (over) setMap(true); } else setMap(!mapOn);
  });
  mark.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setMap(!mapOn); } });

  /* =========================================================================
     Five layers
     ====================================================================== */
  const LAYERS = [
    { n: 5, name: "Communication & relations", c: "#B49CFF", desc: "Keeping people informed and problems small.", chips: [["Internal comms", ""], ["Employee relations", ""], ["Conflict resolution", ""]], items: [["Internal communication", "daily"], ["Employee relations", "30 people"], ["Conflict resolution", "same rules"]] },
    { n: 4, name: "Training & policy", c: "#2F9C8E", desc: "Helping people grow, with the rules written down.", chips: [["Training & development", ""], ["HR policy", ""], ["Process design", ""]], items: [["Training & development", "ongoing"], ["HR policy", "written"], ["Process design", "for everyone"]] },
    { n: 3, name: "Performance & MEPPS", c: "#6D4BC2", desc: "Monthly points, reviewed fairly, applied by finance.", chips: [["Performance", ""], ["MEPPS points", "monthly"], ["Rewards", ""], ["Discipline", ""], ["Payroll input", ""]], items: [["Performance management", "monthly"], ["MEPPS points", "since Jan 2026"], ["Reward & disciplinary systems", "points"], ["Payroll input to finance", "month end"]] },
    { n: 2, name: "Attendance & records", c: "#49C9B8", desc: "Who's in, who's late, who's on leave, every day.", chips: [["Attendance", "daily"], ["LofiHRM", ""], ["Leave", ""], ["Records", ""]], items: [["Attendance management", "daily"], ["LofiHRM", "helped build"], ["Leave & records", "30 people"]] },
    { n: 1, name: "Hiring & onboarding", c: "#351366", desc: "From the job post to the first day.", chips: [["Job posts", ""], ["Interviews", ""], ["Onboarding", ""], ["Hires", "7"]], items: [["Job posts", "end to end"], ["Interviews", "end to end"], ["Onboarding", "end to end"], ["Hires so far", "~7"]] },
  ];
  const stack = $("[data-stack]");
  stack.innerHTML = LAYERS.map((l, i) => `<div class="layer" data-i="${i}" style="--c:${l.c};z-index:${10 - i}" tabindex="0" role="button" aria-label="Layer ${l.n}: ${esc(l.name)}"><div class="layer-top"><span class="mono-label">Layer 0${l.n}</span><b>${esc(l.name)}</b></div><div class="layer-chips">${l.chips.map(([t, v]) => `<span>${esc(t)}${v ? `<em>${esc(v)}</em>` : ""}</span>`).join("")}</div></div>`).join("");
  const layerEls = $$(".layer", stack);
  const info = $(".layer-info");
  let curLayer = -1, hoverL = null;
  function showLayer(i) {
    if (i === curLayer) return;
    curLayer = i;
    const l = LAYERS[i];
    layerEls.forEach((el, j) => el.classList.toggle("active", j === i));
    $(".li-num", info).textContent = `Layer 0${l.n} of 5`;
    $(".li-name", info).textContent = l.name;
    $(".li-desc", info).textContent = l.desc;
    $(".li-items", info).innerHTML = l.items.map(([t, v]) => `<li><span>${esc(t)}</span><em>${esc(v)}</em></li>`).join("");
    info.classList.remove("swap"); void info.offsetWidth; info.classList.add("swap");
  }
  layerEls.forEach((el, i) => {
    const pick = () => { hoverL = i; showLayer(i); };
    el.addEventListener("pointerenter", pick); el.addEventListener("focus", pick); el.addEventListener("click", pick);
  });
  $(".stack-box").addEventListener("pointerleave", () => { hoverL = null; });
  showLayer(2);
  const layersSec = $("#layers");
  function updateLayers() {
    const r = layersSec.getBoundingClientRect();
    const p = motion ? clamp((innerHeight * 0.85 - r.top) / (r.height * 0.75), 0, 1) : 1;
    const gap = 14 + p * 34;
    layerEls.forEach((el, i) => el.style.setProperty("--z", `${(LAYERS.length - 1 - i) * gap}px`));
    if (hoverL === null && motion && p > 0.05 && p < 1) showLayer(clamp(Math.round(p * 4), 0, 4));
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
  track.innerHTML = SUBS.map(([k, t, d, a, b, label]) => `<article class="hs-card"><div class="tall">${shot(a, label)}</div><div class="hs-right"><div class="wide">${shot(b, label)}</div><div class="meta"><p class="kicker">${esc(k)}</p><h3><a href="#" data-open="crm">${esc(t)}</a></h3><p>${esc(d)}</p></div></div></article>`).join("");
  $$("[data-open]", track).forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); openModal("crm"); }));
  const hs = $("[data-hs]"), hsFill = $(".hs-fill");
  const isStatic = () => !motion || innerWidth < 768;
  function updateHs() {
    const st = isStatic();
    hs.classList.toggle("static", st);
    hs.parentElement.classList.toggle("static-hs", st);
    if (st) { track.style.transform = ""; return; }
    const r = hs.getBoundingClientRect();
    const p = clamp(-r.top / (r.height - innerHeight), 0, 1);
    const dist = Math.max(0, track.scrollWidth - innerWidth + 24);
    track.style.transform = `translate3d(${-p * dist}px,0,0)`;
    hsFill.style.width = p * 100 + "%";
  }
  $$("[data-hs-btn]").forEach((b) => b.addEventListener("click", () => {
    if (isStatic()) { track.scrollBy({ left: Number(b.dataset.hsBtn) * 500, behavior: "smooth" }); return; }
    const r = hs.getBoundingClientRect();
    scrollBy({ top: Number(b.dataset.hsBtn) * (r.height - innerHeight) / (SUBS.length - 1), behavior: "smooth" });
  }));

  const PRODUCTS = [
    { name: "LofiHRM", c: "#351366", badge: "Live", mock: "attendance", key: "attendance", desc: "LofiStack's in-house HR software. I helped build and shape it, and use it every day to run HR.", tags: ["HR", "Attendance", "In-house"], caps: ["Attendance logged as people check in", "Leave and records kept in one place", "Ready for the month-end review"] },
    { name: "MEPPS", c: "#49C9B8", badge: "Since Jan 2026", mock: "mepps", key: "mepps", desc: "The Monthly Employee Performance Point System I designed and launched. Same written rules for everyone.", tags: ["Monthly", "Points", "Finance"], caps: ["Breaches and rewards logged as points", "Totals reviewed at month end", "Finance applies deductions and rewards"] },
    { name: "Business CRM", c: "#6D4BC2", badge: "2024", mock: "crmbuild", key: "crmbuild", desc: "A business CRM I built during my IT Officer year at LofiStack.", tags: ["CRM", "IT Officer"], caps: ["Contacts captured in one place", "Leads and customers kept apart", "Built in my IT Officer year"] },
    { name: "Client websites", c: "#2F9C8E", badge: "12 sites", mock: "websites", key: "websites", desc: "Twelve conversion-focused websites built for clients as IT Officer.", tags: ["Websites", "IT Officer"], caps: ["Twelve client sites, built in 2024", "Designed to turn visitors into leads", "Connected to the client's tools"] },
  ];
  const grid = $("[data-products]");
  grid.innerHTML = PRODUCTS.map((p) => `<li><a class="prod" href="#" data-k="${p.key}" style="--c:${p.c};display:block"><div class="prod-top"><span class="prod-badge">${esc(p.badge)}</span><div class="prod-ui"><div class="scr">${shot(p.mock)}</div><div class="prod-cap"><div class="dots">${p.caps.map((_, i) => `<i class="${i ? "" : "on"}"></i>`).join("")}</div><p>${esc(p.caps[0])}</p></div></div></div><div class="prod-body"><h4>${esc(p.name)}<span>↗</span></h4><p>${esc(p.desc)}</p><div class="tags">${p.tags.map((t) => `<span>${esc(t)}</span>`).join("")}</div></div></a></li>`).join("");
  $$(".prod", grid).forEach((a, pi) => {
    a.addEventListener("click", (e) => { e.preventDefault(); openModal(a.dataset.k, PRODUCTS[pi].mock); });
    if (!motion) return;
    let ci = 0;
    const p = $(".prod-cap p", a), dots = $$(".prod-cap .dots i", a);
    setInterval(() => {
      p.classList.add("out");
      setTimeout(() => {
        ci = (ci + 1) % PRODUCTS[pi].caps.length;
        p.textContent = PRODUCTS[pi].caps[ci];
        dots.forEach((d, j) => d.classList.toggle("on", j === ci));
        p.classList.remove("out");
      }, 300);
    }, 2600 + pi * 300);
  });

  /* =========================================================================
     Kanban: cards move along on their own; you can drag them too
     ====================================================================== */
  const COLS = [["Applied", "#8a84a3"], ["Screened", "#B49CFF"], ["Interview", "#6D4BC2"], ["Offer", "#2F9C8E"], ["Onboarded", "#49C9B8"]];
  const CANDS = [
    ["CA", "Candidate A", "Frontend developer", "LinkedIn", "1d", 0], ["CB", "Candidate B", "Project coordinator", "Referral", "2d", 0], ["CC", "Candidate C", "Support executive", "Job board", "3h", 0],
    ["CD", "Candidate D", "Designer", "LinkedIn", "4d", 1], ["CE", "Candidate E", "QA tester", "Job board", "1d", 1],
    ["CF", "Candidate F", "Sales executive", "Referral", "2d", 2], ["CG", "Candidate G", "Content writer", "LinkedIn", "5d", 2],
    ["CH", "Candidate H", "Backend developer", "Referral", "1d", 3],
    ["CI", "Candidate I", "Ops assistant", "Job board", "6d", 4],
  ];
  const kb = $("[data-kanban]");
  kb.innerHTML = COLS.map(([n, c], i) => `<div class="k-col" data-col="${i}"><div class="k-head"><span><i style="background:${c}"></i><p>${n}</p></span><em>0</em></div><div class="k-list" style="display:grid;gap:8px"></div></div>`).join("");
  const colList = (i) => $(`[data-col="${i}"] .k-list`, kb);
  CANDS.forEach(([ini, name, role, src, when, col], i) => {
    const el = document.createElement("div");
    el.className = "k-card";
    el.innerHTML = `<div class="k-top"><span class="k-av" style="background:${AV[i % AV.length]}">${ini}</span><div><div class="k-name">${esc(name)}</div><div class="k-role">${esc(role)}</div></div></div><div class="k-foot"><span class="k-tag">${src}</span><span class="k-when">${when}</span></div>`;
    colList(col).appendChild(el);
  });
  const counts = () => COLS.forEach((_, i) => ($(`[data-col="${i}"] .k-head em`, kb).textContent = colList(i).children.length));
  counts();
  function flipMove(card, toCol) {
    const first = card.getBoundingClientRect();
    colList(toCol).prepend(card);
    const lastR = card.getBoundingClientRect();
    if (motion) card.animate([{ transform: `translate(${first.left - lastR.left}px, ${first.top - lastR.top}px)` }, { transform: "none" }], { duration: 650, easing: "cubic-bezier(.22,1,.36,1)" });
    card.classList.add("moved"); setTimeout(() => card.classList.remove("moved"), 1400);
    counts();
  }
  let kbVisible = false, kbDragging = false;
  new IntersectionObserver((es) => (kbVisible = es[0].isIntersecting)).observe(kb);
  if (motion) setInterval(() => {
    if (!kbVisible || kbDragging) return;
    const movable = $$(".k-card", kb).filter((c) => Number(c.closest(".k-col").dataset.col) < 4);
    if (!movable.length) { $$(".k-card", kb).forEach((c, i) => colList(i % 3).appendChild(c)); counts(); return; }
    const c = movable[Math.floor(Math.random() * movable.length)];
    flipMove(c, Number(c.closest(".k-col").dataset.col) + 1);
  }, 2400);
  kb.addEventListener("pointerdown", (e) => {
    const card = e.target.closest(".k-card");
    if (!card) return;
    kbDragging = true;
    const sx = e.clientX, sy = e.clientY;
    card.setPointerCapture(e.pointerId);
    card.classList.add("dragging");
    let over = null;
    const move = (ev) => {
      card.style.transform = `translate(${ev.clientX - sx}px, ${ev.clientY - sy}px) rotate(2deg)`;
      card.style.visibility = "hidden";
      const col = document.elementFromPoint(ev.clientX, ev.clientY)?.closest(".k-col");
      card.style.visibility = "";
      $$(".k-col", kb).forEach((c) => c.classList.toggle("over", c === col));
      over = col;
    };
    const up = () => {
      card.removeEventListener("pointermove", move); card.removeEventListener("pointerup", up);
      card.classList.remove("dragging"); card.style.transform = "";
      $$(".k-col", kb).forEach((c) => c.classList.remove("over"));
      if (over) flipMove(card, Number(over.dataset.col));
      kbDragging = false;
    };
    card.addEventListener("pointermove", move); card.addEventListener("pointerup", up);
  });

  /* =========================================================================
     Inbox
     ====================================================================== */
  const THREADS = [
    { ini: "EA", name: "Employee A.", team: "Delivery team · leave request", tag: "Approved", acc: 1, q: "Can I take leave next Thursday?", a: "Approved. It's recorded in LofiHRM, enjoy the day off.", s: "Approved · Thursday" },
    { ini: "EB", name: "Employee B.", team: "Design team · attendance correction", tag: "Fixed", acc: 0, q: "I clocked in late, but the system was down.", a: "Thanks for flagging it. I checked the log and corrected it, so no MEPPS points.", s: "Corrected · no points" },
    { ini: "EC", name: "Employee C.", team: "Support team · payslip question", tag: "Replied", acc: 0, q: "Why was there a deduction this month?", a: "Two late arrivals under MEPPS this month. The breakdown is in your monthly summary.", s: "Explained · MEPPS" },
    { ini: "ED", name: "Employee D.", team: "Delivery team · training", tag: "Scheduled", acc: 1, q: "Can I join the next project management training?", a: "Yes. You're booked for the next session, and it counts toward your development plan.", s: "Scheduled · next session" },
    { ini: "EE", name: "Employee E.", team: "Dev team · reward", tag: "Rewarded", acc: 1, q: "Did helping on the client deadline count?", a: "It did. Helping a teammate earned you reward points this month.", s: "Reward · MEPPS" },
  ];
  const ib = $("[data-inbox]");
  const ibList = $(".inbox-list", ib), thread = $(".thread", ib);
  ibList.innerHTML = THREADS.map((t, i) => `<li><button type="button" data-t="${i}"><span class="ib-av" style="background:${AV[i % AV.length]}">${t.ini}</span><span class="ib-main"><b>${esc(t.name)}</b><span>${esc(t.q)}</span></span><span class="ib-tag ${t.acc ? "acc" : ""}">${t.tag}</span></button></li>`).join("");
  let ti = -1, tRun = 0;
  async function openThread(i) {
    ti = i; const run = ++tRun; const t = THREADS[i];
    $$("button", ibList).forEach((b, j) => b.classList.toggle("sel", j === i));
    $(".pane-name", ib).textContent = t.name;
    $(".pane-meta", ib).textContent = t.team;
    thread.innerHTML = `<div class="msg in">${esc(t.q)}</div>`;
    if (motion) { await wait(500); if (run !== tRun) return; thread.insertAdjacentHTML("beforeend", '<div class="typing"><i></i><i></i><i></i></div>'); await wait(1100); if (run !== tRun) return; $(".typing", thread)?.remove(); }
    thread.insertAdjacentHTML("beforeend", `<div class="msg out">${esc(t.a)}</div>`);
    if (motion) { await wait(500); if (run !== tRun) return; }
    thread.insertAdjacentHTML("beforeend", `<div class="msg status"><i></i>${esc(t.s)}</div>`);
  }
  $$("button", ibList).forEach((b) => b.addEventListener("click", () => openThread(Number(b.dataset.t))));
  $("[data-inbox-next]").addEventListener("click", () => openThread((ti + 1) % THREADS.length));
  openThread(1);
  let ibVisible = false;
  new IntersectionObserver((es) => (ibVisible = es[0].isIntersecting)).observe(ib);
  if (motion) setInterval(() => { if (ibVisible && !ib.matches(":hover")) openThread((ti + 1) % THREADS.length); }, 7000);

  /* =========================================================================
     Scroll-driven bits
     ====================================================================== */
  let ticking = false;
  const onScroll = () => { ticking = false; updateLayers(); updateHs(); };
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  addEventListener("resize", onScroll);
  onScroll();

  /* =========================================================================
     Dock: magnify on hover, mark the current section, theme toggle
     ====================================================================== */
  const dock = $("[data-dock]");
  const dks = $$(".dk", dock);
  if (fine && motion) {
    dock.addEventListener("mousemove", (e) => dks.forEach((d) => {
      const r = d.getBoundingClientRect();
      const dist = Math.abs(e.clientX - (r.left + r.width / 2));
      const s = 40 + 22 * Math.max(0, 1 - dist / 130);
      d.style.width = d.style.height = s + "px";
    }));
    dock.addEventListener("mouseleave", () => dks.forEach((d) => (d.style.width = d.style.height = "")));
  }
  const secIo = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    dks.forEach((d) => d.classList.toggle("active", d.getAttribute("href") === "#" + e.target.id));
  }), { rootMargin: "-45% 0px -50% 0px" });
  ["top", "people", "system", "delivery", "hiring", "contact"].forEach((id) => secIo.observe(document.getElementById(id)));

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

  root.classList.add("ready");
})();
