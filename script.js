(() => {
  const root = document.documentElement;
  const motion = root.classList.contains("motion");
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  // Footer year.
  $$("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));

  // ---- Split headings into words so they can build in one word at a time ----
  $$("[data-split]").forEach((el) => {
    const words = el.textContent.trim().split(/\s+/);
    el.setAttribute("aria-label", el.textContent.trim());
    el.innerHTML = words
      .map((w, i) => `<span class="w" aria-hidden="true"><span style="--i:${i}">${w}</span></span>`)
      .join(" ");
    if (el.tagName === "H1") el.style.setProperty("--base", "150ms");
  });

  // ---- Stagger groups: children reveal one after another ----
  $$("[data-stagger]").forEach((group) => {
    [...group.children].forEach((child, i) => {
      child.classList.add("reveal");
      child.style.setProperty("--d", `${i * 110}ms`);
    });
  });

  // ---- Count-up numbers ----
  function countUp(el) {
    const end = Number(el.dataset.count);
    const prefix = el.dataset.prefix || "";
    // Years roll up from a few below instead of from zero.
    const start = el.hasAttribute("data-plain") ? end - 12 : 0;
    const dur = 1400;
    // Wait for the surrounding reveal (if any) so the count is visible from the start.
    const holder = el.closest(".reveal");
    const delay = holder ? parseInt(getComputedStyle(holder).getPropertyValue("--d"), 10) || 0 : 0;
    el.textContent = prefix + start;
    setTimeout(() => {
      const t0 = performance.now();
      const tick = (t) => {
        const k = clamp((t - t0) / dur, 0, 1);
        const eased = 1 - Math.pow(1 - k, 4);
        el.textContent = prefix + Math.round(start + (end - start) * eased);
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, delay);
  }

  // ---- One observer for every "animate when it scrolls into view" element ----
  const watched = ".reveal, [data-split], .reveal-portrait, [data-count], .path, .flow, .mini-ui, .stairs, .langs";
  if (motion && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.classList.add("in");
          if (e.target.dataset.count) countUp(e.target);
          io.unobserve(e.target);
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -6% 0px" }
    );
    $$(watched).forEach((el) => io.observe(el));
  } else {
    $$(watched).forEach((el) => el.classList.add("in"));
  }

  // ---- Scroll-driven bits: header, reading progress, back-to-top ring, timeline ----
  const header = $(".site-header");
  const bar = $(".read-progress span");
  const toTop = $(".to-top");
  const timeline = $(".timeline");
  const jobs = $$(".job");
  let ticking = false;

  function onScroll() {
    ticking = false;
    const y = scrollY;
    const max = document.documentElement.scrollHeight - innerHeight;
    const p = max > 0 ? clamp(y / max, 0, 1) : 0;
    header.classList.toggle("scrolled", y > 8);
    bar.style.setProperty("--p", p);
    toTop.style.setProperty("--p", p);
    toTop.classList.toggle("show", y > 700);

    if (motion && timeline) {
      const line = innerHeight * 0.62;
      const r = timeline.getBoundingClientRect();
      timeline.style.setProperty("--p", clamp((line - r.top) / r.height, 0, 1));
      jobs.forEach((job) => job.classList.toggle("lit", job.getBoundingClientRect().top + 40 < line));
    } else {
      jobs.forEach((job) => job.classList.add("lit"));
    }
  }
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  addEventListener("resize", onScroll);
  onScroll();

  // ---- Nav: highlight the section on screen, with a sliding underline ----
  const navLinks = $$(".nav a");
  const ind = $(".nav-ind");
  function moveInd(link) {
    if (!link) { ind.style.opacity = 0; return; }
    ind.style.left = `${link.offsetLeft}px`;
    ind.style.width = `${link.offsetWidth}px`;
    ind.style.opacity = 1;
  }
  if ("IntersectionObserver" in window) {
    const sectionIO = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          const link = navLinks.find((a) => a.hash === `#${e.target.id}`);
          navLinks.forEach((a) => a.classList.toggle("active", a === link));
          moveInd(link);
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    $$("main section[id]").forEach((s) => sectionIO.observe(s));
  }
  addEventListener("resize", () => moveInd($(".nav a.active")));

  // ---- MEPPS sample-month simulator ----
  const sim = $(".sim");
  if (sim) {
    const needle = $(".needle", sim);
    const scoreEl = $(".score", sim);
    const scoreN = $(".score-n", sim);
    const verdict = $(".verdict", sim);
    let shown = 0;
    function update(animate) {
      const total = $$(".ev[aria-pressed='true']", sim).reduce((s, b) => s + Number(b.dataset.points), 0);
      needle.style.setProperty("--a", `${(clamp(total, -10, 10) / 10) * 90}deg`);
      scoreEl.style.setProperty("--c", total > 0 ? "var(--pos)" : total < 0 ? "var(--neg)" : "var(--text)");
      verdict.textContent =
        total > 0 ? "Reward: finance adds it to this month's pay."
        : total < 0 ? "Deduction: finance takes it from this month's pay."
        : "Neutral month: no reward and no deduction.";
      const fmt = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");
      if (!animate || !motion) { scoreN.textContent = fmt(total); shown = total; return; }
      const from = shown, t0 = performance.now();
      const step = (t) => {
        const k = clamp((t - t0) / 450, 0, 1);
        scoreN.textContent = fmt(Math.round(from + (total - from) * k));
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      shown = total;
      scoreEl.classList.remove("bump");
      void scoreEl.offsetWidth;
      scoreEl.classList.add("bump");
    }
    $$(".ev", sim).forEach((b) =>
      b.addEventListener("click", () => {
        b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") === "true" ? "false" : "true");
        update(true);
      })
    );
    update(false);
  }

  // ---- Case-study tabs (arrow keys move between them) ----
  const tablist = $(".tabs");
  if (tablist) {
    const tabs = $$("[role=tab]", tablist);
    const tabInd = $(".tab-ind", tablist);
    const place = (tab) => {
      tabInd.style.left = `${tab.offsetLeft}px`;
      tabInd.style.width = `${tab.offsetWidth}px`;
      tabInd.style.top = `${tab.offsetTop + tab.offsetHeight - 1}px`;
    };
    const select = (tab, focus) => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute("aria-selected", on);
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
      });
      place(tab);
      if (focus) tab.focus();
    };
    tabs.forEach((t, i) => {
      t.addEventListener("click", () => select(t));
      t.addEventListener("keydown", (e) => {
        const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (d) { e.preventDefault(); select(tabs[(i + d + tabs.length) % tabs.length], true); }
      });
    });
    place(tabs[0]);
    addEventListener("resize", () => place($("[aria-selected=true]", tablist)));
    document.fonts?.ready.then(() => place($("[aria-selected=true]", tablist)));
  }

  // ---- Copy email, with a little confetti burst ----
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
    const colors = ["#e3a6d7", "#ffffff", "#d38bc6", "#7a2e6b", "#f3e8f0"];
    for (let i = 0; i < 22; i++) {
      const d = document.createElement("span");
      d.className = "burst";
      d.style.left = `${cx}px`;
      d.style.top = `${cy}px`;
      d.style.background = colors[i % colors.length];
      document.body.appendChild(d);
      const a = (Math.PI * 2 * i) / 22 + Math.random() * 0.4;
      const dist = 50 + Math.random() * 70;
      d.animate(
        [
          { transform: "translate(-50%, -50%) scale(1)", opacity: 1 },
          { transform: `translate(calc(-50% + ${Math.cos(a) * dist}px), calc(-50% + ${Math.sin(a) * dist + 30}px)) scale(0.3)`, opacity: 0 },
        ],
        { duration: 800 + Math.random() * 400, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
      ).onfinish = () => d.remove();
    }
  }

  // Everything below needs a mouse or trackpad and motion allowed.
  if (!motion || !finePointer) { root.classList.add("ready"); return; }

  // ---- Portrait parallax: layers drift at different depths with the cursor ----
  const hero = $(".hero");
  const layers = $$("[data-depth]", hero);
  hero.addEventListener("pointermove", (e) => {
    const r = hero.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    layers.forEach((l) => {
      const d = Number(l.dataset.depth);
      l.style.translate = `${x * d}px ${y * d}px`;
    });
  });
  hero.addEventListener("pointerleave", () => layers.forEach((l) => (l.style.translate = "0 0")));

  // ---- Tilt + spotlight cards ----
  $$(".tilt").forEach((card) => {
    const max = card.classList.contains("feature") ? 3 : 6;
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      card.classList.add("moving");
      card.style.setProperty("--mx", `${x * 100}%`);
      card.style.setProperty("--my", `${y * 100}%`);
      card.style.transform = `perspective(900px) rotateX(${(0.5 - y) * max}deg) rotateY(${(x - 0.5) * max}deg) translateY(-4px)`;
    });
    card.addEventListener("pointerleave", () => {
      card.classList.remove("moving");
      card.style.transform = "";
    });
  });

  // ---- Magnetic buttons ----
  $$(".magnetic").forEach((btn) => {
    btn.addEventListener("pointermove", (e) => {
      const r = btn.getBoundingClientRect();
      const x = e.clientX - r.left - r.width / 2;
      const y = e.clientY - r.top - r.height / 2;
      btn.style.transform = `translate(${x * 0.25}px, ${y * 0.35}px)`;
    });
    btn.addEventListener("pointerleave", () => (btn.style.transform = ""));
  });

  // ---- Contact glow follows the cursor ----
  const contact = $(".contact");
  contact.addEventListener("pointermove", (e) => {
    const r = contact.getBoundingClientRect();
    contact.style.setProperty("--gx", `${e.clientX - r.left}px`);
    contact.style.setProperty("--gy", `${e.clientY - r.top}px`);
  });

  // ---- Cursor ring that trails the pointer and grows over anything clickable ----
  const cursor = $(".cursor");
  root.classList.add("has-cursor");
  let tx = -100, ty = -100, cx = -100, cy = -100;
  addEventListener("pointermove", (e) => {
    tx = e.clientX; ty = e.clientY;
    cursor.classList.add("on");
    cursor.classList.toggle("big", !!e.target.closest("a, button, .chips li"));
  });
  document.addEventListener("pointerleave", () => cursor.classList.remove("on"));
  addEventListener("pointerdown", () => cursor.classList.add("down"));
  addEventListener("pointerup", () => cursor.classList.remove("down"));
  (function follow() {
    cx += (tx - cx) * 0.2;
    cy += (ty - cy) * 0.2;
    cursor.style.setProperty("--x", `${cx}px`);
    cursor.style.setProperty("--y", `${cy}px`);
    requestAnimationFrame(follow);
  })();

  root.classList.add("ready");
})();
