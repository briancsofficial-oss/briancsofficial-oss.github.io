/* =========================================================
   Brian Sanchez — portfolio interactions
   1. Rotating 3D particle globe (Canvas)
   2. Floating starfield background
   3. Navigation: scroll state, mobile menu, active section
   4. Scroll reveal + panel hover glow
   ========================================================= */

document.documentElement.classList.remove("no-js");

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const DPR = Math.min(window.devicePixelRatio || 1, 2);

/* ---------- 1. Particle globe ---------- */
(function globe() {
    const canvas = document.getElementById("globe");
    const wrap = document.getElementById("globeWrap");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    let size = 0, R = 0, cx = 0, cy = 0;
    let rotY = 0;
    const tilt = 0.38;
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };

    // Cheap smooth pseudo-noise, used to make "continents" of brighter points
    function noise(x, y, z) {
        return (
            Math.sin(x * 3.1 + y * 1.7) * 0.5 +
            Math.sin(y * 2.3 - z * 3.7) * 0.35 +
            Math.sin(z * 4.1 + x * 2.9) * 0.3
        );
    }

    // Evenly spaced points on a sphere (Fibonacci lattice)
    const N = window.innerWidth < 700 ? 1100 : 1800;
    const points = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) {
        const y = 1 - (i / (N - 1)) * 2;
        const r = Math.sqrt(1 - y * y);
        const t = golden * i;
        const x = Math.cos(t) * r, z = Math.sin(t) * r;
        const land = noise(x, y, z) > 0.15;
        points.push({ x, y, z, land });
    }

    // Network nodes + precomputed links between nearby nodes
    const nodes = points.filter((_, i) => i % 9 === 0);
    const links = [];
    for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
            const a = nodes[i], b = nodes[j];
            const d = (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;
            if (d < 0.055) links.push([a, b]);
        }
    }

    // Halo particles drifting around the globe
    const halo = Array.from({ length: 260 }, () => {
        const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2;
        const s = Math.sqrt(1 - u * u);
        const dist = 1.04 + Math.pow(Math.random(), 2.2) * 0.55;
        return { x: Math.cos(th) * s * dist, y: u * dist, z: Math.sin(th) * s * dist, tw: Math.random() * Math.PI * 2 };
    });

    // Glowing orbit rings (the "wisps" around the reference globe)
    const orbits = [
        { rx: 1.18, ry: 0.32, rot: -0.35, speed: 0.6, color: "94,231,255" },
        { rx: 1.30, ry: 0.55, rot: 0.55, speed: -0.4, color: "166,77,255" },
        { rx: 1.08, ry: 0.85, rot: 1.2, speed: 0.3, color: "120,170,255" },
    ];

    function resize() {
        const rect = wrap.getBoundingClientRect();
        size = rect.width;
        canvas.width = size * DPR;
        canvas.height = size * DPR;
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        R = size * 0.34;
        cx = size / 2;
        cy = size / 2;
    }

    function project(p, ry, rx) {
        // rotate around Y
        let x = p.x * Math.cos(ry) - p.z * Math.sin(ry);
        let z = p.x * Math.sin(ry) + p.z * Math.cos(ry);
        // rotate around X (tilt)
        let y = p.y * Math.cos(rx) - z * Math.sin(rx);
        z = p.y * Math.sin(rx) + z * Math.cos(rx);
        const persp = 2.6 / (2.6 - z);
        return { x: cx + x * R * persp, y: cy + y * R * persp, z, s: persp };
    }

    let t = 0;
    function draw() {
        t += 0.016;
        mouse.x += (mouse.tx - mouse.x) * 0.05;
        mouse.y += (mouse.ty - mouse.y) * 0.05;
        const ry = rotY + mouse.x * 0.5;
        const rx = tilt + mouse.y * 0.3;

        ctx.clearRect(0, 0, size, size);

        // atmosphere glow
        const g = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 1.6);
        g.addColorStop(0, "rgba(70,170,255,0.42)");
        g.addColorStop(0.55, "rgba(70,110,255,0.18)");
        g.addColorStop(1, "rgba(40,20,120,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, size, size);

        // back orbit halves
        drawOrbits(true);

        // sphere rim
        ctx.beginPath();
        ctx.arc(cx, cy, R * 1.0, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(140,220,255,0.18)";
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.globalCompositeOperation = "lighter";

        // network links
        ctx.lineWidth = 0.6;
        for (const [a, b] of links) {
            const pa = project(a, ry, rx), pb = project(b, ry, rx);
            const depth = (pa.z + pb.z) / 2;
            if (depth < -0.2) continue;
            ctx.strokeStyle = `rgba(120,220,255,${0.12 + depth * 0.35})`;
            ctx.beginPath();
            ctx.moveTo(pa.x, pa.y);
            ctx.lineTo(pb.x, pb.y);
            ctx.stroke();
        }

        // surface points
        for (const p of points) {
            const q = project(p, ry, rx);
            const front = (q.z + 1) / 2; // 0 back → 1 front
            const alpha = p.land ? 0.15 + front * 0.85 : 0.05 + front * 0.25;
            const r = (p.land ? 2 : 1.1) * q.s;
            ctx.fillStyle = p.land
                ? `rgba(${170 + front * 85 | 0},${235 + front * 20 | 0},255,${alpha})`
                : `rgba(110,140,255,${alpha})`;
            ctx.fillRect(q.x - r / 2, q.y - r / 2, r, r);
        }

        // halo particles
        for (const h of halo) {
            const q = project(h, ry * 0.7, rx);
            const tw = 0.5 + 0.5 * Math.sin(t * 2 + h.tw);
            const a = (0.15 + ((q.z + 1.6) / 3.2) * 0.6) * tw;
            ctx.fillStyle = `rgba(190,240,255,${a})`;
            const r = 1.4 * q.s;
            ctx.beginPath();
            ctx.arc(q.x, q.y, r, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.globalCompositeOperation = "source-over";

        // front orbit halves
        drawOrbits(false);

        // bright pulse travelling along an orbit
        if (!reduceMotion) rotY += 0.0022;
        requestAnimationFrame(draw);
    }

    function drawOrbits(back) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        for (const o of orbits) {
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(o.rot + mouse.x * 0.1);
            const start = back ? Math.PI : 0;
            const end = back ? Math.PI * 2 : Math.PI;
            for (let k = 0; k < 3; k++) {
                ctx.beginPath();
                ctx.ellipse(0, 0, R * (o.rx + k * 0.015), R * (o.ry + k * 0.01), 0, start, end);
                ctx.strokeStyle = `rgba(${o.color},${(back ? 0.08 : 0.22) / (k + 1)})`;
                ctx.lineWidth = back ? 1 : 1.6 - k * 0.4;
                ctx.shadowColor = `rgba(${o.color},0.9)`;
                ctx.shadowBlur = back ? 0 : 12;
                ctx.stroke();
            }
            // comet on the front half
            if (!back) {
                const a = ((t * o.speed) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
                if (a < Math.PI) {
                    const px = Math.cos(a) * R * o.rx, py = Math.sin(a) * R * o.ry;
                    ctx.beginPath();
                    ctx.arc(px, py, 2.6, 0, Math.PI * 2);
                    ctx.fillStyle = "#fff";
                    ctx.shadowColor = `rgb(${o.color})`;
                    ctx.shadowBlur = 18;
                    ctx.fill();
                }
            }
            ctx.restore();
        }
        ctx.restore();
    }

    window.addEventListener("pointermove", (e) => {
        mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2;
        mouse.ty = (e.clientY / window.innerHeight - 0.5) * 2;
    });
    window.addEventListener("resize", resize);
    resize();
    draw();
})();

/* ---------- 2. Starfield ---------- */
(function stars() {
    const canvas = document.getElementById("stars");
    const ctx = canvas.getContext("2d");
    let w = 0, h = 0, list = [];

    function resize() {
        w = window.innerWidth;
        h = window.innerHeight;
        canvas.width = w * DPR;
        canvas.height = h * DPR;
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        const count = Math.round((w * h) / 9000);
        list = Array.from({ length: count }, () => ({
            x: Math.random() * w,
            y: Math.random() * h,
            r: Math.random() * 1.2 + 0.2,
            v: Math.random() * 0.25 + 0.05,
            p: Math.random() * Math.PI * 2,
        }));
    }

    let t = 0;
    function draw() {
        t += 0.016;
        ctx.clearRect(0, 0, w, h);
        for (const s of list) {
            if (!reduceMotion) {
                s.y -= s.v;
                if (s.y < -2) { s.y = h + 2; s.x = Math.random() * w; }
            }
            const a = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(t * 1.5 + s.p));
            ctx.fillStyle = `rgba(200,225,255,${a})`;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            ctx.fill();
        }
        requestAnimationFrame(draw);
    }

    window.addEventListener("resize", resize);
    resize();
    draw();
})();

