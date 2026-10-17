import { canSeeRefs } from "./store.js";

export const $ = (s, r = document) => r.querySelector(s);

// tiny hyperscript: h("div.card#id", {attrs}, ...children)
export function h(sel, ...args) {
  const m = sel.match(/^([a-z0-9]*)((?:[.#][\w-]+)*)$/i) || [];
  const el = document.createElement(m[1] || "div");
  (m[2] || "").replace(/([.#])([\w-]+)/g, (_, t, n) => { if (t === ".") el.classList.add(n); else el.id = n; });
  for (const a of args) add(el, a);
  return el;
}
function add(el, a) {
  if (a == null || a === false || a === "") return;
  if (Array.isArray(a)) return a.forEach((x) => add(el, x));
  if (a instanceof Node) return el.append(a);
  if (typeof a === "object") {
    for (const [k, v] of Object.entries(a)) {
      if (k.startsWith("on")) el[k] = v;
      else if (k === "disabled" || k === "selected" || k === "checked") el[k] = !!v;
      else el.setAttribute(k, v);
    }
    return;
  }
  el.append(document.createTextNode(String(a)));
}

/* ---------- student-safe text ---------- */
// Slide numbers, textbook sections and "outside source" notes are for the admin only.
export function clean(t) {
  if (canSeeRefs()) return String(t);
  let x = String(t)
    .replace(/^(?:Slides?|Textbook|Sed|Weathering)\s+[\d.]+[^:]{0,40}:\s*/i, "")
    .replace(/\s*\([^()]*(?:[Tt]extbook|[Ss]lides?\b|[Ll]ecture|outside source|[Ss]ed \d|[Ww]eathering \d|prof|[Mm]arshak)[^()]*\)/g, "");
  const REF = /\b(?:slides?|lectures?|text ?books?|books?|profs?|professor|marshak|clickers?|outside source)\b/i;
  const sents = x.split(/(?<=[.!?])\s+/);
  const kept = sents.filter((q) => !REF.test(q));
  x = kept.length ? kept.join(" ") : "";
  return x.replace(/\s{2,}/g, " ").trim();
}

// safe mini-markdown: **term** highlighted, *italic*; everything else is plain text
export function md(text) {
  const f = document.createDocumentFragment();
  clean(text).split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).forEach((p) => {
    if (p.startsWith("**")) f.append(h("span.term", p.slice(2, -2)));
    else if (p.startsWith("*") && p.length > 2) f.append(h("em", p.slice(1, -1)));
    else if (p) f.append(document.createTextNode(p));
  });
  return f;
}

/* ---------- icons (one consistent stroke style) ---------- */
const P = {
  home: "M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10",
  cards: "M4 7h13a2 2 0 012 2v9a2 2 0 01-2 2H4zM8 7V5a2 2 0 012-2h9a2 2 0 012 2v9",
  quiz: "M9 12l2 2 4-4M12 3a9 9 0 100 18 9 9 0 000-18z",
  notes: "M4 5a2 2 0 012-2h12v18H6a2 2 0 01-2-2zM8 7h6M8 11h6",
  games: "M6 11h4M8 9v4M15 12h.01M18 10h.01M17.3 5H6.7a4 4 0 00-4 4.3l.8 6a3 3 0 005 1.2L9 15h6l.5 1.5a3 3 0 005-1.2l.8-6a4 4 0 00-4-4.3z",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
  moon: "M21 13A9 9 0 1111 3a7 7 0 0010 10z",
  left: "M15 5l-7 7 7 7",
  right: "M9 5l7 7-7 7",
  down: "M5 9l7 7 7-7",
  up: "M5 15l7-7 7 7",
  list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  bulb: "M9 18h6M10 21h4M12 3a6 6 0 00-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0012 3z",
  brain: "M9 4a3 3 0 00-3 3 3 3 0 00-2 5 3 3 0 002 5 3 3 0 006 0V4a3 3 0 00-3 0zM15 4a3 3 0 013 3 3 3 0 012 5 3 3 0 01-2 5 3 3 0 01-6 0",
  alert: "M12 3l10 18H2zM12 10v5M12 18h.01",
  zoom: "M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-5-5M11 8v6M8 11h6",
  x: "M6 6l12 12M18 6L6 18",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z",
  fire: "M12 3c1 4 5 5 5 10a5 5 0 01-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-9z",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 100 6 3 3 0 000-6z",
  logout: "M9 4H5a2 2 0 00-2 2v12a2 2 0 002 2h4M16 8l4 4-4 4M20 12H9",
  /* subject and lecture symbols (same 2px stroke style) */
  globe: "M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c3.2 3 3.2 15 0 18M12 3c-3.2 3-3.2 15 0 18",
  telescope: "M3 15l13-7 2 4L5 19zM16 8l2-4 3 1.5-2 4M8 19l-2 3M12 17l2 5",
  layers: "M12 3l9 5-9 5-9-5zM3 12.5l9 5 9-5M3 17l9 5 9-5",
  plates: "M3 14l5-3 4 2 4-3 5 2v6H3zM3 9l4-3 5 2 4-2 5 3",
  gem: "M6 3h12l4 6-10 12L2 9zM2 9h20M9 3L7 9l5 12 5-12-2-6",
  volcano: "M3 21l6-12h6l6 12zM12 9V3M9.5 6L8 3M14.5 6L16 3",
  strata: "M3 6c3-2 6 2 9 0s6-2 9 0M3 11c3-2 6 2 9 0s6-2 9 0M3 16c3-2 6 2 9 0s6-2 9 0M3 21c3-2 6 2 9 0s6-2 9 0",
  gear: "M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1",
  hourglass: "M6 2h12M6 22h12M7 2c0 6 5 7 5 10s-5 4-5 10M17 2c0 6-5 7-5 10s5 4 5 10",
  spiral: "M12 12.5a.5.5 0 100-1M12 9.5a2.5 2.5 0 11-2.5 2.5M12 6a6 6 0 11-6 6M12 2.5a9.5 9.5 0 11-9.5 9.5",
  galaxy: "M12 11.5a.5.5 0 100 1M12 8c4 0 6 3 4 6-2 3-7 2-8-1M12 4c7 0 10 6 7 11-3 5-12 4-14-2",
  clock: "M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3.5 2",
  rocket: "M5 19l3-1 8-8c3-3 3-7 3-7s-4 0-7 3l-8 8zM14 10.5a1.2 1.2 0 100-.01M5 19c-1 1-2 3-2 3s2-1 3-2M8 14l2 2",
  bolt: "M13 2L4 14h7l-1 8 9-12h-7z",
  orbit: "M3 12c0-3.9 4-7 9-7s9 3.1 9 7-4 7-9 7-9-3.1-9-7zM12 10.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3zM19.2 7.7a1 1 0 100-.01",
  wave: "M2 12c2-6 4-6 6 0s4 6 6 0 4-6 6 0",
  atom: "M12 11a1 1 0 100 2 1 1 0 000-2z | M2 12a10 4 0 1020 0 10 4 0 10-20 0 | r60:M2 12a10 4 0 1020 0 10 4 0 10-20 0 | r120:M2 12a10 4 0 1020 0 10 4 0 10-20 0",
  ball: "M12 3a9 9 0 100 18 9 9 0 000-18zM12 9a3 3 0 100 6 3 3 0 000-6z",
  sort: "M7 4v16M7 4L4 7M7 4l3 3M17 20V4M17 20l-3-3M17 20l3-3",
  calc: "M5 3h14a1 1 0 011 1v16a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1zM8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01",
  exam: "M6 3h9l4 4v14H6zM14 3v5h5M9 13h6M9 17h4",
  trophy: "M8 4h8v6a4 4 0 01-8 0zM8 6H4v1a4 4 0 004 4M16 6h4v1a4 4 0 01-4 4M12 14v4M8 21h8M9 18h6",
  lock: "M6 11h12v10H6zM8 11V7a4 4 0 018 0v4M12 15v2",
};
// symbol shown for each subject and lecture (instead of emoji)
export const SYM = {
  erth209: "globe", astr207: "telescope",
  interior: "layers", plates: "plates", minerals: "gem", igneous: "volcano", sedimentary: "strata", metamorphism: "gear", strat: "hourglass", fossils: "spiral", biography: "globe",
  scale: "galaxy", timesky: "clock", motion: "rocket", conserve: "bolt", gravity: "orbit", light: "wave", matter: "atom",
};
export const symOf = (x) => SYM[x.id] || "star";
export function symTile(x, size = 52) {
  return h(".symtile", { style: `width:${size}px;height:${size}px`, "aria-hidden": "true" }, ic(symOf(x), Math.round(size * 0.52)));
}

export function ic(name, size = 20) {
  const NS = "http://www.w3.org/2000/svg", s = document.createElementNS(NS, "svg");
  s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("width", size); s.setAttribute("height", size);
  s.setAttribute("fill", "none"); s.setAttribute("stroke", "currentColor"); s.setAttribute("stroke-width", "2");
  s.setAttribute("stroke-linecap", "round"); s.setAttribute("stroke-linejoin", "round"); s.setAttribute("aria-hidden", "true");
  for (const part of (P[name] || P.star).split(" | ")) {
    const m = part.match(/^r(\d+):(.*)$/), p = document.createElementNS(NS, "path");
    p.setAttribute("d", m ? m[2] : part); if (m) p.setAttribute("transform", `rotate(${m[1]} 12 12)`);
    s.append(p);
  }
  return s;
}

/* ---------- toasts, shuffle, confetti ---------- */
let tt;
export function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(tt); tt = setTimeout(() => t.classList.remove("show"), 2200);
}
export function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export function confetti(n = 90) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const c = h("canvas.confetti"); c.width = innerWidth; c.height = innerHeight; document.body.append(c);
  const g = c.getContext("2d"), cols = ["#2563eb", "#7c3aed", "#f59e0b", "#10b981", "#ef4444", "#ec4899"];
  const ps = Array.from({ length: n }, () => ({ x: Math.random() * c.width, y: -20 - Math.random() * c.height * 0.4, r: 4 + Math.random() * 6, vx: -2 + Math.random() * 4, vy: 3 + Math.random() * 4, a: Math.random() * 6, c: cols[(Math.random() * cols.length) | 0] }));
  let f = 0;
  (function tick() {
    g.clearRect(0, 0, c.width, c.height);
    ps.forEach((p) => { p.x += p.vx; p.y += p.vy; p.a += 0.15; g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.fillStyle = p.c; g.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); g.restore(); });
    if (++f < 130) requestAnimationFrame(tick); else c.remove();
  })();
}
export const pick = (a, n) => shuffle(a.slice()).slice(0, n);
