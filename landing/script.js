(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- reveal on scroll ---------- */
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
  );
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

  /* ---------- home: mouse parallax on the scene ---------- */
  const layers = [...document.querySelectorAll(".scene [data-depth]")];
  if (layers.length && !reduceMotion) {
    let mx = 0, my = 0, cx = 0, cy = 0;
    window.addEventListener("pointermove", (e) => {
      mx = e.clientX / window.innerWidth - 0.5;
      my = e.clientY / window.innerHeight - 0.5;
    }, { passive: true });

    const tick = () => {
      cx += (mx - cx) * 0.05;
      cy += (my - cy) * 0.05;
      layers.forEach((layer) => {
        const d = parseFloat(layer.dataset.depth);
        layer.style.transform = `translate3d(${-cx * 40 * d}px, ${-cy * 24 * d}px, 0)`;
      });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ---------- product: background settles as you read ---------- */
  const scroller = document.getElementById("scroller");
  const frame = document.querySelector(".frame");
  if (scroller && !reduceMotion) {
    const onScroll = () => {
      const max = scroller.scrollHeight - scroller.clientHeight;
      frame.style.setProperty("--p", max > 0 ? (scroller.scrollTop / max).toFixed(3) : 0);
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ---------- drifting pollen / light motes ---------- */
  const canvas = document.getElementById("pollen");
  if (canvas) {
    const ctx = canvas.getContext("2d");
    let motes = [];
    let w, h;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(Math.min(70, (w * h) / 22000));
      motes = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.8 + 0.4,
        vx: (Math.random() - 0.3) * 0.18,
        vy: -(Math.random() * 0.22 + 0.04),
        phase: Math.random() * Math.PI * 2,
        a: Math.random() * 0.5 + 0.25,
      }));
    };

    const draw = (t) => {
      ctx.clearRect(0, 0, w, h);
      for (const m of motes) {
        m.x += m.vx + Math.sin(t / 2400 + m.phase) * 0.12;
        m.y += m.vy;
        if (m.y < -10) { m.y = h + 10; m.x = Math.random() * w; }
        if (m.x > w + 10) m.x = -10;
        if (m.x < -10) m.x = w + 10;
        const twinkle = 0.6 + 0.4 * Math.sin(t / 900 + m.phase);
        const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r * 4);
        g.addColorStop(0, `rgba(255, 246, 220, ${m.a * twinkle})`);
        g.addColorStop(1, "rgba(255, 246, 220, 0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r * 4, 0, Math.PI * 2);
        ctx.fill();
      }
      if (!reduceMotion) requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize);
    requestAnimationFrame(draw);
  }

  /* ---------- waitlist ---------- */
  // "Join the waitlist" links on the home page focus the form instead of jumping
  const focusForm = () => document.querySelector("#join input")?.focus({ preventScroll: true });
  document.querySelectorAll('a[href="#join"]').forEach((a) =>
    a.addEventListener("click", (e) => { e.preventDefault(); focusForm(); })
  );
  if (location.hash === "#join") setTimeout(focusForm, 900);

  const submitEmail = async (email) => {
    const res = await fetch("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) throw new Error("Could not join");
  };

  const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

  document.querySelectorAll("[data-waitlist]").forEach((form) => {
    const input = form.querySelector("input");
    const button = form.querySelector("button");
    const note = form.nextElementSibling?.matches("[data-note]") ? form.nextElementSibling : null;
    const original = note?.textContent;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = input.value.trim();
      form.classList.remove("is-error");

      if (!isEmail(email)) {
        void form.offsetWidth; // restart shake animation
        form.classList.add("is-error");
        if (note) { note.textContent = "Hmm, that email doesn't look quite right."; note.classList.remove("ok"); }
        input.focus();
        return;
      }

      button.disabled = true;
      const label = button.innerHTML;
      button.innerHTML = "Saving your spot…";
      try {
        await submitEmail(email);
      } catch {
        button.disabled = false;
        button.innerHTML = label;
        if (note) { note.textContent = "Something went wrong. Try again in a moment."; note.classList.remove("ok"); }
        return;
      }

      form.classList.add("is-done");
      button.innerHTML = "You're on the list ✓";
      input.value = "";
      input.placeholder = email;
      if (note) { note.textContent = "Thank you. We'll be in touch soon — talk then."; note.classList.add("ok"); }
    });

    input.addEventListener("input", () => {
      if (form.classList.contains("is-error")) {
        form.classList.remove("is-error");
        if (note) note.textContent = original;
      }
    });
  });
})();