/* ---------- 3. Navigation ---------- */
(function nav() {
    const navEl = document.getElementById("nav");
    const toggle = document.getElementById("menuToggle");
    const links = document.getElementById("navLinks");

    const onScroll = () => navEl.classList.toggle("scrolled", window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    toggle.addEventListener("click", () => {
        const open = links.classList.toggle("open");
        toggle.setAttribute("aria-expanded", String(open));
        toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    });
    links.addEventListener("click", (e) => {
        if (e.target.tagName === "A") {
            links.classList.remove("open");
            toggle.setAttribute("aria-expanded", "false");
            toggle.setAttribute("aria-label", "Open menu");
        }
    });

    // Highlight the nav link + side dot for the section in view
    const sections = [...document.querySelectorAll("#home, main .section")];
    const allLinks = document.querySelectorAll(".nav-links a, .side-dots a");
    const setActive = (id) => {
        allLinks.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + id));
    };
    const spy = new IntersectionObserver(
        (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
        { rootMargin: "-45% 0px -50% 0px" }
    );
    sections.forEach((s) => spy.observe(s));
    setActive("home");
})();

/* ---------- 4. Reveal on scroll + panel glow ---------- */
(function reveal() {
    const items = document.querySelectorAll(".reveal");
    const io = new IntersectionObserver(
        (entries) => {
            entries.forEach((e) => {
                if (!e.isIntersecting) return;
                // stagger siblings that appear at the same time
                const siblings = [...e.target.parentElement.querySelectorAll(":scope > .reveal")];
                e.target.style.transitionDelay = `${Math.max(0, siblings.indexOf(e.target)) * 0.1}s`;
                e.target.classList.add("in");
                io.unobserve(e.target);
            });
        },
        { threshold: 0.12 }
    );
    items.forEach((el) => io.observe(el));

    document.querySelectorAll(".panel").forEach((panel) => {
        panel.addEventListener("pointermove", (e) => {
            const r = panel.getBoundingClientRect();
            panel.style.setProperty("--mx", `${e.clientX - r.left}px`);
            panel.style.setProperty("--my", `${e.clientY - r.top}px`);
        });
    });
})();

/* ---------- 5. Show the resume download button only if resume.pdf exists ---------- */
(function resumeLink() {
    const btn = document.getElementById("cvDownload");
    if (!btn) return;
    fetch(btn.getAttribute("href"), { method: "HEAD" })
        .then((r) => { if (r.ok) btn.hidden = false; })
        .catch(() => {});
})();
